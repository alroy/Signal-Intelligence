# PM Signal Intelligence

A B2G product intelligence system. It monitors Slack, Salesforce, Gong, and Gmail for signals relevant to PM-defined strategic objectives, scores them, clusters related signals into situations, and presents a daily review queue. PMs confirm or dismiss each signal, and that feedback compounds across the team so the system gets sharper the more PMs use it.

This README focuses on **how data flows through the system** and **the network effect** — what gets better for every PM as more PMs join. For setup, see [`pm-signal-intelligence-walkthrough.md`](pm-signal-intelligence-walkthrough.md). For Claude-plugin context, see [`CLAUDE.md`](CLAUDE.md).

---

## Architecture

```
Data Sources (Slack, Salesforce, Gong, Gmail)
        │
        ▼
  Cowork Plugin  ──▶  Monday.com Board (18407235431, shared across all PMs)
                              │
                              ▼
                     Sync Cron (lib/sync-monday.ts)
                              │
                              ▼
                        Supabase DB  ◀──  Rescore Pipeline (lib/rescore.ts)
                              │
                              ▼
                         Next.js Web App (Vercel)
                         (Review & Feedback ──▶ syncs status back to Monday)
```

Two key constraints shape the design:

- **The plugin can only write to Monday.** Claude (the Cowork plugin) has no direct access to Supabase. Monday is the handoff between the plugin's write path and the app's read path.
- **The Monday board is shared.** One board holds signals for every PM, tagged by PM UUID. This shared surface is what enables the network effect described below.

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
5. Trigger the rescore pipeline.

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

### 6. Objective status changes

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

The rescore pipeline pulls shared patterns on every run ([`lib/rescore.ts:190-201`](lib/rescore.ts)) and injects them into the Claude prompt ([`lib/rescore.ts:75-86`](lib/rescore.ts)):

- Patterns with **>70% team-wide confirmation** are tagged as high-confidence and add **+1-2 points** to matching signals ([`lib/rescore.ts:123`](lib/rescore.ts)).
- Patterns with **>70% team-wide dismissal** are tagged as low-value and subtract **-2-3 points** from matching signals ([`lib/rescore.ts:124`](lib/rescore.ts)).

Every time a PM confirms or dismisses a signal, that judgment feeds back into the team-wide confidence score of the pattern it matches. So a noisy signal category that PM A has dismissed fifteen times will automatically score lower for PM B the first time it appears — PM B never has to train it out themselves.

### How it improves matching on the plugin side

The [`feedback-learning`](skills/feedback-learning/) skill reads the Monday board's Confirmed/Dismissed history for every run of `collect-signals`. It:

- Pulls 5 confirmed and 5 dismissed few-shot examples into the signal-matching prompt.
- Analyzes confirmation rate by score band to flag a miscalibrated threshold.

Because the board is shared, the examples and calibration draw from the whole team's activity, not just the running PM's own history.

### How it improves coverage

- **Account and entity overlap.** When PMs' objectives touch the same customer accounts, the plugin's cluster IDs and `account` fields already connect their signals. A Gong call the plugin surfaced for PM A can become relevant context for PM B's objective on the same account.
- **Clustering heuristics.** More PMs means more clusters and more training signal for the clustering skill's situation-summary generation.
- **Entity dictionaries.** Objective decompositions list entities to watch (features, competitors, personas), multilingual. As more objectives land on the board, the effective dictionary the plugin scans against grows.

### Net effect

- **PM #1** ships with generic scoring, no shared patterns, and a cold feedback history.
- **PM #10** inherits a `shared_patterns` table calibrated by nine other PMs' confirm/dismiss activity, an entity dictionary that already covers the accounts and features the team cares about, and a plugin that has seen thousands of real examples of what "relevant" and "not relevant" look like in this org.

The product is useful on day one for a single PM. It gets meaningfully better — measurable in score precision and review-queue noise reduction — with each additional PM who starts reviewing signals.

---

## Key files

### Web app
- [`lib/sync-monday.ts`](lib/sync-monday.ts) — Monday → Supabase sync: pending fetch, decomposition routing, cluster creation, match upsert.
- [`lib/rescore.ts`](lib/rescore.ts) — LLM rescore with shared patterns and per-PM feedback examples.
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
