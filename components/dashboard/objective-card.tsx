import Link from "next/link";
import type { Objective } from "@/types/database";

const urgencyColors: Record<string, string> = {
  act_now: "bg-red-100 text-red-800",
  this_week: "bg-yellow-100 text-yellow-800",
  background: "bg-green-100 text-green-800",
};

function timeAgo(date: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ObjectiveCard({
  objective,
  unreadCount,
  highestUrgency,
  latestMatchAt,
  totalMatches,
}: {
  objective: Objective;
  unreadCount: number;
  highestUrgency: string | null;
  latestMatchAt: string | null;
  totalMatches: number;
}) {
  return (
    <Link
      href={`/objectives/${objective.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-medium text-gray-900">
          {objective.title}
        </h3>
        {unreadCount > 0 && (
          <span className="shrink-0 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
            {unreadCount} new
          </span>
        )}
      </div>
      <div className="mt-4 flex items-center gap-2">
        {highestUrgency && (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${urgencyColors[highestUrgency] || "bg-gray-100 text-gray-800"}`}
          >
            {highestUrgency.replace("_", " ")}
          </span>
        )}
        <span className="text-xs text-gray-400">
          {totalMatches} {totalMatches === 1 ? "match" : "matches"}
        </span>
      </div>
      {latestMatchAt && (
        <p className="mt-3 text-xs text-gray-400">
          Latest signal {timeAgo(latestMatchAt)}
        </p>
      )}
    </Link>
  );
}
