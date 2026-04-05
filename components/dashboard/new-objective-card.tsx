"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { createObjective } from "@/app/actions/objectives";

export function NewObjectiveCard() {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    startTransition(async () => {
      const result = await createObjective(title);
      if (result.error) {
        setError(result.error);
      } else {
        setTitle("");
        setError(null);
        setIsOpen(false);
      }
    });
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex min-h-[140px] w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-300 bg-white p-6 transition-colors hover:border-gray-400 hover:bg-gray-50"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-2xl font-light text-gray-400">
          +
        </span>
        <span className="text-sm font-semibold text-gray-400">
          New objective
        </span>
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-h-[140px] flex-col rounded-lg border-2 border-blue-200 bg-white p-4"
    >
      <label
        htmlFor="new-objective-title"
        className="block text-sm font-medium text-gray-700"
      >
        Strategic objective
      </label>
      <textarea
        ref={textareaRef}
        id="new-objective-title"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          if (error) setError(null);
        }}
        placeholder="e.g., Identify expansion opportunities in EMEA"
        disabled={isPending}
        rows={3}
        className="mt-1 w-full flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "Creating\u2026" : "Create"}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setTitle("");
            setError(null);
          }}
          disabled={isPending}
          className="rounded-md bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition-colors hover:bg-gray-100 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
