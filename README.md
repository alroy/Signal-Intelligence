# PM Signal Intelligence

A B2G product intelligence system. It monitors Slack, Salesforce, Gong, and Gmail for signals relevant to PM-defined strategic objectives, scores them, clusters related signals into situations, and presents a daily review queue. PMs confirm or dismiss each signal, and that feedback compounds across the team so the system gets sharper the more PMs use it.

This README focuses on **how data flows through the system** and **the network effect** — what gets better for every PM as more PMs join. For setup, see [`pm-signal-intelligence-walkthrough.md`](pm-signal-intelligence-walkthrough.md). For Claude-plugin context, see [`CLAUDE.md`](CLAUDE.md).

---

## Architecture

### End-to-end data flow including Learning loop (the network effect)

<img width="2752" height="1536" alt="Blueprint" src="https://github.com/user-attachments/assets/ae1b4623-b251-4f1a-b31b-b1688eb3f941" />


Two key constraints shape the design:

- **The plugin can only write to Monday.** Claude (the Cowork plugin) has no direct access to Supabase. Monday is the handoff between the plugin's write path and the app's read path.
- **The Monday board is shared.** One board holds signals for every PM, tagged by PM UUID. This shared surface is what enables the network effect described below.

### Why this shape?

- **Plugin writes only to Monday.** The Cowork plugin runs in Claude Desktop over MCP; it has no Supabase credentials. Monday is the asynchronous handoff, and doubles as a human-readable audit trail that PMs can spot-check.
- **Rescore exists as a second scoring pass.** The plugin cannot read `shared_patterns` (no Supabase access). Rescore is the only place where team-wide learning can be applied before a PM sees a signal — so the plugin's initial score and the app's rescored score are allowed to diverge intentionally.
- **Pattern extraction runs after rescore, not at feedback time.** Extraction uses LLM calls; running it on every confirm/dismiss would block the web UI. Batching on the sync cadence (every 6 hours by default) is cheap and gives Claude a wider batch to find cross-record themes in.
- **Minimum-evidence threshold (≥3).** In [`lib/rescore.ts`](lib/rescore.ts), a pattern must have ≥3 total confirm/dismiss records AND confidence `>0.7` or `<0.3` to influence scoring. This prevents a single PM's one-off judgment from cascading across the team before it is validated.

### Trust boundaries

- **Per-PM data stays per-PM.** RLS on `objectives`, `matches`, `pm_feedback`, and `clusters` restricts SELECT / INSERT / UPDATE to rows where `auth.uid() = pm_id`. No PM can read another PM's raw signals, feedback records, or objectives through the web app.
- **`shared_patterns` is the only cross-PM read surface.** RLS is `using (true)`. What the table exposes is deliberately minimal: a `pattern_description` (a generic phrase like *"Customer in Gong call mentions Q4 budget cycle"*), aggregate `confirmations`/`dismissals` counts, and a `contributing_pm_ids` list. No raw signal content, account names, or feedback explanations cross the PM boundary — only the abstracted pattern itself.

---

## Data flow

### 1. Objective creation

1. PM creates an objective in the web app. Supabase assigns a UUID ([`app/actions/objectives.ts`](app/actions/objectives.ts)).
2. The app writes a `new_objective` marker item to the Monday board with the PM UUID, objective ID, and title.
3. On its next daily run, the plugin discovers the marker, uses the [`objective-decomposition`](skills/objective-decomposition/) skill to turn the natural-language objective into structured criteria (signal types, entities to watch, Salesforce filters), and writes a `objective_decomposition` item back to Monday.
4. The plugin flips the marker's status to `Enriched`. On the next sync, [`lib/sync-monday.ts`](lib/sync-monday.ts) routes the decomposition into `objectives.decomposition` in Supabase.
5. The plugin also runs a 90-day backfill of existing signals against the new objective.

### 2. Signal collection

Runs daily via the plugin's [`commands/collect-signals.md`](commands/collect-signals.md) command:

