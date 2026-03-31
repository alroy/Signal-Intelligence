# PM Signal Intelligence — Setup Walkthrough

A step-by-step guide for non-developers. Estimated total time: 45-60 minutes.

By the end of this guide you'll have:
1. A Supabase project with all database tables.
2. Google OAuth configured (for the app, later).
3. Claude Desktop with Slack, Salesforce, and Gong connected.
4. The PM Signal Intelligence plugin installed in Cowork.
5. A daily scheduled task for automatic signal collection.
6. Your first objective with a 30-day backfill of real signals.

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
  feedback text default 'pending',
  feedback_at timestamptz,
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
create index idx_objectives_pm on objectives(pm_id, status);
create index idx_clusters_pm on clusters(pm_id, created_at desc);
create index idx_matches_objective on matches(objective_id, created_at desc);
create index idx_matches_pm_feedback on matches(pm_id, feedback);
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
   - **anon public key** (starts with `eyJ...`) — for the app later
   - **service_role key** (click "Reveal") — for Cowork

### 1.5 Configure Google OAuth

Needed for the app's login. Easier to do now while you're here.

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

Skip this. The plugin works with Slack and Salesforce alone. Add Gong later.

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

### 3.4 Add Gong (skip if not ready)

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

This is where previous versions of this guide asked you to maintain a folder on your desktop. That's no longer necessary. The plugin installs properly into Cowork and Claude manages it internally.

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

In any Cowork task, type "/" and you should see three new commands:
- `/pm-signal-intelligence:create-objective`
- `/pm-signal-intelligence:collect-signals`
- `/pm-signal-intelligence:query`

If they appear, the plugin is installed. You can delete the zip file from your Downloads.

---

## Part 5: Create a Cowork project and configure (5 minutes)

Even though the plugin is installed globally, you need a Cowork project to store your Supabase credentials in project memory.

### 5.1 Create the project

1. In the left sidebar, click "Projects" > "+".
2. Select "Start from scratch."
3. Name: **PM Signal Intelligence**
4. In the "Instructions" field, paste:

```
You are a PM Signal Intelligence agent. Use the pm-signal-intelligence plugin for all commands.

You are stateless. Do not create or read local files. All persistent data lives in Supabase.

All outputs must be in English regardless of source language. Preserve original-language excerpts in citations.

Write matches and objectives to Supabase via REST API using the service role key. Read objectives, patterns, and feedback from Supabase.

After collecting signals or creating an objective, tell me to open the app to review. Until the app is built, show top results in our conversation.
```

5. Click "Create."

### 5.2 Configure Supabase access

Open a task in the project and type:

```
Configure Supabase access.

Supabase URL: [paste your URL]
Service role key: [paste your service role key]
My PM ID: [use your email for now, e.g., gil@zencity.io — will switch to UUID when the app is ready]
```

Claude stores these in project memory. They persist across all tasks in this project.

### 5.3 Verify everything works

Type:

```
Check which connectors are available. Tell me how many Slack channels you can see, whether Salesforce is connected, and whether Gong is available. Then try reading from Supabase — fetch all objectives for my PM ID.
```

Claude should confirm access to each source and return an empty objectives list from Supabase (since you haven't created any yet).

---

## Part 6: Set up daily collection (2 minutes)

In the project, type:

```
/schedule "Daily signal collection" every day at 7:00 AM
```

When asked for instructions:

```
Run /pm-signal-intelligence:collect-signals for the past 24 hours.
```

This runs every morning when your computer is awake and Claude Desktop is open.

---

## Part 7: Create your first objective (10 minutes)

Type:

```
/pm-signal-intelligence:create-objective
```

Or describe it directly:

```
I want to identify expansion opportunities in cities where we currently serve only one department.
```

Claude will:
1. Query Salesforce for your account landscape.
2. Generate a decomposition (signal types, entities, filters).
3. Show it to you for review. Edit as needed ("add Hebrew terms for city manager," "include accounts nearing renewal").
4. Write the objective to Supabase.
5. Run a 30-day backfill. This takes a few minutes.
6. Show the top matches.

Review the results and provide feedback:

```
Confirm signals 1, 3, 5. Dismiss 2, 4.
```

Claude writes this feedback to Supabase. Your next collection run will benefit from it.

---

## What happens next

Your signal collection pipeline is running. Every morning, Claude collects new signals and writes matches to Supabase.

Until the app is built, you can:
- Ask questions: "What have customers said about reporting this month?"
- Check new signals: "Show me today's matches."
- Create more objectives: `/pm-signal-intelligence:create-objective`
- Provide feedback: "Confirm signal 2, dismiss signal 5."

Once the app is ready, it reads from the same Supabase database and gives you the proper interface with one-click confirm/dismiss, digests, trend charts, and shared patterns.

---

## Daily workflow (once everything is set up)

1. Make sure Claude Desktop is open by the time your scheduled task runs.
2. Open the app (when ready) to review new matches. Until then, ask Claude in Cowork.
3. Confirm or dismiss a few signals daily.
4. Check the weekly digest for summaries and suggestions.

---

## What's done once vs. what each PM does

### Done once (admin or first PM)

| Step | What | Time |
|------|------|------|
| Supabase project | Create project, run SQL, get API keys | 10 min |
| Google OAuth | Configure in Google Cloud + Supabase | 5 min |
| Gong MCP server | Build and test (needs developer) | 15 min |
| Slack channel | Create #pm-signal-intelligence | 1 min |
| Deploy app | When ready (separate effort) | varies |

### Done by each PM

| Step | What | Time |
|------|------|------|
| Install plugin | Upload zip in Cowork Customize | 2 min |
| Create project | New project with instructions | 3 min |
| Configure Supabase | Provide URL, key, PM ID | 2 min |
| Enable connectors | Slack, Salesforce, Gong | 5 min |
| Schedule collection | Daily at 7 AM | 1 min |
| First objective | Create, review, backfill | 10 min |
| Calibration | Confirm/dismiss backfill signals | 5 min |

Total per PM: approximately 30 minutes, most of which produces visible results.

---

## Troubleshooting

**Slash commands don't appear after installing the plugin.** Try closing and reopening Cowork. If still missing, reinstall the plugin zip.

**Scheduled tasks didn't run.** Computer must be awake and Claude Desktop open.

**Gong not appearing in connectors.** Check the path in the config file. Restart Claude Desktop.

**Salesforce returns empty.** Custom field names may differ from what the plugin expects. Tell Claude the correct field names.

**Supabase writes failing.** Verify URL and service role key in project memory. Check tables exist (Table Editor in Supabase dashboard).

**Claude forgets Supabase config.** Make sure you're working inside the "PM Signal Intelligence" project, not a standalone Cowork task. Memory is project-scoped.

**"No active objectives found."** You need to create at least one objective first: `/pm-signal-intelligence:create-objective`.
