"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { PropertyType } from "@/lib/types";

interface CreateEstateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateEstateModal({ open, onClose, onCreated }: CreateEstateModalProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [auctionDate, setAuctionDate] = useState("");
  const [propertyType, setPropertyType] = useState<PropertyType | "">("");
  const [executorName, setExecutorName] = useState("");
  const [executorContact, setExecutorContact] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("estates").insert({
      user_id: user.id,
      name,
      address,
      auction_date: new Date(auctionDate).toISOString(),
      property_type: propertyType || null,
      executor_name: executorName || null,
      executor_contact: executorContact || null,
      notes: notes || null,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Reset form
    setName("");
    setAddress("");
    setAuctionDate("");
    setPropertyType("");
    setExecutorName("");
    setExecutorContact("");
    setNotes("");
    setLoading(false);
    onCreated();
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Estate</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Estate Name *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Johnson Family Estate" required />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Address *</label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full property address" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Auction Date *</label>
              <Input type="datetime-local" value={auctionDate} onChange={(e) => setAuctionDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Property Type</label>
              <Select value={propertyType} onChange={(e) => setPropertyType(e.target.value as PropertyType)}>
                <option value="">Select…</option>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="storage">Storage Unit</option>
                <option value="other">Other</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Executor Name</label>
              <Input value={executorName} onChange={(e) => setExecutorName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Executor Contact</label>
              <Input value={executorContact} onChange={(e) => setExecutorContact(e.target.value)} placeholder="Phone or email" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-[#2A2A2A] focus:outline-none focus:ring-1 focus:ring-[#2A2A2A]"
              placeholder="Access instructions, special notes…"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Creating…" : "Create Estate"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