1. [`signal-preprocessing`](skills/signal-preprocessing/) normalizes raw data from Slack, Salesforce, Gong, and Gmail into a standard JSON shape (source, timestamp, account, English summary, original content, speaker role, deeplink).
2. [`signal-matching`](skills/signal-matching/) scores each signal against the PM's objective with an LLM prompt that includes the decomposition and per-PM few-shot examples from feedback-learning. Output: relevance score (0-10), explanation, category (opportunity/risk/info), urgency.
3. [`signal-clustering`](skills/signal-clustering/) groups related matches by account and theme within a 72-hour window. Every item in a cluster shares the same `cluster_id` and a one-sentence `situation_summary`.
4. Each match becomes an item on the shared Monday board.

### 3. Monday → Supabase sync

[`lib/sync-monday.ts`](lib/sync-monday.ts), driven by a cron on Vercel:

1. Fetches all items on board `18407235431` with `Status = "Pending"` via [`lib/monday.ts`](lib/monday.ts).
2. Routes by `Source` field:
   - `objective_decomposition` → update the corresponding row in `objectives`.
   - `new_objective` / `objective_status_change` → skip (these are plugin-discovery markers, not signals).
   - Everything else → treat as a signal match.
3. For each distinct `cluster_id`, create a row in `clusters` (if new) and map the plugin's cluster ID to a Supabase UUID.
4. Upsert the signal items into `matches` with the resolved cluster UUID and `feedback = "pending"`.
5. Trigger the rescore pipeline and then the pattern-extraction pipeline.

### 4. Rescore

[`lib/rescore.ts`](lib/rescore.ts) — the intelligence layer where team-wide learning is applied.

For every newly synced, un-rescored match, the pipeline:

1. Loads the objective's decomposition.
2. Loads **shared patterns** with `confidence > 0.7` or `confidence < 0.3` from the `shared_patterns` table.
3. Loads the current PM's 5 most-recent confirmed and 5 most-recent dismissed matches as few-shot examples.
4. Asks Claude Sonnet 4.6 to re-evaluate the signal with that context. The prompt rules include `+1-2 points` for signals matching shared high-confidence patterns and `-2-3 points` for signals matching shared low-value patterns.
5. Writes the new `score`, `explanation`, `category`, `urgency`, and a `rescored_at` timestamp back to the `matches` row.

Because the plugin scored the signal without shared-pattern context, the number a PM sees in the web app often differs from the number on the Monday board. The rescore is where cross-PM learning enters the loop.

### 5. Review and feedback

1. PM opens the web app and sees rescored matches grouped by cluster, with the situation summary as the header.
2. PM clicks Confirm or Dismiss ([`app/actions/feedback.ts`](app/actions/feedback.ts)).
3. The action writes a row to `pm_feedback`, updates `matches.feedback` and `matches.feedback_at`, and — if the match has a `monday_item_id` — syncs the status back to Monday so the plugin can learn from it on its next run.
4. The plugin's [`feedback-learning`](skills/feedback-learning/) skill reads these statuses from the board for the next collection run's few-shot examples and score-threshold calibration.

### 6. Pattern extraction

[`lib/extract-patterns.ts`](lib/extract-patterns.ts) — turns per-PM feedback into team-wide patterns. Runs after rescore on every sync.

1. Fetches `pm_feedback` rows where `pattern_extracted_at IS NULL` (oldest 30 first), joined with their match context (source, speaker role, category, summary, explanation).
2. Loads the 100 most-recently-updated `shared_patterns` rows to give Claude a reference list.
3. Sends one batched call to Claude Sonnet 4.6. Claude returns, for each feedback record: `match_existing` (bind to an existing pattern id), `create_new` (propose a pattern, reusing the exact same description when multiple records in the batch share a theme), or `skip` (idiosyncratic).
4. Runs a second-pass dedup. For each proposed new pattern, Claude is asked whether it duplicates any existing pattern in the same `source_type` + `category` bucket. Duplicates are folded into the existing pattern's count so paraphrases never create near-duplicate rows.
5. Aggregates the decisions: increments `confirmations`/`dismissals` on matched patterns, merges the PM into `contributing_pm_ids`, and inserts the remaining new pattern rows with seeded counts.
6. Marks every decided feedback row as `pattern_extracted_at = now()` so it is not reprocessed.

