import { createClient } from "@/lib/supabase/server";
import type { PmProfile } from "@/types/database";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("pm_profiles")
    .select("*")
    .eq("id", user!.id)
    .single<PmProfile>();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="mt-1 text-gray-600">
          Welcome back, {profile?.name || profile?.email}
        </p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-medium">Active Objectives</h3>
        <p className="mt-2 text-gray-500">
          No objectives yet. Objectives created via the Cowork plugin will
          appear here.
        </p>
      </div>
    </div>
  );
}
