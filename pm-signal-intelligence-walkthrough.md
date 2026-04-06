# PM Signal Intelligence — Setup Walkthrough

A step-by-step guide for non-developers. Estimated total time: 45-60 minutes.

By the end of this guide you'll have:
1. A Supabase project with all database tables.
2. Google OAuth configured (for the web app).
3. Claude Desktop with Slack, Salesforce, Gong, and **Gmail** connected.
4. The PM Signal Intelligence plugin installed in Cowork.
5. A shared Monday.com board linked to the signal pipeline.
6. A daily scheduled task for automatic signal collection.
7. Your first objective with a 30-day backfill of real signals.

---

## Architecture Overview

```
Data Sources (Slack, Salesforce, Gong, Gmail)
        │
        ▼
  Cowork Plugin  ──▶  Monday.com Board (shared, one board for all PMs)
                              │
                              ▼
                     Cron Job (sync-monday)
                              │
                              ▼
                        Supabase DB  ◀──  Rescore Pipeline (LLM re-evaluation
                              │            with shared patterns + PM feedback)
                              ▼
                         Web App
                         (Review & Feedback ──▶ syncs back to Monday.com)
```

**How it works:** The Cowork plugin collects signals from all data sources (Slack, Salesforce, Gong, Gmail) and writes them as items on a shared Monday.com board. Each item is tagged with the PM's UUID to differentiate ownership. A cron job periodically syncs pending items from Monday.com into Supabase, creates cluster records for grouped signals, and updates objective decompositions. After sync, a rescore pipeline re-evaluates each match using shared patterns and PM feedback history. When a PM confirms or dismisses a signal in the web app, the feedback is written to Supabase and the status is synced back to Monday.com so the plugin can learn from it.

**Shared Monday board structure:** One board (ID: `18407235431`) holds signals for all PMs. Columns:

| Column | Column ID | Purpose |
|---|---|---|
| PM UUID | `text_mm23fspz` | PM's Supabase user ID |
| Objective ID | `text_mm23qar7` | Which objective this signal matches |
| Source | `text_mm238jbc` | `slack`, `salesforce`, `gong`, `gmail`, `objective_decomposition`, `new_objective`, or `objective_status_change` |
| Account | `text_mm23xscc` | Customer account name |
| Content Summary | `text_mm23eqyw` | English summary of the signal |
| Original Content | `long_text_mm23wnrf` | Original text (if non-English) |
| Source Language | `text_mm23f67y` | Detected language code |
| Speaker Role | `text_mm23vdkn` | `customer`, `internal`, or `system` |
| Score | `numeric_mm23h4sr` | Relevance score (0-10) |
| Explanation | `text_mm23983t` | Why this signal matches the objective |
| Category | `color_mm23tcn7` | `opportunity`, `risk`, or `info` |
| Urgency | `color_mm23vf2s` | `act_now`, `this_week`, or `background` |
| Source Reference | `long_text_mm24w82p` | JSON with source type, ID, and deeplink |
| Source Timestamp | `text_mm242qzh` | ISO 8601 timestamp of original signal |
| Cluster ID | `text_mm247era` | Groups related signals together |
| Situation Summary | `text_mm24zxe` | 1-sentence cluster summary |
| Decomposition | `long_text_mm24fq7d` | Objective decomposition JSON (for `objective_decomposition` items only) |
| Status | `color_mm23b9pc` | `Pending`, `Confirmed`, `Dismissed`, or `Enriched` |

### Gmail as a Data Source

Gmail is a primary signal source. The plugin:
- Pulls threads from Gmail via the Gmail connector.
- Matches account domains against your Salesforce accounts to associate signals with the right customer.
- Summarizes key moments (renewal discussions, escalation threads, feature requests) and writes them as signal items.

### How Clustering Works

The plugin groups related signals (e.g., a Gong call and a Slack thread about the same event at the same account) by assigning them the same Cluster ID and Situation Summary. During sync, the app creates cluster records in Supabase. The web app displays clustered signals together with the situation summary as a header.

### How the Rescore Pipeline Works

