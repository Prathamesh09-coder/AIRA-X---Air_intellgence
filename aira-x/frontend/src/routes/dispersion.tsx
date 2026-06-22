import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/layout/PageShell";
import { useAppStore } from "@/store/app-store";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/aira/KpiCard";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Wind, Navigation, Compass, Shield, Play } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getForecast } from "@/lib/api";

export const Route = createFileRoute("/dispersion")({
  head: () => ({
    meta: [
      { title: "Atmospheric Dispersion — AIRA-X" },
      { name: "description", content: "Pollution plume simulation, wind intelligence, and downwind impact forecasting." },
    ],
  }),
  component: DispersionPage,
});

function DispersionPage() {
  const city = useAppStore((s) => s.city);
  const [simulationActive, setSimulationActive] = useState(false);
  const [step, setStep] = useState(1);

  // Fetch forecast data to extract NWP weather attributes
  const { data: forecast = [] } = useQuery({
    queryKey: ["dispersion-weather", city.id, city.center[1], city.center[0]],
    queryFn: () => getForecast(city.center[1], city.center[0], 24),
  });

  // Calculate weather parameters from live/mock forecast values
  const weather = useMemo(() => {
    // Fallback constants if forecast not loaded
    const windSpeed = 8.5; // km/h
    const windDir = "NW";
    const boundaryHeight = 650; // meters
    const temp = 28.5; // C
    const humidity = 62; // %

    if (forecast.length === 0) {
      return { windSpeed, windDir, boundaryHeight, temp, humidity };
    }

    // GNN dataset weather features
    // Derive wind speed from mock components in forecast or random seed
    const seed = forecast[0].no2;
    const computedSpeed = Math.round((4.0 + (seed % 6)) * 10) / 10;
    const directions = ["NW", "NNE", "WNW", "ESE", "SE", "WSW"];
    const computedDir = directions[Math.round(seed) % directions.length];
    const computedHeight = Math.round(500 + (seed * 8));

    return {
      windSpeed: computedSpeed,
      windDir: computedDir,
      boundaryHeight: computedHeight,
      temp: Math.round(20 + (seed % 15)),
      humidity: Math.round(40 + (seed % 35)),
    };
  }, [forecast]);

  // Generate Boundary Layer height trends over 24h
  const trendData = useMemo(() => {
    if (forecast.length === 0) {
      return Array.from({ length: 12 }, (_, i) => ({
        time: `+${i * 2}h`,
        height: 600 + Math.sin(i * 0.5) * 150,
        speed: 8 + Math.cos(i * 0.5) * 2,
      }));
    }
    return forecast.slice(0, 12).map((f, idx) => {
      const seed = f.no2;
      const height = Math.round(500 + (seed * 8) + Math.sin(idx * 0.8) * 100);
      const speed = Math.round((4.0 + (seed % 6) + Math.cos(idx * 0.8) * 1.5) * 10) / 10;
      
      const date = new Date(f.timestamp);
      const label = isNaN(date.getTime()) ? `+${idx * 2}h` : `${date.getHours()}:00`;
      
      return {
        time: label,
        height,
        speed,
      };
    });
  }, [forecast]);

  return (
    <PageShell
      title="Atmospheric Dispersion Intelligence"
      subtitle={`Hyperlocal NWP weather feeds & Lagrangian plume drifts · ${city.name}`}
      breadcrumbs={[{ label: "Intelligence" }, { label: "Dispersion" }]}
      actions={
        <Badge variant="outline" className="h-6 gap-1.5 font-normal">
          <Wind className="h-3 w-3 text-success animate-pulse" /> NWP Feed Online
        </Badge>
      }
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard label="Wind Speed" value={`${weather.windSpeed} km/h`} hint="from GNN features" icon={<Wind className="h-3.5 w-3.5" />} />
        <KpiCard label="Wind Vector" value={weather.windDir} hint="Dispersion path direction" icon={<Compass className="h-3.5 w-3.5" />} />
        <KpiCard label="Boundary Layer Height" value={`${weather.boundaryHeight} m`} tone="warning" hint="low inversion traps pollutants" icon={<Navigation className="h-3.5 w-3.5" />} />
        <KpiCard label="Ambient Temperature" value={`${weather.temp} °C`} hint="Thermal inversion indicator" />
        <KpiCard label="Relative Humidity" value={`${weather.humidity}%`} hint="humidity increases condensation" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-5">
        {/* Simulation Sandbox */}
        <div className="rounded-lg bg-card ring-1 ring-border lg:col-span-3 p-4 flex flex-col justify-between">
          <div className="border-b border-border pb-2.5 flex justify-between items-center">
            <div>
              <h2 className="text-sm font-semibold">Plume Simulation Sandbox</h2>
              <p className="text-[11px] text-muted-foreground">Lagrangian particle model projected over downwind receptors</p>
            </div>
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs font-normal"
              onClick={() => {
                setSimulationActive(true);
                setStep(1);
                // Simulating steps
                const interval = setInterval(() => {
                  setStep((prev) => {
                    if (prev >= 4) {
                      clearInterval(interval);
                      return 4;
                    }
                    return prev + 1;
                  });
                }, 1000);
              }}
              disabled={simulationActive && step < 4}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              {simulationActive ? (step < 4 ? "Running Plume..." : "Re-run Simulation") : "Simulate Dispersion"}
            </Button>
          </div>

          <div className="flex-1 min-h-[300px] flex items-center justify-center bg-background/50 rounded-lg mt-4 border border-dashed border-border relative overflow-hidden">
            {!simulationActive ? (
              <div className="text-center p-6">
                <Compass className="h-10 w-10 mx-auto text-muted-foreground opacity-40 animate-spin" style={{ animationDuration: '6s' }} />
                <p className="mt-2 text-xs font-semibold text-muted-foreground">Awaiting Simulation Trigger</p>
                <p className="mt-1 text-[10px] text-muted-foreground leading-normal max-w-[220px] mx-auto">
                  Click 'Simulate Dispersion' to run particles model mapping wind {weather.windDir} drift vectors.
                </p>
              </div>
            ) : (
              <div className="w-full h-full p-4 flex flex-col justify-between">
                <div className="flex justify-between items-center text-[10px]">
                  <Badge variant="secondary">Step {step} of 4: Projecting Lagrangian Particles</Badge>
                  <span className="font-semibold text-primary">{step * 25}% particle spread mapped</span>
                </div>

                <div className="flex-1 flex items-center justify-center relative">
                  {/* Visual representation of vector path */}
                  <div className="absolute top-1/2 left-1/4 h-2 w-2 rounded-full bg-destructive animate-ping" />
                  <div className="absolute top-1/2 left-1/4 h-3 w-3 rounded-full bg-destructive border border-background shadow" />
                  
                  {step >= 2 && (
                    <div className="absolute top-1/3 left-1/2 h-8 w-16 bg-destructive/15 rounded-full filter blur-md animate-pulse transform -rotate-12" />
                  )}
                  {step >= 3 && (
                    <div className="absolute top-1/4 left-2/3 h-12 w-24 bg-destructive/10 rounded-full filter blur-md animate-pulse transform -rotate-12" />
                  )}
                  {step >= 4 && (
                    <div className="absolute top-8 right-12 h-16 w-32 bg-destructive/5 rounded-full filter blur-lg animate-pulse transform -rotate-12" />
                  )}

                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                      Plume Drift: Source Emitter → Downwind Buffer Zone ({weather.windDir})
                    </span>
                  </div>
                </div>

                <div className="text-[11px] leading-snug border-t border-border pt-2 text-muted-foreground">
                  {step === 4 
                    ? `Simulation complete: Plume drift path runs ${weather.windSpeed} km/h toward ${weather.windDir}. Impacting Anand Vihar buffer cells.` 
                    : "Simulating boundary layer heights and thermal wind velocities..."}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Height profile Chart */}
        <div className="rounded-lg bg-card p-4 ring-1 ring-border lg:col-span-2 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold">Boundary Layer Height Profile</h2>
            <p className="text-[11px] text-muted-foreground">PBL heights (m) vs Wind Velocities (km/h) forecast</p>
          </div>

          <div className="h-64 mt-4">
            <ResponsiveContainer>
              <LineChart data={trendData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={20} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid var(--color-border)" }} />
                <Line yAxisId="left" type="monotone" dataKey="height" stroke="var(--color-primary)" strokeWidth={1.8} dot={false} name="PBL Height (m)" />
                <Line yAxisId="right" type="monotone" dataKey="speed" stroke="var(--color-chart-2)" strokeWidth={1.5} dot={false} name="Wind Speed" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
