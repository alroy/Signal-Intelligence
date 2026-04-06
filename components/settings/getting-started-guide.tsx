"use client";

import { useState, useCallback, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className={`absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        copied
          ? "bg-emerald-500 text-white"
          : "border border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600"
      }`}
    >
      {copied ? (
        <>
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          Copy Prompt
        </>
      )}
    </button>
  );
}

function extractTextFromChildren(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(extractTextFromChildren).join("");
  if (children && typeof children === "object" && "props" in children) {
    return extractTextFromChildren((children as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

interface GettingStartedGuideProps {
  markdownContent: string;
}

export function GettingStartedGuide({
  markdownContent,
}: GettingStartedGuideProps) {
  const processedContent = markdownContent.replace(
    "[Download pm-signal-intelligence-plugin.zip](PLACEHOLDER_URL)",
    "[Download pm-signal-intelligence-plugin.zip](/api/download-plugin)"
  );

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-medium">Getting Started</h3>
      <p className="mt-1 text-sm text-gray-500">
        Everything you need to set up PM Signal Intelligence with Claude Desktop
        and Cowork.
      </p>

      {/* Download CTA */}
      <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-700">
          Download the ZIP file below, upload it to your Cowork project, and
          then use the <strong>PM UUID</strong> found in the section below to
          initialize your identity in project memory.
        </p>
        <a
          href="/api/download-plugin"
          download
          className="mt-3 inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3"
            />
          </svg>
          Download Plugin
        </a>
      </div>

      {/* Collapsible guide */}
      <details className="group mt-4">
        <summary className="flex cursor-pointer select-none list-none items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800">
          <svg
            className="h-4 w-4 transition-transform group-open:rotate-90"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
          View full setup guide
        </summary>
        <div className="mt-3 max-h-[600px] overflow-y-auto rounded-md border border-gray-100 p-4">
          <div className="prose">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                pre({ children, ...props }) {
                  const text = extractTextFromChildren(children).trim();
                  return (
                    <pre {...props}>
                      <CopyButton text={text} />
                      {children}
                    </pre>
                  );
                },
              }}
            >
              {processedContent}
            </ReactMarkdown>
          </div>
        </div>
      </details>
    </section>
  );
}
