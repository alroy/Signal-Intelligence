import Link from "next/link";
import type { Objective } from "@/types/database";

const urgencyColors: Record<string, string> = {
  act_now: "bg-red-100 text-red-800",
  this_week: "bg-yellow-100 text-yellow-800",
  background: "bg-green-100 text-green-800",
};

export function ObjectiveCard({
  objective,
  unreadCount,
  highestUrgency,
}: {
  objective: Objective;
  unreadCount: number;
  highestUrgency: string | null;
}) {
  return (
    <Link
      href={`/objectives/${objective.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          {objective.title}
        </h3>
        {unreadCount > 0 && (
          <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
            {unreadCount} new
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        {highestUrgency && (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${urgencyColors[highestUrgency] || "bg-gray-100 text-gray-800"}`}
          >
            {highestUrgency.replace("_", " ")}
          </span>
        )}
        <span className="text-xs text-gray-500">
          Created {new Date(objective.created_at).toLocaleDateString()}
        </span>
      </div>
    </Link>
  );
}
