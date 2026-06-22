import { aqiCategory } from "@/lib/aira-data";
import { cn } from "@/lib/utils";

export function AqiBadge({ aqi, className }: { aqi: number; className?: string }) {
  const cat = aqiCategory(aqi);
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium", className)}
      style={{ backgroundColor: `color-mix(in oklab, ${cat.color} 18%, transparent)`, color: cat.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
      <span className="tabular-nums">{aqi}</span>
      <span className="opacity-80">· {cat.label}</span>
    </span>
  );
}
