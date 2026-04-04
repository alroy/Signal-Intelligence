---
name: review-signals
description: Review recent signal matches from the Monday.com board. Lets the PM see what was collected and discuss relevance.
---

## When to use

The PM wants to review recent matches, e.g.:
- "Show me what's new."
- "Let me review today's signals."
- "Any new matches for my expansion objective?"

## Steps

1. Read recent items from the Monday.com board using the Monday MCP server:
   - **Board ID**: `18407235431`
   - Filter by PM UUID column matching the current PM.
   - Optionally filter by objective if the PM specifies one.
   - Sort by score descending.

2. Group matches for display:
   - If matches share a `cluster_id`, show a cluster header with individual matches nested below.
   - Unclustered matches appear individually.
   - Within each group, sort by score descending.

3. Present each match showing:
   - Score and category (opportunity/risk/info)
   - Urgency badge (act_now/this_week/background)
   - Source and account
   - Content summary
   - Explanation of why it matched

4. Let the PM discuss relevance. If the PM indicates a match is not useful, note their preference for future collection runs.

## Notes

- This command reads from the Monday.com board. It does not access Supabase directly.
- For full triage with confirm/dismiss feedback, the PM should use the web app dashboard, which writes feedback to Supabase and powers the learning loop.
- If there are no recent items, say: "No new matches on the board. Run /pm-signal-intelligence:collect-signals to check for fresh signals."
