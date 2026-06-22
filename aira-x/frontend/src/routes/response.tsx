import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/layout/PageShell";
import { KpiCard } from "@/components/aira/KpiCard";
import { ArrowRight, Timer, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/response")({
  head: () => ({
    meta: [
      { title: "Operational Response — AIRA-X" },
      { name: "description", content: "Reduction in response time from signal to intervention: traditional workflow vs AIRA-X agent-driven workflow." },
    ],
  }),
  component: ResponsePage,
});

const TRAD = [
  { step: "Detection", time: 45 },
  { step: "Analysis", time: 180 },
  { step: "Decision", time: 240 },
  { step: "Intervention", time: 360 },
];
const AIRA = [
  { step: "Detection", time: 5 },
  { step: "Agent Analysis", time: 18 },
  { step: "Recommendation", time: 9 },
  { step: "Action", time: 35 },
];

function fmt(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function ResponsePage() {
  const tradTotal = TRAD.reduce((a, b) => a + b.time, 0);
  const airaTotal = AIRA.reduce((a, b) => a + b.time, 0);
  const saved = tradTotal - airaTotal;
  const pct = Math.round((saved / tradTotal) * 100);

  return (
    <PageShell
      title="Operational Response Intelligence"
      subtitle="Measure reduction in response time from signal to intervention"
      breadcrumbs={[{ label: "Operations" }, { label: "Response Time" }]}
      actions={<Badge variant="outline" className="h-6 gap-1.5 font-normal"><Zap className="h-3 w-3 text-success" /> {pct}% faster · {fmt(saved)} saved</Badge>}
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Traditional Total" value={fmt(tradTotal)} tone="warning" icon={<Timer className="h-3.5 w-3.5" />} />
        <KpiCard label="AIRA-X Total" value={fmt(airaTotal)} tone="good" delta={-pct} />
        <KpiCard label="Time Saved" value={fmt(saved)} tone="good" hint={`${pct}% reduction`} />
        <KpiCard label="Interventions / day" value="12.4" tone="good" delta={-38} hint="3.2× throughput" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <WorkflowCard title="Traditional Workflow" steps={TRAD} total={tradTotal} tone="warning" />
        <WorkflowCard title="AIRA-X Workflow" steps={AIRA} total={airaTotal} tone="good" />
      </div>
    </PageShell>
  );
}

function WorkflowCard({ title, steps, total, tone }: { title: string; steps: { step: string; time: number }[]; total: number; tone: "warning" | "good" }) {
  const color = tone === "good" ? "bg-success" : "bg-warning";
  return (
    <div className="rounded-lg bg-card p-4 ring-1 ring-border">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-[11px] tabular-nums text-muted-foreground">Total {fmt(total)}</span>
      </div>
      <div className="mt-4 space-y-3">
        {steps.map((s, i) => (
          <div key={s.step}>
            <div className="flex items-center justify-between text-[12px]">
              <span className="flex items-center gap-1.5">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-secondary text-[10px] font-semibold">{i + 1}</span>
                {s.step}
              </span>
              <span className="tabular-nums text-muted-foreground">{fmt(s.time)}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
              <div className={`h-full ${color}`} style={{ width: `${(s.time / total) * 100}%` }} />
            </div>
            {i < steps.length - 1 && <ArrowRight className="ml-1.5 mt-1.5 h-3 w-3 text-muted-foreground" />}
          </div>
        ))}
      </div>
    </div>
  );
}
