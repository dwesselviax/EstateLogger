import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Butterscotch Auction — Estate Logger",
  description: "AI-powered estate auction inventory cataloging, enrichment, and publishing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F8F7F6] text-[#1E1E1E] antialiased">
        {children}
      </body>
    </html>
  );
}