After Monday→Supabase sync, the app re-evaluates each new match using:
- The objective's decomposition (signal types, entities to watch, relevant accounts)
- Shared patterns (high-confidence patterns boost scores, low-confidence ones penalize)
- PM feedback history (5 recent confirmed + 5 recent dismissed examples)

This means the scores shown in the web app may differ from the plugin's original scores on the Monday board.

---

## Part 1: Supabase setup (15 minutes)

Supabase is a hosted database. It stores everything the system produces: objectives, matches, feedback, and shared patterns. You interact with it through a web dashboard.

### 1.1 Create a Supabase account

1. Go to https://supabase.com and click "Start your project."
2. Sign in with GitHub or create an account with email.

### 1.2 Create a project

1. Click "New Project."
2. Name: `pm-signal-intelligence`
3. Set a database password. Save it in a password manager.
4. Region: choose the closest to your team (Frankfurt for Israel).
5. Plan: Pro ($25/month).
6. Click "Create new project." Wait 1-2 minutes.

### 1.3 Create the database tables

1. In the left sidebar, click "SQL Editor."
2. Click "New query."
3. Copy and paste this entire block and click "Run":

```sql
create table pm_profiles (
  id uuid primary key references auth.users(id),
  email text not null,
  name text,
  avatar_url text,
  created_at timestamptz default now()
);

create table objectives (
  id uuid primary key default gen_random_uuid(),
  pm_id uuid references pm_profiles(id) not null,
  title text not null,
  status text not null default 'active',
  decomposition jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table clusters (
  id uuid primary key default gen_random_uuid(),
  pm_id uuid references pm_profiles(id) not null,
  account text,
  situation_summary text not null,
  combined_urgency text not null,
  created_at timestamptz default now()
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  objective_id uuid references objectives(id) not null,
  pm_id uuid references pm_profiles(id) not null,
  source text not null,
  source_timestamp timestamptz,
  account text,
  content_summary text not null,
  original_content text,
  source_language text default 'en',
  speaker_role text,
  source_reference jsonb,
  relevance_score numeric not null,
  explanation text not null,
  category text not null,
  urgency text not null,
  cluster_id uuid references clusters(id),
  monday_item_id text unique,
  feedback text default 'pending',
  feedback_at timestamptz,
  rescored_at timestamptz,
  created_at timestamptz default now()
);

create table pm_feedback (
  id uuid primary key default gen_random_uuid(),
  pm_id uuid references pm_profiles(id) not null,
  match_id uuid references matches(id) not null,
  objective_id uuid references objectives(id) not null,
  signal_content_summary text,
  match_explanation text,
  feedback_type text not null,
  created_at timestamptz default now()
);

create table shared_patterns (
  id uuid primary key default gen_random_uuid(),
  pattern_description text not null,
  source_type text not null,
  source_subtype text,
  category text,
  confirmations integer default 0,
  dismissals integer default 0,
  confidence numeric generated always as (
    case when confirmations + dismissals > 0
    then confirmations::numeric / (confirmations + dismissals)
    else 0 end
  ) stored,
  contributing_pm_ids uuid[],
  created_by uuid references pm_profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Row Level Security
alter table pm_profiles enable row level security;
alter table objectives enable row level security;
alter table clusters enable row level security;
alter table matches enable row level security;
alter table pm_feedback enable row level security;
alter table shared_patterns enable row level security;

create policy "Users can read all profiles" on pm_profiles for select using (true);
create policy "Users can update own profile" on pm_profiles for update using (auth.uid() = id);

create policy "PMs read own objectives" on objectives for select using (auth.uid() = pm_id);
create policy "PMs insert own objectives" on objectives for insert with check (auth.uid() = pm_id);
create policy "PMs update own objectives" on objectives for update using (auth.uid() = pm_id);

create policy "PMs read own clusters" on clusters for select using (auth.uid() = pm_id);
create policy "PMs insert own clusters" on clusters for insert with check (auth.uid() = pm_id);

create policy "PMs read own matches" on matches for select using (auth.uid() = pm_id);
create policy "PMs insert own matches" on matches for insert with check (auth.uid() = pm_id);
create policy "PMs update own matches" on matches for update using (auth.uid() = pm_id);

create policy "PMs read own feedback" on pm_feedback for select using (auth.uid() = pm_id);
create policy "PMs insert own feedback" on pm_feedback for insert with check (auth.uid() = pm_id);

create policy "All PMs read patterns" on shared_patterns for select using (true);
create policy "Authenticated PMs insert patterns" on shared_patterns for insert with check (auth.uid() is not null);
create policy "Authenticated PMs update patterns" on shared_patterns for update using (auth.uid() is not null);

-- Indexes
create index idx_pm_profiles_email on pm_profiles(email);
create index idx_objectives_pm on objectives(pm_id, status);
create index idx_clusters_pm on clusters(pm_id, created_at desc);
create index idx_matches_objective on matches(objective_id, created_at desc);
create index idx_matches_pm_feedback on matches(pm_id, feedback);
create index idx_matches_monday_item_id on matches(monday_item_id) where monday_item_id is not null;
create index idx_patterns_confidence on shared_patterns(confidence);
create index idx_feedback_pm on pm_feedback(pm_id, objective_id);
create index idx_feedback_recent on pm_feedback(pm_id, created_at desc);
```

