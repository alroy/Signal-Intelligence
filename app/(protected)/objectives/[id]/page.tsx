import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MatchWithCluster } from "@/types/database";
import { FilterableMatchFeed } from "@/components/objectives/filterable-match-feed";
import { ObjectiveSidebar } from "@/components/objectives/objective-sidebar";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: objective } = await supabase
    .from("objectives")
    .select("title")
    .eq("id", id)
    .single();

  return {
    title: objective?.title ?? "Objective",
  };
}

export default async function ObjectiveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: objective } = await supabase
    .from("objectives")
    .select("*")
    .eq("id", id)
    .eq("pm_id", user!.id)
    .single();

  if (!objective) {
    notFound();
  }

  const { data: matches } = await supabase
    .from("matches")
    .select("*, cluster:clusters(id, situation_summary, combined_urgency)")
    .eq("objective_id", id)
    .not("source", "in", "(objective_status_change,new_objective,objective_decomposition)")
    .order("created_at", { ascending: false });

  const typedMatches = (matches || []) as MatchWithCluster[];

  const statusColors: Record<string, string> = {
    active: "text-green-700",
    paused: "text-amber-700",
    resolved: "text-gray-500",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{objective.title}</h2>
        <p className="mt-1 text-sm text-gray-500">
          <span className={statusColors[objective.status] || "text-gray-500"}>
            {objective.status}
          </span>
          {" · Created "}
          {new Date(objective.created_at).toLocaleDateString()}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        <FilterableMatchFeed matches={typedMatches} />

        <aside className="rounded-lg border border-gray-200 bg-white p-4">
          <ObjectiveSidebar objective={objective} matches={typedMatches} />
        </aside>
      </div>
    </div>
  );
}
