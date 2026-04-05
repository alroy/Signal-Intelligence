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
   - Filter by PM UUID column (`text_mm23fspz`) matching the current PM.
   - Optionally filter by objective if the PM specifies one (`text_mm23qar7`).
   - Sort by score descending.

2. Group matches for display:
   - If matches share a `Cluster ID` (`text_mm247era`), show the `Situation Summary` (`text_mm24zxe`) as a header with individual matches nested below.
   - Unclustered matches appear individually.
   - Within each group, sort by score descending.

3. Present each match showing:
   - Score and category (opportunity/risk/info)
   - Urgency badge (act_now/this_week/background)
   - Source and account
   - Content summary
   - Explanation of why it matched
   - Source deeplink if available (from `Source Reference` column)

4. Let the PM discuss relevance. If the PM indicates a match is not useful, note their preference for future collection runs.

## Notes

- This command reads from the Monday.com board. It does not access Supabase directly.
- **Scores shown are the plugin's original scores** (pre-rescore). The web app may show different scores after the app's rescoring pipeline runs. For the most accurate scores and full triage with confirm/dismiss feedback, the PM should use the web app dashboard.
- If there are no recent items, say: "No new matches on the board. Run /pm-signal-intelligence:collect-signals to check for fresh signals."
