import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export default function PlacesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-5">
        <h1 className="font-serif text-3xl font-medium tracking-tight text-ink">Places</h1>
        <p className="mt-1 text-sm text-muted">
          Track spots you want to try, low-key explorations, and favourites you&apos;ve visited.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2" aria-label="Status overview">
        <Chip tone="to_try">To Try · 0</Chip>
        <Chip tone="exploration">Exploration · 0</Chip>
        <Chip tone="tried">Tried · 0</Chip>
      </div>

      <EmptyState
        title="Nothing on the menu yet"
        description="Paste a Google Maps link or search by name to add your first spot."
        action={
          <Link href="/places?add=1" className={cn(buttonVariants({ variant: "primary" }))}>
            Add first spot
          </Link>
        }
      />
    </div>
  );
}
