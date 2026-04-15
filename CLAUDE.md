# PM Signal Intelligence

B2G product intelligence system. Monitors Slack, Salesforce, Gong, and Gmail for signals relevant to PM-defined strategic objectives.

## Architecture

```
Data Sources (Slack, Salesforce, Gong, Gmail)
        │
        ▼
  Cowork Plugin  ──▶  Monday.com Board (18407235431)
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

## Critical Constraint

**Claude (the Cowork plugin) can ONLY write to the Monday.com board.** Claude cannot read from or write to Supabase directly. All data flows through Monday:
- Signal matches → Monday board items
- Objective decompositions → Monday board items with `Source = "objective_decomposition"`
- New objectives created in the web app → Monday board items with `Source = "new_objective"` (auto-discovered by the plugin's daily task)
- Objective status changes from the web app → Monday board items with `Source = "objective_status_change"` (auto-discovered by the plugin's daily task)
- The app's sync cron routes decomposition and signal items to the correct Supabase tables; `new_objective` and `objective_status_change` markers are skipped by sync (they exist for the plugin to discover)

## Monday.com Board (18407235431)

| Column | Column ID | Type |
|---|---|---|
| PM UUID | `text_mm23fspz` | text |
| Objective ID | `text_mm23qar7` | text |
| Source | `text_mm238jbc` | text |
| Account | `text_mm23xscc` | text |
| Content Summary | `text_mm23eqyw` | text |
| Original Content | `long_text_mm23wnrf` | long_text |
| Source Language | `text_mm23f67y` | text |
| Speaker Role | `text_mm23vdkn` | text |
| Score | `numeric_mm23h4sr` | numeric |
| Explanation | `text_mm23983t` | text |
| Category | `color_mm23tcn7` | status |
| Urgency | `color_mm23vf2s` | status |
| Source Reference | `long_text_mm24w82p` | long_text |
| Source Timestamp | `text_mm242qzh` | text |
| Cluster ID | `text_mm247era` | text |
| Situation Summary | `text_mm24zxe` | text |
| Decomposition | `long_text_mm24fq7d` | long_text |
| Status | `color_mm23b9pc` | status |

## Data Flow

### Signal Collection
1. Plugin discovers new unenriched objectives from Monday board (`new_objective` markers)
2. Plugin reads from Slack, Salesforce, Gong, Gmail via MCP
3. Normalizes signals (signal-preprocessing skill)
4. Matches against objectives (signal-matching skill) with few-shot examples from feedback-learning
5. Clusters related signals (signal-clustering skill)
6. Writes items to Monday board

### Objective Creation
1. PM creates objective in web app (gets Supabase UUID)
2. Web app writes a `new_objective` marker item to Monday board (with PM UUID, Objective ID, title)
3. Plugin's daily task (or manual `/create-objective`) discovers the marker on Monday
4. Plugin enriches with decomposition (Salesforce context + LLM)
5. Plugin writes decomposition to Monday with `Source = "objective_decomposition"`
6. Plugin updates the `new_objective` marker's Status to `Enriched`
7. Sync cron detects decomposition item, updates objective's decomposition in Supabase

### Objective Status Changes
1. PM pauses, resolves, or reactivates objective in web app
2. Web app updates Supabase and writes an `objective_status_change` marker to Monday board
3. Plugin's daily task discovers the marker, updates objective status in project memory
4. Plugin marks the Monday marker item's Status as `Enriched`
5. Paused/resolved objectives are excluded from signal collection

### Monday → Supabase Sync (lib/sync-monday.ts)
1. Fetches items with Status = "Pending"
2. Separates decomposition items from signal items
3. Decomposition items → updates objectives.decomposition in Supabase
4. Signal items → groups by cluster_id, creates cluster records, upserts matches
5. Triggers rescore pipeline (lib/rescore.ts) using shared patterns + PM feedback

### Feedback Loop
1. PM confirms/dismisses signals in web app
2. App writes to Supabase (matches.feedback + pm_feedback table)
3. App syncs status back to Monday (Confirmed/Dismissed)
4. Plugin's feedback-learning skill reads these from Monday for few-shot examples and threshold calibration
5. On every sync, `lib/extract-patterns.ts` aggregates new `pm_feedback` rows into `shared_patterns` via a batched LLM call — feeding the next rescore's team-wide scoring adjustments

## Plugin Structure

### Skills (internal capabilities)
- `skills/objective-decomposition/` — Decompose objectives into monitoring criteria
- `skills/signal-preprocessing/` — Normalize raw data into standard format
- `skills/signal-matching/` — LLM scoring of signals against objectives
- `skills/signal-clustering/` — Group related signals into situations
- `skills/feedback-learning/` — Read feedback from Monday for learning loop

### Commands (PM-facing)
- `commands/create-objective.md` — Define new objective with decomposition and backfill
- `commands/collect-signals.md` — Daily pipeline: collect, match, cluster, write to Monday
- `commands/query.md` — Read-only natural language search across sources
- `commands/review-signals.md` — Preview matches from Monday board

## Supabase Tables
- `pm_profiles` — User accounts (Supabase Auth)
- `objectives` — PM objectives with decomposition JSON
- `matches` — Signals (synced from Monday, rescored by app)
- `clusters` — Grouped signals
- `pm_feedback` — Confirm/dismiss records
- `shared_patterns` — Cross-PM pattern confidence scores

## Tech Stack
- **Web app:** Next.js (App Router), TypeScript, Tailwind CSS, deployed on Vercel
- **Database:** Supabase (PostgreSQL + Auth + RLS)
- **Ingestion layer:** Monday.com board via MCP
- **LLM:** Claude Sonnet 4.6 (rescore pipeline)
- **Plugin:** Cowork plugin with skills/commands in markdown

## Key Files
- `lib/sync-monday.ts` — Monday → Supabase sync with cluster handling and decomposition routing
- `lib/rescore.ts` — LLM re-evaluation of matches post-sync (requires ≥3 feedback records for a pattern to influence scoring)
- `lib/extract-patterns.ts` — Aggregates `pm_feedback` into `shared_patterns` after every sync
- `lib/monday.ts` — Monday API client (fetch pending, update status)
- `app/actions/feedback.ts` — PM feedback + sync back to Monday
- `app/actions/objectives.ts` — Objective CRUD
- `pm-signal-intelligence-walkthrough.md` — Full setup guide
