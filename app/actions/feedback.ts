"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { updateSignalStatus, createObjectiveStatusMarker } from "@/lib/monday";

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
  const { data: updatedMatch, error: matchError } = await supabase
    .from("matches")
    .update({
      feedback: feedbackType,
      feedback_at: new Date().toISOString(),
    })
    .eq("id", matchId)
    .select("monday_item_id")
    .single();

  if (matchError) {
    return { error: matchError.message };
  }

  // Sync feedback back to Monday.com if this match originated from a Monday item
  if (updatedMatch?.monday_item_id) {
    try {
      await updateSignalStatus(
        updatedMatch.monday_item_id,
        feedbackType === "confirmed" ? "Confirmed" : "Dismissed"
      );
    } catch {
      // Monday sync is best-effort; don't fail the entire feedback action
      console.error("Failed to sync feedback to Monday.com");
    }
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

  const { data: objective, error } = await supabase
    .from("objectives")
    .update({ status })
    .eq("id", objectiveId)
    .select("title")
    .single();

  if (error) {
    return { error: error.message };
  }

  // Write status-change marker to Monday so the Cowork plugin discovers it
  try {
    await createObjectiveStatusMarker(objectiveId, user.id, status, objective.title ?? "");
  } catch {
    console.error("Failed to write objective status change to Monday.com");
  }

  revalidatePath(`/objectives/${objectiveId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function resolveObjective(
  objectiveId: string,
  resolutionNote: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: objective, error } = await supabase
    .from("objectives")
    .update({
      status: "resolved" as const,
      resolution_note: resolutionNote || null,
    })
    .eq("id", objectiveId)
    .select("title")
    .single();

  if (error) {
    return { error: error.message };
  }

  // Write status-change marker to Monday so the Cowork plugin discovers it
  try {
    await createObjectiveStatusMarker(objectiveId, user.id, "resolved", objective.title ?? "");
  } catch {
    console.error("Failed to write objective status change to Monday.com");
  }

  revalidatePath(`/objectives/${objectiveId}`);
  revalidatePath("/dashboard");
  return { success: true };
}
