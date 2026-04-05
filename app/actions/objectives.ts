"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createBoardItem } from "@/lib/monday";

export async function createObjective(title: string) {
  const trimmed = title.trim();
  if (!trimmed) {
    return { error: "Title is required" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("objectives")
    .insert({
      pm_id: user.id,
      title: trimmed,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  // Write a marker item to Monday so the Cowork plugin can discover this objective
  const mondayBoardId = process.env.MONDAY_BOARD_ID;
  if (mondayBoardId) {
    try {
      await createBoardItem(mondayBoardId, trimmed.slice(0, 50), {
        text_mm23fspz: user.id,
        text_mm23qar7: data.id,
        text_mm238jbc: "new_objective",
        color_mm23b9pc: JSON.stringify({ label: "Pending" }),
      });
    } catch (e) {
      console.error("Failed to write objective marker to Monday.com:", e);
      // Non-fatal: objective exists in Supabase, PM can enrich manually
    }
  }

  revalidatePath("/dashboard");
  return { success: true, id: data.id };
}
