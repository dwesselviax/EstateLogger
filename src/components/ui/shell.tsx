"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-[#F8F7F6]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link href="/estates" className="flex items-center gap-3">
            <Image src="/logo.webp" alt="Butterscotch Auction" width={180} height={40} className="h-8 w-auto" priority />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-4 md:flex">
            <Link href="/estates" className="text-sm font-medium text-gray-600 hover:text-[#1E1E1E]">
              Estates
            </Link>
            <button onClick={handleSignOut} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600">
              <LogOut size={16} /> Sign Out
            </button>
          </nav>

          {/* Mobile hamburger */}
          <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="border-t border-gray-100 bg-white px-4 py-3 md:hidden">
            <Link href="/estates" className="block py-2 text-sm font-medium" onClick={() => setMenuOpen(false)}>
              Estates
            </Link>
            <button onClick={handleSignOut} className="flex items-center gap-1.5 py-2 text-sm text-red-600">
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
