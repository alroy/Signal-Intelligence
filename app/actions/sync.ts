"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllSignals } from "@/lib/monday";
import {
  MONDAY_COLUMNS,
  getColumnText,
  mapItemToMatch,
  groupItemsByClusters,
  isDecompositionItem,
  isNewObjectiveMarker,
} from "@/lib/sync-monday";
import { rescoreNewMatches } from "@/lib/rescore";

export async function triggerMondaySync() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const boardId = process.env.MONDAY_BOARD_ID;
  if (!boardId) {
    return { error: "MONDAY_BOARD_ID is not configured" };
  }

  const pmId = user.id;

  // Fetch all items from Monday (not just "Pending") so manual sync catches everything
  const allItems = await fetchAllSignals(boardId);

  // Filter to only this PM's items
  const pmItems = allItems.filter(
    (item) => getColumnText(item, MONDAY_COLUMNS.pm_uuid) === pmId
  );

  // Exclude decomposition items and new_objective markers
  const signalItems = pmItems.filter(
    (item) => !isDecompositionItem(item) && !isNewObjectiveMarker(item)
  );

  if (signalItems.length === 0) {
    revalidatePath("/dashboard");
    revalidatePath("/objectives/[id]", "page");
    return { success: true as const, synced: 0 };
  }

  const admin = createAdminClient();

  // Handle clusters
  const { clustered, unclustered } = groupItemsByClusters(signalItems);
  const clusterIdMap = new Map<string, string>();

  for (const group of clustered) {
    const urgencyOrder = ["act_now", "this_week", "background"];
    const combinedUrgency = group.items.reduce((highest, item) => {
      const itemUrgency =
        getColumnText(item, MONDAY_COLUMNS.urgency) || "background";
      return urgencyOrder.indexOf(itemUrgency) < urgencyOrder.indexOf(highest)
        ? itemUrgency
        : highest;
    }, "background");

    const { data: cluster, error: clusterError } = await admin
      .from("clusters")
      .insert({
        pm_id: group.pm_id,
        account: group.account,
        situation_summary: group.situation_summary || "Clustered signals",
        combined_urgency: combinedUrgency,
      })
      .select("id")
      .single();

    if (clusterError || !cluster) {
      continue;
    }

    clusterIdMap.set(group.cluster_id, cluster.id);
  }

  // Map all items to match rows, resolving cluster IDs
  const itemsToSync = [
    ...unclustered,
    ...clustered.flatMap((g) => g.items),
  ];
  const rows = itemsToSync.map((item) => {
    const match = mapItemToMatch(item);
    const pluginClusterId = getColumnText(item, MONDAY_COLUMNS.cluster_id);
    return {
      ...match,
      cluster_id: pluginClusterId
        ? clusterIdMap.get(pluginClusterId) ?? null
        : null,
    };
  });

  // Filter out items that already exist in Supabase (no unique constraint on monday_item_id)
  const mondayIds = rows.map((r) => r.monday_item_id);
  const { data: existing } = await admin
    .from("matches")
    .select("monday_item_id")
    .in("monday_item_id", mondayIds);

  const existingIds = new Set((existing || []).map((e) => e.monday_item_id));
  const newRows = rows.filter((r) => !existingIds.has(r.monday_item_id));

  if (newRows.length === 0) {
    revalidatePath("/dashboard");
    revalidatePath("/objectives/[id]", "page");
    return { success: true as const, synced: 0 };
  }

  const { data, error } = await admin
    .from("matches")
    .insert(newRows)
    .select("id");

  if (error) {
    return { error: `Supabase insert failed: ${error.message}` };
  }

  // Re-score synced matches
  await rescoreNewMatches();

  revalidatePath("/dashboard");
  revalidatePath("/objectives/[id]", "page");
  return { success: true as const, synced: data.length };
}
