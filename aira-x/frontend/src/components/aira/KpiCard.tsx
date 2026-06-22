import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";

type Props = {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  delta?: number;
  tone?: "default" | "good" | "warning" | "danger";
  icon?: ReactNode;
};

const toneRing: Record<NonNullable<Props["tone"]>, string> = {
  default: "ring-border",
  good: "ring-success/30",
  warning: "ring-warning/40",
  danger: "ring-destructive/40",
};

export function KpiCard({ label, value, unit, hint, delta, tone = "default", icon }: Props) {
  return (
    <div className={cn("rounded-lg bg-card p-4 ring-1 transition-shadow hover:shadow-sm", toneRing[tone])}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">{value}</span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      <div className="mt-1 flex items-center gap-2 text-[11px]">
        {typeof delta === "number" && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1 py-0.5 font-medium tabular-nums",
              delta > 0 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success",
            )}
          >
            {delta > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {Math.abs(delta)}%
          </span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}
