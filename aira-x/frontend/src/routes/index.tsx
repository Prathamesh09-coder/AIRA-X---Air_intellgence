import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/layout/PageShell";
import { CityMap } from "@/components/maps/CityMap";
import { KpiCard } from "@/components/aira/KpiCard";
import { AqiBadge } from "@/components/aira/AqiBadge";
import { useAppStore } from "@/store/app-store";
import { generateGrid, generateForecast, ALERTS, RECOMMENDATIONS, WARDS } from "@/lib/aira-data";
import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  AlertTriangle,
  TrendingUp,
  Users,
  Crosshair,
  Wind,
  Layers,
  CheckCircle2,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { getForecast, getSourceAttribution, queryEnforcement, WS_URL } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Command Center — AIRA-X" },
      {
        name: "description",
        content:
          "Smart City Environmental Intelligence Command Center. Live AQI, forecasts, source attribution, and agent-recommended interventions.",
      },
      { property: "og:title", content: "AIRA-X — Smart City Environmental Intelligence" },
      {
        property: "og:description",
        content: "Move from reactive monitoring to proactive intervention with AI-driven air-quality intelligence.",
      },
    ],
  }),
  component: CommandCenter,
});

function CommandCenter() {
  const city = useAppStore((s) => s.city);
  const role = useAppStore((s) => s.role);
  
  // Real-time WebSocket additions
  const [aqiOffset, setAqiOffset] = useState(0);
  const [liveAlerts, setLiveAlerts] = useState(ALERTS);

  // 1. Fetch 48h forecast from the GNN engine using city coordinates
  const { data: liveForecast = [] } = useQuery({
    queryKey: ["forecast", city.id, city.center[1], city.center[0]],
    queryFn: () => getForecast(city.center[1], city.center[0], 48),
  });

  // 2. Fetch source attribution
  const { data: liveAttribution = [] } = useQuery({
    queryKey: ["attribution", city.id, city.center[1], city.center[0]],
    queryFn: () => getSourceAttribution(city.center[1], city.center[0]),
  });

  // 3. Fetch enforcement plan recommendations
  const { data: liveEnforcement } = useQuery({
    queryKey: ["enforcement", city.id, city.center[1], city.center[0], role],
    queryFn: () => queryEnforcement("Optimize enforcement for peak zones", city.center[1], city.center[0]),
  });

  // WebSocket Live update connection
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
      console.log("[WS Connected] Listening to real-time events...");
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "realtime_update") {
          if (payload.aqi_delta !== undefined) {
            setAqiOffset((prev) => {
              const next = prev + payload.aqi_delta;
              return Math.max(-25, Math.min(25, next));
            });
          }
          if (payload.new_alert) {
            setLiveAlerts((prev) => [
              {
                ...payload.new_alert,
                time: "Just now"
              },
              ...prev.slice(0, 5)
            ]);
          }
        }
      } catch (err) {
        console.error("Error parsing WS packet:", err);
      }
    };

    ws.onerror = (err) => {
      console.warn("[WS Connection Error] Fallback polling active.", err);
    };

    return () => ws.close();
  }, [WS_URL]);

  const currentAqiBase = liveForecast.length > 0 ? liveForecast[0].aqi : 180;
  const currentAqi = Math.max(10, Math.round(currentAqiBase + aqiOffset));
  const peakAqi = liveForecast.length > 0 
    ? Math.round(Math.max(...liveForecast.map((f) => f.aqi))) 
    : 220;

  // Scale map cells dynamically based on live forecast AQI
  const cells = useMemo(() => {
    const rawCells = generateGrid(city);
    const baseAvg = rawCells.reduce((sum, c) => sum + c.aqi, 0) / rawCells.length;
    const scale = currentAqi / baseAvg;
    return rawCells.map((c) => ({
      ...c,
      aqi: Math.round(c.aqi * scale),
      pm25: Math.round(c.pm25 * scale),
      pm10: Math.round(c.pm10 * scale),
      no2: Math.round(c.no2 * scale),
      so2: Math.round(c.so2 * scale),
      o3: Math.round(c.o3 * scale),
    }));
  }, [city, currentAqi]);

  // Map backend enforcement values to Recommendations layout
  const recommendations = useMemo(() => {
    if (!liveEnforcement) return RECOMMENDATIONS;
    return [
      {
        id: "live-r1",
        title: `Halt ${liveEnforcement.primary_hotspot.source_type} at hotspot`,
        impact: `−${Math.round(liveEnforcement.primary_hotspot.contribution_pct * 0.7)} AQI`,
        confidence: liveEnforcement.primary_hotspot.contribution_pct > 30 ? 0.88 : 0.81,
        priority: 1,
        action: liveEnforcement.recommended_actions,
      },
      {
        id: "live-r2",
        title: `Audit target zone under ${liveEnforcement.governing_regulation.split(" (")[0]}`,
        impact: liveEnforcement.estimated_impact.split(" ")[2] ? `−${liveEnforcement.estimated_impact.split(" ")[2]} PM2.5` : "−15 PM2.5",
        confidence: 0.83,
        priority: 2,
        action: `Coordinate inspection at target: ${liveEnforcement.inspection_target}`,
      },
      ...RECOMMENDATIONS.slice(2)
    ];
  }, [liveEnforcement]);

  const hotspots = useMemo(() => {
    if (!liveEnforcement) return [];
    return [
      {
        lat: liveEnforcement.primary_hotspot.hotspot_lat,
        lon: liveEnforcement.primary_hotspot.hotspot_lon,
        label: `Primary Hotspot: ${liveEnforcement.primary_hotspot.source_type}`,
        details: `Targeted inspection zone: ${liveEnforcement.inspection_target}`,
      }
    ];
  }, [liveEnforcement]);

  const [layers, setLayers] = useState({
    heatmap: true,
    grid: true,
    forecast: false,
    sources: false,
    dispersion: false,
    vulnerability: false,
  });

  return (
    <PageShell
      title="Command Center"
      subtitle={`Live environmental operations · ${city.name}, ${city.state}`}
      breadcrumbs={[{ label: "Operations" }, { label: "Command Center" }]}
      actions={
        <>
          <Badge variant="outline" className="h-6 gap-1.5 font-normal animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Live · updated real-time
          </Badge>
          <Button size="sm" variant="outline" className="h-8 text-xs">
            Export brief
          </Button>
          <Button size="sm" className="h-8 text-xs">
            Trigger response
          </Button>
        </>
      }
      rightPanel={<RightPanel alerts={liveAlerts} recommendations={recommendations} />}
    >
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Current AQI"
          value={currentAqi}
          hint={city.name}
          delta={aqiOffset > 0 ? aqiOffset : undefined}
          tone={currentAqi > 200 ? "danger" : currentAqi > 100 ? "warning" : "good"}
          icon={<Activity className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Forecast 24h Peak"
          value={peakAqi}
          delta={12}
          tone="warning"
          hint="Within next 24h"
          icon={<TrendingUp className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Active Hotspots"
          value={liveEnforcement ? "1" : "14"}
          delta={0}
          tone="warning"
          hint={liveEnforcement ? liveEnforcement.primary_hotspot.source_type : "≥ 4σ above ward mean"}
          icon={<Crosshair className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="High-Risk Wards"
          value={currentAqi > 200 ? "5" : "2"}
          tone={currentAqi > 150 ? "danger" : "warning"}
          hint="of 24 monitored"
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Population Exposed"
          value={currentAqi > 200 ? "3.8M" : "1.2M"}
          tone={currentAqi > 200 ? "danger" : "warning"}
          hint="PM2.5 > 60 µg/m³"
          icon={<Users className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Open Interventions"
          value="4"
          delta={-2}
          tone="good"
          hint="2 awaiting approval"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        />
      </div>

      {/* Decision intelligence */}
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-lg bg-card p-4 ring-1 ring-border lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Decision Intelligence</h2>
              <Badge variant="secondary" className="h-5 text-[10px]">Multi-agent consensus · 94%</Badge>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              View reasoning <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {recommendations.slice(0, 4).map((r) => (
              <div
                key={r.id}
                className="rounded-md border border-border bg-background p-3 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="h-5 text-[10px]">
                    Priority {r.priority}
                  </Badge>
                  <span className="text-[11px] font-medium text-success">{r.impact}</span>
                </div>
                <p className="mt-2 text-[13px] font-medium leading-snug">{r.title}</p>
                <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{r.action}</p>
                <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Confidence {Math.round(r.confidence * 100)}%</span>
                  <button className="font-medium text-primary hover:underline">Approve</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg bg-card p-4 ring-1 ring-border">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Forecast Curve</h2>
            <AqiBadge aqi={peakAqi} />
          </div>
          <div className="mt-2 h-32">
            <ResponsiveContainer>
              <AreaChart data={liveForecast.length > 0 ? liveForecast : generateForecast(currentAqi, 24)} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="aqiArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="timestamp" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} interval={11} tickFormatter={(t) => {
                  const date = new Date(t);
                  return isNaN(date.getTime()) ? `+${t}h` : `${date.getHours()}:00`;
                }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} width={32} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid var(--color-border)" }}
                  labelFormatter={(t) => {
                    const date = new Date(t);
                    return isNaN(date.getTime()) ? `Hour: ${t}` : date.toLocaleTimeString();
                  }}
                />
                <Area type="monotone" dataKey="aqi" stroke="var(--color-primary)" strokeWidth={1.5} fill="url(#aqiArea)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {peakAqi > 200 ? "Alert: Peak forecast AQI crosses 200 (Very Unhealthy) soon." : "Nominal trends forecast for next 24h."}
          </p>
        </div>
      </div>

      {/* Map + ward list */}
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-lg bg-card ring-1 ring-border lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Environmental Digital Twin</h2>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {Object.entries(layers).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => setLayers((prev) => ({ ...prev, [k]: !v }))}
                  className={`rounded border px-2 py-0.5 text-[10px] font-medium capitalize transition-colors ${
                    v
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
          <div className="relative h-[460px] overflow-hidden rounded-b-lg">
            <CityMap city={city} cells={cells} hotspots={hotspots} className="absolute inset-0" showHeatmap={layers.heatmap} showGrid={layers.grid} />
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-border bg-card/95 p-2.5 text-[10px] shadow-sm backdrop-blur">
              <div className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">AQI Legend</div>
              <div className="flex items-center gap-1.5">
                {[
                  { c: "#54bf6a", l: "0-50" },
                  { c: "#f0c020", l: "51-100" },
                  { c: "#f08a3e", l: "101-150" },
                  { c: "#e1483b", l: "151-200" },
                  { c: "#8a3ea1", l: "201-300" },
                  { c: "#5a1a1a", l: "300+" },
                ].map((s) => (
                  <div key={s.l} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.c }} />
                    <span className="text-muted-foreground">{s.l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-card ring-1 ring-border">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <h2 className="text-sm font-semibold">Most Polluted Wards</h2>
            <Badge variant="outline" className="h-5 text-[10px]">8 of 24</Badge>
          </div>
          <ul className="divide-y divide-border">
            {WARDS.map((w) => {
              // Scale ward AQIs proportionally to city current AQI
              const scaledAqi = Math.max(30, Math.round(w.aqi * (currentAqi / 200)));
              return (
                <li key={w.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-accent/50">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{w.name}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {(w.population / 1000).toFixed(0)}k residents · risk {scaledAqi > 200 ? "critical" : scaledAqi > 120 ? "high" : "moderate"}
                    </p>
                  </div>
                  <AqiBadge aqi={scaledAqi} />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </PageShell>
  );
}

function RightPanel({ alerts, recommendations }: { alerts: any[]; recommendations: any[] }) {
  return (
    <div className="flex flex-col">
      <div className="border-b border-sidebar-border px-4 py-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Live alerts (WS)
        </h3>
      </div>
      <ul className="divide-y divide-sidebar-border max-h-[300px] overflow-y-auto">
        {alerts.map((a) => (
          <li key={a.id} className="px-4 py-3 hover:bg-accent/40">
            <div className="flex items-center justify-between">
              <span
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                  a.severity === "critical"
                    ? "bg-destructive/10 text-destructive"
                    : a.severity === "high"
                    ? "bg-warning/15 text-warning-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {a.severity}
              </span>
              <span className="text-[10px] text-muted-foreground">{a.time}</span>
            </div>
            <p className="mt-1.5 text-[12px] font-medium leading-snug">{a.message}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{a.ward}</p>
          </li>
        ))}
      </ul>

      <div className="border-y border-sidebar-border bg-background/60 px-4 py-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Agent recommendations
        </h3>
      </div>
      <ul className="divide-y divide-sidebar-border">
        {recommendations.slice(0, 3).map((r) => (
          <li key={r.id} className="px-4 py-3">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-semibold text-primary">Priority {r.priority}</span>
              <span className="text-success">{r.impact}</span>
            </div>
            <p className="mt-1 text-[12px] font-medium leading-snug">{r.title}</p>
            <div className="mt-2 flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]">Defer</Button>
              <Button size="sm" className="h-6 px-2 text-[10px]">Approve</Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Wind className="h-3.5 w-3.5" /> Wind NW · Temp nominal · GNN active
        </div>
      </div>
    </div>
  );
}
