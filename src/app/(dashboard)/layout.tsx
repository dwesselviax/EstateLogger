export const dynamic = "force-dynamic";

import { AppShell } from "@/components/ui/shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
