"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mic, MicOff, Square, Loader2, Plus, Send, Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useSpeech } from "@/lib/use-speech";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Item, ItemImage, LoggingSession } from "@/lib/types";

export default function LoggingPage() {
  const { id: estateId } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [session, setSession] = useState<LoggingSession | null>(null);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [showComplete, setShowComplete] = useState(false);
  const [itemImages, setItemImages] = useState<Record<string, ItemImage[]>>({});
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeItemIdRef = useRef<string | null>(null);

  const transcriptRef = useRef(transcript);
  transcriptRef.current = transcript;
  const pendingRef = useRef("");
  const extractTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Start a logging session
  const startSession = useCallback(async () => {
    const { data } = await supabase
      .from("logging_sessions")
      .insert({ estate_id: estateId, status: "active" })
      .select()
      .single();

    if (data) setSession(data as LoggingSession);

    // Update estate status to logging
    await supabase.from("estates").update({ status: "logging" }).eq("id", estateId);
  }, [estateId, supabase]);

  useEffect(() => {
    startSession();
  }, [startSession]);

  // Subscribe to new items via Realtime
  useEffect(() => {
    const channel = supabase
      .channel("items-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "items", filter: `estate_id=eq.${estateId}` },
        (payload) => {
          setItems((prev) => [payload.new as Item, ...prev]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [estateId, supabase]);

  // Load existing items for this estate
  useEffect(() => {
    supabase
      .from("items")
      .select("*")
      .eq("estate_id", estateId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setItems(data as Item[]);
      });
  }, [estateId, supabase]);

  // Load existing images for items
  useEffect(() => {
    if (items.length === 0) return;
    const itemIds = items.map((i) => i.id);
    supabase
      .from("item_images")
      .select("*")
      .in("item_id", itemIds)
      .then(({ data }) => {
        if (data) {
          const grouped: Record<string, ItemImage[]> = {};
          for (const img of data as ItemImage[]) {
            if (!grouped[img.item_id]) grouped[img.item_id] = [];
            grouped[img.item_id].push(img);
          }
          setItemImages(grouped);
        }
      });
  }, [items, supabase]);

  // Handle image upload for an item
  async function handleImageUpload(file: File, itemId: string) {
    setUploadingItemId(itemId);
    try {
      const timestamp = Date.now();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${estateId}/${itemId}/${timestamp}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("item-images")
        .upload(path, file);

      if (uploadError) {
        console.error("Upload failed:", uploadError);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("item-images")
        .getPublicUrl(path);

      const { data: record, error: insertError } = await supabase
        .from("item_images")
        .insert({
          item_id: itemId,
          url: urlData.publicUrl,
          type: "actual",
          is_primary: !itemImages[itemId]?.length,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Insert failed:", insertError);
        return;
      }

      setItemImages((prev) => ({
        ...prev,
        [itemId]: [...(prev[itemId] || []), record as ItemImage],
      }));
    } catch (err) {
      console.error("Image upload error:", err);
    } finally {
      setUploadingItemId(null);
    }
  }

  function openFilePicker(itemId: string) {
    activeItemIdRef.current = itemId;
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && activeItemIdRef.current) {
      handleImageUpload(file, activeItemIdRef.current);
    }
    e.target.value = "";
  }

  // Extract items from transcript via API route
  const extractItems = useCallback(
    async (text: string) => {
      if (!text.trim() || !session) return;
      setExtracting(true);

      try {
        const response = await fetch("/api/extract-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: text,
            estateId,
            sessionId: session.id,
          }),
        });

        if (!response.ok) {
          console.error("Extraction failed:", await response.text());
        }
      } catch (err) {
        console.error("Extraction error:", err);
      } finally {
        setExtracting(false);
        pendingRef.current = "";
      }
    },
    [estateId, session]
  );

  // Debounced extraction: wait for a pause in speech
  const scheduleExtraction = useCallback(
    (text: string) => {
      pendingRef.current = text;
      if (extractTimerRef.current) clearTimeout(extractTimerRef.current);
      extractTimerRef.current = setTimeout(() => {
        extractItems(pendingRef.current);
      }, 3000); // 3s pause triggers extraction
    },
    [extractItems]
  );

  // Speech recognition
  const handleTranscript = useCallback(
    (text: string, isFinal: boolean) => {
      if (isFinal) {
        setTranscript((prev) => {
          const updated = prev + " " + text;
          scheduleExtraction(updated);
          return updated;
        });
        setInterimText("");
      } else {
        setInterimText(text);
      }
    },
    [scheduleExtraction]
  );

  const { isListening, isSupported, start, stop } = useSpeech({
    onTranscript: handleTranscript,
  });

  // Manual text input submission
  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualInput.trim()) return;

    const text = manualInput.trim();
    setManualInput("");
    setTranscript((prev) => prev + " " + text);
    extractItems(text);
  }

  // End session
  async function handleStopSession() {
    // Flush any pending extraction
    if (pendingRef.current) {
      await extractItems(pendingRef.current);
    }

    stop();

    if (session) {
      await supabase
        .from("logging_sessions")
        .update({
          status: "completed",
          full_transcript: transcript,
          item_count: items.length,
          ended_at: new Date().toISOString(),
        })
        .eq("id", session.id);
    }

    setShowComplete(true);
  }

  // Session complete UI
  if (showComplete) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-6 rounded-full bg-green-100 p-4">
          <Mic size={32} className="text-green-600" />
        </div>
        <h2 className="mb-2 text-xl font-semibold">Session Complete</h2>
        <p className="mb-8 text-gray-500">{items.length} items captured</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            onClick={() => {
              setShowComplete(false);
              setTranscript("");
              setInterimText("");
              startSession();
            }}
            variant="secondary"
            size="lg"
          >
            <Plus size={18} /> Keep Going
          </Button>
          <Button onClick={() => router.push(`/estates/${estateId}/review`)} size="lg">
            Review & Enrich
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-32">
      {/* Hidden file input for camera/gallery */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileChange}
      />

      {/* Header */}
      <Link
        href={`/estates/${estateId}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#1E1E1E]"
      >
        <ArrowLeft size={16} /> Back to Estate
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Voice Logging</h1>
        <Button variant="secondary" size="sm" onClick={handleStopSession}>
          <Square size={16} /> End Session
        </Button>
      </div>

      {/* Transcript display */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <label className="mb-2 block text-xs font-medium uppercase text-gray-400">
          Live Transcript
        </label>
        <div className="min-h-[100px] text-sm leading-relaxed text-gray-700">
          {transcript || <span className="text-gray-300">Start speaking or type below…</span>}
          {interimText && <span className="text-gray-400"> {interimText}</span>}
        </div>
        {extracting && (
          <div className="mt-3 flex items-center gap-2 text-xs text-purple-600">
            <Loader2 size={14} className="animate-spin" /> Extracting items…
          </div>
        )}
      </div>

      {/* Manual text input */}
      <form onSubmit={handleManualSubmit} className="mb-6 flex gap-2">
        <Input
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder="Type items manually…"
          className="flex-1"
        />
        <Button type="submit" variant="secondary" size="md">
          <Send size={16} />
        </Button>
      </form>

      {/* Extracted items */}
      {items.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium uppercase text-gray-400">
            Extracted Items ({items.length})
          </h2>
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-gray-100 bg-white px-4 py-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    {item.description && (
                      <p className="mt-0.5 text-sm text-gray-500">{item.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openFilePicker(item.id)}
                      disabled={uploadingItemId === item.id}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                      title="Add photo"
                    >
                      {uploadingItemId === item.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Camera size={16} />
                      )}
                    </button>
                    <Badge>{item.category}</Badge>
                  </div>
                </div>
                {/* Image thumbnails */}
                {itemImages[item.id]?.length > 0 && (
                  <div className="mt-2 flex gap-2 overflow-x-auto">
                    {itemImages[item.id].map((img) => (
                      <img
                        key={img.id}
                        src={img.url}
                        alt={item.name}
                        className="h-16 w-16 flex-shrink-0 rounded-md border border-gray-200 object-cover"
                      />
                    ))}
                  </div>
                )}
                <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-gray-400">
                  {item.condition && item.condition !== "unknown" && (
                    <span className="capitalize">{item.condition}</span>
                  )}
                  {item.location && <span>📍 {item.location}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating mic button */}
      <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
        {isSupported ? (
          <button
            onClick={isListening ? stop : start}
            className={`flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-all ${
              isListening
                ? "animate-pulse bg-red-500 text-white"
                : "bg-[#2A2A2A] text-white hover:bg-[#3a3a3a]"
            }`}
          >
            {isListening ? <MicOff size={28} /> : <Mic size={28} />}
          </button>
        ) : (
          <div className="rounded-full bg-gray-200 px-4 py-2 text-xs text-gray-500">
            Voice not supported — use text input above
          </div>
        )}
      </div>
    </div>
  );
}
