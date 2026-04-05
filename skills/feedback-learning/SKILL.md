---
name: feedback-learning
description: Reads confirmed and dismissed signals from the Monday.com board to build few-shot examples and calibrate scoring thresholds. Run at the start of collect-signals to improve match quality over time.
---

## How it works

The web app writes feedback status ("Confirmed" or "Dismissed") back to the Monday.com board's Status column when a PM reviews signals. This skill reads that feedback to improve future signal matching.

## Steps

1. Query the Monday.com board for recently reviewed items:
   - **Board ID**: `18407235431`
   - Filter by PM UUID column matching the current PM.
   - Filter Status column for "Confirmed" and "Dismissed" (not "Pending").
   - Retrieve the most recent 20 items of each type.

2. Build few-shot examples for `signal-matching`:
   - Select up to 5 confirmed items with the highest scores as **positive examples**.
   - Select up to 5 dismissed items as **negative examples**.
   - For each, extract: content summary, explanation, score, category, and the PM's verdict.
   - Format these as example input/output pairs to prepend to the matching prompt.

3. Calibrate score thresholds:
   - Group reviewed items by score band: 4-6, 7-8, 9-10.
   - For each band, calculate the confirmation rate: `confirmed / (confirmed + dismissed)`.
   - If a band has a confirmation rate below 30% (over at least 10 reviewed items), flag it as underperforming.
   - Recommend raising the minimum score threshold to exclude underperforming bands.

4. Return a learning context object for use by `collect-signals`:

```json
{
  "few_shot_positive": [
    {
      "content_summary": "...",
      "score": 8,
      "category": "opportunity",
      "explanation": "...",
      "verdict": "confirmed"
    }
  ],
  "few_shot_negative": [
    {
      "content_summary": "...",
      "score": 6,
      "category": "info",
      "explanation": "...",
      "verdict": "dismissed"
    }
  ],
  "min_score_threshold": 5,
  "threshold_notes": "Score band 4-6 has 20% confirmation rate (3/15). Raising minimum to 7."
}
```

## Monday board columns used

| Column | Monday Column ID | Used for |
|---|---|---|
| PM UUID | `text_mm23fspz` | Filter items for the current PM |
| Content Summary | `text_mm23eqyw` | Few-shot example content |
| Score | `numeric_mm23h4sr` | Threshold calibration |
| Explanation | `text_mm23983t` | Few-shot example context |
| Category | `color_mm23tcn7` | Few-shot example metadata |
| Status | `color_mm23b9pc` | Confirmed / Dismissed / Pending |

## Important: Score values

The scores on the Monday board are the plugin's **original scores** (pre-rescore). The app rescores matches after sync using shared patterns and PM feedback history, but those rescored values stay in Supabase only — they are not written back to Monday.

This means threshold calibration is based on the plugin's scoring accuracy, which is the correct behavior: the plugin learns to produce better initial scores over time. However, PM confirm/dismiss decisions may be influenced by the rescored values they see in the web app, which can differ from the original scores.

## Notes

- If fewer than 10 total reviewed items exist, skip threshold calibration and use a default minimum score of 5.
- Few-shot examples are rebuilt on every collection run — they reflect the PM's most recent preferences.
- This skill is read-only. It does not modify any Monday board items.
