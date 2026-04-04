"use client";

import { useState } from "react";
import type { MatchWithCluster } from "@/types/database";
import { MatchItem } from "./match-item";

const filterDefs = [
  {
    key: "category" as const,
    label: "Category",
    options: ["all", "opportunity", "risk", "info"],
  },
  {
    key: "urgency" as const,
    label: "Urgency",
    options: ["all", "act_now", "this_week", "background"],
  },
  {
    key: "feedback" as const,
    label: "Status",
    options: ["all", "pending", "confirmed", "dismissed"],
  },
  {
    key: "source" as const,
    label: "Source",
    options: ["all", "slack", "salesforce", "gong", "gmail", "monday"],
  },
];

type FilterKey = "category" | "urgency" | "feedback" | "source";

const urgencyOrder: Record<string, number> = {
  act_now: 0,
  this_week: 1,
  background: 2,
};

const urgencyColors: Record<string, string> = {
  act_now: "bg-red-100 text-red-800",
  this_week: "bg-yellow-100 text-yellow-800",
  background: "bg-green-100 text-green-800",
};

export function FilterableMatchFeed({ matches }: { matches: MatchWithCluster[] }) {
  const [filters, setFilters] = useState<Record<FilterKey, string>>({
    category: "all",
    urgency: "all",
    feedback: "all",
    source: "all",
  });

  const hasActiveFilters = Object.values(filters).some((v) => v !== "all");

  const filtered = matches.filter((match) => {
    if (filters.category !== "all" && match.category !== filters.category)
      return false;
    if (filters.urgency !== "all" && match.urgency !== filters.urgency)
      return false;
    if (filters.feedback !== "all" && match.feedback !== filters.feedback)
      return false;
    if (filters.source !== "all" && match.source !== filters.source)
      return false;
    return true;
  });

  // Group filtered matches by cluster
  const clusterGroups = new Map<
    string,
    { cluster: NonNullable<MatchWithCluster["cluster"]>; matches: MatchWithCluster[] }
  >();
  const unclustered: MatchWithCluster[] = [];

  for (const match of filtered) {
    if (match.cluster) {
      const existing = clusterGroups.get(match.cluster.id);
      if (existing) {
        existing.matches.push(match);
      } else {
        clusterGroups.set(match.cluster.id, {
          cluster: match.cluster,
          matches: [match],
        });
      }
    } else {
      unclustered.push(match);
    }
  }

  // Sort cluster groups by urgency (act_now first)
  const sortedGroups = [...clusterGroups.values()].sort(
    (a, b) =>
      (urgencyOrder[a.cluster.combined_urgency] ?? 2) -
      (urgencyOrder[b.cluster.combined_urgency] ?? 2)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        {filterDefs.map((def) => (
          <div key={def.key} className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">
              {def.label}
            </span>
            <select
              value={filters[def.key]}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, [def.key]: e.target.value }))
              }
              className="appearance-none rounded-md border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-xs text-gray-700 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[position:right_6px_center] bg-no-repeat"
            >
              {def.options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === "all" ? "All" : opt.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
        ))}
        {hasActiveFilters && (
          <button
            onClick={() =>
              setFilters({
                category: "all",
                urgency: "all",
                feedback: "all",
                source: "all",
              })
            }
            className="text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            Clear filters
          </button>
        )}
      </div>

      {filtered.length > 0 ? (
        <div className="space-y-4">
          {sortedGroups.map(({ cluster, matches: groupMatches }) => (
            <div
              key={cluster.id}
              className="border-l-2 border-purple-300 pl-3 space-y-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-purple-900">
                  {cluster.situation_summary}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${urgencyColors[cluster.combined_urgency] || ""}`}
                >
                  {cluster.combined_urgency.replace("_", " ")}
                </span>
                <span className="text-xs text-gray-400">
                  {groupMatches.length} signals
                </span>
              </div>
              {groupMatches.map((match) => (
                <MatchItem key={match.id} match={match} />
              ))}
            </div>
          ))}
          {unclustered.length > 0 && sortedGroups.length > 0 && (
            <div className="pt-2">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Unclustered signals
              </span>
            </div>
          )}
          {unclustered.map((match) => (
            <MatchItem key={match.id} match={match} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">
            {hasActiveFilters
              ? "No matches found with these filters."
              : "No matches yet. The Cowork plugin will populate matches during signal collection."}
          </p>
        </div>
      )}
    </div>
  );
}
