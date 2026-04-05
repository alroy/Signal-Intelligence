"use client";

import { useState, useTransition, useCallback } from "react";
import { triggerMondaySync } from "@/app/actions/sync";

function Toast({
  message,
  isError,
}: {
  message: string;
  isError: boolean;
}) {
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
      <div
        className={`rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${
          isError
            ? "bg-red-50 text-red-800 ring-1 ring-red-200"
            : "bg-green-50 text-green-800 ring-1 ring-green-200"
        }`}
      >
        {message}
      </div>
    </div>
  );
}

export function SyncButton() {
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{
    message: string;
    isError: boolean;
  } | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const handleSync = useCallback(() => {
    startTransition(async () => {
      const result = await triggerMondaySync();
      if ("error" in result) {
        setToast({ message: `Sync failed: ${result.error}`, isError: true });
      } else {
        setToast({
          message: `Successfully synced ${result.synced} signal${result.synced === 1 ? "" : "s"}`,
          isError: false,
        });
        setLastSyncedAt(new Date());
      }
      setTimeout(() => setToast(null), 4000);
    });
  }, []);

  function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <>
      <div className="flex flex-col items-end">
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
        <p className="mt-1 h-4 text-xs text-gray-400">
          {lastSyncedAt ? `Last synced ${formatTime(lastSyncedAt)}` : ""}
        </p>
      </div>
      {toast && <Toast message={toast.message} isError={toast.isError} />}
    </>
  );
}
