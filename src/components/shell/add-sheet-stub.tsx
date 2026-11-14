"use client";

import { ClipboardPaste, Link2, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function AddSheetStub() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [tab, setTab] = useState<"link" | "search">("link");

  const isOpen = searchParams.get("add") === "1";

  function handleOpenChange(open: boolean) {
    const next = new URLSearchParams(searchParams.toString());
    if (open) {
      next.set("add", "1");
    } else {
      next.delete("add");
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent>
        <div className="mb-4">
          <SheetTitle>Add a restaurant</SheetTitle>
          <SheetDescription>
            Paste a Google Maps link or search by name (wired in Phase 2).
          </SheetDescription>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-1 rounded-full border border-border bg-surface-elevated p-1">
          <button
            type="button"
            onClick={() => setTab("link")}
            className={cn(
              "inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors",
              tab === "link" ? "bg-surface text-ink shadow-2xs" : "text-muted hover:text-ink",
            )}
          >
            <Link2 className="size-4" aria-hidden="true" />
            Paste link
          </button>
          <button
            type="button"
            onClick={() => setTab("search")}
            className={cn(
              "inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors",
              tab === "search" ? "bg-surface text-ink shadow-2xs" : "text-muted hover:text-ink",
            )}
          >
            <Search className="size-4" aria-hidden="true" />
            Search
          </button>
        </div>

        {tab === "link" ? (
          <div className="space-y-3 pb-2">
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://maps.app.goo.gl/..."
                aria-label="Google Maps link"
                disabled
              />
              <Button variant="secondary" disabled aria-label="Paste from clipboard">
                <ClipboardPaste className="size-4" aria-hidden="true" />
                Paste
              </Button>
            </div>
            <p className="text-xs text-muted">
              Google Places link resolution and autocomplete arrive in Phase 2.
            </p>
          </div>
        ) : (
          <div className="space-y-3 pb-2">
            <Input
              type="search"
              placeholder="Search restaurant name or neighborhood..."
              aria-label="Search restaurants"
              disabled
            />
            <p className="text-xs text-muted">
              Server-proxied Google Autocomplete arrives in Phase 2.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
