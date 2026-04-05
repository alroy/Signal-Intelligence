import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const OBJECTIVE_ID = "e688f89f-57f3-45e4-b9f3-06217e1275de";

export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const log: string[] = [];

  // 1. Find matches and their clusters
  const { data: matches } = await supabase
    .from("matches")
    .select("id, cluster_id")
    .eq("objective_id", OBJECTIVE_ID);

  const matchIds = (matches || []).map((m) => m.id);
  const clusterIds = [
    ...new Set(
      (matches || [])
        .map((m) => m.cluster_id)
        .filter(Boolean) as string[]
    ),
  ];

  // 2. Delete pm_feedback
  if (matchIds.length > 0) {
    const { count } = await supabase
      .from("pm_feedback")
      .delete({ count: "exact" })
      .in("match_id", matchIds);
    log.push(`pm_feedback: ${count ?? 0}`);
  }

  // 3. Delete matches
  const { count: mCount } = await supabase
    .from("matches")
    .delete({ count: "exact" })
    .eq("objective_id", OBJECTIVE_ID);
  log.push(`matches: ${mCount ?? 0}`);

  // 4. Delete clusters
  if (clusterIds.length > 0) {
    const { count: cCount } = await supabase
      .from("clusters")
      .delete({ count: "exact" })
      .in("id", clusterIds);
    log.push(`clusters: ${cCount ?? 0}`);
  }

  // 5. Delete objective
  const { count: oCount } = await supabase
    .from("objectives")
    .delete({ count: "exact" })
    .eq("id", OBJECTIVE_ID);
  log.push(`objectives: ${oCount ?? 0}`);

  return NextResponse.json({ deleted: log });
}
