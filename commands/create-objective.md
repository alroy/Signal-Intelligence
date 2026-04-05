---
name: create-objective
description: Define a new strategic objective. Queries Salesforce for account context, generates a decomposition of signal types and entities to watch, saves it to the web app, and runs a 30-day backfill.
---

## Steps

1. Ask the PM to describe the objective in natural language. If already provided, proceed.

2. Check if the PM has already created the objective in the web app dashboard:
   - Ask: "Have you already created this objective in the web app, or should I walk you through that first?"
   - If not yet created: instruct the PM to create it via the dashboard's "+ New objective" button. The PM must provide the resulting objective ID (visible in the URL after creation).
   - If already created: ask for the objective ID.

3. Query Salesforce for an account landscape summary:
   - Total active accounts grouped by active department count.
   - Accounts with open opportunities.
   - Accounts approaching renewal (next 90 days).

4. Use the objective-decomposition skill to generate a structured decomposition from the objective text and Salesforce summary.

5. Show the decomposition to the PM. Ask:
   - "Are there specific account names, department names, or people I should watch for?"
   - "Are there Slack channels that are particularly relevant?"
   - "Should I watch for terms in languages other than English (e.g., Hebrew)?"

6. Apply the PM's edits.

7. Save the decomposition to the web app via the objectives API:
   ```
   PATCH {app_url}/api/objectives
   Headers: Authorization: Bearer {signals_api_key}, Content-Type: application/json
   Body: {"objective_id": "{objective_id}", "decomposition": {decomposition JSON}}
   ```
   This writes the decomposition to Supabase so the app's rescoring pipeline can use it.

8. Store the objective in Cowork project memory for use during signal collection:
   - Store: `{ "id": "{objective_id}", "title": "{objective text}", "status": "active", "decomposition": {decomposition JSON} }`
   - Add to the list of active objectives in project memory.

9. Run `/pm-signal-intelligence:collect-signals --days 30` for a backfill.

10. After backfill completes, tell the PM:
    "Your objective '[name]' is now active with a full decomposition. I've run a 30-day backfill and written matches to the Monday board. Signals will sync to the web app shortly, or you can trigger a manual sync from the dashboard."
