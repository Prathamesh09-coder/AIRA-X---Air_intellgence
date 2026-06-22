import type { ReactNode } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

export function StubPage({
  title,
  subtitle,
  crumb,
  bullets,
}: {
  title: string;
  subtitle: string;
  crumb: string;
  bullets: { label: string; desc: string }[];
}): ReactNode {
  return (
    <PageShell
      title={title}
      subtitle={subtitle}
      breadcrumbs={[{ label: "Intelligence" }, { label: crumb }]}
      actions={
        <Badge variant="outline" className="h-6 gap-1.5 font-normal">
          <Sparkles className="h-3 w-3 text-primary" /> Module ready · awaiting API wiring
        </Badge>
      }
    >
      <div className="rounded-lg border border-dashed border-border bg-card p-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
          {bullets.map((b) => (
            <div key={b.label} className="rounded-md border border-border bg-background p-4">
              <p className="text-[13px] font-semibold">{b.label}</p>
              <p className="mt-1 text-[12px] leading-snug text-muted-foreground">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