### 7. Objective status changes

1. PM pauses or resolves an objective in the web app. The app updates Supabase and writes an `objective_status_change` marker to Monday.
2. The plugin's daily run discovers the marker, updates its local project memory, and flips the marker to `Enriched`.
3. Paused and resolved objectives are excluded from subsequent signal collection until reactivated.

---

## Network effect — why the system gets sharper as more PMs join

The shared components of the stack — the Monday board, the `shared_patterns` table, the `pm_feedback` history, and the rescore pipeline — mean that every PM's review activity produces value for every other PM, not just for themselves.

### What is shared

- **The Monday board.** One board, one column schema, one cluster namespace. Every PM's raw signals and feedback live on the same surface, tagged by `PM UUID`.
- **Shared patterns** (`shared_patterns` table, RLS-readable by all PMs). Each row is a `pattern_description` with a running count of `confirmations` and `dismissals` and a derived `confidence` score, plus the list of PM IDs that contributed to it.
- **PM feedback** (`pm_feedback`). Individual confirm/dismiss records that also feed the shared-pattern aggregation.

### How it improves scoring for everyone

The loop has two halves: **extraction** writes team-wide patterns; **rescore** applies them.

**Extraction** ([`lib/extract-patterns.ts`](lib/extract-patterns.ts)) runs after every sync. It batches recent `pm_feedback` records from every PM and asks Claude to group them into reusable patterns. A pattern that PMs A, B, and C each dismissed three times becomes a `shared_patterns` row with 9 dismissals and a 0.0 confidence score.

**Rescore** ([`lib/rescore.ts`](lib/rescore.ts)) pulls patterns with at least 3 total feedback records and a `confidence > 0.7` or `< 0.3`, then injects them into the Claude prompt:

- Patterns with **>70% team-wide confirmation** are tagged as high-confidence and add **+1-2 points** to matching signals.
- Patterns with **>70% team-wide dismissal** are tagged as low-value and subtract **-2-3 points** from matching signals.

The minimum-evidence threshold (≥3 records) stops a single PM's one-off judgment from distorting scores for everyone. Once a pattern has enough support, it starts shifting scores on every future match across the team.

Concretely: a noisy signal category that PMs A, B, and C have collectively dismissed fifteen times will automatically score lower for PM D the first time it appears — PM D never has to train it out themselves.

### How it improves matching on the plugin side

The [`feedback-learning`](skills/feedback-learning/) skill reads the Monday board's Confirmed/Dismissed history for every run of `collect-signals`. It:

- Pulls 5 confirmed and 5 dismissed few-shot examples into the signal-matching prompt.
- Analyzes confirmation rate by score band to flag a miscalibrated threshold.

Because the board is shared, the examples and calibration draw from the whole team's activity, not just the running PM's own history.

### How it improves coverage

- **Account and entity overlap.** When PMs' objectives touch the same customer accounts, the plugin's cluster IDs and `account` fields already connect their signals. A Gong call the plugin surfaced for PM A can become relevant context for PM B's objective on the same account.
- **Clustering heuristics.** More PMs means more clusters and more training signal for the clustering skill's situation-summary generation.
- **Entity dictionaries.** Objective decompositions list entities to watch (features, competitors, personas), multilingual. As more objectives land on the board, the effective dictionary the plugin scans against grows.

### When the network effect activates

- **Solo PM.** Even with one PM, the loop starts working diagonally. After ~3 same-theme confirms or dismisses, extraction seeds a `shared_patterns` row whose counts cross the evidence threshold. Rescore then applies that pattern to future matches — the PM's own reviewing teaches their own scorer.
- **Second PM joins.** Because `shared_patterns` has `using (true)` RLS, PM #2's first rescore immediately pulls PM #1's accumulated patterns. `contributing_pm_ids` is metadata only — it doesn't gate read access. Cross-PM compounding activates the moment a second PM's rescore runs against any pattern that already has evidence.
- **The threshold that matters is not "# of PMs" — it's "# of feedback records per pattern".** Scale along either axis (more feedback from fewer PMs, or less feedback from more PMs) and the effect compounds the same way.

