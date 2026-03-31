---
name: collect-signals
description: Collect signals from Slack, Salesforce, and Gong. Matches them against active objectives using LLM evaluation with dynamic thresholds and clustering.
---

## 1. Supabase Context Retrieval
Retrieve the following state from Supabase before beginning collection:

* **Active Objectives**: Fetch all objectives for the current PM where `status = 'active'`.
* **Shared Patterns**: Fetch patterns with `confidence > 0.7` to boost and `confidence < 0.3` to penalize.
* **Learning Loop**: Retrieve 5 "confirmed" and 5 "dismissed" feedback records from `pm_feedback` for few-shot prompting.
* **Threshold Calibration**: Calculate confirmation rates of recent score bands (4-6, 7-8, 9-10). If a band is under-performing (< 30% confirmation over the last 2 weeks), raise the minimum threshold to exclude it from primary results.

## 2. Signal Collection (Parallel)
Gather raw data from the last 24 hours (or specified `--days`):

* **Slack**: Summarize threads (3+ messages) and skip short chatter (< 20 chars).
* **Salesforce**: Query for stage changes, new notes, and renewals within 60 days.
* **Gong**: Extract 5-10 "Key Moments" per call using the Gong MCP server.

## 3. Intelligence Pipeline

### Step 1: Normalization
Invoke **`signal-preprocessing`** to standardize all raw data into a JSON format.

### Step 2: Pre-Filtering
Perform a string-match against `entities_to_watch` and `relevant_accounts`. Skip LLM matching if no overlap exists.

### Step 3: LLM Matching
Invoke **`signal-matching`** using retrieved Shared Patterns and Few-Shot Examples.

### Step 4: Clustering
Group matches by account and theme within a 72-hour window. For each group with 2+ matches, ask the LLM: "Do these matches refer to the same underlying event or theme?" If yes, assign the same `cluster_id`. Multi-source clusters (same event seen in Slack and Gong) rank higher.

## 4. Write via App API

Send all results in a single POST to the app's `/api/signals` endpoint. The endpoint handles the two-step write (clusters first, then matches) internally.

```
POST https://<app-domain>/api/signals
Authorization: Bearer <SIGNALS_API_KEY>
Content-Type: application/json

{
  "clusters": [
    {
      "pm_id": "uuid",
      "account": "string or null",
      "situation_summary": "English summary of the combined event",
      "combined_urgency": "act_now | this_week | background"
    }
  ],
  "matches": [
    {
      "objective_id": "uuid",
      "pm_id": "uuid",
      "source": "slack | salesforce | gong | gmail",
      "source_timestamp": "ISO 8601",
      "account": "string or null",
      "content_summary": "English summary",
      "original_content": "original text if non-English",
      "source_language": "detected language code",
      "speaker_role": "customer | internal | system",
      "source_reference": { "type": "...", "id": "...", "deeplink": "..." },
      "relevance_score": "number",
      "explanation": "English explanation",
      "category": "opportunity | risk | info",
      "urgency": "act_now | this_week | background",
      "cluster_id": "cluster_index:0 — references index in clusters array above, or null",
      "feedback": "pending"
    }
  ]
}
```

**Cluster references:** Matches reference clusters by index using `"cluster_index:0"`, `"cluster_index:1"`, etc. The API resolves these to the actual UUIDs generated when clusters are inserted. Matches without a cluster set `cluster_id` to `null`.

**Response:**
```json
{ "success": true, "clusters_created": 2, "matches_created": 7 }
```

## 5. Summary Report

Upon completion of all database writes, generate a final response to the PM:

> "Collected [N] signals from Slack, Salesforce, and Gong. Identified [M] new matches across [K] active objectives. [X] signals were grouped into clusters. Open the web app to review your updated dashboard."
