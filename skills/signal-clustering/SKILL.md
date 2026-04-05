---
name: signal-clustering
description: Groups individual matches into cohesive "Situations" or "Events." This reduces signal fatigue by connecting related data points across different sources (Slack, Gong, Salesforce, Gmail) within a specific timeframe.
---

## Clustering Logic

Run this skill after `signal-matching` has identified relevant signals, but before the final write to the Monday.com board.

### 1. Grouping Parameters
* **Primary Anchor:** `account`. Signals must belong to the same account to be clustered.
* **Temporal Window:** 72 hours. Use `source_timestamp` to compare signal timing. Signals occurring more than 3 days apart should generally remain separate unless a direct semantic link is found.
* **Cross-Source Affinity:** Prioritize clustering a "Customer Statement" (Gong) with an "Internal Discussion" (Slack) if they share the same entities.

### 2. LLM Evaluation Criteria
When comparing two signals for a cluster, ask:
* Do these signals refer to the same **Economic Event** (e.g., a budget hearing, an RFP release, a contract renewal)?
* Do these signals involve the same **Key Stakeholders** or their direct reports?
* Is one signal a direct consequence or reaction to the other (e.g., a Gong call followed by a Slack "debrief")?

### 3. Output Requirements
For every cluster identified, generate:
* **cluster_id:** A unique UUID shared by all matches in the group.
* **Situation Summary:** A 1-sentence English summary of the combined event (e.g., "Coordinated push for Enterprise upgrade following Miami-Dade Q3 budget surplus announcement").
* **Combined Urgency:** The highest urgency score among all signals in the cluster.

When writing clustered matches to the Monday.com board via `collect-signals`, set both the `Cluster ID` column (`text_mm247era`) and the `Situation Summary` column (`text_mm24zxe`) on every item in the cluster. The app's sync process will use these to create proper cluster records in Supabase and display them in the web app.

## B2G Specific Scenarios

| If Signal A is... | And Signal B is... | Cluster Action |
| :--- | :--- | :--- |
| Salesforce Stage Change (to Risk) | Slack thread discussing a champion leaving | **Cluster:** Label as "Account Health Deterioration". |
| Gong call mentioning a competitor | Salesforce note about a new RFP | **Cluster:** Label as "Competitive Threat / New Procurement". |
| Slack chatter about a feature request | Gong call where a user expresses frustration | **Cluster:** Label as "Product Gap Impacting Relationship". |
| Gmail renewal negotiation thread | Salesforce opportunity stage change | **Cluster:** Label as "Active Renewal Negotiation". |
| Gmail escalation from city manager | Slack internal triage thread | **Cluster:** Label as "Customer Escalation In Progress". |

## Constraints
* Do not cluster signals from different Accounts even if the "Theme" is similar (e.g., two different cities facing the same state-level budget cut). These must remain distinct for PM workflow.
* If a signal is a 9/10 "Act Now" urgency, do not "hide" it inside a cluster of low-priority background info; ensure the cluster inherits the highest urgency.
