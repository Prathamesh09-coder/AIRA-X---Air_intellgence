import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/layout/PageShell";
import { useAppStore } from "@/store/app-store";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/aira/KpiCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HeartPulse, ShieldAlert, Languages, Users, MessageSquare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getHealthAdvisory } from "@/lib/api";

export const Route = createFileRoute("/health")({
  head: () => ({
    meta: [
      { title: "Citizen Health Risk — AIRA-X" },
      { name: "description", content: "Translate AQI into health impact for vulnerable groups, with multilingual advisories." },
    ],
  }),
  component: HealthPage,
});

function HealthPage() {
  const city = useAppStore((s) => s.city);
  const [queryText, setQueryText] = useState("Assess health risk for vulnerable demographic clusters");
  const [activeQuery, setActiveQuery] = useState("Assess health risk for vulnerable demographic clusters");
  const [selectedLang, setSelectedLang] = useState<"en" | "hi" | "mr" | "kn" | "ta">("en");

  // Fetch health advisory workflow from API
  const { data: workflow, isLoading } = useQuery({
    queryKey: ["health-advisory", city.id, activeQuery, city.center[1], city.center[0]],
    queryFn: () => getHealthAdvisory(activeQuery, city.center[1], city.center[0]),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveQuery(queryText);
  };

  const currentAdvisories = workflow?.health_advisory?.advisories || {
    en: "No active warnings loaded.",
    hi: "कोई सक्रिय चेतावनी लोड नहीं है।",
    mr: "कोणतीही सक्रिय चेतावणी लोड नाही।",
    kn: "ಯಾವುದೇ ಸಕ್ರಿಯ ಎಚ್ಚರಿಕೆ ಇಲ್ಲ.",
    ta: "செயலில் உள்ள எச்சரிக்கைகள் எதுவும் இல்லை."
  };

  const peakPm25 = workflow?.health_advisory?.peak_pm25 || 120;
  const targetDemo = workflow?.health_advisory?.target_demographics || "Sensitive groups (children, elderly, respiratory patients)";

  // Determine risk level based on PM2.5 value
  const riskLevel = peakPm25 > 150 ? "Critical" : peakPm25 > 90 ? "High" : "Moderate";

  const languages = [
    { key: "en", label: "English" },
    { key: "hi", label: "हिंदी (Hindi)" },
    { key: "mr", label: "मराठी (Marathi)" },
    { key: "kn", label: "ಕನ್ನಡ (Kannada)" },
    { key: "ta", label: "தமிழ் (Tamil)" },
  ] as const;

  return (
    <PageShell
      title="Citizen Health Risk Intelligence"
      subtitle={`Vulnerable demographic exposure & health alerts · ${city.name}`}
      breadcrumbs={[{ label: "Intelligence" }, { label: "Citizen Health" }]}
      actions={
        <Badge variant="outline" className="h-6 gap-1.5 font-normal">
          <HeartPulse className="h-3 w-3 text-destructive animate-pulse" /> Health Engine Active
        </Badge>
      }
    >
      <div className="rounded-lg bg-card p-4 ring-1 ring-border">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Query public health impact for specific locations or groups..."
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Running LangGraph..." : "Assess Health Risks"}
          </Button>
        </form>
      </div>

      {workflow && (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="Risk Level Assessment"
            value={riskLevel}
            tone={riskLevel === "Critical" ? "danger" : "warning"}
            hint="based on peak forecasted PM2.5"
            icon={<ShieldAlert className="h-3.5 w-3.5" />}
          />
          <KpiCard
            label="Peak Forecast PM2.5"
            value={`${Math.round(peakPm25)} µg/m³`}
            tone="danger"
            hint="Within next 24h"
            icon={<HeartPulse className="h-3.5 w-3.5" />}
          />
          <KpiCard
            label="Target Demographics"
            value="Vulnerable Clusters"
            hint={targetDemo}
            icon={<Users className="h-3.5 w-3.5" />}
          />
          <KpiCard
            label="Population Exposure"
            value={peakPm25 > 150 ? "~3.8 Million" : "~1.2 Million"}
            tone={peakPm25 > 150 ? "danger" : "warning"}
            hint="cumulative count in hotspots"
            icon={<Users className="h-3.5 w-3.5" />}
          />
        </div>
      )}

      {workflow && (
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          {/* Multilingual Advisory Box */}
          <div className="rounded-lg bg-card ring-1 ring-border lg:col-span-2">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Multilingual Civic Advisories</h2>
              </div>
              <Badge variant="secondary" className="h-5 text-[10px]">Broadcasting Ready</Badge>
            </div>
            
            <div className="p-4">
              <div className="flex flex-wrap gap-1 rounded-md border border-input bg-muted p-1">
                {languages.map((l) => (
                  <button
                    key={l.key}
                    onClick={() => setSelectedLang(l.key)}
                    className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                      selectedLang === l.key
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 min-h-[140px] rounded-lg border border-border bg-background p-5">
                <div className="flex items-start gap-3">
                  <MessageSquare className="h-5 w-5 text-primary mt-1 shrink-0" />
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Broadcast Advisory</h4>
                    <p className="mt-2 text-base font-semibold leading-relaxed tracking-tight text-foreground select-all">
                      {currentAdvisories[selectedLang] || currentAdvisories.en}
                    </p>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-[10px] text-muted-foreground text-center">
                *Advisories generated dynamically by the Health Risk Agent. Ready to broadcast via WhatsApp / SMS gateways.
              </p>
            </div>
          </div>

          {/* Workflow state */}
          <div className="rounded-lg bg-card ring-1 ring-border">
            <div className="border-b border-border px-4 py-2.5">
              <h2 className="text-sm font-semibold">Health Advisory Agent Logic</h2>
            </div>
            <div className="p-4">
              <ol className="relative border-l border-border space-y-4 ml-4">
                {workflow.messages.map((msg, idx) => (
                  <li key={idx} className="ml-4">
                    <span className="absolute -left-[5px] flex h-2 w-2 items-center justify-center rounded-full bg-primary" />
                    <p className="text-[11px] text-muted-foreground">Step {idx + 1}</p>
                    <p className="mt-0.5 text-[12px] font-medium leading-snug">{msg}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
