export function PatternPlaceholderCard() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      {/* Skeleton description line */}
      <div className="space-y-1.5">
        <div className="h-3 w-4/5 rounded bg-gray-100" />
        <div className="h-3 w-3/5 rounded bg-gray-100" />
      </div>
      {/* Skeleton meta row mimicking source badge + confidence bar */}
      <div className="mt-3 flex items-center gap-3">
        <div className="h-5 w-16 rounded-full bg-gray-100" />
        <div className="h-1.5 w-16 rounded-full bg-gray-100" />
        <div className="h-3 w-6 rounded bg-gray-100" />
      </div>
      {/* Status message */}
      <div className="mt-4 border-t border-gray-100 pt-3">
        <p className="text-xs font-medium text-gray-400">
          AI is observing feedback...
        </p>
        <p className="mt-0.5 text-xs text-gray-400">
          Patterns emerge automatically once enough signals have been confirmed
          or dismissed across the team.
        </p>
      </div>
    </div>
  );
}
