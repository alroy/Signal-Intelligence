import type { Match } from "@/types/database";
import { FeedbackButtons } from "./feedback-buttons";

const sourceIcons: Record<string, string> = {
  slack: "💬",
  salesforce: "☁️",
  gong: "🎙️",
};

const categoryColors: Record<string, string> = {
  opportunity: "bg-blue-100 text-blue-800",
  risk: "bg-red-100 text-red-800",
  info: "bg-gray-100 text-gray-800",
};

const urgencyColors: Record<string, string> = {
  act_now: "bg-red-100 text-red-800",
  this_week: "bg-yellow-100 text-yellow-800",
  background: "bg-green-100 text-green-800",
};

export function MatchItem({ match }: { match: Match }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm">
            <span title={match.source}>
              {sourceIcons[match.source] || "📄"}
            </span>
            {match.account && (
              <span className="font-medium text-gray-900">
                {match.account}
              </span>
            )}
            {match.speaker_role && (
              <span className="text-gray-500">· {match.speaker_role}</span>
            )}
            <span className="text-gray-400">
              {match.source_timestamp
                ? new Date(match.source_timestamp).toLocaleDateString()
                : new Date(match.created_at).toLocaleDateString()}
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-900">{match.content_summary}</p>
          <p className="mt-1 text-sm text-gray-600">{match.explanation}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${categoryColors[match.category] || ""}`}
            >
              {match.category}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${urgencyColors[match.urgency] || ""}`}
            >
              {match.urgency.replace("_", " ")}
            </span>
          </div>
        </div>
        <div className="shrink-0">
          <FeedbackButtons
            matchId={match.id}
            objectiveId={match.objective_id}
            currentFeedback={match.feedback}
          />
        </div>
      </div>
    </div>
  );
}
