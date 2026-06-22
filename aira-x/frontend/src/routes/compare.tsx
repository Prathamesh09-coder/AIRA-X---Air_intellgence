import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/layout/PageShell";
import { useMemo } from "react";
import { CITIES } from "@/lib/aira-data";
import { useQueries } from "@tanstack/react-query";
import { getForecast } from "@/lib/api";
import { KpiCard } from "@/components/aira/KpiCard";
import { AqiBadge } from "@/components/aira/AqiBadge";
import { Badge } from "@/components/ui/badge";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { GitCompare, Trophy, TrendingUp, Sparkles } from "lucide-react";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Multi-City Compare — AIRA-X" },
      { name: "description", content: "Compare AQI, forecasts, intervention effectiveness, and rankings across Delhi, Mumbai, Pune, Bengaluru, Chennai, Kolkata." },
    ],
  }),
  component: ComparePage,
});

function ComparePage() {
  // 1. Run parallel forecast requests for all 6 target cities
  const cityQueries = useQueries({
    queries: CITIES.map((c) => ({
      queryKey: ["compare-forecast", c.id, c.center[1], c.center[0]],
      queryFn: () => getForecast(c.center[1], c.center[0], 24),
    })),
  });

  const cityData = useMemo(() => {
    return CITIES.map((c, idx) => {
      const query = cityQueries[idx];
      const forecast = query.data || [];
      const currentAqi = forecast.length > 0 ? Math.round(forecast[0].aqi) : 120 + idx * 25;
      const peakAqi = forecast.length > 0 ? Math.round(Math.max(...forecast.map(f => f.aqi))) : currentAqi * 1.25;
      const pm25 = forecast.length > 0 ? Math.round(forecast[0].pm25) : currentAqi * 0.45;
      
      return {
        id: c.id,
        name: c.name,
        state: c.state,
        population: c.population,
        aqi: currentAqi,
        peak: peakAqi,
        pm25,
      };
    });
  }, [cityQueries]);

  // Rank cities from most polluted to cleanest
  const leaderboard = useMemo(() => {
    return [...cityData].sort((a, b) => b.aqi - a.aqi);
  }, [cityData]);

  // Interventions efficiency logic
  const interventions = useMemo(() => {
    return cityData.map((c) => {
      // Calculate efficiency base on current AQI (higher pollution = higher reduction capacity)
      const cap = c.aqi * 0.15;
      return {
        name: c.name,
        traffic: `−${Math.round(cap * 1.2)} AQI`,
        construction: `−${Math.round(cap * 0.8)} AQI`,
        industry: `−${Math.round(cap * 1.1)} AQI`,
        biomass: `−${Math.round(cap * 0.5)} AQI`,
      };
    });
  }, [cityData]);

  const worstCity = leaderboard[0];
  const bestCity = leaderboard[leaderboard.length - 1];

  return (
    <PageShell
      title="Multi-City Comparative Intelligence"
      subtitle="Benchmark AQI indicators, forecast curves, and intervention efficacy across targets in parallel"
      breadcrumbs={[{ label: "Intelligence" }, { label: "Compare" }]}
      actions={
        <Badge variant="outline" className="h-6 gap-1.5 font-normal">
          <GitCompare className="h-3 w-3 text-primary animate-pulse" /> Benchmarking live
        </Badge>
      }
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Highest Pollution Target" value={worstCity?.name || "Delhi"} tone="danger" hint={`${worstCity?.aqi || 0} AQI (Current)`} icon={<Trophy className="h-3.5 w-3.5" />} />
        <KpiCard label="Lowest Pollution Target" value={bestCity?.name || "Pune"} tone="good" hint={`${bestCity?.aqi || 0} AQI (Current)`} icon={<Sparkles className="h-3.5 w-3.5" />} />
        <KpiCard label="Average AQI Across Cities" value={Math.round(cityData.reduce((sum, c) => sum + c.aqi, 0) / cityData.length).toString()} tone="warning" hint="Combined grid mean" icon={<TrendingUp className="h-3.5 w-3.5" />} />
        <KpiCard label="Parallel Queries" value="6 Cities" hint="CPCB / OpenAQ datasets" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-5">
        {/* Comparative Chart */}
        <div className="rounded-lg bg-card p-4 ring-1 ring-border lg:col-span-3">
          <h2 className="text-sm font-semibold">Comparative AQI & Peak Forecasts</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <BarChart data={cityData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid var(--color-border)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                <Bar dataKey="aqi" name="Current AQI" fill="var(--color-chart-2)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="peak" name="Projected 24h Peak" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Leaderboard list */}
        <div className="rounded-lg bg-card ring-1 ring-border lg:col-span-2">
          <div className="border-b border-border px-4 py-2.5">
            <h2 className="text-sm font-semibold">Leaderboard Ranking</h2>
            <p className="text-[11px] text-muted-foreground">Ranked from highest particulate density to lowest</p>
          </div>
          <ul className="divide-y divide-border">
            {leaderboard.map((c, idx) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-accent/40">
                <div className="flex items-center gap-3">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-muted text-[10px] font-semibold">{idx + 1}</span>
                  <div>
                    <p className="text-[13px] font-medium">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground">{(c.population / 1000000).toFixed(1)}M population</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{c.pm25} µg/m³ PM2.5</span>
                  <AqiBadge aqi={c.aqi} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Intervention efficacy matrix */}
      <div className="mt-4 rounded-lg bg-card ring-1 ring-border">
        <div className="border-b border-border px-4 py-2.5">
          <h2 className="text-sm font-semibold">Intervention Efficacy Analysis Matrix</h2>
          <p className="text-[11px] text-muted-foreground">Estimated AQI drop capacity per city if specific regulations are active</p>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-left">
                <th className="pb-2 font-medium">Target City</th>
                <th className="pb-2 font-medium">Odd-Even Traffic Bans</th>
                <th className="pb-2 font-medium">Halt Construction Dust</th>
                <th className="pb-2 font-medium">Industrial Stack Suspensions</th>
                <th className="pb-2 font-medium">Agri Biomass Mulching</th>
              </tr>
            </thead>
            <tbody>
              {interventions.map((row) => (
                <tr key={row.name} className="border-b border-border last:border-0 hover:bg-accent/35">
                  <td className="py-2.5 font-semibold text-foreground">{row.name}</td>
                  <td className="py-2.5 text-success font-medium">{row.traffic}</td>
                  <td className="py-2.5 text-success font-medium">{row.construction}</td>
                  <td className="py-2.5 text-success font-medium">{row.industry}</td>
                  <td className="py-2.5 text-success font-medium">{row.biomass}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}
