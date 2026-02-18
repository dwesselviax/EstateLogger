export type EstateStatus = "draft" | "logging" | "review" | "enriching" | "published" | "archived";
export type ItemStatus = "captured" | "confirmed" | "enriched" | "published";
export type SessionStatus = "active" | "paused" | "completed";
export type ItemCondition = "excellent" | "good" | "fair" | "poor" | "unknown";
export type PropertyType = "residential" | "commercial" | "storage" | "other";
export type ImageType = "actual" | "reference";
export type EnrichmentConfidence = "high" | "medium" | "low";

export interface Estate {
  id: string;
  user_id: string;
  name: string;
  address: string;
  auction_date: string;
  status: EstateStatus;
  property_type: PropertyType | null;
  executor_name: string | null;
  executor_contact: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  item_count?: number;
  enriched_count?: number;
}

export interface Item {
  id: string;
  estate_id: string;
  session_id: string | null;
  name: string;
  description: string | null;
  category: string;
  condition: ItemCondition | null;
  location: string | null;
  voice_transcript: string | null;
  status: ItemStatus;
  sort_order: number | null;
  created_at: string;
  enrichment?: EnrichmentRecord | null;
  images?: ItemImage[];
}

export interface EnrichmentRecord {
  id: string;
  item_id: string;
  product_match: string | null;
  manufacturer: string | null;
  reference_images: string[] | null;
  last_sale_price: number | null;
  estimated_value_low: number | null;
  estimated_value_high: number | null;
  recommended_start_bid: number | null;
  enhanced_description: string | null;
  notable_details: string | null;
  source_urls: string[] | null;
  confidence: EnrichmentConfidence | null;
  enriched_at: string;
}

export interface ItemImage {
  id: string;
  item_id: string;
  url: string;
  type: ImageType;
  is_primary: boolean;
  created_at: string;
}

export interface LoggingSession {
  id: string;
  estate_id: string;
  status: SessionStatus;
  full_transcript: string | null;
  item_count: number | null;
  started_at: string;
  ended_at: string | null;
}

export const CATEGORIES = [
  "Furniture",
  "Art & Decor",
  "Electronics",
  "Jewelry & Watches",
  "Kitchenware",
  "Tools & Equipment",
  "Clothing & Textiles",
  "Books & Media",
  "Collectibles & Antiques",
  "Vehicles & Outdoor",
  "Musical Instruments",
  "Sporting Goods",
  "Miscellaneous",
] as const;

export const CONDITIONS: ItemCondition[] = ["excellent", "good", "fair", "poor", "unknown"];
