---
name: create-objective
description: Define a new strategic objective. Queries Salesforce for account context, generates a decomposition of signal types and entities to watch, and runs a 30-day backfill.
---

## Steps

1. Ask the PM to describe the objective in natural language. If already provided, proceed.

2. Query Salesforce for an account landscape summary:
   - Total active accounts grouped by active department count.
   - Accounts with open opportunities.
   - Accounts approaching renewal (next 90 days).

3. Use the objective-decomposition skill to generate a structured decomposition from the objective text and Salesforce summary.

4. Show the decomposition to the PM. Ask:
   - "Are there specific account names, department names, or people I should watch for?"
   - "Are there Slack channels that are particularly relevant?"
   - "Should I watch for terms in languages other than English (e.g., Hebrew)?"

5. Apply the PM's edits.

6. Write the objective to Supabase:
   ```
   POST {supabase_url}/rest/v1/objectives
   Headers: apikey: {service_role_key}, Authorization: Bearer {service_role_key}, Content-Type: application/json, Prefer: return=representation
   Body: {"pm_id": "{pm_id}", "title": "{objective text}", "status": "active", "decomposition": {decomposition JSON}}
   ```

7. Run `/pm-signal-intelligence:collect-signals --days 30` for a backfill.

8. After backfill completes, show the PM the top 5 matches by score.

9. Ask the PM to confirm or dismiss: "Say 'confirm 1, 3, 5' and 'dismiss 2, 4' to help me learn what's useful."

10. For each confirmed/dismissed match, update the match record in Supabase:
    ```
    PATCH {supabase_url}/rest/v1/matches?id=eq.{match_id}
    Body: {"feedback": "confirmed" or "dismissed", "feedback_at": "{now}"}
    ```
    And insert a feedback record:
    ```
    POST {supabase_url}/rest/v1/pm_feedback
    Body: {"pm_id": "{pm_id}", "match_id": "{match_id}", "objective_id": "{objective_id}", "signal_content_summary": "...", "match_explanation": "...", "feedback_type": "confirmed" or "dismissed"}
    ```

11. Confirm: "Your objective '[name]' is now active. Daily collection will pick up new signals. Open the app to review matches anytime."
