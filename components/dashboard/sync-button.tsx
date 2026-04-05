"use client";

import { useState, useTransition } from "react";
import { triggerMondaySync } from "@/app/actions/sync";

export function SyncButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleSync() {
    setMessage(null);
    startTransition(async () => {
      const result = await triggerMondaySync();
      if ("error" in result) {
        setMessage(`Error: ${result.error}`);
      } else {
        setMessage(`Synced ${result.synced} signals`);
      }
      setTimeout(() => setMessage(null), 4000);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSync}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 ring-1 ring-blue-200 transition-colors hover:bg-blue-100 disabled:opacity-50"
      >
        <svg
          className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M23 4v6h-6" />
          <path d="M1 20v-6h6" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
        {isPending ? "Syncing\u2026" : "Sync now"}
      </button>
      {message && (
        <span
          className={`text-xs font-medium ${
            message.startsWith("Error") ? "text-red-600" : "text-green-600"
          }`}
        >
          {message}
        </span>
      )}
    </div>
  );
}
