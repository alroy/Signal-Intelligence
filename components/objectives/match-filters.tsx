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

  return (
    <div className="flex flex-wrap items-center gap-3">
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
    <label className="flex items-center gap-1.5 text-xs text-gray-600">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt === "all" ? "All" : opt.replace("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}