4. You should see "Success. No rows returned." The tables are created.
5. Verify: click "Table Editor" in the sidebar. You should see six tables, all empty.

### 1.4 Get your API credentials

1. Click "Project Settings" (gear icon in the sidebar).
2. Click "API."
3. Save these three values:
   - **Project URL** (e.g., `https://abcdefg.supabase.co`)
   - **anon public key** (starts with `eyJ...`) — for the web app
   - **service_role key** (click "Reveal") — for the web app server-side operations

### 1.5 Configure Google OAuth

Needed for the web app's login. Easier to do now while you're here.

**In Google Cloud Console (https://console.cloud.google.com):**

1. Create a project if you don't have one. Name: "PM Signal Intelligence."
2. Go to "APIs & Services" > "Credentials."
3. If prompted, configure the OAuth consent screen:
   - Choose "Internal" (restricts to your Google Workspace org).
   - App name: "PM Signal Intelligence."
   - Add your org domain as authorized.
   - Save.
4. Click "Create Credentials" > "OAuth client ID."
5. Type: "Web application." Name: "PM Signal Intelligence."
6. Under "Authorized redirect URIs," add:
   `https://<your-supabase-project-id>.supabase.co/auth/v1/callback`
   (Use the subdomain from your Supabase URL.)
7. Click "Create." Copy the **Client ID** and **Client Secret**.

**In Supabase dashboard:**

1. Go to "Authentication" in the sidebar.
2. Click "Providers."
3. Find "Google," expand it, toggle to Enabled.
4. Paste Client ID and Client Secret.
5. Click "Save."

---

## Part 2: Gong MCP server (15 minutes, needs a developer)

Ask a developer on your team to handle this part.

### What they need

1. **Gong API key** from your Gong admin (Settings > Technical > API). Two values: access key and secret key.
2. The `gong-mcp-server.zip` file (provided separately).

### What they do

1. Unzip the file and run `npm install` in the directory.
2. Test: `GONG_ACCESS_KEY=<key> GONG_SECRET_KEY=<secret> npm run inspector`
3. If the inspector opens and "list_calls" returns data, it works.
4. Note the full path to `build/index.js` (e.g., `/Users/developer/gong-mcp-server/build/index.js`).

### If Gong isn't available yet

Skip this. The plugin works with Slack, Salesforce, and Gmail alone. Add Gong later.

---

## Part 3: Claude Desktop connectors (10 minutes)

### 3.1 Install or update Claude Desktop

Go to https://claude.com/download. Install the latest version. You need a Pro or Max plan.

### 3.2 Connect Slack

1. Settings > Connectors > Slack > "Connect."
2. Authorize in the browser.
3. Tool permissions: Search messages **Allow**, Read channels **Allow**, Send messages **Block**.

### 3.3 Connect Salesforce

1. Settings > Connectors > Salesforce > "Connect."
2. Authenticate with your Salesforce credentials.
3. Permissions: Query/Read **Allow**, Create/Update **Block**.

If Salesforce isn't listed, ask your Salesforce admin about setting up a Salesforce MCP server.

### 3.4 Connect Gmail

1. Settings > Connectors > Gmail > "Connect."
2. Authorize with your Google account.
3. Permissions: Read/Search **Allow**, Send/Draft **Block**.

### 3.5 Add Gong (skip if not ready)

1. Settings > Developer > "App Config File." A text file opens.
2. If empty, replace the contents with:

```json
{
  "mcpServers": {
    "gong": {
      "command": "node",
      "args": ["/full/path/to/gong-mcp-server/build/index.js"],
      "env": {
        "GONG_ACCESS_KEY": "your-access-key",
        "GONG_SECRET_KEY": "your-secret-key"
      }
    }
  }
}
```

3. Replace the path and keys with real values.
4. Save. Quit and reopen Claude Desktop.
5. Settings > Connectors > "gong" should appear. Set all tools to **Allow**.

---

## Part 4: Install the plugin (3 minutes)

### 4.1 Download the plugin zip

Download `pm-signal-intelligence-plugin.zip`. Do not unzip it. You'll upload the zip directly.

### 4.2 Install in Cowork

1. Open Claude Desktop.
2. Switch to the "Cowork" tab.
3. In the left sidebar, click "Customize."
4. Click "Browse plugins."
5. Look for an upload option (it may say "Upload" or show a "+" icon for custom plugins).
6. Select the `pm-signal-intelligence-plugin.zip` file.
7. The plugin installs. You should see "PM Signal Intelligence" appear in your plugin list.

### 4.3 Verify installation

In any Cowork task, type "/" and you should see four new commands:
- `/pm-signal-intelligence:create-objective`
- `/pm-signal-intelligence:collect-signals`
- `/pm-signal-intelligence:query`
- `/pm-signal-intelligence:review-signals`

If they appear, the plugin is installed. You can delete the zip file from your Downloads.

---

## Part 5: Create a Cowork project and configure (5 minutes)

The plugin needs a Cowork project to store your PM identity and objectives in project memory.

### 5.1 Create the project

1. In the left sidebar, click "Projects" > "+".
2. Select "Start from scratch."
3. Name: **PM Signal Intelligence**
4. In the "Instructions" field, paste:

```
You are a PM Signal Intelligence agent. Use the pm-signal-intelligence plugin for all commands.

You are stateless between sessions. All persistent signal data flows through the Monday.com board. The web app handles Supabase reads/writes.

All outputs must be in English regardless of source language. Preserve original-language excerpts in citations.

Write signal matches to the shared Monday.com board. Write objective decompositions to the Monday board with Source = "objective_decomposition". The web app's sync cron handles everything else.
```

5. Click "Create."

### 5.2 Configure your PM identity

Open a task in the project and type:

```
Store my PM configuration.

My PM UUID: [paste your Supabase user UUID]
```

Claude stores this in project memory. It's used to tag Monday board items with your identity.

### 5.3 Verify everything works

Type:

```
Check which connectors are available. Tell me how many Slack channels you can see, whether Salesforce is connected, whether Gmail is connected, and whether Gong is available.
```

Claude should confirm access to each connected source.

---

## Part 6: Set up daily collection (2 minutes)

In the project, type:

```
/schedule "Daily signal collection" every day at 7:00 AM
```

When asked for instructions:

```
Run /pm-signal-intelligence:collect-signals
```

This runs every morning when your computer is awake and Claude Desktop is open. The daily task is fully autonomous:
- It automatically discovers new objectives you created in the web app (via Monday board markers).
- It enriches them with a decomposition (Salesforce context + LLM).
- It discovers objective status changes (pause, resolve, reactivate) and updates accordingly — paused/resolved objectives are skipped.
- It collects signals from all active objectives and writes matches to the Monday board.
- No PM interaction is needed after the initial setup.

---

## Part 7: Create your first objective (10 minutes)

### 7.1 Create the objective in the web app

1. Open the web app dashboard.
2. Click "+ New objective."
3. Enter a title (e.g., "Identify expansion opportunities in cities where we currently serve only one department").

That's it. The web app writes a marker to the Monday board so the plugin can discover it.

### 7.2 Enrich it with the plugin (optional — the daily task does this automatically)

If you want to enrich the objective immediately (rather than waiting for the next daily run), open Cowork and type:

```
/pm-signal-intelligence:create-objective
```

Claude will:
1. Find your unenriched objective from the Monday board.
2. Query Salesforce for your account landscape.
3. Generate a decomposition (signal types, entities, filters).
4. Show it to you for review. Edit as needed ("add Hebrew terms for city manager," "include accounts nearing renewal").
5. Write the decomposition to the Monday board for sync to Supabase.
6. Run a 30-day backfill. This takes a few minutes.

If you skip this step, the next daily scheduled task will automatically discover and enrich the objective — but without PM review of the decomposition.

### 7.3 Review results

After the backfill (or the next daily run), open the web app to review matches. The app shows rescored signals with full triage capabilities (confirm/dismiss). You can also preview results in Cowork:

```
/pm-signal-intelligence:review-signals
```

For full feedback that powers the learning loop, use the web app — confirm/dismiss actions there write to Supabase and sync back to Monday so the plugin can learn from your preferences.

---

## What happens next

Your signal collection pipeline is running. Every morning, Claude collects new signals and writes matches to the Monday board. The app syncs them to Supabase and rescores them.

You can:
- **Ask questions:** "What have customers said about reporting this month?" (`/pm-signal-intelligence:query`)
- **Review new signals:** `/pm-signal-intelligence:review-signals` (quick view) or use the web app (full triage)
- **Create more objectives:** Create in the web app, then enrich with `/pm-signal-intelligence:create-objective`
- **Provide feedback:** Confirm/dismiss signals in the web app to improve future scoring

---

## Daily workflow (once everything is set up)

1. Make sure Claude Desktop is open by the time your scheduled task runs.
2. Open the web app to review new matches. Confirm or dismiss a few signals daily.
3. Ask Claude questions as needed: "Summarize everything we know about City of Durham."
4. Periodically create new objectives as your strategy evolves.

---

## What's done once vs. what each PM does

### Done once (admin or first PM)

| Step | What | Time |
|------|------|------|
| Supabase project | Create project, run SQL, get API keys | 10 min |
| Google OAuth | Configure in Google Cloud + Supabase | 5 min |
| Gong MCP server | Build and test (needs developer) | 15 min |
| Monday.com board | Board is pre-configured (ID: `18407235431`) | 0 min |
| Deploy web app | Deploy to Vercel (separate effort) | varies |

### Done by each PM

| Step | What | Time |
|------|------|------|
| Install plugin | Upload zip in Cowork Customize | 2 min |
| Create project | New project with instructions | 3 min |
| Configure PM identity | Provide PM UUID | 1 min |
| Enable connectors | Slack, Salesforce, Gmail, Gong | 5 min |
| Schedule collection | Daily at 7 AM | 1 min |
| First objective | Create in web app, enrich with plugin, backfill | 10 min |
| Calibration | Confirm/dismiss signals in the web app | 5 min |

Total per PM: approximately 30 minutes, most of which produces visible results.

---

## Troubleshooting

**Slash commands don't appear after installing the plugin.** Try closing and reopening Cowork. If still missing, reinstall the plugin zip.

**Scheduled tasks didn't run.** Computer must be awake and Claude Desktop open.

**Gong not appearing in connectors.** Check the path in the config file. Restart Claude Desktop.

**Salesforce returns empty.** Custom field names may differ from what the plugin expects. Tell Claude the correct field names.

**Monday board writes failing.** Verify that the Monday MCP server is connected and has write access to board `18407235431`.

**Signals not appearing in the web app.** The sync cron runs periodically. You can trigger a manual sync from the dashboard. Check that items have Status = "Pending" on the Monday board.

**Scores differ between Monday board and web app.** This is expected. The app rescores matches using shared patterns and PM feedback. The Monday board shows the plugin's original scores.

**Claude forgets your PM UUID.** Make sure you're working inside the "PM Signal Intelligence" project, not a standalone Cowork task. Memory is project-scoped.

**"No active objectives found."** You need to create at least one objective: first in the web app dashboard, then enrich it with `/pm-signal-intelligence:create-objective`.
