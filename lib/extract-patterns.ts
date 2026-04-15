import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

// Pattern extraction pipeline.
//
// Runs after rescore on every sync. Reads unprocessed rows from pm_feedback,
// asks Claude Sonnet 4.6 to group them by theme (either matching existing
// shared_patterns rows or proposing new ones), then aggregates confirm/dismiss
// counts into shared_patterns. This is the write path that closes the
// network-effect loop: feedback from any PM becomes input to every other PM's
// rescore on the next sync.

const anthropic = new Anthropic();

const BATCH_LIMIT = 30;
const EXISTING_PATTERNS_LIMIT = 100;

interface FeedbackRecord {
  id: string;
  pm_id: string;
  feedback_type: "confirmed" | "dismissed";
  source: string;
  speaker_role: string | null;
  category: string;
  content_summary: string;
  match_explanation: string;
}

interface ExistingPattern {
  id: string;
  pattern_description: string;
  source_type: string;
  category: string | null;
  confirmations: number;
  dismissals: number;
}

interface NewPatternProposal {
  pattern_description: string;
  source_type: string;
  source_subtype: string | null;
  category: string;
}

type ExtractionDecision =
  | { feedback_id: string; action: "match_existing"; pattern_id: string }
  | { feedback_id: string; action: "create_new"; new_pattern: NewPatternProposal }
  | { feedback_id: string; action: "skip" };

function buildPrompt(
  feedback: FeedbackRecord[],
  patterns: ExistingPattern[]
): string {
  const existingList =
    patterns.length > 0
      ? patterns
          .map(
            (p) =>
              `- id=${p.id} | "${p.pattern_description}" (source=${p.source_type}, category=${p.category ?? "null"}, confirmed=${p.confirmations}, dismissed=${p.dismissals})`
          )
          .join("\n")
      : "(none yet — this is the first extraction run)";

  const feedbackList = feedback
    .map(
      (f) =>
        `- id=${f.id} | ${f.feedback_type} | source=${f.source} | speaker=${f.speaker_role ?? "unknown"} | category=${f.category}
  summary: "${f.content_summary}"
  why: "${f.match_explanation}"`
    )
    .join("\n");

  return `You identify recurring patterns in product manager feedback for a B2G signal intelligence system. Patterns help score future signals: patterns with high confirmation rates boost scores, patterns with high dismissal rates suppress them.

EXISTING PATTERNS:
${existingList}

NEW FEEDBACK RECORDS TO CLASSIFY:
${feedbackList}

For each feedback record, decide one of:
A) match_existing — the record fits an existing pattern. Return that pattern's id.
B) create_new — the record fits a theme shared with at least one other record in this batch. Propose a new pattern. Use the EXACT same pattern_description (word for word) for every record that shares the theme so they aggregate into one row.
C) skip — the record is idiosyncratic (no other record in the batch shares its theme, no existing pattern fits). Do not invent a pattern for a single record.

Rules for new patterns:
- pattern_description must be specific enough to apply to future signals.
  Good: "Customer in Gong call mentions budget cycle ending in Q4"
  Bad: "Budget signal"
- source_type must be one of: slack, salesforce, gong, gmail
- category must be one of: opportunity, risk, info
- source_subtype is optional (e.g., "customer", "internal", or null)

Respond with ONLY a JSON array, no markdown fences, no prose. Every feedback id must appear exactly once.

[
  {"feedback_id": "...", "action": "match_existing", "pattern_id": "..."},
  {"feedback_id": "...", "action": "create_new", "new_pattern": {"pattern_description": "...", "source_type": "...", "source_subtype": null, "category": "..."}},
  {"feedback_id": "...", "action": "skip"}
]`;
}

async function classifyBatch(
  feedback: FeedbackRecord[],
  patterns: ExistingPattern[]
): Promise<ExtractionDecision[]> {
  const prompt = buildPrompt(feedback, patterns);
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error("Pattern extractor returned non-array response");
  }
  return parsed as ExtractionDecision[];
}

