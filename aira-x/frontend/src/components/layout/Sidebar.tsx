import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CloudFog,
  Crosshair,
  Wind,
  ShieldCheck,
  Activity,
  HeartPulse,
  GitCompare,
  Network,
  Bot,
  Timer,
  Leaf,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Command Center", icon: LayoutDashboard },
  { to: "/forecasting", label: "Hyperlocal Forecast", icon: CloudFog },
  { to: "/source-attribution", label: "Source Attribution", icon: Crosshair },
  { to: "/dispersion", label: "Atmospheric Dispersion", icon: Wind },
  { to: "/enforcement", label: "Enforcement", icon: ShieldCheck },
  { to: "/interventions", label: "Intervention Impact", icon: Activity },
  { to: "/health", label: "Citizen Health", icon: HeartPulse },
  { to: "/compare", label: "Multi-City Compare", icon: GitCompare },
  { to: "/knowledge-graph", label: "Knowledge Graph", icon: Network },
  { to: "/ai-agents", label: "AI Intelligence", icon: Bot },
  { to: "/response", label: "Response Time", icon: Timer },
] as const;

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="hidden lg:flex h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Leaf className="h-4 w-4" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-sidebar-foreground">AIRA-X</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Air Intelligence</span>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="px-2 pb-2 pt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Operations
        </div>
        <ul className="space-y-0.5">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <li key={to}>
                <Link
                  to={to}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                  <span className="truncate">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2 rounded-md bg-card px-2 py-2 ring-1 ring-border">
          <div className="h-2 w-2 rounded-full bg-success" />
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] font-medium">All agents online</span>
            <span className="text-[10px] text-muted-foreground">6 / 6 healthy · 142ms</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
