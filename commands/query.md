---
name: query
description: Ask a natural language question across Slack, Salesforce, and Gong. Returns an English answer with source citations. Does not write to Supabase.
---

## When to use

The PM asks a question like:
- "Which customers mentioned reporting in the last 30 days?"
- "What's the evidence for and against building a multi-department dashboard?"
- "Summarize everything we know about City of Durham."
- "What did customers say about the survey feature on Gong calls this month?"

## Steps

1. Analyze the PM's question to determine:
   - Which sources to query (Slack, Salesforce, Gong, or all).
   - What time range is relevant (explicit or inferred, default last 30 days).
   - What entities, accounts, or topics to search for.

2. Query source systems in parallel for fresh data:
   - Slack: keyword search across channels.
   - Salesforce: record search or SOQL query.
   - Gong: use the search_calls tool for keyword matches in transcripts.

3. Synthesize an English answer with citations:
   - Cite Slack messages with channel name and date.
   - Cite Gong calls with call title, timestamp link, and who said it.
   - Cite Salesforce records with type and date.
   - Preserve original-language excerpts when citing non-English content.
   - Note conflicts if sources disagree.

4. If the question suggests a topic not covered by any active objective, offer:
   "You don't have an objective covering [topic]. Want me to create one?"

## Notes

- This command is read-only. It queries source systems directly and does not read from or write to Supabase.
- All processing happens in memory. No state is persisted.
