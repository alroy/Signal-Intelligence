---
name: signal-preprocessing
description: Normalizes raw data from Slack, Salesforce, Gong, and Gmail into a standard signal format for matching. Use when processing source data during signal collection. All signals are processed in memory and not persisted.
---

## Normalized signal format

Every signal, regardless of source, should be normalized to this structure before matching:

```json
{
  "source": "slack | salesforce | gong | gmail",
  "timestamp": "ISO 8601",
  "account": "account name or null",
  "content": "English summary, 1-3 sentences",
  "original_content": "original-language text if different from English",
  "source_language": "detected language code",
  "speaker_role": "customer | internal | system",
  "source_reference": {
    "type": "slack_message | salesforce_record | gong_call | gmail_thread",
    "id": "source-specific ID",
    "deeplink": "URL to the specific message, record, or call moment"
  },
  "raw_context": "surrounding 2-3 messages or paragraphs for context"
}
```

**Monday board mapping:** The `source_reference` object is written as a JSON string to the `Source Reference` column (`long_text_mm24w82p`). The `timestamp` is written to the `Source Timestamp` column (`text_mm242qzh`). Both are synced to Supabase by the web app.

## Slack rules

1. Retrieve messages and threads from the time range.
2. Skip messages shorter than 20 characters (reactions, acknowledgments).
3. Threads with 3+ messages: treat as one signal. Summarize the thread in `content`.
4. Standalone messages: use the message text directly.
5. Identify account/customer mentions by matching against Salesforce account names.
6. Determine author role from Slack profile or channel context (CS, sales, PM, engineering). Default: "internal."
7. All Slack signals: `speaker_role` = "internal" (these are internal communications).
8. Non-English messages: set `original_content` to the original text, generate an English summary in `content`.
9. Generate a Slack deeplink to the message.

## Salesforce rules

1. Query for record changes in the time range: opportunity stage changes, new notes, new tasks, contact additions/removals, upcoming renewals.
2. Create event statements as `content`. Examples:
   - "Account 'City of Durham' opportunity moved from 'Proposal' to 'Negotiation' on Mar 24."
   - "New note on Account 'City of Austin' by [CS rep]: [first 200 chars]."
   - "Account 'City of Memphis' renewal in 45 days. No expansion discussion logged."
   - "Contact [name], title [title], added to Account 'City of Portland'."
3. `speaker_role` = "system" for automated changes, "internal" for human-created notes.
4. Preserve non-English note content in `original_content`.
5. Generate a Salesforce record deeplink.

## Gong rules

1. Retrieve calls via the Gong MCP server. Get transcripts segmented by speaker.
2. Use get_call_details to identify which speakers are customer (external) vs. internal.
3. Extract 5-10 key moments per call. A key moment is a segment where:
   - The customer states a need, pain point, or request.
   - The customer mentions another department, stakeholder, or competitor.
   - The customer expresses frustration, excitement, or urgency.
   - A concrete decision, commitment, or next step is discussed.
4. Create one signal per key moment (not one per call).
5. `speaker_role` = "customer" for customer statements, "internal" for rep statements.
6. Generate an English summary for each key moment even if the call was in another language.
7. Include a deeplink to the Gong recording at the specific timestamp. Store the timestamp (seconds into recording) in the `source_reference.id` field as `{call_id}:{seconds}`.

## Gmail rules

1. Pull threads from the specified time range via the Gmail MCP server.
2. Match sender/recipient domains against `relevant_accounts` from the active objectives.
3. For matched threads, summarize key moments as `content`: renewal discussions, escalation threads, feature requests, stakeholder introductions.
4. Identify `speaker_role` based on sender domain: external domains = "customer", internal domain = "internal".
5. Non-English threads: set `original_content` to the original text, generate an English summary in `content`.
6. Generate a Gmail deeplink to the thread.
