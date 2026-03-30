"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function submitFeedback(
  matchId: string,
  objectiveId: string,
  feedbackType: "confirmed" | "dismissed"
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Insert feedback record
  const { error: feedbackError } = await supabase.from("pm_feedback").insert({
    pm_id: user.id,
    match_id: matchId,
    objective_id: objectiveId,
    feedback_type: feedbackType,
  });

  if (feedbackError) {
    return { error: feedbackError.message };
  }

  // Update match feedback status
  const { error: matchError } = await supabase
    .from("matches")
    .update({
      feedback: feedbackType,
      feedback_at: new Date().toISOString(),
    })
    .eq("id", matchId);

  if (matchError) {
    return { error: matchError.message };
  }

  revalidatePath(`/objectives/${objectiveId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateObjectiveStatus(
  objectiveId: string,
  status: "active" | "paused" | "resolved"
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("objectives")
    .update({ status })
    .eq("id", objectiveId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/objectives/${objectiveId}`);
  revalidatePath("/dashboard");
  return { success: true };
}
