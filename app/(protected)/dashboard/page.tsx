import { createClient } from "@/lib/supabase/server";
import { ObjectiveCard } from "@/components/dashboard/objective-card";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("pm_profiles")
    .select("name, email")
    .eq("id", user!.id)
    .single();

  const { data: objectives } = await supabase
    .from("objectives")
    .select("*, matches(id, urgency, feedback)")
    .eq("pm_id", user!.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const objectivesWithCounts = (objectives || []).map((obj) => {
    const matches = (obj.matches || []) as Array<{
      id: string;
      urgency: string;
      feedback: string;
    }>;
    const pendingMatches = matches.filter((m) => m.feedback === "pending");
    const urgencyOrder = ["act_now", "this_week", "background"];
    const highestUrgency =
      pendingMatches.length > 0
        ? pendingMatches.sort(
            (a, b) =>
              urgencyOrder.indexOf(a.urgency) -
              urgencyOrder.indexOf(b.urgency)
          )[0].urgency
        : null;
    return {
      objective: { ...obj, matches: undefined },
      unreadCount: pendingMatches.length,
      highestUrgency,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="mt-1 text-gray-600">
          Welcome back, {profile?.name || profile?.email}
        </p>
      </div>

      {objectivesWithCounts.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {objectivesWithCounts.map(
            ({ objective, unreadCount, highestUrgency }) => (
              <ObjectiveCard
                key={objective.id}
                objective={objective}
                unreadCount={unreadCount}
                highestUrgency={highestUrgency}
              />
            )
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <h3 className="text-lg font-medium text-gray-900">
            No active objectives
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            Your objectives will appear here once they&apos;re created.
          </p>
        </div>
      )}

      {objectivesWithCounts.length > 0 &&
        objectivesWithCounts.length < 3 && (
          <p className="text-sm text-gray-500">
            Tip: The PRD recommends 3-5 active objectives. Create more via the
            Cowork plugin.
          </p>
        )}
    </div>
  );
}
