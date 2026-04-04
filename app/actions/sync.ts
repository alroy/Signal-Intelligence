"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { syncMondaySignals } from "@/lib/sync-monday";

export async function triggerMondaySync() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const result = await syncMondaySignals();

  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath("/dashboard");
  return result;
}
