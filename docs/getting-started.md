# Getting Started with PM Signal Intelligence

Welcome! PM Signal Intelligence monitors your company's Slack, Salesforce, Gong, and Gmail for signals that matter to your strategic objectives. It surfaces relevant conversations, deals, and customer moments so you don't have to hunt for them manually.

This guide walks you through setting everything up. You'll need about **20 minutes**.

**What you'll set up:**

- Claude Desktop connected to Slack, Salesforce, Gmail, and Gong
- The PM Signal Intelligence plugin installed
- A Cowork project configured with your identity
- A daily schedule that collects signals automatically
- Your first objective with a 90-day backfill of real signals

**Prerequisites:**

- Claude Desktop with a Pro or Max plan
- A Zencity email address (any Zencity employee can log in to the web app with their business email)
- Access to your company's Slack, Salesforce, and Gmail

---

## Step 1: Connect Your Data Sources

Open Claude Desktop and go to **Settings > Connectors**. You'll connect each data source that the plugin reads from.

### Slack

1. Click **Slack > "Connect."**
2. Authorize in the browser when prompted.
3. Set tool permissions:
   - Search messages: **Allow**
   - Read channels: **Allow**
   - Send messages: **Block**

### Salesforce

1. Click **Salesforce > "Connect."**
2. Sign in with your Salesforce credentials.
3. Set permissions:
   - Query / Read: **Allow**
   - Create / Update: **Block**

### Gmail

1. Click **Gmail > "Connect."**
2. Authorize with your Google account.
3. Set permissions:
   - Read / Search: **Allow**
   - Send / Draft: **Block**

### Gong

Gong requires a dedicated MCP server to be installed. The MCP server is not yet available, but the plugin already supports Gong and will start collecting call insights as soon as the MCP server is set up. No action needed from you on this step right now — you'll be notified when Gong integration is ready.

---

## Step 2: Install the Plugin

1. [Download the plugin file: pm-signal-intelligence-plugin.zip](PLACEHOLDER_URL)
2. Open Claude Desktop and switch to the **Cowork** tab.
3. In the left sidebar, click **Customize**.
4. Click **Browse plugins**.
5. Look for the upload option (it may say "Upload" or show a **+** icon).
6. Select the `pm-signal-intelligence-plugin.zip` file you downloaded.

### Verify it worked

In any Cowork task, type `/` and you should see four new commands:

- `/pm-signal-intelligence:create-objective`
- `/pm-signal-intelligence:collect-signals`
- `/pm-signal-intelligence:query`
- `/pm-signal-intelligence:review-signals`

If they appear, you're good. You can delete the zip file from your Downloads.

---

## Step 3: Create a Cowork Project

The plugin needs a dedicated project to remember your identity and objectives between sessions.

1. In the Cowork sidebar, click **Projects > "+"**.
2. Select **Start from scratch**.
3. Name the project: **PM Signal Intelligence**
4. In the **Instructions** field, paste:

```
Run /pm-signal-intelligence:collect-signals

This is an autonomous daily task. Do not ask questions or wait for user input.

Before collecting signals, read ALL items from Monday.com board 18407235431 using the Monday MCP server. Look for any item where the Source column (text_mm238jbc) has the value "new_objective" and the Status column (color_mm23b9pc) shows "Pending". Match against my PM UUID in column text_mm23fspz.

For each new_objective item found:
1. Read the Objective ID from column text_mm23qar7 and the item name (the objective title).
2. Query Salesforce for an account landscape summary.
3. Run the objective-decomposition skill to generate a decomposition.
4. Write the decomposition to Monday as a new item with Source = "objective_decomposition" in column text_mm238jbc, the Objective ID in text_mm23qar7, PM UUID in text_mm23fspz, and the decomposition JSON in long_text_mm24fq7d. Set Status to Pending.
5. Update the original new_objective item's Status to "Enriched".
6. Store the objective in project memory with its ID, title, and decomposition.

Then proceed with the full signal collection pipeline across all active objectives in project memory.

Log a summary at the end: how many new objectives were enriched, how many signals collected, how many matches written, how many clusters formed.

If no active objectives exist in project memory and no new_objective items are found, log "No active objectives. Create one in the web app." and stop.

If a data source is unavailable, continue with the remaining sources.
```

