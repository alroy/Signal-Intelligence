---
name: review-signals
description: Review and triage pending signal matches. Lets the PM confirm or dismiss matches to improve future scoring through the feedback learning loop.
---

## When to use

The PM wants to review recent matches, e.g.:
- "Show me what's new."
- "Let me review today's signals."
- "Any new matches for my expansion objective?"

## Steps

1. Fetch pending matches from Supabase:
   ```
   GET {supabase_url}/rest/v1/matches?pm_id=eq.{pm_id}&feedback=eq.pending&order=relevance_score.desc&limit=20
   ```
   Optionally filter by objective if the PM specifies one:
   ```
   &objective_id=eq.{objective_id}
   ```

2. Group matches for display:
   - If matches share a `cluster_id`, show the cluster's situation summary as a header with individual matches nested below.
   - Unclustered matches appear individually.
   - Within each group, sort by `relevance_score` descending.

3. Present each match showing:
   - Index number (for confirm/dismiss)
   - Score and category (opportunity/risk/info)
   - Urgency badge (act_now/this_week/background)
   - Source and account
   - Content summary
   - Explanation of why it matched

4. Ask the PM to confirm or dismiss:
   "Reply with 'confirm 1, 3, 5' and 'dismiss 2, 4' — or 'confirm all' / 'dismiss all'. You can also skip items to review later."

5. For each confirmed/dismissed match, update the match record:
   ```
   PATCH {supabase_url}/rest/v1/matches?id=eq.{match_id}
   Body: {"feedback": "confirmed" or "dismissed", "feedback_at": "{now}"}
   ```
   And insert a feedback record:
   ```
   POST {supabase_url}/rest/v1/pm_feedback
   Body: {"pm_id": "{pm_id}", "match_id": "{match_id}", "objective_id": "{objective_id}", "signal_content_summary": "...", "match_explanation": "...", "feedback_type": "confirmed" or "dismissed"}
   ```

6. After processing, summarize:
   "Reviewed [N] matches: [X] confirmed, [Y] dismissed, [Z] skipped. Your feedback improves future signal scoring."

## Notes

- This command reads and writes to Supabase. It does not query source systems.
- Feedback records power the learning loop in `collect-signals` (few-shot examples and threshold calibration).
- If there are no pending matches, say: "No new matches to review. Run /pm-signal-intelligence:collect-signals to check for fresh signals."
