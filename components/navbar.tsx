import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./signout-button";
import { NavLinks } from "./nav-links";

export async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("pm_profiles")
    .select("name, email, avatar_url")
    .eq("id", user.id)
    .single();

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <h1 className="text-lg font-semibold">Signal Intelligence</h1>
          <NavLinks />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {profile?.avatar_url && (
              <img
                src={profile.avatar_url}
                alt=""
                className="h-8 w-8 rounded-full"
              />
            )}
            <span className="text-sm text-gray-700">
              {profile?.name || profile?.email}
            </span>
          </div>
          <SignOutButton />
        </div>
      </div>
    </nav>
  );
}
