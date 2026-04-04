# How the Signal Intelligence App Works

## Context

Signal Intelligence is a web application that helps **Product Managers (PMs)** monitor customer and market signals from multiple data sources (Slack, Salesforce, Gong). It automatically collects, scores, clusters, and surfaces the most relevant signals so PMs can act on risks and opportunities without manually sifting through dozens of tools.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Claude Desktop Plugin (Cowork)                         │
│  ┌─────────┐  ┌────────────┐  ┌──────┐                 │
│  │  Slack   │  │ Salesforce │  │ Gong │  (MCP Servers)  │
│  └────┬────┘  └─────┬──────┘  └──┬───┘                  │
│       └─────────────┼────────────┘                      │
│              Intelligence Pipeline                       │
│  (normalize → pre-filter → LLM match → cluster)        │
│                      │                                   │
│              POST /api/signals                           │
└──────────────────────┼──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│  Next.js Web App                                        │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │Dashboard │→ │Objective View│→ │ Match Feed + Feedback│
│  └──────────┘  └──────────────┘  └───────────────────┘  │
│                       │                                  │
│               Supabase (PostgreSQL)                      │
│  [pm_profiles][objectives][matches][clusters]            │
│  [pm_feedback][shared_patterns]                          │
└─────────────────────────────────────────────────────────┘
```

**Tech stack:** Next.js 16 + React 19 + TypeScript, Supabase (PostgreSQL + Auth), Tailwind CSS

---

## Core Concepts

### PM Profiles & Authentication
- Users sign in via **Google OAuth** through Supabase Auth
- `middleware.ts` enforces authentication: unauthenticated → `/login`, authenticated → `/dashboard`
- Each PM has a profile in `pm_profiles` (id, email, name, avatar_url)
- **Row-Level Security (RLS)** ensures PMs can only access their own data (`pm_id = auth.uid()`)

### Objectives
- A PM creates **objectives** — business goals they want to monitor (e.g., "Reduce enterprise churn in EMEA accounts")
- Each objective has:
  - `title` — the goal description
  - `status` — active / paused / resolved
  - `decomposition` (JSONB) — machine-readable breakdown: what signal types matter (e.g., "champion_departure", "feature_request") and what entities to watch (e.g., "budget cut", "renewal", "API")
- Created via a **Server Action** (`app/actions/objectives.ts`) that validates input, checks auth, and inserts into Supabase

---

## Deep Dive 1: Signal Collection Pipeline

> Defined in `commands/collect-signals.md` — runs as a **Claude Desktop plugin** (Cowork), NOT inside the web app.

The plugin connects to three external data sources via **MCP (Model Context Protocol) servers** — each server exposes read-only APIs that the plugin queries:

### Data Sources

| Source | MCP Server | What It Pulls | Filtering Rules |
|--------|-----------|---------------|-----------------|
| **Slack** | Slack MCP (read-only, write blocked) | Channel messages, threads | Only threads with 3+ messages; skips messages < 20 chars |
| **Salesforce** | Salesforce MCP | Opportunity stage changes, account notes, renewals | Stage changes + new notes; renewals within 60 days |
| **Gong** | Gong MCP (custom-built) | Call transcripts, conversation metadata | Extracts 5-10 "Key Moments" per call |

### Collection Timing
- Default: **daily** at a configurable time (default 7 AM)
- Lookback window: **last 24 hours** (configurable via `--days` flag)
- First run on a new objective: **30-day backfill**
- All three sources are queried **in parallel**

### Plugin Configuration (per PM)
The plugin is installed in Cowork as a zip file. Each PM configures a Cowork project with:
- Supabase URL + service role key (stored in project memory)
- PM UUID (their `pm_profiles.id`)
- MCP server connections for Slack, Salesforce, Gong

### How Collection Starts
1. Plugin runs the `/pm-signal-intelligence:collect-signals` command (scheduled or manual)
2. Fetches PM's active objectives, shared patterns, and recent feedback from Supabase
3. Queries all three data sources in parallel for the lookback window
4. Passes raw data into the Intelligence Pipeline (see below)
5. POSTs results to the web app's `/api/signals` endpoint
6. Reports a summary: "Collected [N] signals... Identified [M] matches across [K] objectives"

---

## Deep Dive 2: Intelligence Processing Pipeline

> Defined in `commands/collect-signals.md` (steps 1-3) and `skills/signal-clustering/SKILL.md`

The pipeline has **5 sequential stages** that transform raw data from Slack/Salesforce/Gong into scored, categorized, clustered matches:

### Stage 1: Context Retrieval (from Supabase)
Before processing any signals, the plugin loads context to calibrate its behavior:

| Context Item | Supabase Query | How It's Used |
|-------------|---------------|---------------|
| Active objectives | `objectives WHERE status = 'active' AND pm_id = ?` | Defines what signals to look for |
| High-confidence patterns | `shared_patterns WHERE confidence > 0.7` | Boosts matching for known-good patterns |
| Low-confidence patterns | `shared_patterns WHERE confidence < 0.3` | Penalizes matching for known-bad patterns |
| Few-shot examples | 5 "confirmed" + 5 "dismissed" from `pm_feedback` | Teaches LLM what this PM considers relevant |
| Threshold calibration | Confirmation rates by score band (4-6, 7-8, 9-10) over 2 weeks | If a band has < 30% confirmation rate, it's excluded from primary results |

### Stage 2: Normalization
Raw data from each source is standardized into a common JSON format via the `signal-preprocessing` skill. Each normalized signal includes:
- `source` (slack / salesforce / gong)
- `source_timestamp` (ISO 8601)
- `account` (string or null)
- `content_summary` (English summary)
- `original_content` (preserved if non-English)
- `source_language` (detected language code)
- `speaker_role` (customer / internal / system)
- `source_reference` (deeplink back to original source)

### Stage 3: Pre-Filtering
A fast string-match pass **before** invoking the LLM. For each normalized signal:
1. Check if any token in the signal matches the objective's `entities_to_watch` (e.g., "budget cut", "renewal", "API")
2. Check if the signal's account matches `relevant_accounts`
3. **If no overlap exists, skip LLM matching entirely** — this saves cost and latency

### Stage 4: LLM Matching
The `signal-matching` skill invokes Claude to evaluate each surviving signal against each active objective. The LLM receives:
- The objective's `decomposition` (signal types + entities to watch)
- High/low-confidence shared patterns as boosters/penalties
- 10 few-shot examples (5 confirmed, 5 dismissed) from `pm_feedback`

For each match, the LLM produces:
- **`relevance_score`** (0-10) — how relevant this signal is to the objective
- **`explanation`** — English text explaining why this signal matters
- **`category`** — `opportunity`, `risk`, or `info`
- **`urgency`** — `act_now`, `this_week`, or `background`

### Stage 5: Clustering
Defined in `skills/signal-clustering/SKILL.md`. Groups related matches to reduce "signal fatigue":

**Grouping rules:**
- **Primary anchor:** Same `account` (signals from different accounts are NEVER clustered)
- **Temporal window:** 72 hours (signals > 3 days apart stay separate)
- **Cross-source affinity:** A Gong call + Slack thread about the same event are prioritized for clustering

**LLM evaluation criteria** — two signals are clustered if ANY of these hold:
1. They refer to the same **Economic Event** (budget hearing, RFP, contract renewal)
2. They involve the same **Key Stakeholders** or their direct reports
3. One is a **direct consequence** of the other (e.g., Gong call → Slack debrief)

**Cluster output:**
- `situation_summary` — 1-sentence English summary (e.g., "Coordinated push for Enterprise upgrade following Miami-Dade Q3 budget surplus announcement")
- `combined_urgency` — inherits the **highest** urgency from any member signal
- Individual match urgency values are NOT overwritten

**Real-world example from seed data:**
- Cluster "Acme Corp" groups 3 signals: a Gong call (VP reconsidering rollout), a Slack thread (CS flagged support tickets), and a Salesforce stage change (moved to "At Risk") — all referring to the same onboarding friction event

### Write to App API
After the pipeline, results are sent in a **single POST** to `POST /api/signals` (`app/api/signals/route.ts`):
- **Auth:** Bearer token matching `SIGNALS_API_KEY` env var
- **Two-phase write:**
  1. Insert all clusters → Supabase returns generated UUIDs
  2. Resolve `"cluster_index:0"` references in matches to actual cluster UUIDs
  3. Insert all matches with resolved foreign keys
- This is the **only way** data enters the system — the web app never collects signals itself

---

## Deep Dive 3: Web Dashboard (Next.js + Supabase)

> The web app is the **consumption and feedback layer**. It does not collect or process signals.

### Authentication Flow
1. User clicks "Sign in with Google" → `components/login-button.tsx` calls `supabase.auth.signInWithOAuth({ provider: "google" })`
2. Supabase handles the OAuth flow, redirects to `/auth/callback`
3. `app/auth/callback/route.ts` exchanges the auth code for a session, sets cookies
4. `middleware.ts` runs on every request: redirects unauthenticated users to `/login`, authenticated users away from `/login` to `/dashboard`
5. A database trigger (`handle_new_user`) auto-creates a `pm_profiles` row on first login

### Dashboard (`app/(protected)/dashboard/page.tsx`)
A server component that queries Supabase directly:
- Fetches the PM's profile (name, email)
- Fetches all active objectives with their matches (via Supabase JOIN: `objectives.select("*, matches(id, urgency, feedback, created_at)")`)
- Computes per-objective stats client-side:
  - **Unread count** — matches where `feedback = "pending"`
  - **Highest urgency** — sorts pending matches by urgency order (act_now > this_week > background)
  - **Latest signal** — most recent `created_at` among all matches
  - **Total matches** — count of all matches

Each objective renders as an `ObjectiveCard` (`components/dashboard/objective-card.tsx`):
- Title, "X new" badge (pending count), urgency pill (color-coded: red/yellow/green), total matches, "Latest signal Xm/Xh/Xd ago"
- Clicking navigates to `/objectives/[id]`

A `CreateObjectiveForm` allows creating new objectives inline.

### Objective Detail View (`app/(protected)/objectives/[id]/page.tsx`)
Two-column layout:

**Main column — Filterable Match Feed** (`components/objectives/filterable-match-feed.tsx`):
- 4 filter dropdowns: Category (opportunity/risk/info), Urgency (act_now/this_week/background), Status (pending/confirmed/dismissed), Source (slack/salesforce/gong)
- "Clear filters" link when any filter is active
- Matches are **grouped by cluster**: clustered signals appear under a purple left-border with the cluster's situation summary and combined urgency badge
- Unclustered signals appear below, separated by an "Unclustered signals" header
- Clusters are sorted by urgency (act_now first)

**Each Match Item** (`components/objectives/match-item.tsx`) displays:
- Source icon (Slack/Salesforce/Gong/Gmail/Monday logos from `/public/`)
- Account name, speaker role, date
- `content_summary` — what the signal says
- `explanation` — why it matters for this objective
- Category pill (blue=opportunity, red=risk, gray=info)
- Urgency pill (red=act_now, yellow=this_week, green=background)
- Cluster context pill (purple, truncated to 40 chars)
- **Feedback buttons** (Confirm / Dismiss) — or a status badge if already reviewed

**Sidebar** (`components/objectives/objective-sidebar.tsx`):
- Status toggle (active / paused / resolved)
- Match stats: total, confirmed, dismissed, pending
- Cluster stats: active clusters count, clustered vs. unclustered signals
- Category breakdown (opportunity/risk/info counts)
- Top 5 accounts by signal count

### Patterns Page (`app/(protected)/patterns/page.tsx`)
Displays shared patterns from `shared_patterns` table via `PatternCard` (`components/patterns/pattern-card.tsx`):
- Pattern description text
- Source type + subtype badge
- Confidence bar (green fill, percentage)
- Confirmation/dismissal counts (e.g., "12↑ 3↓")

### Settings Page
Shows the PM's UUID (`components/settings/uuid-display.tsx`) — needed for configuring the Cowork plugin.

---

## Deep Dive 4: Feedback Learning Loop

> This is the **closed-loop system** that makes signal quality improve over time.

### Step 1: PM Reviews Signals in the Web App
When a PM views an objective's matches, each pending signal has two buttons:
- **Confirm** (green) — "This signal is relevant and useful"
- **Dismiss** (gray) — "This signal is noise or irrelevant"

These are rendered by `components/objectives/feedback-buttons.tsx` (client component using `useTransition` for optimistic UI).

### Step 2: Feedback is Written to Two Tables
The `submitFeedback()` Server Action (`app/actions/feedback.ts:6-48`) performs two writes:

1. **Insert into `pm_feedback`** — a permanent training record:
   ```
   { pm_id, match_id, objective_id, feedback_type: "confirmed"|"dismissed" }
   ```
   The `pm_feedback` table also stores `signal_content_summary` and `match_explanation` (preserved for few-shot examples even if the original match is later deleted).

2. **Update `matches` row** — sets `feedback` to "confirmed" or "dismissed" and `feedback_at` to current timestamp.

Both paths are followed by `revalidatePath()` to refresh the dashboard and objective views.

### Step 3: Feedback Feeds Back Into the Collection Pipeline
On the **next collection run**, the plugin reads this feedback and uses it in 3 ways:

#### A. Few-Shot Examples (Direct Learning)
- The plugin fetches the **5 most recent confirmed** and **5 most recent dismissed** `pm_feedback` records
- These are injected into the LLM matching prompt as examples: "Here's what this PM previously found useful vs. irrelevant"
- This teaches the LLM the PM's personal preferences and domain context

#### B. Threshold Calibration (Score Band Tuning)
- The plugin calculates **confirmation rates by score band** over the last 2 weeks:
  - Band 4-6: What % of signals scored 4-6 were confirmed?
  - Band 7-8: What % of signals scored 7-8 were confirmed?
  - Band 9-10: What % of signals scored 9-10 were confirmed?
- If a band's confirmation rate drops below **30%**, that entire score band is excluded from primary results
- Example: if the PM keeps dismissing 4-6 scored signals, the system stops showing them

#### C. Shared Patterns (Cross-PM Learning)
The `shared_patterns` table stores patterns extracted from aggregated feedback across all PMs:

| Field | Purpose |
|-------|---------|
| `pattern_description` | Human-readable description of the pattern |
| `source_type` / `source_subtype` | Where the pattern was observed |
| `confirmations` | How many PMs confirmed signals matching this pattern |
| `dismissals` | How many PMs dismissed signals matching this pattern |
| `confidence` | Computed as `confirmations / (confirmations + dismissals)` |
| `contributing_pm_ids` | Which PMs contributed to this pattern |

**How patterns affect future collection:**
- Patterns with `confidence > 0.7` are used as **boosters** — the LLM is told "signals matching this pattern tend to be relevant"
- Patterns with `confidence < 0.3` are used as **penalties** — the LLM is told "signals matching this pattern tend to be noise"
- The Patterns page in the web app shows PMs the confidence bar and counts so they can see what the system has learned

### The Complete Feedback Cycle

```
Day 1: Plugin collects 50 raw signals → Pipeline produces 12 matches
                                                    ↓
