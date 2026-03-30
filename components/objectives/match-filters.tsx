"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

const filters = [
  {
    key: "category",
    label: "Category",
    options: ["all", "opportunity", "risk", "info"],
  },
  {
    key: "urgency",
    label: "Urgency",
    options: ["all", "act_now", "this_week", "background"],
  },
  {
    key: "feedback",
    label: "Status",
    options: ["all", "pending", "confirmed", "dismissed"],
  },
  {
    key: "source",
    label: "Source",
    options: ["all", "slack", "salesforce", "gong"],
  },
];

function formatOption(opt: string): string {
  if (opt === "all") return "All";
  return opt
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function MatchFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const hasActiveFilters = filters.some(
    (f) => searchParams.get(f.key) && searchParams.get(f.key) !== "all"
  );

  const clearAll = useCallback(() => {
    router.push(pathname);
  }, [router, pathname]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {filters.map((filter) => {
          const current = searchParams.get(filter.key) || "all";
          return (
            <div key={filter.key} className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-gray-500">
                {filter.label}
              </span>
              <div className="flex items-center rounded-md bg-gray-100 p-0.5">
                {filter.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => updateFilter(filter.key, opt)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      current === opt
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {formatOption(opt)}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
