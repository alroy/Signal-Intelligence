"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateObjectiveStatus,
  resolveObjective,
} from "@/app/actions/feedback";

const badgeStyles: Record<string, { dot: string; text: string; bg: string }> = {
  active: { dot: "bg-green-500", text: "text-green-800", bg: "bg-green-50" },
  paused: { dot: "bg-amber-500", text: "text-amber-800", bg: "bg-amber-50" },
  resolved: { dot: "bg-gray-400", text: "text-gray-600", bg: "bg-gray-100" },
};

export function StatusToggle({
  objectiveId,
  currentStatus,
}: {
  objectiveId: string;
  currentStatus: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleToggle() {
    if (isPending) return;
    const next = currentStatus === "active" ? "paused" : "active";
    startTransition(async () => {
      await updateObjectiveStatus(objectiveId, next);
    });
  }

  function handleReactivate() {
    if (isPending) return;
    startTransition(async () => {
      await updateObjectiveStatus(objectiveId, "active");
    });
  }

  function handleConfirmResolve() {
    setError(null);
    startTransition(async () => {
      const result = await resolveObjective(objectiveId, "");
      if (result.error) {
        setError(result.error);
      } else {
        setShowResolveModal(false);
        router.push("/dashboard");
      }
    });
  }

  const badge = badgeStyles[currentStatus] || badgeStyles.active;

  return (
    <>
      <div className="space-y-3">
        {/* Status badge */}
        <div
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${badge.bg} ${badge.text}`}
        >
          <span className={`h-2 w-2 rounded-full ${badge.dot}`} />
          <span className="capitalize">{currentStatus}</span>
        </div>

        {currentStatus === "resolved" ? (
          /* Resolved: show re-activate link */
          <button
            onClick={handleReactivate}
            disabled={isPending}
            className="block text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            {isPending ? "Reactivating\u2026" : "Re-activate objective"}
          </button>
        ) : (
          /* Active or Paused: show action buttons */
          <div className="space-y-2">
            <button
              onClick={handleToggle}
              disabled={isPending}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              {currentStatus === "active" ? (
                <>
                  {/* Pause icon */}
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                  {isPending ? "Pausing\u2026" : "Pause Collection"}
                </>
              ) : (
                <>
                  {/* Play icon */}
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  {isPending ? "Resuming\u2026" : "Resume Monitoring"}
                </>
              )}
            </button>

            <button
              onClick={() => setShowResolveModal(true)}
              disabled={isPending}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Resolve Objective
            </button>
          </div>
        )}
      </div>

      {/* Resolve confirmation modal */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">
              Resolve objective?
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              This will stop all daily AI signal collection for this objective.
              It will be moved to your &ldquo;Resolved&rdquo; list.
            </p>

            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowResolveModal(false);
                  setError(null);
                }}
                disabled={isPending}
                className="rounded-md bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition-colors hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResolve}
                disabled={isPending}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? "Resolving\u2026" : "Confirm Resolve"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
