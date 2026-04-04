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

6. Save the objective to Cowork project memory:
   - Generate a UUID for the objective.
   - Store: `{ "id": "{uuid}", "title": "{objective text}", "status": "active", "decomposition": {decomposition JSON} }`
   - Add to the list of active objectives in project memory.

7. Run `/pm-signal-intelligence:collect-signals --days 30` for a backfill.

8. After backfill completes, tell the PM:
   "Your objective '[name]' is now active. I've run a 30-day backfill and written matches to the Monday board. Signals will sync to the web app shortly, or you can trigger a manual sync from the dashboard."
