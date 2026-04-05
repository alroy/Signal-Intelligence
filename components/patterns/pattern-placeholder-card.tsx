export function PatternPlaceholderCard() {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white p-6">
      <svg
        className="h-5 w-5 text-gray-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3l1.91 5.79L20 10.5l-4.91 2.71L12 21l-2.09-7.79L5 10.5l4.91-1.71z" />
      </svg>
      <span className="text-sm font-medium text-gray-400">
        Waiting for feedback...
      </span>
    </div>
  );
}
