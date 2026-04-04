---
name: signal-clustering
description: Groups individual matches into cohesive "Situations" or "Events." This reduces signal fatigue by connecting related data points across different sources (Slack, Gong, Salesforce, Gmail) within a specific timeframe. Runs server-side after Monday-to-Supabase sync, not in the Cowork plugin.
---

## When This Runs

This skill runs **server-side** after the Monday-to-Supabase sync cron job imports new signals. It operates on unclustered matches already in the Supabase `matches` table. It does **not** run in the Cowork plugin — the plugin writes flat, unclustered items to the Monday.com board.

## Clustering Logic

Query unclustered matches (`cluster_id IS NULL`) from the `matches` table. Group and evaluate them as follows:

### 1. Grouping Parameters
* **Primary Anchor:** `account`. Signals must belong to the same account to be clustered.
* **Temporal Window:** 72 hours. Signals occurring more than 3 days apart should generally remain separate unless a direct semantic link is found.
* **Cross-Source Affinity:** Prioritize clustering signals from different sources that share the same entities. For example: a Gmail renewal thread + a Gong call debrief + a Slack discussion about the same account.

### 2. LLM Evaluation Criteria
When comparing two signals for a cluster, ask:
* Do these signals refer to the same **Economic Event** (e.g., a budget hearing, an RFP release, a contract renewal)?
* Do these signals involve the same **Key Stakeholders** or their direct reports?
* Is one signal a direct consequence or reaction to the other (e.g., a Gong call followed by a Slack "debrief", or a Gmail thread followed by a Salesforce note)?

If any one of these conditions is met, the signals should be clustered.

### 3. Output Requirements
For every cluster identified:
1. Insert a row into the `clusters` table with:
   * **situation_summary:** A 1-sentence English summary of the combined event (e.g., "Coordinated push for Enterprise upgrade following Miami-Dade Q3 budget surplus announcement").
   * **combined_urgency:** The highest urgency score among all signals in the cluster.
2. Update the `cluster_id` on each member match in the `matches` table.

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
* Individual match records keep their original urgency values. The `combined_urgency` on the cluster record is the highest urgency among its members. Do not overwrite individual match urgency scores.
