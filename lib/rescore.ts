import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

const anthropic = new Anthropic();

interface UnscoredMatch {
  id: string;
  pm_id: string;
  objective_id: string;
  source: string;
  account: string | null;
  speaker_role: string | null;
  content_summary: string;
  original_content: string | null;
  relevance_score: number;
  explanation: string;
  category: string;
  urgency: string;
}

interface Objective {
  id: string;
  title: string;
  decomposition: Record<string, unknown>;
}

interface FeedbackExample {
  signal_content_summary: string | null;
  match_explanation: string | null;
  feedback_type: string;
}

interface SharedPattern {
  pattern_description: string;
  confidence: number;
}

interface RescoreResult {
  score: number;
  explanation: string;
  category: string;
  urgency: string;
}

function buildPrompt(
  match: UnscoredMatch,
  objective: Objective,
  confirmedExamples: FeedbackExample[],
  dismissedExamples: FeedbackExample[],
  highPatterns: SharedPattern[],
  lowPatterns: SharedPattern[]
): string {
  const decomp = objective.decomposition;
  const signalTypesPositive = (decomp.signal_types as string[])?.join(", ") ?? "";
  const signalTypesNegative = (decomp.signal_types_negative as string[])?.join(", ") ?? "";
  const entities = (decomp.entities_to_watch as string[])?.join(", ") ?? "";
  const accounts = (decomp.relevant_accounts as string[])?.join(", ") ?? "";

  let prompt = `You are evaluating whether a signal is relevant to a product manager's strategic objective at a B2G startup. Customers are city and county governments.

OBJECTIVE: ${objective.title}

POSITIVE SIGNAL TYPES (evidence of progress):
${signalTypesPositive}

NEGATIVE SIGNAL TYPES (evidence of risk):
${signalTypesNegative}

ENTITIES OF INTEREST:
${entities}

RELEVANT ACCOUNTS:
${accounts}`;

  if (highPatterns.length > 0) {
    prompt += `

SHARED INTELLIGENCE — HIGH-CONFIDENCE PATTERNS (>70% confirmation rate across the team):
${highPatterns.map((p) => `- ${p.pattern_description} (${Math.round(p.confidence * 100)}% confirmed)`).join("\n")}`;
  }

  if (lowPatterns.length > 0) {
    prompt += `

SHARED INTELLIGENCE — LOW-VALUE PATTERNS (>70% dismissal rate across the team):
${lowPatterns.map((p) => `- ${p.pattern_description} (${Math.round((1 - p.confidence) * 100)}% dismissed)`).join("\n")}`;
  }

  if (confirmedExamples.length > 0) {
    prompt += `

EXAMPLES THIS PM CONFIRMED AS RELEVANT:
${confirmedExamples.map((e) => `- "${e.signal_content_summary}" — ${e.match_explanation}`).join("\n")}`;
  }

  if (dismissedExamples.length > 0) {
    prompt += `

EXAMPLES THIS PM DISMISSED AS NOT RELEVANT:
${dismissedExamples.map((e) => `- "${e.signal_content_summary}" — ${e.match_explanation}`).join("\n")}`;
  }

  prompt += `

SIGNAL TO EVALUATE:
Source: ${match.source}
Account: ${match.account ?? "unknown"}
Speaker role: ${match.speaker_role ?? "unknown"}
Content: ${match.original_content ?? match.content_summary}

ORIGINAL PLUGIN ASSESSMENT:
Score: ${match.relevance_score}, Category: ${match.category}, Urgency: ${match.urgency}
Explanation: ${match.explanation}

SCORING:
- 9-10: PM must see this. Clear, specific, directly relevant.
- 7-8: Strong signal. PM should see this.
- 5-6: Moderate. Potentially useful context.
- 3-4: Weak. Tangentially related.
- 1-2: Not relevant.
- Customer statements score higher than internal statements for equivalent content.
- Multi-person threads carry more weight than single messages.
- Signals matching shared high-confidence patterns: +1-2 points.
- Signals matching shared low-value patterns: -2-3 points.

Re-evaluate this signal considering the shared patterns and PM feedback examples above. The plugin scored this without that context.

Respond with only this JSON object:
{
  "score": <number 0-10>,
  "explanation": "<one sentence in English>",
  "category": "opportunity" | "risk" | "info",
  "urgency": "act_now" | "this_week" | "background"
}`;

  return prompt;
}

