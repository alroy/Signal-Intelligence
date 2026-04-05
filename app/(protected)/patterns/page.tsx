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
  const hasPatterns = categories.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Shared Patterns</h2>
        <p className="mt-1 text-gray-600">
          Cross-PM insights that improve signal matching for everyone. Patterns
          are automatically extracted from aggregated feedback.
        </p>
      </div>

      {hasPatterns ? (
        categories.map((category) => (
          <div key={category}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
              {category}
            </h3>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {grouped[category].map((pattern) => (
                <PatternCard key={pattern.id} pattern={pattern} />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">
            No patterns yet. Shared patterns will be automatically extracted
            from aggregated PM feedback over time.
          </p>
        </div>
      )}
    </div>
  );
}
