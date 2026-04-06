import type { Objective, MatchWithCluster } from "@/types/database";
import { StatusToggle } from "./status-toggle";

export function ObjectiveSidebar({
  objective,
  matches,
}: {
  objective: Objective;
  matches: MatchWithCluster[];
}) {
  const total = matches.length;
  const confirmed = matches.filter((m) => m.feedback === "confirmed").length;
  const dismissed = matches.filter((m) => m.feedback === "dismissed").length;
  const pending = matches.filter((m) => m.feedback === "pending").length;

  const clusterIds = new Set(
    matches.map((m) => m.cluster?.id).filter(Boolean)
  );
  const clusteredCount = matches.filter((m) => m.cluster !== null).length;

  const categoryBreakdown = matches.reduce(
    (acc, m) => {
      acc[m.category] = (acc[m.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const topAccounts = Object.entries(
    matches.reduce(
      (acc, m) => {
        if (m.account) acc[m.account] = (acc[m.account] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    )
  )
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <StatusToggle
        objectiveId={objective.id}
        currentStatus={objective.status}
      />

      {objective.status === "resolved" && objective.resolution_note && (
        <div>
          <h3 className="text-sm font-medium text-gray-500">Resolution Note</h3>
          <p className="mt-1 text-sm text-gray-600 italic">
            {objective.resolution_note}
          </p>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-gray-500">Match Stats</h3>
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-600">Total</dt>
            <dd className="font-medium">{total}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-green-600">Confirmed</dt>
            <dd className="font-medium">{confirmed}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-400">Dismissed</dt>
            <dd className="font-medium">{dismissed}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-blue-600">Pending</dt>
            <dd className="font-medium">{pending}</dd>
          </div>
        </dl>
      </div>

      {clusterIds.size > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-500">Clusters</h3>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Active clusters</dt>
              <dd className="font-medium">{clusterIds.size}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-purple-600">Clustered</dt>
              <dd className="font-medium">{clusteredCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-400">Unclustered</dt>
              <dd className="font-medium">{total - clusteredCount}</dd>
            </div>
          </dl>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-gray-500">By Category</h3>
        <dl className="mt-2 space-y-1 text-sm">
          {Object.entries(categoryBreakdown).map(([cat, count]) => (
            <div key={cat} className="flex justify-between">
              <dt className="capitalize text-gray-600">{cat}</dt>
              <dd className="font-medium">{count}</dd>
            </div>
          ))}
        </dl>
      </div>

      {topAccounts.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-500">Top Accounts</h3>
          <dl className="mt-2 space-y-1 text-sm">
            {topAccounts.map(([account, count]) => (
              <div key={account} className="flex justify-between">
                <dt className="truncate text-gray-600">{account}</dt>
                <dd className="font-medium">{count}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

    </div>
  );
}
