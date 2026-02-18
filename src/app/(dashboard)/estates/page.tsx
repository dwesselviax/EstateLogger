"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, MapPin, Calendar, Package, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreateEstateModal } from "@/components/estate/create-estate-modal";
import { formatDate, daysUntil } from "@/lib/utils";
import type { Estate } from "@/lib/types";

export default function EstatesPage() {
  const [estates, setEstates] = useState<Estate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const supabase = createClient();

  const fetchEstates = useCallback(async () => {
    const { data } = await supabase
      .from("estate_summary")
      .select("*")
      .order("created_at", { ascending: false });

    setEstates((data as Estate[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchEstates();
  }, [fetchEstates]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Estates</h1>
          <p className="text-sm text-gray-500">Manage your auction inventories</p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="md">
          <Plus size={18} /> New Estate
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : estates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16">
          <Package size={48} className="mb-4 text-gray-300" />
          <p className="mb-2 font-medium text-gray-600">No estates yet</p>
          <p className="mb-6 text-sm text-gray-400">Create your first estate to start cataloging</p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={18} /> Create Estate
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {estates.map((estate) => {
            const days = daysUntil(estate.auction_date);
            return (
              <Link
                key={estate.id}
                href={`/estates/${estate.id}`}
                className="group rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
              >
                <div className="mb-3 flex items-start justify-between">
                  <h3 className="font-semibold leading-snug text-[#1E1E1E] group-hover:underline">
                    {estate.name}
                  </h3>
                  <Badge status={estate.status}>{estate.status}</Badge>
                </div>

                <div className="space-y-1.5 text-sm text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={14} /> {estate.address}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar size={14} />
                    {formatDate(estate.auction_date)}
                    {days > 0 && (
                      <span className="text-xs text-gray-400">({days}d away)</span>
                    )}
                    {days <= 0 && days > -1 && (
                      <span className="text-xs font-medium text-amber-600">Today!</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Package size={14} />
                    {estate.item_count ?? 0} items
                    {(estate.enriched_count ?? 0) > 0 && (
                      <span className="text-xs text-gray-400">
                        · {estate.enriched_count} enriched
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end text-sm font-medium text-[#2A2A2A] opacity-0 transition-opacity group-hover:opacity-100">
                  Open <ArrowRight size={14} className="ml-1" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <CreateEstateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={fetchEstates}
      />
    </div>
  );
}
