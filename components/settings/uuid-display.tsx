"use client";

import { useState } from "react";

export function UuidDisplay({ uuid }: { uuid: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(uuid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-3">
      <code className="rounded-md bg-gray-100 px-3 py-2 text-sm font-mono text-gray-800">
        {uuid}
      </code>
      <button
        onClick={handleCopy}
        className="rounded-md bg-gray-100 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
