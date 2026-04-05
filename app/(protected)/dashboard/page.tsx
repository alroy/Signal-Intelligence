import { createClient } from "@/lib/supabase/server";
import { ObjectiveCard } from "@/components/dashboard/objective-card";
import { NewObjectiveCard } from "@/components/dashboard/new-objective-card";
import { SyncButton } from "@/components/dashboard/sync-button";

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
    .select("*, matches(id, urgency, feedback, created_at)")
    .eq("pm_id", user!.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const objectivesWithCounts = (objectives || []).map((obj) => {
    const matches = (obj.matches || []) as Array<{
      id: string;
      urgency: string;
      feedback: string;
      created_at: string;
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
    const latestMatchAt =
      matches.length > 0
        ? matches.sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          )[0].created_at
        : null;
    return {
      objective: { ...obj, matches: undefined },
      unreadCount: pendingMatches.length,
      highestUrgency,
      latestMatchAt,
      totalMatches: matches.length,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="mt-1 text-gray-600">
            Welcome back, {profile?.name || profile?.email}
          </p>
          {objectivesWithCounts.length === 0 && (
            <p className="mt-1 text-sm text-gray-400">
              Define your first strategic objective to start monitoring signals
              from Slack, Salesforce, Gong, and Gmail.
            </p>
          )}
        </div>
        <SyncButton />
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <NewObjectiveCard />
        {objectivesWithCounts.map(
          ({ objective, unreadCount, highestUrgency, latestMatchAt, totalMatches }) => (
            <ObjectiveCard
              key={objective.id}
              objective={objective}
              unreadCount={unreadCount}
              highestUrgency={highestUrgency}
              latestMatchAt={latestMatchAt}
              totalMatches={totalMatches}
            />
          )
        )}
      </div>
    </div>
  );
}
