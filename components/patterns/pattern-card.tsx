import type { SharedPattern } from "@/types/database";

export function PatternCard({ pattern }: { pattern: SharedPattern }) {
  const total = pattern.confirmations + pattern.dismissals;
  const confidencePct = Math.round(pattern.confidence * 100);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-900">{pattern.pattern_description}</p>
      <div className="mt-3 flex items-center gap-3 text-xs">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
          {pattern.source_type}
          {pattern.source_subtype ? ` · ${pattern.source_subtype}` : ""}
        </span>
        {total > 0 && (
          <>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-green-500"
                  style={{ width: `${confidencePct}%` }}
                />
              </div>
              <span className="text-gray-500">{confidencePct}%</span>
            </div>
            <span className="text-gray-400">
              {pattern.confirmations}↑ {pattern.dismissals}↓
            </span>
          </>
        )}
      </div>
    </div>
  );
}
