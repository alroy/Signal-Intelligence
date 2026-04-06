import { createClient } from "@/lib/supabase/server";
import { ArchivedObjectiveCard } from "@/components/archive/archived-objective-card";

export default async function ArchivePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: objectives } = await supabase
    .from("objectives")
    .select("*, matches(id, feedback)")
    .eq("pm_id", user!.id)
    .eq("status", "resolved")
    .order("updated_at", { ascending: false });

  const objectivesWithCounts = (objectives || []).map((obj) => {
    const matches = (obj.matches || []) as Array<{
      id: string;
      feedback: string;
    }>;
    return {
      objective: { ...obj, matches: undefined },
      totalMatches: matches.length,
      confirmedCount: matches.filter((m) => m.feedback === "confirmed").length,
      dismissedCount: matches.filter((m) => m.feedback === "dismissed").length,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Archive</h2>
        <p className="mt-1 text-gray-600">
          Resolved objectives and their collected signals.
        </p>
      </div>

      {objectivesWithCounts.length === 0 ? (
        <p className="text-sm text-gray-400">
          No resolved objectives yet. Objectives you resolve will appear here.
        </p>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {objectivesWithCounts.map(
            ({ objective, totalMatches, confirmedCount, dismissedCount }) => (
              <ArchivedObjectiveCard
                key={objective.id}
                objective={objective}
                totalMatches={totalMatches}
                confirmedCount={confirmedCount}
                dismissedCount={dismissedCount}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
