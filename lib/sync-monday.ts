import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPendingSignals, type MondayItem } from "@/lib/monday";
import { rescoreNewMatches } from "@/lib/rescore";

// Monday.com column IDs from the Signal Intelligence board (board 18407235431)
const MONDAY_COLUMNS = {
  pm_uuid: "text_mm23fspz",
  objective_id: "text_mm23qar7",
  source: "text_mm238jbc",
  account: "text_mm23xscc",
  content_summary: "text_mm23eqyw",
  original_content: "long_text_mm23wnrf",
  source_language: "text_mm23f67y",
  speaker_role: "text_mm23vdkn",
  score: "numeric_mm23h4sr",
  explanation: "text_mm23983t",
  category: "color_mm23tcn7",
  urgency: "color_mm23vf2s",
} as const;

function getColumnText(item: MondayItem, columnId: string): string {
  return item.column_values.find((c) => c.id === columnId)?.text ?? "";
}

function mapItemToMatch(item: MondayItem) {
  return {
    monday_item_id: item.id,
    pm_id: getColumnText(item, MONDAY_COLUMNS.pm_uuid),
    objective_id: getColumnText(item, MONDAY_COLUMNS.objective_id),
    source: getColumnText(item, MONDAY_COLUMNS.source) || "monday",
    account: getColumnText(item, MONDAY_COLUMNS.account) || null,
    content_summary: getColumnText(item, MONDAY_COLUMNS.content_summary) || item.name,
    original_content: getColumnText(item, MONDAY_COLUMNS.original_content) || null,
    source_language: getColumnText(item, MONDAY_COLUMNS.source_language) || "en",
    speaker_role: getColumnText(item, MONDAY_COLUMNS.speaker_role) || null,
    relevance_score: parseFloat(getColumnText(item, MONDAY_COLUMNS.score)) || 0,
    explanation: getColumnText(item, MONDAY_COLUMNS.explanation) || "",
    category: getColumnText(item, MONDAY_COLUMNS.category) || "info",
    urgency: getColumnText(item, MONDAY_COLUMNS.urgency) || "background",
    feedback: "pending" as const,
  };
}

export async function syncMondaySignals(): Promise<
  { success: true; synced: number; rescored: number } | { error: string }
> {
  const boardId = process.env.MONDAY_BOARD_ID;
  if (!boardId) {
    return { error: "MONDAY_BOARD_ID is not configured" };
  }

  const items = await fetchPendingSignals(boardId);

  if (items.length === 0) {
    return { success: true, synced: 0, rescored: 0 };
  }

  const rows = items.map(mapItemToMatch);

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("matches")
    .upsert(rows, { onConflict: "monday_item_id" })
    .select("id");

  if (error) {
    return { error: `Supabase upsert failed: ${error.message}` };
  }

  // Re-score synced matches using shared patterns + PM feedback history
  const { rescored } = await rescoreNewMatches();

  return { success: true, synced: data.length, rescored };
}