5. Click **Create**.

---

## Step 4: Configure Your PM Identity

The plugin tags every signal it finds with your unique PM identifier. You need to tell it who you are.

### Find your UUID

1. Open the **PM Signal Intelligence web app** in your browser.
2. Go to the app's **Settings** page.
3. Under **Cowork Plugin Configuration**, you'll see your UUID.
4. Click the **copy button** next to it.

### Tell the plugin

Open a new task inside your **PM Signal Intelligence** project in Cowork and type:

```
Store my PM configuration.
My PM UUID: [paste your UUID here]
```

Claude will store this in project memory. From now on, every signal it writes to the Monday board will be tagged with your UUID so the web app knows it's yours.

> **Important:** Always work inside the "PM Signal Intelligence" project in Cowork. If you open a standalone task outside the project, Claude won't have your UUID and will ask for it again.

---

## Step 5: Set Up Daily Signal Collection

Still inside the project, type:

```
/schedule "Daily signal collection" every day at 7:00 AM
```

The project instructions you pasted in Step 3 already tell Claude exactly what to do during each daily run. Every morning, the plugin will automatically:

- Discover any new objectives you've created in the web app
- Enrich new objectives with a decomposition (signal types, entities to watch, Salesforce filters)
- Detect objective status changes (paused, resolved, or reactivated)
- Collect signals from Slack, Salesforce, Gmail, and Gong
- Score and cluster them
- Write matches to the Monday board for the web app to sync

On the very first run, the plugin automatically looks back **90 days** to capture historical signals. After that, each daily run covers the last 24 hours.

> **Note:** Claude Desktop must be open on your computer for scheduled tasks to run. If your computer is asleep at 7 AM, the task runs when you next open Claude Desktop.

---

## Step 6: Create Your First Objective

Objectives are the strategic topics you want the system to monitor. For example: "Identify expansion opportunities in cities where we currently serve only one department" or "Track competitive threats in active procurement cycles."

### Create the objective in the web app

1. Open the web app and go to the **Dashboard**.
2. Click **"+ New objective"**.
3. Enter a descriptive title.

That's all you need to do in the web app. It writes a marker to the Monday board so the plugin can discover it.

### Enrich it (optional — happens automatically on the next daily run)

If you want results right away instead of waiting until tomorrow morning, open Cowork and run:

```
/pm-signal-intelligence:create-objective
```

Claude will:

1. Find your new objective from the Monday board.
2. Query Salesforce for your account landscape (accounts, departments, opportunities, renewals).
3. Generate a **decomposition** — a structured breakdown of what signal types to look for, which entities to watch, and which Salesforce filters to apply.
4. Show the decomposition to you for review. You can edit it: "add Hebrew terms for city manager," "include accounts nearing renewal," etc.
5. Write the final decomposition to the Monday board.
6. Run a **90-day backfill** — scanning the past 90 days of data across all sources for relevant signals. This takes a few minutes.

If you skip this step, the next scheduled daily run will discover and enrich the objective automatically (though without your review of the decomposition).

---

## Step 7: Review and Triage Signals

Once signals are collected (either from the backfill or the daily run), they flow through to the web app.

### How signals reach the web app

The system syncs signals from the Monday board to the web app's database periodically. You can also trigger a sync manually by clicking the **Sync** button on the dashboard.

### Reviewing signals

