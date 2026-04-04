---
name: collect-signals
description: Collect signals from Slack, Salesforce, Gong, and Gmail. Matches them against active objectives using LLM evaluation and clustering. Writes results to a shared Monday.com board.
---

## 1. Context from Project Memory

Before collection, read the following from Cowork project memory (set during objective creation):

* **Active Objectives**: The PM's current objectives (title, ID, decomposition with entities_to_watch and relevant_accounts).
* **PM UUID**: The PM's Supabase user ID (used to tag Monday items).

These are maintained by the PM via `/pm-signal-intelligence:create-objective` and stored in project memory.

## 2. Signal Collection (Parallel)
Gather raw data from the last 24 hours (or specified `--days`):

* **Slack**: Summarize threads (3+ messages) and skip short chatter (< 20 chars).
* **Salesforce**: Query for stage changes, new notes, and renewals within 60 days.
* **Gong**: Extract 5-10 "Key Moments" per call using the Gong MCP server.
* **Gmail**: Pull threads from the last 24 hours. Match sender/recipient domains against `relevant_accounts`. Summarize key moments — renewal discussions, escalation threads, feature requests, stakeholder introductions. Preserve original-language excerpts in citations.

## 3. Intelligence Pipeline

### Step 1: Normalization
Invoke **`signal-preprocessing`** to standardize all raw data into a JSON format.

### Step 2: Pre-Filtering
Perform a string-match against `entities_to_watch` and `relevant_accounts`. Skip LLM matching if no overlap exists.

### Step 3: LLM Matching
Invoke **`signal-matching`** to evaluate each signal against the PM's objectives.

### Step 4: Clustering
Group matches by account and theme within a 72-hour window. For each group with 2+ matches, ask the LLM: "Do these matches refer to the same underlying event or theme?" If yes, assign the same `cluster_id`. Multi-source clusters (same event seen in Slack and Gong) rank higher.

## 4. Write to Monday.com Board

Write each matched signal as an item on the shared Monday.com board using the Monday MCP server.

For each match, call the Monday MCP `create_item` tool:

* **Board ID**: `18407235431`
* **Item name**: Content summary (truncated to 50 characters)
* **Column values**:

| Column | Monday Column ID | Value |
|---|---|---|
| PM UUID | `text_mm23fspz` | PM's Supabase user ID |
| Objective ID | `text_mm23qar7` | Matched objective UUID |
| Source | `text_mm238jbc` | `slack`, `salesforce`, `gong`, or `gmail` |
| Account | `text_mm23xscc` | Customer account name (or empty) |
| Content Summary | `text_mm23eqyw` | English summary of the signal |
| Original Content | `long_text_mm23wnrf` | Original text (if non-English or worth preserving) |
| Source Language | `text_mm23f67y` | Detected language code (e.g. `en`, `he`) |
| Speaker Role | `text_mm23vdkn` | `customer`, `internal`, or `system` |
| Score | `numeric_mm23h4sr` | Relevance score (0-10) |
| Explanation | `text_mm23983t` | Why this signal matches the objective |
| Category | `color_mm23tcn7` | `opportunity`, `risk`, or `info` |
| Urgency | `color_mm23vf2s` | `act_now`, `this_week`, or `background` |
| Cluster ID | `text_mm23b9pc` | Cluster UUID (or empty if unclustered) |
| Status | `color_mm23b9pc` | Always set to `Pending` |

**Note:** The web app's cron job syncs pending items from this board into Supabase twice daily. PMs can also trigger a manual sync from the dashboard.

## 5. Summary Report

Upon completion, generate a final response to the PM:

> "Collected [N] signals from Slack, Salesforce, Gong, and Gmail. Created [M] items on the shared Monday board across [K] active objectives. [X] signals were grouped into clusters. Signals will sync to the web app shortly, or you can trigger a manual sync from the dashboard."
