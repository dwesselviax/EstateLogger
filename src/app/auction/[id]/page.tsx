import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Calendar, Package } from "lucide-react";
import { AuctionItems } from "@/components/auction/auction-items";
import { formatDate } from "@/lib/utils";
import type { Estate, Item } from "@/lib/types";

// Public page — no auth required, server-rendered for SEO
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabase();
  const { data: estate } = await supabase
    .from("estates")
    .select("name, address, auction_date")
    .eq("id", id)
    .eq("status", "published")
    .single();

  if (!estate) return { title: "Auction Not Found" };

  return {
    title: `${estate.name} — Butterscotch Auction`,
    description: `Estate auction at ${estate.address}. ${formatDate(estate.auction_date)}.`,
  };
}

export default async function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabase();

  const [estateRes, itemsRes] = await Promise.all([
    supabase.from("estates").select("*").eq("id", id).eq("status", "published").single(),
    supabase
      .from("items")
      .select("*, enrichment:enrichment_records(*), images:item_images(*)")
      .eq("estate_id", id)
      .in("status", ["enriched", "published"])
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("category", { ascending: true }),
  ]);

  if (!estateRes.data) notFound();

  const estate = estateRes.data as Estate;
  const items = (itemsRes.data as Item[]) ?? [];

  // Extract unique categories for filter nav
  const categories = [...new Set(items.map((i) => i.category))].sort();

  return (
    <div className="min-h-screen bg-[#F8F7F6]">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="mb-4 flex items-center justify-center">
            <Link href="/"><Image src="/logo.webp" alt="Butterscotch Auction" width={220} height={50} className="h-10 w-auto" priority /></Link>
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-bold text-[#1E1E1E] sm:text-3xl">{estate.name}</h1>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1"><MapPin size={14} /> {estate.address}</span>
              <span className="flex items-center gap-1"><Calendar size={14} /> {formatDate(estate.auction_date)}</span>
              <span className="flex items-center gap-1"><Package size={14} /> {items.length} lots</span>
            </div>
            {estate.notes && <p className="mx-auto mt-4 max-w-2xl text-sm text-gray-600">{estate.notes}</p>}
          </div>
        </div>
      </header>

      {/* Items — client component for filtering and search */}
      <AuctionItems items={items} categories={categories} />
    </div>
  );
}
