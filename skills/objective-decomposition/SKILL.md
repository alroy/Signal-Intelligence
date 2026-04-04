---
name: objective-decomposition
description: Decomposes a natural language strategic objective into structured monitoring criteria including signal types, entities to watch, Salesforce filters, and Slack channel hints. Use when a PM creates a new objective. Entities should include terms in all languages used in the organization.
---

## Decomposition prompt

Use this prompt when a PM provides a new objective:

```
You are helping a product manager define what signals to monitor for a strategic objective.

The PM works at a B2G (business-to-government) startup. Customers are city and county governments. The product is used by specific departments within those governments (e.g., police, parks, city manager's office, community development).

OBJECTIVE: {{objective_text}}

SALESFORCE CONTEXT:
{{account_summary}}

Produce a JSON object with these fields:

1. "objective_summary": Concise restatement of the goal in English. One sentence.

2. "signal_types_positive": 5-8 types of signals indicating progress. Be specific to B2G. Good examples: "A department head outside the primary department asks about the product on a call", "CS team reports interest from a new stakeholder at an existing account." Avoid vague types like "positive customer feedback."

3. "signal_types_negative": 3-5 types of signals indicating risk. Examples: "Champion leaves their role or transfers departments", "Account reduces contract scope at renewal."

4. "entities_to_watch": Names, titles, departments, keywords likely to appear in relevant signals. Include terms in all languages used in the organization (e.g., English and Hebrew equivalents for key roles and departments). Format as a flat list of strings.

5. "salesforce_filters": JSON object with criteria to identify relevant accounts. Use field names matching the Salesforce schema.

6. "slack_channel_hints": Types of Slack channels likely to contain relevant signals (e.g., "customer-specific channels", "cs-team", "sales-updates").

Return only the JSON object. No markdown formatting, no explanation.
```

## After generating the decomposition

1. Show the full decomposition to the PM.
2. Ask specifically about multilingual entities: "Should I add Hebrew (or other language) terms for any of these roles or departments?"
3. Ask about specific accounts or people: "Are there specific accounts or stakeholders I should prioritize?"
4. Apply the PM's edits before saving.
