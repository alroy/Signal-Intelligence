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
  source_reference: "long_text_mm24w82p",
  source_timestamp: "text_mm242qzh",
  cluster_id: "text_mm247era",
  situation_summary: "text_mm24zxe",
  decomposition: "long_text_mm24fq7d",
} as const;

function getColumnText(item: MondayItem, columnId: string): string {
  return item.column_values.find((c) => c.id === columnId)?.text ?? "";
}

function parseSourceReference(text: string): Record<string, unknown> | null {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function mapItemToMatch(item: MondayItem) {
  return {
    monday_item_id: item.id,
    pm_id: getColumnText(item, MONDAY_COLUMNS.pm_uuid),
    objective_id: getColumnText(item, MONDAY_COLUMNS.objective_id),
    source: getColumnText(item, MONDAY_COLUMNS.source) || "monday",
    source_timestamp: getColumnText(item, MONDAY_COLUMNS.source_timestamp) || null,
    account: getColumnText(item, MONDAY_COLUMNS.account) || null,
    content_summary: getColumnText(item, MONDAY_COLUMNS.content_summary) || item.name,
    original_content: getColumnText(item, MONDAY_COLUMNS.original_content) || null,
    source_language: getColumnText(item, MONDAY_COLUMNS.source_language) || "en",
    speaker_role: getColumnText(item, MONDAY_COLUMNS.speaker_role) || null,
    source_reference: parseSourceReference(getColumnText(item, MONDAY_COLUMNS.source_reference)),
    relevance_score: parseFloat(getColumnText(item, MONDAY_COLUMNS.score)) || 0,
    explanation: getColumnText(item, MONDAY_COLUMNS.explanation) || "",
    category: getColumnText(item, MONDAY_COLUMNS.category) || "info",
    urgency: getColumnText(item, MONDAY_COLUMNS.urgency) || "background",
    feedback: "pending" as const,
  };
}

interface ClusterGroup {
  cluster_id: string;
  pm_id: string;
  account: string | null;
  situation_summary: string;
  combined_urgency: string;
  items: MondayItem[];
}

function groupItemsByClusters(items: MondayItem[]): {
  clustered: ClusterGroup[];
  unclustered: MondayItem[];
} {
  const clusterMap = new Map<string, ClusterGroup>();
  const unclustered: MondayItem[] = [];

  for (const item of items) {
    const clusterId = getColumnText(item, MONDAY_COLUMNS.cluster_id);
    if (!clusterId) {
      unclustered.push(item);
      continue;
    }

    if (!clusterMap.has(clusterId)) {
      clusterMap.set(clusterId, {
        cluster_id: clusterId,
        pm_id: getColumnText(item, MONDAY_COLUMNS.pm_uuid),
        account: getColumnText(item, MONDAY_COLUMNS.account) || null,
        situation_summary: getColumnText(item, MONDAY_COLUMNS.situation_summary) || "",
        combined_urgency: getColumnText(item, MONDAY_COLUMNS.urgency) || "background",
        items: [],
      });
    }
    clusterMap.get(clusterId)!.items.push(item);
  }

  return { clustered: Array.from(clusterMap.values()), unclustered };
}

function isDecompositionItem(item: MondayItem): boolean {
  return getColumnText(item, MONDAY_COLUMNS.source) === "objective_decomposition";
}

function parseDecomposition(text: string): Record<string, unknown> | null {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function syncMondaySignals(): Promise<
  { success: true; synced: number; clusters_created: number; objectives_updated: number; rescored: number } | { error: string }
> {
  const boardId = process.env.MONDAY_BOARD_ID;
  if (!boardId) {
    return { error: "MONDAY_BOARD_ID is not configured" };
  }

  const items = await fetchPendingSignals(boardId);

  if (items.length === 0) {
    return { success: true, synced: 0, clusters_created: 0, objectives_updated: 0, rescored: 0 };
  }

  const supabase = createAdminClient();

  // Separate decomposition items from signal items
  const decompositionItems = items.filter(isDecompositionItem);
  const signalItems = items.filter((item) => !isDecompositionItem(item));

  // Process objective decomposition updates
  let objectivesUpdated = 0;
  for (const item of decompositionItems) {
    const objectiveId = getColumnText(item, MONDAY_COLUMNS.objective_id);
    const decomposition = parseDecomposition(
      getColumnText(item, MONDAY_COLUMNS.decomposition)
    );

    if (objectiveId && decomposition) {
      const { error } = await supabase
        .from("objectives")
        .update({ decomposition })
        .eq("id", objectiveId);

      if (!error) {
        objectivesUpdated++;
      }
    }
  }

  if (signalItems.length === 0) {
    return { success: true, synced: 0, clusters_created: 0, objectives_updated: objectivesUpdated, rescored: 0 };
  }

  // Group signal items by cluster
  const { clustered, unclustered } = groupItemsByClusters(signalItems);

  // Step 1: Create cluster records in Supabase and map plugin cluster IDs to Supabase UUIDs
  const clusterIdMap = new Map<string, string>();

  for (const group of clustered) {
    // Calculate combined urgency as the highest among all items
    const urgencyOrder = ["act_now", "this_week", "background"];
    const combinedUrgency = group.items.reduce((highest, item) => {
      const itemUrgency = getColumnText(item, MONDAY_COLUMNS.urgency) || "background";
      return urgencyOrder.indexOf(itemUrgency) < urgencyOrder.indexOf(highest)
        ? itemUrgency
        : highest;
    }, "background");

    const { data: cluster, error: clusterError } = await supabase
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

  // Step 2: Map all items to match rows, resolving cluster IDs
  const allItems = [...unclustered, ...clustered.flatMap((g) => g.items)];
  const rows = allItems.map((item) => {
    const match = mapItemToMatch(item);
    const pluginClusterId = getColumnText(item, MONDAY_COLUMNS.cluster_id);
    return {
      ...match,
      cluster_id: pluginClusterId ? clusterIdMap.get(pluginClusterId) ?? null : null,
    };
  });

  const { data, error } = await supabase
    .from("matches")
    .upsert(rows, { onConflict: "monday_item_id" })
    .select("id");

  if (error) {
    return { error: `Supabase upsert failed: ${error.message}` };
  }

  // Re-score synced matches using shared patterns + PM feedback history
  const { rescored } = await rescoreNewMatches();

  return { success: true, synced: data.length, clusters_created: clusterIdMap.size, objectives_updated: objectivesUpdated, rescored };
}
