import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface DecompositionUpdate {
  objective_id: string;
  decomposition: Record<string, unknown>;
}

export async function PATCH(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token || token !== process.env.SIGNALS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: DecompositionUpdate;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.objective_id || !body.decomposition) {
    return NextResponse.json(
      { error: "objective_id and decomposition are required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("objectives")
    .update({ decomposition: body.decomposition })
    .eq("id", body.objective_id)
    .select("id, title, status")
    .single();

  if (error) {
    return NextResponse.json(
      { error: `Update failed: ${error.message}` },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Objective not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    objective: data,
  });
}
