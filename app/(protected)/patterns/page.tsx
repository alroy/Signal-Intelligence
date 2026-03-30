import { createClient } from "@/lib/supabase/server";
import type { SharedPattern } from "@/types/database";
import { PatternCard } from "@/components/patterns/pattern-card";

export default async function PatternsPage() {
  const supabase = await createClient();

  const { data: patterns } = await supabase
    .from("shared_patterns")
    .select("*")
    .order("category")
    .order("confidence", { ascending: false });

  const typedPatterns = (patterns || []) as SharedPattern[];

  // Group by category
  const grouped = typedPatterns.reduce(
    (acc, pattern) => {
      const cat = pattern.category || "Uncategorized";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(pattern);
      return acc;
    },
    {} as Record<string, SharedPattern[]>
  );

  const categories = Object.keys(grouped).sort();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Shared Patterns</h2>
        <p className="mt-1 text-gray-600">
          Cross-PM insights that improve signal matching for everyone
        </p>
      </div>

      {categories.length > 0 ? (
        categories.map((category) => (
          <div key={category}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
              {category}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {grouped[category].map((pattern) => (
                <PatternCard key={pattern.id} pattern={pattern} />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <h3 className="text-lg font-medium text-gray-900">
            No patterns yet
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            Shared patterns are extracted from aggregated PM feedback over time.
            Keep confirming and dismissing matches to build patterns.
          </p>
        </div>
      )}
    </div>
  );
}
