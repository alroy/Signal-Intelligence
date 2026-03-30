import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Match } from "@/types/database";
import { MatchItem } from "@/components/objectives/match-item";
import { MatchFilters } from "@/components/objectives/match-filters";
import { ObjectiveSidebar } from "@/components/objectives/objective-sidebar";

export default async function ObjectiveDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const { id } = await params;
  const filters = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch objective
  const { data: objective } = await supabase
    .from("objectives")
    .select("*")
    .eq("id", id)
    .eq("pm_id", user!.id)
    .single();

  if (!objective) {
    notFound();
  }

  // Build matches query with filters
  let matchesQuery = supabase
    .from("matches")
    .select("*")
    .eq("objective_id", id)
    .order("created_at", { ascending: false });

  if (filters.category) {
    matchesQuery = matchesQuery.eq("category", filters.category);
  }
  if (filters.urgency) {
    matchesQuery = matchesQuery.eq("urgency", filters.urgency);
  }
  if (filters.feedback) {
    matchesQuery = matchesQuery.eq("feedback", filters.feedback);
  }
  if (filters.source) {
    matchesQuery = matchesQuery.eq("source", filters.source);
  }

  const { data: matches } = await matchesQuery;
  const typedMatches = (matches || []) as Match[];

  // Fetch all matches for sidebar stats (unfiltered)
  const { data: allMatches } = await supabase
    .from("matches")
    .select("*")
    .eq("objective_id", id);
  const allTypedMatches = (allMatches || []) as Match[];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{objective.title}</h2>
        <p className="mt-1 text-sm text-gray-500">
          {objective.status} · Created{" "}
          {new Date(objective.created_at).toLocaleDateString()}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        {/* Match Feed */}
        <div className="space-y-4">
          <MatchFilters />
          {typedMatches.length > 0 ? (
            <div className="space-y-3">
              {typedMatches.map((match) => (
                <MatchItem key={match.id} match={match} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
              <p className="text-sm text-gray-500">
                {filters.category ||
                filters.urgency ||
                filters.feedback ||
                filters.source
                  ? "No matches found with these filters."
                  : "No matches yet. The Cowork plugin will populate matches during signal collection."}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="rounded-lg border border-gray-200 bg-white p-4">
          <ObjectiveSidebar
            objective={objective}
            matches={allTypedMatches}
          />
        </aside>
      </div>
    </div>
  );
}