// Second-pass dedup. The batched classifier sees up to EXISTING_PATTERNS_LIMIT
// patterns ranked by recency; it can still paraphrase an existing pattern when
// the match is subtle. Before we insert a new row, re-check the proposal
// against every existing pattern that shares its source_type and category
// (categories ["opportunity","risk","info"] cut the search space by ~3x
// and source_type by another ~4x, so buckets stay small).
//
// If Claude says the proposal is a duplicate, we return the matched id so the
// caller can re-route the proposal's feedback into an existing-pattern
// increment instead of creating a new row.
async function findDuplicateOfProposal(
  proposal: NewPatternProposal,
  allExistingPatterns: ExistingPattern[]
): Promise<string | null> {
  const candidates = allExistingPatterns.filter(
    (p) =>
      p.source_type === proposal.source_type &&
      (p.category ?? "") === (proposal.category ?? "")
  );

  if (candidates.length === 0) return null;

  const prompt = `Decide whether a NEW pattern proposal describes the same phenomenon as any EXISTING pattern.

Two patterns are duplicates if a product manager would confirm or dismiss signals for the same underlying reason. Paraphrases, reorderings, and different levels of specificity of the same theme count as duplicates. Different themes within the same category do not.

NEW PROPOSAL:
"${proposal.pattern_description}"
(source_type=${proposal.source_type}, category=${proposal.category})

EXISTING PATTERNS (same source_type and category):
${candidates.map((p) => `- id=${p.id} | "${p.pattern_description}"`).join("\n")}

If the proposal is a duplicate of one existing pattern, respond with ONLY that pattern's id.
If the proposal is genuinely new, respond with ONLY the word: none

No prose, no quotes, no explanation.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 64,
    messages: [{ role: "user", content: prompt }],
  });

  const raw =
    message.content[0].type === "text" ? message.content[0].text : "";
  const answer = raw.trim().replace(/^["']|["']$/g, "");

  if (!answer || answer.toLowerCase() === "none") return null;

  // Claude might return a hallucinated id; only accept ids we showed it.
  const match = candidates.find((p) => p.id === answer);
  return match ? match.id : null;
}

export async function extractPatternsFromFeedback(): Promise<{
  processed: number;
  new_patterns: number;
  existing_updated: number;
}> {
  const supabase = createAdminClient();

  // Fetch unprocessed feedback (oldest first, so we catch up fairly).
  const { data: feedbackRows, error: feedbackError } = await supabase
    .from("pm_feedback")
    .select("id, pm_id, feedback_type, match_id")
    .is("pattern_extracted_at", null)
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (feedbackError || !feedbackRows || feedbackRows.length === 0) {
    return { processed: 0, new_patterns: 0, existing_updated: 0 };
  }

  // Fetch match context for those feedback rows.
  const matchIds = feedbackRows.map((r) => r.match_id);
  const { data: matchRows } = await supabase
    .from("matches")
    .select("id, source, speaker_role, category, content_summary, explanation")
    .in("id", matchIds);

  const matchById = new Map(
    (matchRows ?? []).map((m) => [m.id as string, m])
  );

  const feedback: FeedbackRecord[] = [];
  for (const row of feedbackRows) {
    const match = matchById.get(row.match_id as string);
    if (!match) continue;
    if (row.feedback_type !== "confirmed" && row.feedback_type !== "dismissed") {
      continue;
    }
    feedback.push({
      id: row.id as string,
      pm_id: row.pm_id as string,
      feedback_type: row.feedback_type as "confirmed" | "dismissed",
      source: match.source as string,
      speaker_role: (match.speaker_role as string | null) ?? null,
      category: match.category as string,
      content_summary: match.content_summary as string,
      match_explanation: match.explanation as string,
    });
  }

  if (feedback.length === 0) {
    return { processed: 0, new_patterns: 0, existing_updated: 0 };
  }

  // Fetch existing patterns. The first-pass classifier only sees the top N by
  // recency (keeps the batched prompt bounded), but the dedup pass below
  // considers ALL patterns within the same source_type+category bucket, so an
  // older-but-relevant pattern still prevents duplicate creation.
  const { data: allPatternRows } = await supabase
    .from("shared_patterns")
    .select("id, pattern_description, source_type, category, confirmations, dismissals")
    .order("updated_at", { ascending: false });

  const allExistingPatterns = (allPatternRows ?? []) as ExistingPattern[];
  const existingPatterns = allExistingPatterns.slice(0, EXISTING_PATTERNS_LIMIT);

  // Ask Claude to classify.
  let decisions: ExtractionDecision[];
  try {
    decisions = await classifyBatch(feedback, existingPatterns);
  } catch {
    // If classification fails, leave feedback unprocessed so a future run retries.
    return { processed: 0, new_patterns: 0, existing_updated: 0 };
  }

  const feedbackById = new Map(feedback.map((f) => [f.id, f]));

  // Aggregate existing-pattern increments so we do one UPDATE per pattern.
  const existingUpdates = new Map<
    string,
    {
      confirmations: number;
      dismissals: number;
      contributing_pms: Set<string>;
    }
  >();

  // Group new-pattern proposals by pattern_description so duplicates in the
  // same batch become one row with summed counts.
  const newGroups = new Map<
    string,
    {
      proposal: NewPatternProposal;
      confirmed_pms: string[];
      dismissed_pms: string[];
    }
  >();

  const processedIds: string[] = [];
  const existingPatternIds = new Set(existingPatterns.map((p) => p.id));

  for (const decision of decisions) {
    const fb = feedbackById.get(decision.feedback_id);
    if (!fb) continue;

    if (decision.action === "skip") {
      processedIds.push(fb.id);
      continue;
    }

    if (decision.action === "match_existing") {
      if (!existingPatternIds.has(decision.pattern_id)) {
        // Claude hallucinated a pattern id; drop this decision, let it retry.
        continue;
      }
      const agg = existingUpdates.get(decision.pattern_id) ?? {
        confirmations: 0,
        dismissals: 0,
        contributing_pms: new Set<string>(),
      };
      if (fb.feedback_type === "confirmed") agg.confirmations += 1;
      else agg.dismissals += 1;
      agg.contributing_pms.add(fb.pm_id);
      existingUpdates.set(decision.pattern_id, agg);
      processedIds.push(fb.id);
      continue;
    }

    if (decision.action === "create_new") {
      const proposal = decision.new_pattern;
      if (!proposal?.pattern_description || !proposal.source_type || !proposal.category) {
        continue;
      }
      const key = proposal.pattern_description.trim().toLowerCase();
      const group = newGroups.get(key) ?? {
        proposal,
        confirmed_pms: [] as string[],
        dismissed_pms: [] as string[],
      };
      if (fb.feedback_type === "confirmed") group.confirmed_pms.push(fb.pm_id);
      else group.dismissed_pms.push(fb.pm_id);
      newGroups.set(key, group);
      processedIds.push(fb.id);
    }
  }

  // Second-pass dedup: for each proposed new pattern, ask Claude whether it
  // duplicates an existing pattern in the same source_type+category bucket.
  // If yes, fold the proposal's feedback into the existing pattern's update
  // aggregation and remove it from the insert list. This prevents near-
  // duplicate rows like "Customer mentions Q4 budget" vs "Q4 budget cycle
  // mentioned by customer" from accumulating over time.
  for (const [key, group] of Array.from(newGroups.entries())) {
    let matchedId: string | null = null;
    try {
      matchedId = await findDuplicateOfProposal(
        group.proposal,
        allExistingPatterns
      );
    } catch {
      // Dedup is a best-effort pass; on error, leave the proposal as-is and
      // the insert loop will create a new row.
      continue;
    }

    if (!matchedId) continue;

    const agg = existingUpdates.get(matchedId) ?? {
      confirmations: 0,
      dismissals: 0,
      contributing_pms: new Set<string>(),
    };
    agg.confirmations += group.confirmed_pms.length;
    agg.dismissals += group.dismissed_pms.length;
    for (const pm of group.confirmed_pms) agg.contributing_pms.add(pm);
    for (const pm of group.dismissed_pms) agg.contributing_pms.add(pm);
    existingUpdates.set(matchedId, agg);

    newGroups.delete(key);
  }

  // Update existing patterns.
  let existingUpdated = 0;
  for (const [patternId, agg] of existingUpdates) {
    const { data: currentRow } = await supabase
      .from("shared_patterns")
      .select("confirmations, dismissals, contributing_pm_ids")
      .eq("id", patternId)
      .single();

    if (!currentRow) continue;

    const mergedPms = new Set<string>([
      ...((currentRow.contributing_pm_ids as string[] | null) ?? []),
      ...agg.contributing_pms,
    ]);

    const { error } = await supabase
      .from("shared_patterns")
      .update({
        confirmations: (currentRow.confirmations as number) + agg.confirmations,
        dismissals: (currentRow.dismissals as number) + agg.dismissals,
        contributing_pm_ids: Array.from(mergedPms),
      })
      .eq("id", patternId);

    if (!error) existingUpdated++;
  }

  // Insert new patterns.
  let newPatternsCreated = 0;
  for (const group of newGroups.values()) {
    const contributingPms = Array.from(
      new Set<string>([...group.confirmed_pms, ...group.dismissed_pms])
    );

    const { error } = await supabase.from("shared_patterns").insert({
      pattern_description: group.proposal.pattern_description,
      source_type: group.proposal.source_type,
      source_subtype: group.proposal.source_subtype,
      category: group.proposal.category,
      confirmations: group.confirmed_pms.length,
      dismissals: group.dismissed_pms.length,
      contributing_pm_ids: contributingPms,
    });

    if (!error) newPatternsCreated++;
  }

  // Mark every decided feedback record as processed. Skipped records are also
  // marked so we don't reprocess them on every run — if the same theme recurs
  // later, Claude will see enough records in a future batch to create a pattern.
  if (processedIds.length > 0) {
    await supabase
      .from("pm_feedback")
      .update({ pattern_extracted_at: new Date().toISOString() })
      .in("id", processedIds);
  }

  return {
    processed: processedIds.length,
    new_patterns: newPatternsCreated,
    existing_updated: existingUpdated,
  };
}
