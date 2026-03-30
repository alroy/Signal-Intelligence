"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

const categories = ["all", "opportunity", "risk", "info"];
const urgencies = ["all", "act_now", "this_week", "background"];
const feedbackStatuses = ["all", "pending", "confirmed", "dismissed"];
const sources = ["all", "slack", "salesforce", "gong"];

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

  const hasActiveFilters = ["category", "urgency", "feedback", "source"].some(
    (key) => searchParams.get(key) && searchParams.get(key) !== "all"
  );

  const clearAll = useCallback(() => {
    router.push(pathname);
  }, [router, pathname]);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <FilterSelect
        label="Category"
        options={categories}
        value={searchParams.get("category") || "all"}
        onChange={(v) => updateFilter("category", v)}
      />
      <FilterSelect
        label="Urgency"
        options={urgencies}
        value={searchParams.get("urgency") || "all"}
        onChange={(v) => updateFilter("urgency", v)}
      />
      <FilterSelect
        label="Feedback"
        options={feedbackStatuses}
        value={searchParams.get("feedback") || "all"}
        onChange={(v) => updateFilter("feedback", v)}
      />
      <FilterSelect
        label="Source"
        options={sources}
        value={searchParams.get("source") || "all"}
        onChange={(v) => updateFilter("source", v)}
      />
      {hasActiveFilters && (
        <button
          onClick={clearAll}
          className="text-xs font-medium text-blue-600 hover:text-blue-800"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-md border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-xs text-gray-700 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[position:right_6px_center] bg-no-repeat"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt === "all" ? "All" : opt.replace("_", " ")}
          </option>
        ))}
      </select>
    </div>
  );
}
