"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, Loader2, ChevronDown, ChevronUp, RefreshCw, DollarSign } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { Item, EnrichmentRecord } from "@/lib/types";

export default function EnrichPage() {
  const { id: estateId } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrichingAll, setEnrichingAll] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from("items")
      .select("*, enrichment:enrichment_records(*)")
      .eq("estate_id", estateId)
      .in("status", ["confirmed", "enriched", "published"])
      .order("created_at", { ascending: false });

    setItems((data as Item[]) ?? []);
    setLoading(false);
  }, [estateId, supabase]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  async function enrichSingle(itemId: string) {
    setEnrichingId(itemId);
    try {
      await fetch("/api/enrich-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
    } catch (err) {
      console.error("Enrichment error:", err);
    }
    setEnrichingId(null);
    fetchItems();
  }

  async function enrichAll() {
    const toEnrich = items.filter(
      (i) => i.status === "confirmed" || (!i.enrichment && i.status !== "captured")
    );

    if (toEnrich.length === 0) {
      alert("No items to enrich. Confirm items first in the Review step.");
      return;
    }

    setEnrichingAll(true);
    setProgress({ done: 0, total: toEnrich.length });

    for (let i = 0; i < toEnrich.length; i++) {
      try {
        await fetch("/api/enrich-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: toEnrich[i].id }),
        });
      } catch (err) {
        console.error(`Failed to enrich ${toEnrich[i].name}:`, err);
      }
      setProgress({ done: i + 1, total: toEnrich.length });
    }

    setEnrichingAll(false);

    // Update estate status
    await supabase.from("estates").update({ status: "enriching" }).eq("id", estateId);
    fetchItems();
  }

  const enrichedCount = items.filter((i) => i.enrichment).length;

  return (
    <div>
      <Link
        href={`/estates/${estateId}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#1E1E1E]"
      >
        <ArrowLeft size={16} /> Back to Estate
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Enrichment</h1>
          <p className="text-sm text-gray-500">
            {enrichedCount} of {items.length} items enriched
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={enrichAll}
            disabled={enrichingAll}
            size="md"
          >
            {enrichingAll ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {progress.done}/{progress.total}
              </>
            ) : (
              <>
                <Sparkles size={16} /> Enrich All
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      {enrichingAll && (
        <div className="mb-6">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-purple-500 transition-all"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Items list */}
      <div className="space-y-3">
        {items.map((item) => {
          const enrichment = Array.isArray(item.enrichment) ? item.enrichment[0] : item.enrichment;
          const isExpanded = expandedId === item.id;
          const isEnriching = enrichingId === item.id;

          return (
            <div key={item.id} className="rounded-xl border border-gray-200 bg-white">
              {/* Item header row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{item.name}</p>
                    <Badge status={item.status}>{item.status}</Badge>
                    {enrichment?.confidence && (
                      <Badge status={enrichment.confidence}>
                        {enrichment.confidence}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{item.category}</p>
                </div>

                {enrichment && (
                  <div className="hidden text-right text-sm sm:block">
                    <p className="font-semibold text-green-700">
                      {formatCurrency(enrichment.estimated_value_low)} – {formatCurrency(enrichment.estimated_value_high)}
                    </p>
                    <p className="text-xs text-gray-400">
                      Start bid: {formatCurrency(enrichment.recommended_start_bid)}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-1">
                  {!enrichment && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => enrichSingle(item.id)}
                      disabled={isEnriching}
                    >
                      {isEnriching ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    </Button>
                  )}
                  {enrichment && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => enrichSingle(item.id)}
                      disabled={isEnriching}
                      title="Re-enrich"
                    >
                      {isEnriching ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    </Button>
                  )}
                  {enrichment && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </Button>
                  )}
                </div>
              </div>

              {/* Expanded enrichment details */}
              {isExpanded && enrichment && (
                <div className="border-t border-gray-100 px-4 py-4 text-sm">
                  {/* Mobile pricing */}
                  <div className="mb-3 sm:hidden">
                    <p className="font-semibold text-green-700">
                      {formatCurrency(enrichment.estimated_value_low)} – {formatCurrency(enrichment.estimated_value_high)}
                    </p>
                    <p className="text-xs text-gray-400">
                      Start bid: {formatCurrency(enrichment.recommended_start_bid)}
                    </p>
                  </div>

                  {enrichment.product_match && (
                    <div className="mb-2">
                      <span className="font-medium text-gray-500">Product: </span>
                      {enrichment.product_match}
                      {enrichment.manufacturer && ` by ${enrichment.manufacturer}`}
                    </div>
                  )}
                  {enrichment.enhanced_description && (
                    <div className="mb-2">
                      <span className="font-medium text-gray-500">Description: </span>
                      {enrichment.enhanced_description}
                    </div>
                  )}
                  {enrichment.notable_details && (
                    <div className="mb-2">
                      <span className="font-medium text-gray-500">Notable: </span>
                      {enrichment.notable_details}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {items.length === 0 && !loading && (
        <div className="py-16 text-center text-sm text-gray-400">
          No confirmed items to enrich.{" "}
          <Link href={`/estates/${estateId}/review`} className="underline">
            Review and confirm items first.
          </Link>
        </div>
      )}
    </div>
  );
}
