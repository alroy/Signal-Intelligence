---
name: collect-signals
description: Collect signals from Slack, Salesforce, Gong, and Gmail. Matches them against active objectives using LLM evaluation and clustering. Writes results to a shared Monday.com board.
---

## 1. Context from Project Memory

Before collection, read the following from Cowork project memory (set during objective creation):

* **Active Objectives**: The PM's current objectives (title, ID, decomposition with entities_to_watch and relevant_accounts).
* **PM UUID**: The PM's Supabase user ID (used to tag Monday items).

These are maintained by the PM via `/pm-signal-intelligence:create-objective` and stored in project memory.

## 2. Learning Context

Invoke **`feedback-learning`** to read confirmed and dismissed items from the Monday board. This returns:
* **Few-shot examples**: Up to 5 confirmed and 5 dismissed signals to guide LLM matching.
* **Score threshold**: Minimum score to include, calibrated from the PM's feedback history.

If no reviewed items exist yet, use default settings (minimum score 5, no few-shot examples).

**Note:** The few-shot examples use the plugin's original scores (pre-rescore). The app rescores matches after sync using shared patterns and PM feedback, but those rescored values stay in Supabase. This is expected — the plugin calibrates its own scoring accuracy.

## 3. Signal Collection (Parallel)
Gather raw data from the last 24 hours (or specified `--days`):

* **Slack**: Summarize threads (3+ messages) and skip short chatter (< 20 chars).
* **Salesforce**: Query for stage changes, new notes, and renewals within 60 days.
* **Gong**: Extract 5-10 "Key Moments" per call using the Gong MCP server.
* **Gmail**: Pull threads from the last 24 hours. Match sender/recipient domains against `relevant_accounts`. Summarize key moments — renewal discussions, escalation threads, feature requests, stakeholder introductions. Preserve original-language excerpts in citations.

## 4. Intelligence Pipeline

### Step 1: Normalization
Invoke **`signal-preprocessing`** to standardize all raw data into a JSON format.

### Step 2: Pre-Filtering
Perform a string-match against `entities_to_watch` and `relevant_accounts`. Skip LLM matching if no overlap exists.

### Step 3: LLM Matching
Invoke **`signal-matching`** to evaluate each signal against the PM's objectives. Include the few-shot examples from the learning context to guide scoring. Only keep matches above the calibrated score threshold.

**Note:** The plugin does not have access to shared patterns (stored in Supabase). The app's rescore pipeline applies shared pattern boosting/penalizing after sync.

### Step 4: Clustering
Invoke **`signal-clustering`** to group matches by account and theme within a 72-hour window. For each cluster, generate a `cluster_id` (UUID) and a situation summary. All items in a cluster share the same `cluster_id` and `situation_summary` values when written to Monday.

## 5. Write to Monday.com Board

Write each matched signal as an item on the shared Monday.com board using the Monday MCP server.

For each match, call the Monday MCP `create_item` tool:

* **Board ID**: `18407235431`
* **Item name**: Content summary (truncated to 50 characters)
* **Column values**:

| Column | Monday Column ID | Type | Value |
|---|---|---|---|
| PM UUID | `text_mm23fspz` | text | PM's Supabase user ID |
| Objective ID | `text_mm23qar7` | text | Matched objective UUID |
| Source | `text_mm238jbc` | text | `slack`, `salesforce`, `gong`, or `gmail` |
| Account | `text_mm23xscc` | text | Customer account name (or empty) |
| Content Summary | `text_mm23eqyw` | text | English summary of the signal |
| Original Content | `long_text_mm23wnrf` | long_text | Original text (if non-English or worth preserving) |
| Source Language | `text_mm23f67y` | text | Detected language code (e.g. `en`, `he`) |
| Speaker Role | `text_mm23vdkn` | text | `customer`, `internal`, or `system` |
| Score | `numeric_mm23h4sr` | numeric | Relevance score (0-10) |
| Explanation | `text_mm23983t` | text | Why this signal matches the objective |
| Category | `color_mm23tcn7` | status | `opportunity`, `risk`, or `info` |
| Urgency | `color_mm23vf2s` | status | `act_now`, `this_week`, or `background` |
| Source Reference | `long_text_mm24w82p` | long_text | JSON object with source type, ID, deeplink, and timestamp |
| Source Timestamp | `text_mm242qzh` | text | ISO 8601 timestamp of the original signal |
| Cluster ID | `text_mm247era` | text | Cluster UUID (empty if unclustered) |
| Situation Summary | `text_mm24zxe` | text | 1-sentence cluster summary (empty if unclustered) |
| Status | `color_mm23b9pc` | status | Always set to `Pending` |

**Note:** The web app's cron job syncs pending items from this board into Supabase. During sync, the app creates cluster records and resolves cluster IDs, then rescores each match using shared patterns and PM feedback history. PMs can also trigger a manual sync from the dashboard.

## 6. Summary Report

Upon completion, generate a final response to the PM:

> "Collected [N] signals from Slack, Salesforce, Gong, and Gmail. Created [M] items on the shared Monday board across [K] active objectives. [X] signals were grouped into [C] clusters. Signals will sync to the web app shortly, or you can trigger a manual sync from the dashboard."
