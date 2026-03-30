"use client";

import { useTransition } from "react";
import { updateObjectiveStatus } from "@/app/actions/feedback";

const statuses = ["active", "paused", "resolved"] as const;

export function StatusToggle({
  objectiveId,
  currentStatus,
}: {
  objectiveId: string;
  currentStatus: string;
}) {
  const [isPending, startTransition] = useTransition();

  const handleChange = (status: "active" | "paused" | "resolved") => {
    startTransition(async () => {
      await updateObjectiveStatus(objectiveId, status);
    });
  };

  return (
    <div className="flex items-center gap-1">
      {statuses.map((status) => (
        <button
          key={status}
          onClick={() => handleChange(status)}
          disabled={isPending || currentStatus === status}
          className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
            currentStatus === status
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          } disabled:opacity-50`}
        >
          {status}
        </button>
      ))}
    </div>
  );
}
