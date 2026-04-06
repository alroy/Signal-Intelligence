"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateObjectiveStatus } from "@/app/actions/feedback";
import type { Objective } from "@/types/database";

export function ArchivedObjectiveCard({
  objective,
  totalMatches,
  confirmedCount,
  dismissedCount,
}: {
  objective: Objective;
  totalMatches: number;
  confirmedCount: number;
  dismissedCount: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [removed, setRemoved] = useState(false);

  function handleReactivate() {
    if (isPending) return;
    startTransition(async () => {
      const result = await updateObjectiveStatus(objective.id, "active");
      if (!result.error) {
        setRemoved(true);
      }
    });
  }

  if (removed) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/objectives/${objective.id}`}
          className="text-base font-medium text-gray-900 hover:text-blue-600 transition-colors"
        >
          {objective.title}
        </Link>
        <button
          onClick={handleReactivate}
          disabled={isPending}
          className="shrink-0 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          {isPending ? "Reactivating\u2026" : "Reactivate"}
        </button>
      </div>

      {objective.resolution_note && (
        <p className="mt-2 text-sm text-gray-500 italic">
          {objective.resolution_note}
        </p>
      )}

      <div className="mt-4 flex items-center gap-3 text-xs text-gray-400">
        <span>
          Resolved{" "}
          {new Date(objective.updated_at).toLocaleDateString()}
        </span>
        <span className="text-gray-300">|</span>
        <span>
          {totalMatches} {totalMatches === 1 ? "match" : "matches"}
        </span>
        {confirmedCount > 0 && (
          <span className="text-green-600">{confirmedCount} confirmed</span>
        )}
        {dismissedCount > 0 && (
          <span className="text-gray-400">{dismissedCount} dismissed</span>
        )}
      </div>
    </div>
  );
}
