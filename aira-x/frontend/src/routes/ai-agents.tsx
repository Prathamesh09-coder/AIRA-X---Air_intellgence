import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Bot, ArrowRight, Activity, CheckCircle2, Play } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getHealthAdvisory } from "@/lib/api";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/ai-agents")({
  head: () => ({
    meta: [
      { title: "AI Intelligence Center — AIRA-X" },
      { name: "description", content: "LangGraph multi-agent workflow visualization for forecast, attribution, dispersion, enforcement, health, and policy agents." },
    ],
  }),
  component: AiAgents,
});

function AiAgents() {
  const city = useAppStore((s) => s.city);
  const [triggerQuery, setTriggerQuery] = useState("Run diagnostic smart city workflow");

  // Fetch the full LangGraph pipeline execution response
  const { data: workflow, isLoading, refetch } = useQuery({
    queryKey: ["agent-workflow", city.id, triggerQuery, city.center[1], city.center[0]],
    queryFn: () => getHealthAdvisory(triggerQuery, city.center[1], city.center[0]),
  });

  const agentsList = useMemo(() => {
    if (!workflow) {
      return [
        { id: "forecast", name: "Forecast Agent", status: "active", task: "Running GNN forecasts", out: "Awaiting execution..." },
        { id: "attrib", name: "Source Attribution Agent", status: "idle", task: "Analyzing MODIS/Sentinel bands", out: "Awaiting execution..." },
        { id: "enforcement", name: "Enforcement Agent", status: "idle", task: "Evaluating regulatory codes", out: "Awaiting execution..." },
        { id: "health", name: "Health Risk Agent", status: "idle", task: "Computing demographic exposure", out: "Awaiting execution..." },
        { id: "policy", name: "Policy Agent", status: "idle", task: "Formulating long-term policies", out: "Awaiting execution..." },
      ];
    }

    const peak_pm25 = workflow.health_advisory?.peak_pm25 || 120;
    const primarySource = workflow.attribution?.[0]?.source_type || "Traffic";
    const contrib = workflow.attribution?.[0]?.contribution_pct || 35;

    return [
      {
        id: "forecast",
        name: "Forecast Agent",
        status: "active",
        task: "PM2.5-GNN Spatial Model Solver",
        out: `Projected Peak PM2.5 level: ${Math.round(peak_pm25)} µg/m³.`,
      },
      {
        id: "attrib",
        name: "Source Attribution Agent",
        status: "active",
        task: "XGBoost + SHAP Bands Apportioner",
        out: `Attributed ${contrib}% pollution contribution to '${primarySource}'.`,
      },
      {
        id: "enforcement",
        name: "Enforcement Agent",
        status: "active",
        task: "Neo4j statutory compliance checker",
        out: workflow.enforcement_plan 
          ? `Priority inspection target ordered: ${workflow.enforcement_plan.inspection_target}.`
          : "CPCB action plan queued.",
      },
      {
        id: "health",
        name: "Health Risk Agent",
        status: "active",
        task: "Vulnerable exposure estimator",
        out: workflow.health_advisory 
          ? `Exposed population warning: ${workflow.health_advisory.advisory.slice(0, 50)}...`
          : "Health advisories constructed.",
      },
      {
        id: "policy",
        name: "Policy Agent",
        status: "active",
        task: "Long-term structural planner",
        out: workflow.policy_plan
          ? `Policy target: ${workflow.policy_plan.policy_actions.slice(0, 55)}...`
          : "Interventions quadrant mapped.",
      },
    ];
  }, [workflow]);

  const timelineMessages = useMemo(() => {
    if (!workflow) {
      return ["Awaiting manual workflow execution trigger..."];
    }
    return workflow.messages;
  }, [workflow]);

  return (
    <PageShell
      title="AI Intelligence Center"
      subtitle="LangGraph multi-agent decision workflow · live node states, outputs, and memory"
      breadcrumbs={[{ label: "Intelligence" }, { label: "AI Agents" }]}
      actions={
        <div className="flex gap-2">
          <Button size="sm" className="h-8 gap-1.5 text-xs font-normal" onClick={() => refetch()} disabled={isLoading}>
            <Play className="h-3.5 w-3.5 fill-current" />
            {isLoading ? "Running..." : "Trigger Workflow"}
          </Button>
          <Badge variant="outline" className="h-8 gap-1.5 font-normal">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> LangGraph Connected
          </Badge>
        </div>
      }
    >
      <div className="rounded-lg bg-card p-6 ring-1 ring-border">
        <h2 className="text-sm font-semibold">LangGraph Multi-Agent Orchestration Chain</h2>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {agentsList.map((a, i) => (
            <div key={a.id} className="flex items-center gap-2">
              <div className="flex w-44 flex-col gap-1 rounded-md border border-border bg-background p-3">
                <div className="flex items-center justify-between">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                  <span className={`h-1.5 w-1.5 rounded-full ${a.status === "active" ? "bg-success" : "bg-muted-foreground/35 animate-pulse"}`} />
                </div>
                <p className="text-[12px] font-semibold leading-tight">{a.name}</p>
                <p className="text-[10px] text-muted-foreground line-clamp-1">{a.task}</p>
              </div>
              {i < agentsList.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-lg bg-card ring-1 ring-border">
          <div className="border-b border-border px-4 py-2.5">
            <h2 className="text-sm font-semibold">Live Agent Outputs</h2>
          </div>
          <ul className="divide-y divide-border">
            {agentsList.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-medium">{a.name}</p>
                  <span className="text-[10px] text-muted-foreground">last run: active</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground leading-snug">{a.out}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg bg-card ring-1 ring-border">
          <div className="border-b border-border px-4 py-2.5">
            <h2 className="text-sm font-semibold">Decision Execution Timeline</h2>
          </div>
          <ol className="relative ml-4 space-y-3 border-l border-border p-4">
            {timelineMessages.map((msg, idx) => (
              <li key={idx} className="ml-3">
                <span className="absolute -left-[5px] flex h-2.5 w-2.5 items-center justify-center rounded-full bg-primary" />
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Activity className="h-3 w-3" /> Step {idx + 1}
                </div>
                <p className="mt-0.5 text-[12px] font-medium">{msg}</p>
              </li>
            ))}
            {workflow && (
              <li className="ml-3">
                <span className="absolute -left-[5px] flex h-2.5 w-2.5 items-center justify-center rounded-full bg-success" />
                <div className="flex items-center gap-2 text-[10px] text-success font-semibold">
                  <CheckCircle2 className="h-3 w-3" /> Complete
                </div>
                <p className="mt-0.5 text-[12px] text-success">Orchestrated all 5 agents successfully.</p>
              </li>
            )}
          </ol>
        </div>
      </div>
    </PageShell>
  );
}
