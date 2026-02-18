import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY!;

const SYSTEM_PROMPT = `You are an estate auction enrichment specialist. Given an item name, description, category, and condition, provide market intelligence for auction listing.

Return a single JSON object with:
- "product_match": string — specific product identification (manufacturer, model, era) or null
- "manufacturer": string or null
- "estimated_value_low": number — low end of estimated auction value in USD
- "estimated_value_high": number — high end of estimated auction value in USD
- "recommended_start_bid": number — suggested opening bid in USD
- "enhanced_description": string — a polished, auction-ready description (2-3 sentences)
- "notable_details": string — era, maker, provenance signals, collectibility factors
- "confidence": "high" | "medium" | "low" — how confident you are in the pricing

Base your estimates on typical auction results for similar items. Be realistic — do not inflate values. Factor in condition when pricing.

Return ONLY the JSON object, no other text.`;

export async function POST(req: NextRequest) {
  try {
    const { itemId } = await req.json();

    // Fetch the item
    const { data: item, error: fetchError } = await supabase
      .from("items")
      .select("*")
      .eq("id", itemId)
      .single();

    if (fetchError || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const prompt = `Item: ${item.name}
Description: ${item.description || "No description"}
Category: ${item.category}
Condition: ${item.condition || "unknown"}
Location: ${item.location || "Unknown"}`;

    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      console.error("DeepSeek enrichment error:", await response.text());
      return NextResponse.json({ error: "AI enrichment failed" }, { status: 502 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";

    let enrichment: Record<string, unknown>;
    try {
      const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      enrichment = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse enrichment:", content);
      return NextResponse.json({ error: "Failed to parse enrichment" }, { status: 500 });
    }

    // Upsert enrichment record
    const { data: record, error: upsertError } = await supabase
      .from("enrichment_records")
      .upsert(
        {
          item_id: itemId,
          product_match: enrichment.product_match || null,
          manufacturer: enrichment.manufacturer || null,
          estimated_value_low: enrichment.estimated_value_low || null,
          estimated_value_high: enrichment.estimated_value_high || null,
          recommended_start_bid: enrichment.recommended_start_bid || null,
          enhanced_description: enrichment.enhanced_description || null,
          notable_details: enrichment.notable_details || null,
          confidence: enrichment.confidence || "medium",
          enriched_at: new Date().toISOString(),
        },
        { onConflict: "item_id" }
      )
      .select()
      .single();

    if (upsertError) {
      console.error("Enrichment upsert error:", upsertError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // Update item status
    await supabase.from("items").update({ status: "enriched" }).eq("id", itemId);

    return NextResponse.json({ enrichment: record });
  } catch (err) {
    console.error("Enrich item error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
