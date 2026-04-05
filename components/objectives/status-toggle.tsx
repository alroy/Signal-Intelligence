"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  updateObjectiveStatus,
  resolveObjective,
} from "@/app/actions/feedback";

const segments = [
  { value: "active", label: "Active", color: "bg-green-100 text-green-800 ring-green-300" },
  { value: "paused", label: "Paused", color: "bg-amber-100 text-amber-800 ring-amber-300" },
  { value: "resolved", label: "Resolved", color: "bg-gray-100 text-gray-600 ring-gray-300" },
] as const;

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

  function handleSelect(value: string) {
    if (value === currentStatus || isPending) return;

    if (value === "resolved") {
      setShowResolveModal(true);
      return;
    }

    startTransition(async () => {
      await updateObjectiveStatus(
        objectiveId,
        value as "active" | "paused"
      );
    });
  }

  function handleConfirmResolve() {
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
  }

  return (
    <>
      <div className="flex w-full rounded-lg bg-gray-100 p-0.5">
        {segments.map((seg) => {
          const isActive = seg.value === currentStatus;
          return (
            <button
              key={seg.value}
              onClick={() => handleSelect(seg.value)}
              disabled={isPending || (currentStatus === "resolved" && seg.value !== "resolved")}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-all ${
                isActive
                  ? `${seg.color} shadow-sm ring-1`
                  : "text-gray-500 hover:text-gray-700"
              } disabled:opacity-50`}
            >
              {seg.label}
            </button>
          );
        })}
      </div>

      {showResolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">
              Resolve Strategic Objective?
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              This will stop all daily AI signal collection for this objective.
              It will be moved to your &ldquo;Resolved&rdquo; list.
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
              placeholder="What was the final outcome?"
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
