---
name: create-objective
description: Define a new strategic objective. Queries Salesforce for account context, generates a decomposition of signal types and entities to watch, writes it to the Monday board for sync, and runs a 90-day backfill. Can be triggered manually or via a Cowork scheduled task.
---

## Steps

1. Check the Monday board for unenriched objectives from the web app:
   - Read items from board `18407235431` where Source = `new_objective` and Status = `Pending`.
   - Filter by PM UUID matching the current PM.
   - If items exist, list them:
     "I found these objectives you created in the web app that haven't been enriched yet:
      1. [title] (ID: [objective_id])
      2. [title] (ID: [objective_id])
      Would you like me to enrich one of these, or create a new one?"
   - If the PM selects one, use its Objective ID and title — skip to step 4 (Salesforce query).
   - If no items found or PM wants a new one, continue with step 2.

2. Ask the PM to describe the objective in natural language. If already provided, proceed.

3. Ensure the objective exists in the web app:
   - Ask: "Have you already created this objective in the web app?"
   - If not yet created: instruct the PM to create it via the dashboard's "+ New objective" button. The PM must provide the resulting objective ID (visible in the URL after creation).
   - If already created: ask for the objective ID.

4. Query Salesforce for an account landscape summary:
   - Total active accounts grouped by active department count.
   - Accounts with open opportunities.
   - Accounts approaching renewal (next 90 days).

5. Use the objective-decomposition skill to generate a structured decomposition from the objective text and Salesforce summary.

6. Show the decomposition to the PM. Ask:
   - "Are there specific account names, department names, or people I should watch for?"
   - "Are there Slack channels that are particularly relevant?"
   - "Should I watch for terms in languages other than English (e.g., Hebrew)?"

7. Apply the PM's edits.

8. Write the decomposition to the Monday.com board so the app can sync it to Supabase:

   Call the Monday MCP `create_item` tool:

   * **Board ID**: `18407235431`
   * **Item name**: Objective title (truncated to 50 characters)
   * **Column values**:

   | Column | Monday Column ID | Value |
   |---|---|---|
   | PM UUID | `text_mm23fspz` | PM's Supabase user ID |
   | Objective ID | `text_mm23qar7` | The objective UUID from the web app |
   | Source | `text_mm238jbc` | `objective_decomposition` (marker for sync) |
   | Decomposition | `long_text_mm24fq7d` | The full decomposition JSON |
   | Status | `color_mm23b9pc` | `Pending` |

   The app's sync cron detects items with Source = `objective_decomposition` and updates the objective's `decomposition` field in Supabase instead of creating a match.

9. If this objective came from a `new_objective` marker (step 1), update that marker item's Status to `Enriched` using the Monday MCP `change_item_column_values` tool.

10. Store the objective in Cowork project memory for use during signal collection:
    - Store: `{ "id": "{objective_id}", "title": "{objective text}", "status": "active", "decomposition": {decomposition JSON} }`
    - Add to the list of active objectives in project memory.

11. Run `/pm-signal-intelligence:collect-signals --days 90` for a backfill.

12. After backfill completes, tell the PM:
    "Your objective '[name]' is now active with a full decomposition. I've run a 90-day backfill and written matches to the Monday board. Signals will sync to the web app shortly, or you can trigger a manual sync from the dashboard."

## Scheduling

This command can be run as a Cowork scheduled task. For example, a PM could schedule it to run weekly to check if any existing objectives need decomposition updates based on new Salesforce data.
