import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/layout/PageShell";
import { useAppStore } from "@/store/app-store";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/aira/KpiCard";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ShieldCheck, Activity, Switch, HelpCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getForecast } from "@/lib/api";

export const Route = createFileRoute("/interventions")({
  head: () => ({
    meta: [
      { title: "Intervention Impact — AIRA-X" },
      { name: "description", content: "Measure intervention effectiveness: before vs after, improvement %, cost-effectiveness, and time to impact." },
    ],
  }),
  component: InterventionsPage,
});

function InterventionsPage() {
  const city = useAppStore((s) => s.city);
  
  // Toggles for active policies
  const [trafficActive, setTrafficActive] = useState(true);
  const [constructionActive, setConstructionActive] = useState(true);
  const [factoryActive, setFactoryActive] = useState(false);

  // Fetch forecast data to represent live GNN trend
  const { data: forecast = [] } = useQuery({
    queryKey: ["interventions-forecast", city.id, city.center[1], city.center[0]],
    queryFn: () => getForecast(city.center[1], city.center[0], 24),
  });

  // Calculate simulated reduction sum
  const totalReduction = useMemo(() => {
    let r = 0;
    if (trafficActive) r += 28;
    if (constructionActive) r += 42;
    if (factoryActive) r += 18;
    return r;
  }, [trafficActive, constructionActive, factoryActive]);

  // Generate Counterfactual lines: Observed vs Simulated No-Intervention
  const chartData = useMemo(() => {
    if (forecast.length === 0) {
      return Array.from({ length: 12 }, (_, i) => {
        const obs = 180 + Math.sin(i * 0.5) * 20 - (trafficActive ? 15 : 0) - (constructionActive ? 20 : 0);
        const counter = obs + 35;
        return {
          time: `+${i * 2}h`,
          observed: Math.round(obs),
          counterfactual: Math.round(counter),
        };
      });
    }

    return forecast.slice(0, 12).map((f, idx) => {
      const date = new Date(f.timestamp);
      const label = isNaN(date.getTime()) ? `+${idx * 2}h` : `${date.getHours()}:00`;
      
      const observedAqi = Math.round(f.aqi);
      // Counterfactual is higher since there are no interventions implemented
      const counterfactualAqi = Math.round(observedAqi + totalReduction - 20); // offset baseline

      return {
        time: label,
        observed: observedAqi,
        counterfactual: Math.max(observedAqi, counterfactualAqi),
      };
    });
  }, [forecast, totalReduction, trafficActive, constructionActive, factoryActive]);

  const observedAqi = chartData.length > 0 ? chartData[0].observed : 150;
  const counterfactualAqi = chartData.length > 0 ? chartData[0].counterfactual : 205;
  const netSaved = Math.max(0, counterfactualAqi - observedAqi);
  const percentage = counterfactualAqi > 0 ? Math.round((netSaved / counterfactualAqi) * 100) : 0;

  return (
    <PageShell
      title="Intervention Effectiveness Intelligence"
      subtitle={`Synthetic controls & counterfactual impact tracing · ${city.name}`}
      breadcrumbs={[{ label: "Operations" }, { label: "Interventions" }]}
      actions={
        <Badge variant="outline" className="h-6 gap-1.5 font-normal">
          <ShieldCheck className="h-3 w-3 text-success animate-pulse" /> Counterfactual Active
        </Badge>
      }
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Simulated Counterfactual" value={counterfactualAqi} tone="danger" hint="Estimated AQI without interventions" />
        <KpiCard label="Observed AQI" value={observedAqi} tone={observedAqi > 150 ? "warning" : "good"} hint="Actual levels with active controls" />
        <KpiCard label="Net AQI Saved" value={`−${netSaved}`} tone="good" hint="difference due to policies" icon={<Activity className="h-3.5 w-3.5" />} />
        <KpiCard label="Improvement %" value={`${percentage}%`} tone="good" hint="Reduction magnitude" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-5">
        {/* Toggle Panel */}
        <div className="rounded-lg bg-card p-4 ring-1 ring-border lg:col-span-2 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold">Active Policy Controls</h2>
            <p className="text-[11px] text-muted-foreground">Toggle interventions to simulate counterfactual shifts dynamically</p>
          </div>

          <div className="space-y-3 mt-4 flex-1 flex flex-col justify-center">
            {/* Control 1 */}
            <div className="flex items-center justify-between rounded-md border border-border bg-background p-3">
              <div>
                <p className="text-[12px] font-semibold">Odd-Even Traffic Bans</p>
                <p className="text-[10px] text-muted-foreground">Estimated impact: −28 AQI</p>
              </div>
              <button
                onClick={() => setTrafficActive(!trafficActive)}
                className={`h-5 w-10 rounded-full p-0.5 transition-colors ${trafficActive ? "bg-primary" : "bg-muted"}`}
              >
                <div className={`h-4 w-4 rounded-full bg-background transition-transform ${trafficActive ? "translate-x-5" : ""}`} />
              </button>
            </div>

            {/* Control 2 */}
            <div className="flex items-center justify-between rounded-md border border-border bg-background p-3">
              <div>
                <p className="text-[12px] font-semibold">Halt Construction Dust</p>
                <p className="text-[10px] text-muted-foreground">Estimated impact: −42 AQI</p>
              </div>
              <button
                onClick={() => setConstructionActive(!constructionActive)}
                className={`h-5 w-10 rounded-full p-0.5 transition-colors ${constructionActive ? "bg-primary" : "bg-muted"}`}
              >
                <div className={`h-4 w-4 rounded-full bg-background transition-transform ${constructionActive ? "translate-x-5" : ""}`} />
              </button>
            </div>

            {/* Control 3 */}
            <div className="flex items-center justify-between rounded-md border border-border bg-background p-3">
              <div>
                <p className="text-[12px] font-semibold">Industrial Stack Suspensions</p>
                <p className="text-[10px] text-muted-foreground">Estimated impact: −18 AQI</p>
              </div>
              <button
                onClick={() => setFactoryActive(!factoryActive)}
                className={`h-5 w-10 rounded-full p-0.5 transition-colors ${factoryActive ? "bg-primary" : "bg-muted"}`}
              >
                <div className={`h-4 w-4 rounded-full bg-background transition-transform ${factoryActive ? "translate-x-5" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Counterfactual curve Chart */}
        <div className="rounded-lg bg-card p-4 ring-1 ring-border lg:col-span-3">
          <div className="flex justify-between items-center pb-2 border-b border-border">
            <h2 className="text-sm font-semibold">Observed vs Counterfactual Timeline</h2>
            <Badge variant="outline" className="text-[10px]">24h Horizon</Badge>
          </div>

          <div className="h-64 mt-4">
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid var(--color-border)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                <Line type="monotone" dataKey="observed" stroke="var(--color-primary)" strokeWidth={1.8} name="Observed (Active Policies)" dot={false} />
                <Line type="monotone" dataKey="counterfactual" stroke="var(--color-destructive)" strokeWidth={1.5} strokeDasharray="4 4" name="Counterfactual (No Policies)" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
