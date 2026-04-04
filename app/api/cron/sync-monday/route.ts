import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPendingSignals, type MondayItem } from "@/lib/monday";

function getColumnText(item: MondayItem, columnId: string): string {
  return item.column_values.find((c) => c.id === columnId)?.text ?? "";
}

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
  status: "color_mm23b9pc",
} as const;

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

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const boardId = process.env.MONDAY_BOARD_ID;
  if (!boardId) {
    return NextResponse.json(
      { error: "MONDAY_BOARD_ID is not configured" },
      { status: 500 }
    );
  }

  const items = await fetchPendingSignals(boardId);

  if (items.length === 0) {
    return NextResponse.json({ success: true, synced: 0 });
  }

  const rows = items.map(mapItemToMatch);

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("matches")
    .upsert(rows, { onConflict: "monday_item_id" })
    .select("id");

  if (error) {
    return NextResponse.json(
      { error: `Supabase upsert failed: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, synced: data.length });
}
