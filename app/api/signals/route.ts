import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface ClusterPayload {
  pm_id: string;
  account?: string | null;
  situation_summary: string;
  combined_urgency: string;
}

interface MatchPayload {
  objective_id: string;
  pm_id: string;
  source: string;
  source_timestamp?: string | null;
  account?: string | null;
  content_summary: string;
  original_content?: string | null;
  source_language?: string;
  speaker_role?: string | null;
  source_reference?: Record<string, unknown> | null;
  relevance_score: number;
  explanation: string;
  category: string;
  urgency: string;
  cluster_id?: string | null;
  feedback?: string;
}

interface SignalsRequest {
  clusters?: ClusterPayload[];
  matches: MatchPayload[];
}

export async function POST(request: NextRequest) {
  // Authenticate via Bearer token
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token || token !== process.env.SIGNALS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SignalsRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.matches || !Array.isArray(body.matches)) {
    return NextResponse.json(
      { error: "matches array is required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Step 1: Write clusters and collect generated UUIDs
  const clusterIdMap = new Map<number, string>();

  if (body.clusters && body.clusters.length > 0) {
    const { data: clusters, error: clusterError } = await supabase
      .from("clusters")
      .insert(body.clusters)
      .select("id");

    if (clusterError) {
      return NextResponse.json(
        { error: `Cluster write failed: ${clusterError.message}` },
        { status: 500 }
      );
    }

    // Map index → generated UUID so matches can reference them
    clusters.forEach((c, i) => clusterIdMap.set(i, c.id));
  }

  // Step 2: Resolve cluster_id references in matches
  // Matches can reference clusters by index: "cluster_index:0" → resolved to actual UUID
  const resolvedMatches = body.matches.map((match) => {
    const clusterId = match.cluster_id;
    if (
      typeof clusterId === "string" &&
      clusterId.startsWith("cluster_index:")
    ) {
      const index = parseInt(clusterId.split(":")[1], 10);
      return { ...match, cluster_id: clusterIdMap.get(index) ?? null };
    }
    return match;
  });

  // Step 3: Write matches
  const { data: matches, error: matchError } = await supabase
    .from("matches")
    .insert(resolvedMatches)
    .select("id");

  if (matchError) {
    return NextResponse.json(
      { error: `Match write failed: ${matchError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    clusters_created: clusterIdMap.size,
    matches_created: matches.length,
  });
}
