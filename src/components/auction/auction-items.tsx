"use client";

import { useState } from "react";
import Image from "next/image";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { Item, EnrichmentRecord, ItemImage } from "@/lib/types";

function getPrimaryImage(images?: ItemImage[]): ItemImage | undefined {
  if (!images || images.length === 0) return undefined;
  return images.find((img) => img.is_primary) ?? images[0];
}

interface AuctionItemsProps {
  items: Item[];
  categories: string[];
}

export function AuctionItems({ items, categories }: AuctionItemsProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const filtered = items.filter((item) => {
    const matchesCategory = !activeCategory || item.category === activeCategory;
    const matchesSearch =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.description?.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Filters bar */}
      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items…"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              !activeCategory
                ? "bg-[#2A2A2A] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All ({items.length})
          </button>
          {categories.map((cat) => {
            const count = items.filter((i) => i.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  activeCategory === cat
                    ? "bg-[#2A2A2A] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Item grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((item) => {
          const enrichment: EnrichmentRecord | null = Array.isArray(item.enrichment)
            ? item.enrichment[0]
            : item.enrichment ?? null;

          return (
            <button
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="group rounded-xl border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
            >
              {/* Item image */}
              <div className="relative mb-3 h-36 overflow-hidden rounded-lg bg-gray-50">
                {getPrimaryImage(item.images) ? (
                  <Image
                    src={getPrimaryImage(item.images)!.url}
                    alt={item.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-300">
                    <span className="text-3xl">📦</span>
                  </div>
                )}
              </div>

              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-snug group-hover:underline">
                  {item.name}
                </h3>
              </div>

              <Badge>{item.category}</Badge>

              {item.condition && item.condition !== "unknown" && (
                <span className="ml-2 text-xs capitalize text-gray-400">{item.condition}</span>
              )}

              {enrichment && (
                <div className="mt-3 border-t border-gray-50 pt-3">
                  <p className="text-lg font-bold text-green-700">
                    {formatCurrency(enrichment.recommended_start_bid)}
                  </p>
                  <p className="text-xs text-gray-400">
                    Est. {formatCurrency(enrichment.estimated_value_low)} – {formatCurrency(enrichment.estimated_value_high)}
                  </p>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="py-16 text-center text-gray-400">No items match your search</div>
      )}

      {/* Item detail modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}

function ItemDetailModal({ item, onClose }: { item: Item; onClose: () => void }) {
  const enrichment: EnrichmentRecord | null = Array.isArray(item.enrichment)
    ? item.enrichment[0]
    : item.enrichment ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
        {/* Modal image */}
        {getPrimaryImage(item.images) && (
          <div className="relative -mx-6 -mt-6 mb-4 h-64 overflow-hidden rounded-t-2xl">
            <Image
              src={getPrimaryImage(item.images)!.url}
              alt={item.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 512px"
            />
          </div>
        )}

        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">{item.name}</h2>
            <div className="mt-1 flex items-center gap-2">
              <Badge>{item.category}</Badge>
              {item.condition && item.condition !== "unknown" && (
                <span className="text-sm capitalize text-gray-500">{item.condition} condition</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        {/* Description */}
        {(enrichment?.enhanced_description || item.description) && (
          <p className="mb-4 text-sm leading-relaxed text-gray-700">
            {enrichment?.enhanced_description || item.description}
          </p>
        )}

        {/* Pricing */}
        {enrichment && (
          <div className="mb-4 rounded-lg bg-green-50 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-gray-500">Starting Bid</span>
              <span className="text-2xl font-bold text-green-700">
                {formatCurrency(enrichment.recommended_start_bid)}
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between text-sm">
              <span className="text-gray-400">Estimated Value</span>
              <span className="text-gray-600">
                {formatCurrency(enrichment.estimated_value_low)} – {formatCurrency(enrichment.estimated_value_high)}
              </span>
            </div>
          </div>
        )}

        {/* Details */}
        <div className="space-y-3 text-sm">
          {enrichment?.product_match && (
            <div>
              <span className="font-medium text-gray-500">Product Match: </span>
              {enrichment.product_match}
              {enrichment.manufacturer && ` by ${enrichment.manufacturer}`}
            </div>
          )}
          {enrichment?.notable_details && (
            <div>
              <span className="font-medium text-gray-500">Notable: </span>
              {enrichment.notable_details}
            </div>
          )}
          {item.location && (
            <div>
              <span className="font-medium text-gray-500">Location: </span>
              {item.location}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
