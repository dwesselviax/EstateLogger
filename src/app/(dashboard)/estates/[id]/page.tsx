"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mic, ClipboardList, Sparkles, Globe, ArrowLeft,
  MapPin, Calendar, Package, Pencil, Trash2
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, daysUntil, formatCurrency } from "@/lib/utils";
import type { Estate, Item } from "@/lib/types";

export default function EstateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [estate, setEstate] = useState<Estate | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [estateRes, itemsRes] = await Promise.all([
      supabase.from("estate_summary").select("*").eq("id", id).single(),
      supabase.from("items").select("*, enrichment:enrichment_records(*)").eq("estate_id", id).order("created_at", { ascending: false }).limit(10),
    ]);
    setEstate(estateRes.data as Estate | null);
    setItems((itemsRes.data as Item[]) ?? []);
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleUpdateStatus(status: string) {
    await supabase.from("estates").update({ status }).eq("id", id);
    fetchData();
  }

  async function handleDelete() {
    if (!confirm("Delete this estate? This cannot be undone.")) return;
    const { data, error, count, status } = await supabase.from("estates").delete().eq("id", id).select();
if (error) {
      alert(`Failed to delete: ${error.message}`);
      return;
    }
    if (!data || data.length === 0) {
      alert("Delete blocked — you may not own this estate or RLS is preventing deletion.");
      return;
    }
    router.push("/estates");
  }

  if (loading) {
    return <div className="space-y-4"><div className="h-8 w-48 animate-pulse rounded bg-gray-100" /><div className="h-40 animate-pulse rounded-xl bg-gray-100" /></div>;
  }

  if (!estate) {
    return <div className="py-16 text-center text-gray-500">Estate not found</div>;
  }

  const days = daysUntil(estate.auction_date);
  const confirmedCount = items.filter((i) => i.status !== "captured").length;
  const enrichedCount = items.filter((i) => i.status === "enriched" || i.status === "published").length;

  return (
    <div>
      {/* Back nav */}
      <Link href="/estates" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#1E1E1E]">
        <ArrowLeft size={16} /> All Estates
      </Link>

      {/* Estate header */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold sm:text-2xl">{estate.name}</h1>
              <Badge status={estate.status}>{estate.status}</Badge>
            </div>
            <div className="mt-2 space-y-1 text-sm text-gray-500">
              <div className="flex items-center gap-1.5"><MapPin size={14} /> {estate.address}</div>
              <div className="flex items-center gap-1.5">
                <Calendar size={14} /> {formatDate(estate.auction_date)}
                {days > 0 && <span className="text-xs">({days}d away)</span>}
              </div>
              <div className="flex items-center gap-1.5">
                <Package size={14} /> {estate.item_count ?? 0} items · {enrichedCount} enriched
              </div>
            </div>
            {estate.notes && <p className="mt-3 text-sm text-gray-600">{estate.notes}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleDelete}><Trash2 size={16} /></Button>
          </div>
        </div>
      </div>

      {/* Action cards — the main workflow */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <WorkflowCard
          icon={<Mic size={24} />}
          title="Log Items"
          description="Voice-capture inventory"
          href={`/estates/${id}/log`}
          accent
        />
        <WorkflowCard
          icon={<ClipboardList size={24} />}
          title="Review Items"
          description={`${estate.item_count ?? 0} items · ${confirmedCount} confirmed`}
          href={`/estates/${id}/review`}
        />
        <WorkflowCard
          icon={<Sparkles size={24} />}
          title="Enrich"
          description={`${enrichedCount} of ${estate.item_count ?? 0} enriched`}
          href={`/estates/${id}/enrich`}
        />
        <WorkflowCard
          icon={<Globe size={24} />}
          title={estate.status === "published" ? "View Auction Page" : "Publish"}
          description={estate.status === "published" ? "Live" : "Generate auction page"}
          href={estate.status === "published" ? `/auction/${id}` : `/estates/${id}/review`}
          onClick={
            estate.status !== "published"
              ? async () => {
                  if (confirm("Publish this estate? Items will be visible publicly.")) {
                    await handleUpdateStatus("published");
                    // Also mark all enriched items as published
                    await supabase.from("items").update({ status: "published" }).eq("estate_id", id).in("status", ["enriched", "confirmed"]);
                    router.push(`/auction/${id}`);
                  }
                }
              : undefined
          }
        />
      </div>

      {/* Recent items preview */}
      {items.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Recent Items</h2>
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase text-gray-400">
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="hidden px-4 py-3 sm:table-cell">Condition</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3 font-medium">{item.name}</td>
                      <td className="px-4 py-3 text-gray-500">{item.category}</td>
                      <td className="hidden px-4 py-3 capitalize text-gray-500 sm:table-cell">{item.condition ?? "—"}</td>
                      <td className="px-4 py-3"><Badge status={item.status}>{item.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkflowCard({
  icon,
  title,
  description,
  href,
  accent,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  accent?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <div
      className={`group flex cursor-pointer flex-col items-center gap-3 rounded-xl border p-6 text-center transition-shadow hover:shadow-md ${
        accent
          ? "border-[#2A2A2A] bg-[#2A2A2A] text-white"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className={accent ? "text-white" : "text-gray-600"}>{icon}</div>
      <div>
        <p className="font-semibold">{title}</p>
        <p className={`text-xs ${accent ? "text-gray-300" : "text-gray-400"}`}>{description}</p>
      </div>
    </div>
  );

  if (onClick) {
    return <div onClick={onClick}>{content}</div>;
  }

  return <Link href={href}>{content}</Link>;
}
