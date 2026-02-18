import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  );
}

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

const SYSTEM_PROMPT = `You are an estate auction item extraction assistant. Given a transcript of someone describing items in a property, extract each distinct item as a structured record.

Return a JSON array of items. Each item must have:
- "name": string (concise item name)
- "description": string (detailed description from context)
- "category": string (one of: Furniture, Art & Decor, Electronics, Jewelry & Watches, Kitchenware, Tools & Equipment, Clothing & Textiles, Books & Media, Collectibles & Antiques, Vehicles & Outdoor, Musical Instruments, Sporting Goods, Miscellaneous)
- "condition": string (one of: excellent, good, fair, poor, unknown)
- "location": string or null (where in the property)

Rules:
- Extract EVERY distinct item mentioned
- Handle corrections mid-stream (e.g., "actually that's walnut not oak" — update the relevant item)
- If unsure about a field, use reasonable defaults (condition: "unknown", category: "Miscellaneous")
- Return ONLY the JSON array, no other text

Example input: "In the living room there's a mahogany bookcase, about six feet tall, good shape. Also a brass floor lamp, needs rewiring."
Example output: [{"name":"Mahogany Bookcase","description":"Six feet tall mahogany bookcase in good condition","category":"Furniture","condition":"good","location":"Living Room"},{"name":"Brass Floor Lamp","description":"Brass floor lamp, needs rewiring","category":"Art & Decor","condition":"fair","location":"Living Room"}]`;

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { transcript, estateId, sessionId } = await req.json();

    if (!transcript?.trim()) {
      return NextResponse.json({ items: [] });
    }

    // Call DeepSeek
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: transcript },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("DeepSeek error:", errText);
      return NextResponse.json({ error: "AI extraction failed" }, { status: 502 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "[]";

    // Parse the JSON array from the response
    let extractedItems: Array<{
      name: string;
      description: string;
      category: string;
      condition: string;
      location: string | null;
    }>;

    try {
      // Handle potential markdown code blocks
      const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      extractedItems = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      return NextResponse.json({ error: "Failed to parse extraction" }, { status: 500 });
    }

    if (!Array.isArray(extractedItems) || extractedItems.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // Insert items into the database
    const rows = extractedItems.map((item) => ({
      estate_id: estateId,
      session_id: sessionId || null,
      name: item.name,
      description: item.description || null,
      category: item.category || "Miscellaneous",
      condition: item.condition || "unknown",
      location: item.location || null,
      voice_transcript: transcript.substring(0, 2000),
      status: "captured" as const,
    }));

    const { data: inserted, error } = await supabase
      .from("items")
      .insert(rows)
      .select();

    if (error) {
      console.error("Insert error:", error);
      return NextResponse.json({ error: "Database insert failed" }, { status: 500 });
    }

    return NextResponse.json({ items: inserted });
  } catch (err) {
    console.error("Extract items error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
