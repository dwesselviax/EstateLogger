"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Trash2, Search, Filter } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES, CONDITIONS, type Item, type ItemCondition } from "@/lib/types";

export default function ReviewPage() {
  const { id: estateId } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    let query = supabase
      .from("items")
      .select("*")
      .eq("estate_id", estateId)
      .order("created_at", { ascending: false });

    if (filterCategory) query = query.eq("category", filterCategory);
    if (filterStatus) query = query.eq("status", filterStatus);

    const { data } = await query;
    setItems((data as Item[]) ?? []);
    setLoading(false);
  }, [estateId, supabase, filterCategory, filterStatus]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filteredItems = items.filter((item) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      item.name.toLowerCase().includes(s) ||
      item.description?.toLowerCase().includes(s) ||
      item.category.toLowerCase().includes(s) ||
      item.location?.toLowerCase().includes(s)
    );
  });

  async function handleInlineEdit(itemId: string, field: string, value: string) {
    await supabase.from("items").update({ [field]: value }).eq("id", itemId);
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, [field]: value } : i))
    );
  }

  async function handleConfirmSelected() {
    const ids = Array.from(selected);
    await supabase.from("items").update({ status: "confirmed" }).in("id", ids);
    setSelected(new Set());
    fetchItems();
  }

  async function handleDeleteSelected() {
    const ids = Array.from(selected);
    if (!confirm(`Delete ${ids.length} item(s)?`)) return;
    await supabase.from("items").delete().in("id", ids);
    setSelected(new Set());
    fetchItems();
  }

  async function handleConfirmAll() {
    await supabase
      .from("items")
      .update({ status: "confirmed" })
      .eq("estate_id", estateId)
      .eq("status", "captured");
    fetchItems();
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filteredItems.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredItems.map((i) => i.id)));
    }
  }

  return (
    <div>
      <Link
        href={`/estates/${estateId}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#1E1E1E]"
      >
        <ArrowLeft size={16} /> Back to Estate
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Review Items ({items.length})</h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleConfirmAll}>
            <Check size={16} /> Confirm All
          </Button>
          <Button
            size="sm"
            onClick={() => router.push(`/estates/${estateId}/enrich`)}
          >
            Enrich →
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items…"
            className="pl-9"
          />
        </div>
        <Select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="w-full sm:w-48"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-full sm:w-36"
        >
          <option value="">All Statuses</option>
          <option value="captured">Captured</option>
          <option value="confirmed">Confirmed</option>
          <option value="enriched">Enriched</option>
        </Select>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg bg-[#2A2A2A] px-4 py-2 text-sm text-white">
          <span>{selected.size} selected</span>
          <Button variant="ghost" size="sm" className="text-white hover:text-green-300" onClick={handleConfirmSelected}>
            <Check size={14} /> Confirm
          </Button>
          <Button variant="ghost" size="sm" className="text-white hover:text-red-300" onClick={handleDeleteSelected}>
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      )}

      {/* Items table */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase text-gray-400">
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.size === filteredItems.length && filteredItems.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Category</th>
                <th className="hidden px-4 py-3 md:table-cell">Condition</th>
                <th className="hidden px-4 py-3 sm:table-cell">Location</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    {editingId === item.id ? (
                      <Input
                        defaultValue={item.name}
                        onBlur={(e) => {
                          handleInlineEdit(item.id, "name", e.target.value);
                          setEditingId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleInlineEdit(item.id, "name", (e.target as HTMLInputElement).value);
                            setEditingId(null);
                          }
                        }}
                        autoFocus
                        className="h-8 text-sm"
                      />
                    ) : (
                      <button
                        onClick={() => setEditingId(item.id)}
                        className="text-left font-medium hover:underline"
                      >
                        {item.name}
                      </button>
                    )}
                    {item.description && (
                      <p className="mt-0.5 text-xs text-gray-400 line-clamp-1">
                        {item.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={item.category}
                      onChange={(e) => handleInlineEdit(item.id, "category", e.target.value)}
                      className="h-8 border-none bg-transparent p-0 text-sm"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </Select>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <Select
                      value={item.condition ?? "unknown"}
                      onChange={(e) => handleInlineEdit(item.id, "condition", e.target.value)}
                      className="h-8 border-none bg-transparent p-0 text-sm capitalize"
                    >
                      {CONDITIONS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </Select>
                  </td>
                  <td className="hidden px-4 py-3 text-gray-500 sm:table-cell">
                    {item.location ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={item.status}>{item.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredItems.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">
            {items.length === 0 ? "No items yet — start a logging session" : "No items match your filters"}
          </div>
        )}
      </div>
    </div>
  );
}