### Net effect

- **PM #1** ships with generic scoring, an empty `shared_patterns` table, and a cold feedback history. The extraction pipeline starts forming patterns as soon as they confirm or dismiss a few signals, but nothing team-wide exists yet.
- **PM #10** inherits a `shared_patterns` table calibrated by nine other PMs' confirm/dismiss activity, an entity dictionary that already covers the accounts and features the team cares about, and a plugin that has seen thousands of real examples of what "relevant" and "not relevant" look like in this org.

The product is useful on day one for a single PM. It gets meaningfully better — measurable in score precision and review-queue noise reduction — with each additional PM who starts reviewing signals.

---

## Key files

### Web app
- [`lib/sync-monday.ts`](lib/sync-monday.ts) — Monday → Supabase sync: pending fetch, decomposition routing, cluster creation, match upsert. Triggers rescore + pattern extraction.
- [`lib/rescore.ts`](lib/rescore.ts) — LLM rescore with shared patterns (≥3 evidence) and per-PM feedback examples.
- [`lib/extract-patterns.ts`](lib/extract-patterns.ts) — Batched LLM pipeline that aggregates `pm_feedback` into `shared_patterns` rows.
- [`lib/monday.ts`](lib/monday.ts) — Monday GraphQL client: fetch pending items, update status.
- [`app/actions/feedback.ts`](app/actions/feedback.ts) — Confirm/dismiss handler; writes to Supabase and syncs status back to Monday.
- [`app/actions/objectives.ts`](app/actions/objectives.ts) — Objective CRUD; emits `new_objective` and `objective_status_change` markers to Monday.

### Plugin
- [`commands/collect-signals.md`](commands/collect-signals.md) — Daily pipeline entrypoint.
- [`commands/create-objective.md`](commands/create-objective.md) — Define an objective + run backfill.
- [`commands/query.md`](commands/query.md) — Read-only natural-language search across sources.
- [`commands/review-signals.md`](commands/review-signals.md) — Preview matches from the Monday board.
- [`skills/objective-decomposition/`](skills/objective-decomposition/) — Structured decomposition of a natural-language objective.
- [`skills/signal-preprocessing/`](skills/signal-preprocessing/) — Normalize raw source data.
- [`skills/signal-matching/`](skills/signal-matching/) — Per-signal LLM relevance scoring.
- [`skills/signal-clustering/`](skills/signal-clustering/) — Group related matches into situations.
- [`skills/feedback-learning/`](skills/feedback-learning/) — Read confirm/dismiss history for few-shot examples and threshold calibration.

### Docs
- [`CLAUDE.md`](CLAUDE.md) — Architecture reference for the Claude plugin.
- [`pm-signal-intelligence-walkthrough.md`](pm-signal-intelligence-walkthrough.md) — End-to-end setup guide (Supabase, OAuth, Claude Desktop, Cowork plugin, Monday board, cron).
- [`docs/getting-started.md`](docs/getting-started.md) — Shorter onboarding notes.

---

## Tech stack

- **Web app:** Next.js (App Router), TypeScript, Tailwind CSS, deployed on Vercel.
- **Database:** Supabase (PostgreSQL + Auth + RLS).
- **Ingestion surface:** Monday.com board via MCP.
- **LLM:** Claude Sonnet 4.6 (rescore pipeline).
- **Plugin:** Cowork plugin with skills and commands in markdown.

---

## Supabase tables

- `pm_profiles` — Supabase Auth user accounts.
- `objectives` — PM objectives with decomposition JSON.
- `matches` — Signals synced from Monday and rescored by the app.
- `clusters` — Grouped signals with situation summary.
- `pm_feedback` — Confirm/dismiss records.
- `shared_patterns` — Cross-PM pattern confidence scores used by the rescore pipeline.