1. Open the **Dashboard** in the web app.
2. Click on an objective to open its signal feed.
3. Each signal shows:
   - **Score** — how relevant the system thinks it is (0-10)
   - **Category** — opportunity, risk, or info
   - **Urgency** — act now, this week, or background
   - **Source** — Slack, Salesforce, Gong, or Gmail
   - **Account** — the customer account involved
   - **Summary** — a concise English description
   - **Explanation** — why the system matched it to your objective

Related signals are **clustered** together (e.g., a Gong call and a Slack thread about the same event at the same account). Clusters have a **situation summary** header that describes the overall picture.

### Confirm or dismiss

This is the most important part of your daily workflow:

- **Confirm** a signal if it's genuinely relevant to your objective. This tells the system: "more like this."
- **Dismiss** a signal if it's noise or not useful. This tells the system: "less like this."

Your feedback directly improves future results. Here's what happens behind the scenes:

1. Your confirm/dismiss decision is saved in the web app.
2. It syncs back to the Monday board.
3. On the next daily collection run, the plugin reads your recent feedback.
4. It uses your confirmed signals as positive examples and dismissed signals as negative examples when scoring new matches.
5. Over time, the system learns your preferences and surfaces better results.

> **Tip:** You don't need to review every signal. Focus on confirming the best ones and dismissing the clearly irrelevant ones. Even a few decisions per day make a noticeable difference.

> **Note:** Scores in the web app may differ from what the plugin originally assigned. The web app applies additional rescoring using cross-PM patterns and your feedback history. This is expected.

---

## Managing Objectives Over Time

As your strategy evolves, you can manage your objectives from the web app:

- **Pause** an objective to temporarily stop collecting signals for it. Useful when a strategic priority is on hold.
- **Resolve** an objective when it's complete or no longer relevant.
- **Reactivate** a paused or resolved objective to resume signal collection.

Status changes sync automatically to the plugin — paused and resolved objectives are skipped during daily collection.

You can create new objectives at any time by clicking **"+ New objective"** on the dashboard.

---

## Other Useful Commands

You can use these anytime in your Cowork project:

| Command | What it does |
|---|---|
| `/pm-signal-intelligence:query` | Ask natural-language questions across all your data sources. Example: "What have customers said about reporting this month?" |
| `/pm-signal-intelligence:review-signals` | Quick preview of recent signals from the Monday board, without opening the web app. |
| `/pm-signal-intelligence:create-objective` | Manually discover and enrich new objectives (instead of waiting for the daily run). |
| `/pm-signal-intelligence:collect-signals` | Manually trigger signal collection (instead of waiting for the daily run). |

---

## Your Daily Workflow

Once everything is set up, your routine looks like this:

1. **Morning:** Make sure Claude Desktop is open before your scheduled collection time.
2. **Review:** Open the web app to check new signals. Confirm or dismiss a few each day.
3. **Ask questions:** Use `/pm-signal-intelligence:query` in Cowork for ad-hoc research. Example: "Summarize everything we know about City of Durham."
4. **Evolve:** Create new objectives as your strategy shifts. Pause or resolve objectives that are no longer active.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Slash commands don't appear after installing the plugin | Close and reopen Cowork. If still missing, reinstall the plugin zip. |
| Scheduled task didn't run | Your computer must be awake and Claude Desktop must be open at the scheduled time. |
| Claude forgets your PM UUID | Make sure you're working inside the "PM Signal Intelligence" project, not a standalone task. Project memory is scoped to the project. |
| Signals not appearing in the web app | The sync runs periodically. Click the **Sync** button on the dashboard to trigger it manually. Check that items have Status = "Pending" on the Monday board. |
| Scores differ between Cowork preview and web app | This is expected. The web app rescores signals using cross-PM patterns and your personal feedback history. |
| Salesforce returns empty results | Custom field names may differ from what the plugin expects. Tell Claude the correct field names in your Cowork task. |
| "No active objectives found" | You need at least one objective. Create one in the web app dashboard, then enrich it with `/pm-signal-intelligence:create-objective`. |