Day 1-2: PM reviews matches → confirms 8, dismisses 4
                                                    ↓
Day 2: pm_feedback table now has 12 new records
        shared_patterns updated (confidence recalculated)
                                                    ↓
Day 2: Next collection run loads:
        - 5 confirmed + 5 dismissed as few-shot examples
        - Score band thresholds adjusted
        - Shared patterns with updated confidence
                                                    ↓
Day 2: Pipeline produces higher-quality matches
        (fewer false positives, better-calibrated scores)
                                                    ↓
        ... cycle repeats, quality improves over time ...
```

---

## Data Flow Summary

```
PM creates objective
        ↓
Plugin collects signals from Slack/Salesforce/Gong (daily)
        ↓
Intelligence pipeline: normalize → filter → LLM score → cluster
        ↓
POST /api/signals → writes clusters + matches to Supabase
        ↓
PM opens dashboard → reviews matches → confirms or dismisses
        ↓
Feedback stored → used to calibrate next collection run
        ↓
Shared patterns emerge across PMs → improve system-wide accuracy
```

---

## Key Files

| File | Purpose |
|------|---------|
| `app/(protected)/dashboard/page.tsx` | Dashboard with objective cards |
| `app/(protected)/objectives/[id]/page.tsx` | Objective detail + match feed |
| `app/api/signals/route.ts` | Signal ingestion API (POST) |
| `app/actions/objectives.ts` | Create objective Server Action |
| `app/actions/feedback.ts` | Submit feedback + update status Server Actions |
| `commands/collect-signals.md` | Full signal collection pipeline spec |
| `types/database.ts` | TypeScript types for all 6 database tables |
| `supabase/seed.sql` | Schema + test data |
| `lib/supabase/server.ts` | Server-side Supabase client |
| `lib/supabase/middleware.ts` | Session management middleware |
| `middleware.ts` | Auth redirect logic |
| `components/` | All React UI components |

---

## What the App Does NOT Do

- **Does not collect signals itself** — The Claude Desktop plugin handles all data collection and LLM processing externally
- **Has no test suite** — No test framework or test files exist
- **Has no CI/CD or Docker** — No deployment pipeline configured
- **Has no real-time updates** — Dashboard requires page refresh to see new signals
