import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPendingSignals, type MondayItem } from "@/lib/monday";

function getColumnText(item: MondayItem, columnId: string): string {
  return item.column_values.find((c) => c.id === columnId)?.text ?? "";
}

function mapItemToMatch(item: MondayItem) {
  return {
    monday_item_id: item.id,
    pm_id: getColumnText(item, "pm_uuid"),
    objective_id: getColumnText(item, "objective_id"),
    source: getColumnText(item, "source") || "monday",
    account: getColumnText(item, "account") || null,
    content_summary: getColumnText(item, "content_summary") || item.name,
    original_content: getColumnText(item, "original_content") || null,
    source_language: getColumnText(item, "source_language") || "en",
    speaker_role: getColumnText(item, "speaker_role") || null,
    relevance_score: parseFloat(getColumnText(item, "score")) || 0,
    explanation: getColumnText(item, "explanation") || "",
    category: getColumnText(item, "category") || "info",
    urgency: getColumnText(item, "urgency") || "background",
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
