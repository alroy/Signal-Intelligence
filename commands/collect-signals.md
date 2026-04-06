---
name: collect-signals
description: Collect signals from Slack, Salesforce, Gong, and Gmail. Matches them against active objectives using LLM evaluation and clustering. Writes results to a shared Monday.com board.
---

## 0. Discover New Objectives

Before running the signal pipeline, check the Monday.com board for objectives created in the web app that haven't been enriched yet.

1. Read items from board `18407235431` where:
   - Source column (`text_mm238jbc`) = `new_objective`
   - Status column (`color_mm23b9pc`) = `Pending`
   - PM UUID column (`text_mm23fspz`) matches the current PM.

2. For each unenriched objective found:
   a. Read the Objective ID (`text_mm23qar7`) and item name (the objective title).
   b. Check project memory — if this objective ID already has a decomposition stored, skip it.
   c. Query Salesforce for the account landscape summary (same as create-objective step 3).
   d. Invoke the **`objective-decomposition`** skill to generate a structured decomposition from the title and Salesforce summary.
   e. Write the decomposition to the Monday board as a **new item**:
      - Source = `objective_decomposition`
      - Objective ID = same objective UUID
      - PM UUID = same PM UUID
      - Decomposition = the JSON output
      - Status = `Pending`
   f. Update the original `new_objective` item's Status to `Enriched` using the Monday MCP `change_item_column_values` tool.
   g. Store the objective in project memory: `{ "id": "{objective_id}", "title": "{title}", "status": "active", "decomposition": {decomposition JSON} }`.

3. If any new objectives were discovered, log: "Discovered and enriched [N] new objective(s) from the web app."

4. Store the list of newly discovered objective IDs (from step 2) as `new_objective_ids` for use in Section 5c.

### 0b. Discover Objective Status Changes

1. Read items from board `18407235431` where:
   - Source column (`text_mm238jbc`) = `objective_status_change`
   - Status column (`color_mm23b9pc`) = `Pending`
   - PM UUID column (`text_mm23fspz`) matches the current PM.

2. For each status-change marker found:
   a. Read the Objective ID (`text_mm23qar7`) and the new status from Content Summary (`text_mm23eqyw`).
   b. Update the objective's status in project memory:
      - If new status is `paused`: set `"status": "paused"` in project memory.
      - If new status is `resolved`: set `"status": "resolved"` in project memory.
      - If new status is `active`: set `"status": "active"` in project memory.
   c. Update the marker item's Status to `Enriched` using the Monday MCP `change_item_column_values` tool.

3. If any status changes were discovered, log: "Applied [N] objective status change(s) from the web app."

## 1. Context from Project Memory

Read the following from Cowork project memory:

* **Active Objectives**: The PM's current objectives **with status = "active"** (title, ID, decomposition with entities_to_watch and relevant_accounts). Skip any objectives with status "paused" or "resolved". This includes any objectives discovered or updated in Section 0.
* **PM UUID**: The PM's Supabase user ID (used to tag Monday items).

### 1b. Determine Collection Window

Determine how far back to collect signals:

1. If the `--days` argument was provided, use that value.
2. Otherwise, check project memory for `last_collection_date`.
   - **If `last_collection_date` is not found** (first run): use **90 days** as the lookback window. Log: "No previous collection found — running initial 90-day backfill."
   - **If `last_collection_date` is found**: use **24 hours** (the default daily window).

Store the resolved lookback value for use in Section 3.

## 2. Learning Context

Invoke **`feedback-learning`** to read confirmed and dismissed items from the Monday board. This returns:
* **Few-shot examples**: Up to 5 confirmed and 5 dismissed signals to guide LLM matching.
* **Score threshold**: Minimum score to include, calibrated from the PM's feedback history.

If no reviewed items exist yet, use default settings (minimum score 5, no few-shot examples).

**Note:** The few-shot examples use the plugin's original scores (pre-rescore). The app rescores matches after sync using shared patterns and PM feedback, but those rescored values stay in Supabase. This is expected — the plugin calibrates its own scoring accuracy.

## 3. Signal Collection (Parallel)
Gather raw data using the collection window determined in Section 1b:

* **Slack**: Summarize threads (3+ messages) and skip short chatter (< 20 chars).
* **Salesforce**: Query for stage changes, new notes, and renewals within 60 days.
* **Gong**: Extract 5-10 "Key Moments" per call using the Gong MCP server.
* **Gmail**: Pull threads from the collection window. Match sender/recipient domains against `relevant_accounts`. Summarize key moments — renewal discussions, escalation threads, feature requests, stakeholder introductions. Preserve original-language excerpts in citations.

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

### 5b. Update Collection Timestamp

Store `last_collection_date` in project memory with the current ISO 8601 timestamp. This ensures subsequent runs use the default 24-hour window.

### 5c. Backfill Pass for Newly Discovered Objectives

If `new_objective_ids` (from Section 0, step 4) is empty, skip this section entirely.

Otherwise, run a dedicated 90-day backfill for the newly discovered objectives:

1. **Scope**: Filter active objectives to ONLY those in `new_objective_ids`. Existing objectives are excluded from this pass.
2. **Collection window**: Use **90 days** as the lookback window, regardless of the `--days` argument or `last_collection_date`.
3. **Learning context**: Reuse the feedback-learning results from Section 2 (no need to re-invoke).
4. **Signal collection**: Re-run Section 3 (Slack, Salesforce, Gong, Gmail) with the 90-day window.
5. **Intelligence pipeline**: Run the full Section 4 pipeline (normalize, pre-filter, match, cluster) but only matching against the new objectives from `new_objective_ids`.
6. **Write to Monday**: Write matched signals to the Monday board per Section 5. Before writing each item, check if an item with the same Source Reference source ID and Objective ID was already written in the regular pass (Section 5). If so, skip it to avoid duplicates.
7. Log: "Completed 90-day backfill for [N] new objective(s). Created [M] additional items on the Monday board."

## 6. Summary Report

Upon completion, generate a final response to the PM:

> "Collected [N] signals from Slack, Salesforce, Gong, and Gmail. Created [M] items on the shared Monday board across [K] active objectives. [X] signals were grouped into [C] clusters. Signals will sync to the web app shortly, or you can trigger a manual sync from the dashboard."

If a backfill pass was run (Section 5c), append:
> "Additionally, ran a 90-day backfill for [N] newly discovered objective(s), creating [M] additional items."
