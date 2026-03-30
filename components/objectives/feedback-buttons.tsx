"use client";

import { useTransition } from "react";
import { submitFeedback } from "@/app/actions/feedback";

export function FeedbackButtons({
  matchId,
  objectiveId,
  currentFeedback,
}: {
  matchId: string;
  objectiveId: string;
  currentFeedback: string;
}) {
  const [isPending, startTransition] = useTransition();

  if (currentFeedback !== "pending") {
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          currentFeedback === "confirmed"
            ? "bg-green-100 text-green-800"
            : "bg-gray-100 text-gray-600"
        }`}
      >
        {currentFeedback}
      </span>
    );
  }

  const handleFeedback = (type: "confirmed" | "dismissed") => {
    startTransition(async () => {
      await submitFeedback(matchId, objectiveId, type);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleFeedback("confirmed")}
        disabled={isPending}
        className="rounded-md bg-green-50 px-3 py-1 text-xs font-medium text-green-700 ring-1 ring-green-200 transition-colors hover:bg-green-100 disabled:opacity-50"
      >
        Confirm
      </button>
      <button
        onClick={() => handleFeedback("dismissed")}
        disabled={isPending}
        className="rounded-md bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-200 transition-colors hover:bg-gray-100 disabled:opacity-50"
      >
        Dismiss
      </button>
    </div>
  );
}
