import { MapPin } from "lucide-react";

import { Card } from "@/components/ui/card";

export default function MapPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-5">
        <h1 className="font-serif text-3xl font-medium tracking-tight text-ink">Map</h1>
        <p className="mt-1 text-sm text-muted">
          Your saved restaurants plotted on a single persistent Google Map.
        </p>
      </header>

      <Card className="flex min-h-[55dvh] flex-col items-center justify-center p-8 text-center">
        <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-surface-elevated text-accent">
          <MapPin className="size-6" aria-hidden="true" />
        </span>
        <h2 className="font-serif text-xl font-medium text-ink">Map arrives in Phase 6</h2>
        <p className="mt-1.5 max-w-xs text-sm text-muted">
          Once saving restaurants is wired up, all your spots will appear here with status-tinted
          cuisine pins and clustering.
        </p>
      </Card>
    </div>
  );
}
