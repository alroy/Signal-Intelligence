import { createClient } from "@/lib/supabase/server";
import type { PmProfile } from "@/types/database";
import { UuidDisplay } from "@/components/settings/uuid-display";

export default async function SettingsPage() {
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
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
      </div>

      {/* Profile */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-medium">Profile</h3>
        <div className="mt-4 flex items-center gap-4">
          {profile?.avatar_url && (
            <img
              src={profile.avatar_url}
              alt=""
              className="h-16 w-16 rounded-full"
            />
          )}
          <div>
            <p className="font-medium text-gray-900">{profile?.name}</p>
            <p className="text-sm text-gray-500">{profile?.email}</p>
          </div>
        </div>
      </section>

      {/* Supabase UUID */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-medium">Cowork Plugin Configuration</h3>
        <p className="mt-1 text-sm text-gray-500">
          Use this UUID to configure the Cowork plugin&apos;s PM identity in
          project memory.
        </p>
        <div className="mt-4">
          <UuidDisplay uuid={user!.id} />
        </div>
      </section>

      {/* Digest Preferences */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-medium">Digest Preferences</h3>
        <p className="mt-1 text-sm text-gray-500">
          Digest delivery is currently in-app only. Email delivery coming soon.
        </p>
      </section>
    </div>
  );
}
