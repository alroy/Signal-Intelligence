"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateObjectiveStatus, resolveObjective } from "@/app/actions/feedback";

const statuses = ["active", "paused", "resolved"] as const;

export function StatusToggle({
  objectiveId,
  currentStatus,
}: {
  objectiveId: string;
  currentStatus: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (showResolveModal && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [showResolveModal]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const status = e.target.value as "active" | "paused" | "resolved";
    if (status === currentStatus) return;

    if (status === "resolved") {
      // Reset select to current value — modal will handle the actual change
      e.target.value = currentStatus;
      setShowResolveModal(true);
      return;
    }

    startTransition(async () => {
      await updateObjectiveStatus(objectiveId, status);
    });
  };

  const handleConfirmResolve = () => {
    setError(null);
    startTransition(async () => {
      const result = await resolveObjective(objectiveId, resolutionNote);
      if (result.error) {
        setError(result.error);
      } else {
        setShowResolveModal(false);
        router.push("/dashboard");
      }
    });
  };

  if (currentStatus === "resolved") {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 py-1.5 pl-3 pr-3 text-xs font-medium text-gray-500">
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Resolved
      </div>
    );
  }

  return (
    <>
      <select
        value={currentStatus}
        onChange={handleChange}
        disabled={isPending}
        className="appearance-none rounded-md border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-xs font-medium capitalize text-gray-700 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[position:right_6px_center] bg-no-repeat disabled:opacity-50"
      >
        {statuses.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>

      {showResolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">
              Resolve Objective?
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Resolving this objective will stop the daily AI collection and
              remove it from your active dashboard. This action is intended for
              goals that have been successfully met or are no longer relevant.
            </p>

            <label
              htmlFor="resolution-note"
              className="mt-4 block text-sm font-medium text-gray-700"
            >
              Resolution summary{" "}
              <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              ref={textareaRef}
              id="resolution-note"
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="What was the outcome?"
              disabled={isPending}
              rows={3}
              className="mt-1 w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />

            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowResolveModal(false);
                  setResolutionNote("");
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
