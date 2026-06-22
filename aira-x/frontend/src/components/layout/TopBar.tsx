import { Search, Bell, ChevronDown } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { CITIES } from "@/lib/aira-data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const ROLES = ["City Administrator", "Pollution Control Officer", "Enforcement Officer", "Urban Planner", "Public Health Officer"] as const;
const RANGES = ["1h", "24h", "7d", "30d"] as const;

export function TopBar() {
  const { city, setCity, role, setRole, timeRange, setTimeRange } = useAppStore();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur">
      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search wards, stations, sources, agents…"
          className="h-9 w-full rounded-md border border-input bg-card pl-8 pr-16 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
        />
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* City */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {city.name}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs">Switch city</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {CITIES.map((c) => (
              <DropdownMenuItem key={c.id} onClick={() => setCity(c)} className="text-xs">
                <span className="flex-1">{c.name}</span>
                <span className="text-muted-foreground">{c.state}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Time range */}
        <div className="flex h-8 items-center rounded-md border border-input bg-card p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                timeRange === r ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Notifications */}
        <Button variant="outline" size="icon" className="relative h-8 w-8" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-destructive" />
        </Button>

        {/* Role */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-8 items-center gap-2 rounded-md border border-input bg-card pl-1 pr-2.5 text-xs hover:bg-accent">
              <span className="grid h-6 w-6 place-items-center rounded bg-primary text-[10px] font-semibold text-primary-foreground">
                {role.split(" ").map((s) => s[0]).slice(0, 2).join("")}
              </span>
              <span className="hidden md:inline-block max-w-[140px] truncate text-left font-medium">
                {role}
              </span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs">Active role</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ROLES.map((r) => (
              <DropdownMenuItem key={r} onClick={() => setRole(r)} className="text-xs">
                <span className="flex-1">{r}</span>
                {role === r && <Badge variant="secondary" className="ml-2 h-4 text-[9px]">active</Badge>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
