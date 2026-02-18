import { cn, statusColor } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  status?: string;
  className?: string;
}

export function Badge({ children, status, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        status ? statusColor(status) : "bg-gray-100 text-gray-700",
        className
      )}
    >
      {children}
    </span>
  );
}
