import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/layout/PageShell";
import { CityMap } from "@/components/maps/CityMap";
import { useAppStore } from "@/store/app-store";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/aira/KpiCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Target, Scale, Zap, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { queryEnforcement } from "@/lib/api";

export const Route = createFileRoute("/enforcement")({
  head: () => ({
    meta: [
      { title: "Enforcement Intelligence — AIRA-X" },
      { name: "description", content: "Priority hotspots, inspection targets, compliance risks, and recommended enforcement actions." },
    ],
  }),
  component: EnforcementPage,
});

function EnforcementPage() {
  const city = useAppStore((s) => s.city);
  const [queryText, setQueryText] = useState("Evaluate active emission violations");
  const [activeQuery, setActiveQuery] = useState("Evaluate active emission violations");

  // Fetch enforcement plan from API
  const { data: plan, isLoading, refetch } = useQuery({
    queryKey: ["enforcement-plan", city.id, activeQuery, city.center[1], city.center[0]],
    queryFn: () => queryEnforcement(activeQuery, city.center[1], city.center[0]),
  });

  const cells = useMemo(() => {
    if (!plan) return [];
    // Mark target hotspot coordinate on the grid cell map
    return [
      {
        id: "target-hotspot",
        lng: plan.primary_hotspot.hotspot_lon,
        lat: plan.primary_hotspot.hotspot_lat,
        aqi: Math.round(plan.primary_hotspot.contribution_pct * 4.5),
        pm25: Math.round(plan.primary_hotspot.contribution_pct * 2.0),
        pm10: Math.round(plan.primary_hotspot.contribution_pct * 3.5),
        no2: 45,
        so2: 12,
        o3: 30,
      },
    ];
  }, [plan]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveQuery(queryText);
  };

  return (
    <PageShell
      title="Enforcement Intelligence Center"
      subtitle={`Statutory-backed priority inspection targets · ${city.name}`}
      breadcrumbs={[{ label: "Operations" }, { label: "Enforcement" }]}
      actions={
        <Badge variant="outline" className="h-6 gap-1.5 font-normal">
          <ShieldCheck className="h-3 w-3 text-success animate-pulse" /> Agent Online
        </Badge>
      }
    >
      <div className="rounded-lg bg-card p-4 ring-1 ring-border">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Search regulations or inspect specific zones..."
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Analyzing..." : "Evaluate Targets"}
          </Button>
        </form>
      </div>

      {plan && (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="Primary Hotspot Source"
            value={plan.primary_hotspot.source_type}
            tone="warning"
            hint={`${plan.primary_hotspot.contribution_pct}% contribution`}
            icon={<Target className="h-3.5 w-3.5" />}
          />
          <KpiCard
            label="Governing Law"
            value={plan.governing_regulation.split(" (")[0]}
            hint={plan.governing_regulation}
            icon={<Scale className="h-3.5 w-3.5" />}
          />
          <KpiCard
            label="Inspection Target"
            value="1 High Priority"
            tone="danger"
            hint={plan.inspection_target}
            icon={<MapPin className="h-3.5 w-3.5" />}
          />
          <KpiCard
            label="Est. Intervention Impact"
            value="High"
            tone="good"
            hint={plan.estimated_impact}
            icon={<Zap className="h-3.5 w-3.5" />}
          />
        </div>
      )}

      {plan && (
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-5">
          {/* Map display */}
          <div className="rounded-lg bg-card ring-1 ring-border lg:col-span-3">
            <div className="border-b border-border px-4 py-2.5">
              <h2 className="text-sm font-semibold">Hotspot Geographic Evidence Location</h2>
              <p className="text-[11px] text-muted-foreground">Map pinning targeted coordinates for inspection teams</p>
            </div>
            <div className="relative h-[400px]">
              <CityMap city={{ ...city, center: [plan.primary_hotspot.hotspot_lon, plan.primary_hotspot.hotspot_lat] }} cells={cells} className="absolute inset-0" />
            </div>
          </div>

          {/* Details list */}
          <div className="rounded-lg bg-card ring-1 ring-border lg:col-span-2">
            <div className="border-b border-border px-4 py-2.5">
              <h2 className="text-sm font-semibold">Enforcement Details</h2>
            </div>
            <div className="p-4 space-y-4">
              <div className="rounded-md border border-border bg-background p-3">
                <h3 className="text-[12px] font-semibold text-primary">Inspection Target Details</h3>
                <p className="mt-1 text-[13px] font-medium leading-snug">{plan.inspection_target}</p>
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <h3 className="text-[12px] font-semibold text-primary">Geospatial Evidence Logs</h3>
                <p className="mt-1 text-[12px] text-muted-foreground leading-snug">{plan.geospatial_evidence}</p>
                <div className="mt-2 text-[10px] text-muted-foreground flex gap-3">
                  <span>Lat: {plan.primary_hotspot.hotspot_lat.toFixed(5)}</span>
                  <span>Lon: {plan.primary_hotspot.hotspot_lon.toFixed(5)}</span>
                </div>
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <h3 className="text-[12px] font-semibold text-success">Recommended Field Action</h3>
                <p className="mt-1 text-[12px] font-medium leading-snug">{plan.recommended_actions}</p>
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <h3 className="text-[12px] font-semibold text-muted-foreground">Evaluation Timestamp</h3>
                <p className="mt-0.5 text-[11px] font-mono text-muted-foreground">{new Date(plan.timestamp).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
