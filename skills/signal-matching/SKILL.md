---
name: signal-matching
description: Evaluates a pre-filtered signal against a PM's objective using LLM scoring. Returns relevance, score, category, urgency, and source language. Handles multilingual content and writes all output in English.
---

## Matching prompt

Use this prompt for each signal that passes the pre-filter:

```
OBJECTIVE: {{objective_summary}}

POSITIVE SIGNAL TYPES (evidence of progress):
{{signal_types_positive}}

NEGATIVE SIGNAL TYPES (evidence of risk):
{{signal_types_negative}}

ENTITIES OF INTEREST:
{{entities_to_watch}}

RELEVANT ACCOUNTS:
{{relevant_accounts}}

SIGNAL TO EVALUATE:
Source: {{signal_source}}
Account: {{signal_account}}
Speaker role: {{speaker_role}}
Content: {{signal_content}}
Context: {{signal_context}}

LANGUAGE RULES:
- Signal content may be in any language. Evaluate based on meaning.
- Write ALL output fields in English.
- If quoting the signal, preserve the original language.

SCORING:
- 9-10: PM must see this. Clear, specific, directly relevant.
- 7-8: Strong signal. PM should see this.
- 5-6: Moderate. Potentially useful context.
- 3-4: Weak. Tangentially related.
- 1-2: Not relevant.
- Customer statements score higher than internal statements.
- Multi-person threads carry more weight than single messages.

Respond with only this JSON object:
{
  "relevant": "yes" | "no" | "maybe",
  "score": <number 0-10>,
  "explanation": "<one sentence in English>",
  "category": "opportunity" | "risk" | "info",
  "urgency": "act_now" | "this_week" | "background",
  "source_language": "<detected language>"
}
```
