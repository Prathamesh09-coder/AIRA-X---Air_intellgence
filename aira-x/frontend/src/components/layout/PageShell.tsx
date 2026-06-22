import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ChevronRight } from "lucide-react";

type Crumb = { label: string; to?: string };

type Props = {
  title: string;
  subtitle?: string;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
  rightPanel?: ReactNode;
  children: ReactNode;
};

export function PageShell({ title, subtitle, breadcrumbs, actions, rightPanel, children }: Props) {
  return (
    <div className="flex h-dvh w-full bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-y-auto">
            <div className="border-b border-border bg-background px-6 py-4">
              {breadcrumbs && breadcrumbs.length > 0 && (
                <nav aria-label="Breadcrumb" className="mb-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                  {breadcrumbs.map((c, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && <ChevronRight className="h-3 w-3" />}
                      <span className={i === breadcrumbs.length - 1 ? "text-foreground" : ""}>{c.label}</span>
                    </span>
                  ))}
                </nav>
              )}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
                  {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
                </div>
                {actions && <div className="flex items-center gap-2">{actions}</div>}
              </div>
            </div>
            <div className="p-6">{children}</div>
          </main>
          {rightPanel && (
            <aside className="hidden xl:flex h-full w-80 shrink-0 flex-col border-l border-border bg-sidebar overflow-y-auto">
              {rightPanel}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