async function callLLM(prompt: string): Promise<RescoreResult> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";
  const json = JSON.parse(text);

  return {
    score: Number(json.score),
    explanation: String(json.explanation),
    category: json.category,
    urgency: json.urgency,
  };
}

export async function rescoreNewMatches(): Promise<{ rescored: number }> {
  const supabase = createAdminClient();

  // Fetch matches that came from Monday sync and haven't been rescored
  const { data: matches, error: matchError } = await supabase
    .from("matches")
    .select(
      "id, pm_id, objective_id, source, account, speaker_role, content_summary, original_content, relevance_score, explanation, category, urgency"
    )
    .not("monday_item_id", "is", null)
    .is("rescored_at", null)
    .eq("feedback", "pending")
    .limit(50);

  if (matchError || !matches || matches.length === 0) {
    return { rescored: 0 };
  }

  // Collect unique PM and objective IDs
  const pmIds = [...new Set(matches.map((m) => m.pm_id))];
  const objectiveIds = [...new Set(matches.map((m) => m.objective_id))];

  // Fetch objectives
  const { data: objectives } = await supabase
    .from("objectives")
    .select("id, title, decomposition")
    .in("id", objectiveIds);

  const objectiveMap = new Map(
    (objectives ?? []).map((o) => [o.id, o as Objective])
  );

  // Fetch shared patterns
  const { data: patterns } = await supabase
    .from("shared_patterns")
    .select("pattern_description, confidence")
    .or("confidence.gt.0.7,confidence.lt.0.3");

  const highPatterns = (patterns ?? []).filter(
    (p) => p.confidence > 0.7
  ) as SharedPattern[];
  const lowPatterns = (patterns ?? []).filter(
    (p) => p.confidence < 0.3
  ) as SharedPattern[];

  // Fetch recent feedback per PM (5 confirmed + 5 dismissed each)
  const feedbackMap = new Map<
    string,
    { confirmed: FeedbackExample[]; dismissed: FeedbackExample[] }
  >();

  for (const pmId of pmIds) {
    const { data: confirmed } = await supabase
      .from("pm_feedback")
      .select("signal_content_summary, match_explanation, feedback_type")
      .eq("pm_id", pmId)
      .eq("feedback_type", "confirmed")
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: dismissed } = await supabase
      .from("pm_feedback")
      .select("signal_content_summary, match_explanation, feedback_type")
      .eq("pm_id", pmId)
      .eq("feedback_type", "dismissed")
      .order("created_at", { ascending: false })
      .limit(5);

    feedbackMap.set(pmId, {
      confirmed: (confirmed ?? []) as FeedbackExample[],
      dismissed: (dismissed ?? []) as FeedbackExample[],
    });
  }

  // Re-score each match
  let rescored = 0;

  for (const match of matches) {
    const objective = objectiveMap.get(match.objective_id);
    if (!objective) continue;

    const feedback = feedbackMap.get(match.pm_id) ?? {
      confirmed: [],
      dismissed: [],
    };

    try {
      const prompt = buildPrompt(
        match as UnscoredMatch,
        objective,
        feedback.confirmed,
        feedback.dismissed,
        highPatterns,
        lowPatterns
      );

      const result = await callLLM(prompt);

      await supabase
        .from("matches")
        .update({
          relevance_score: result.score,
          explanation: result.explanation,
          category: result.category,
          urgency: result.urgency,
          rescored_at: new Date().toISOString(),
        })
        .eq("id", match.id);

      rescored++;
    } catch {
      // Mark as rescored even on failure to avoid retrying bad data indefinitely
      await supabase
        .from("matches")
        .update({ rescored_at: new Date().toISOString() })
        .eq("id", match.id);
    }
  }

  return { rescored };
}
