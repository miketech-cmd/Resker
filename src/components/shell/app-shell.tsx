"use client";

import { Bookmark, CalendarClock, List, MapPin, Plus, User } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";

import { FoodIcon } from "@/components/icons/food-icons";
import { Button } from "@/components/ui/button";
import { buildFilteredHref, useSharedFilters } from "@/lib/places/filter-store";
import { cn } from "@/lib/utils";
import type { AuthenticatedUser } from "@/server/auth-guard";

const AddSheet = dynamic(() => import("@/components/places/add-sheet").then((m) => m.AddSheet), {
  ssr: false,
});

const PersistentMap = dynamic(
  () => import("@/components/map/persistent-map").then((m) => m.PersistentMap),
  { ssr: false },
);

const NAV_ITEMS = [
  { href: "/places", label: "Places", Icon: Bookmark },
  { href: "/map", label: "Map", Icon: MapPin },
  { href: "/lists", label: "Lists", Icon: List },
  { href: "/me", label: "Me", Icon: User },
] as const;

const DESKTOP_NAV_ITEMS = [
  { href: "/places", label: "Places", Icon: Bookmark },
  { href: "/map", label: "Map", Icon: MapPin },
  { href: "/lists", label: "Lists", Icon: List },
  { href: "/plans", label: "Plans", Icon: CalendarClock },
  { href: "/me", label: "Me", Icon: User },
] as const;

function AddButtonTrigger({ variant }: { variant: "mobile" | "desktop" }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  function openAdd() {
    const next = new URLSearchParams(searchParams.toString());
    next.set("add", "1");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  if (variant === "desktop") {
    return (
      <Button onClick={openAdd} className="w-full justify-center">
        <Plus className="size-4" aria-hidden="true" />
        Add restaurant
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={openAdd}
      aria-label="Add restaurant"
      className="-mt-5 flex size-14 cursor-pointer items-center justify-center rounded-full bg-accent text-accent-ink shadow-md ring-4 ring-bg transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Plus className="size-6 stroke-[2.25]" aria-hidden="true" />
    </button>
  );
}

export function AppShell({ user, children }: { user: AuthenticatedUser; children: ReactNode }) {
  const pathname = usePathname();
  const [hasVisitedMap, setHasVisitedMap] = useState(() => pathname === "/map");

  if (pathname === "/map" && !hasVisitedMap) {
    setHasVisitedMap(true);
  }

  const sharedFilters = useSharedFilters();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const resolveNavHref = (href: string) =>
    href === "/places" || href === "/map" ? buildFilteredHref(href, sharedFilters) : href;

  return (
    <div className="flex min-h-dvh bg-bg text-ink">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-border lg:bg-surface lg:p-5">
        <Link
          href="/places"
          className="mb-6 flex items-center gap-2.5 rounded-xl px-2 py-1.5 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-ink">
            <FoodIcon name="bowl" className="size-5" />
          </span>
          <span className="font-serif text-lg font-medium tracking-tight text-ink">
            Restaurant Tracker
          </span>
        </Link>

        <div className="mb-5">
          <Suspense
            fallback={
              <Button disabled className="w-full justify-center">
                <Plus className="size-4" aria-hidden="true" />
                Add restaurant
              </Button>
            }
          >
            <AddButtonTrigger variant="desktop" />
          </Suspense>
        </div>

        <nav aria-label="Primary" className="flex flex-1 flex-col gap-1">
          {DESKTOP_NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={resolveNavHref(href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  active
                    ? "bg-surface-elevated text-ink"
                    : "text-muted hover:bg-surface-elevated/60 hover:text-ink",
                )}
              >
                <Icon className={cn("size-5", active && "text-accent")} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-border pt-4">
          <Link
            href="/me"
            className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-elevated/60"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-elevated font-serif text-sm font-medium text-ink">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">{user.name}</span>
              <span className="block truncate text-xs text-muted">
                @{user.displayUsername || user.username}
              </span>
            </span>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="min-w-0 flex-1 pb-[calc(5.25rem+env(safe-area-inset-bottom))] lg:pb-8">
        {children}
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="mx-auto grid h-16 max-w-lg grid-cols-5 items-center px-2">
          {NAV_ITEMS.slice(0, 2).map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={resolveNavHref(href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  active ? "text-accent" : "text-muted hover:text-ink",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}

          <div className="flex items-center justify-center">
            <Suspense
              fallback={
                <span className="-mt-5 flex size-14 items-center justify-center rounded-full bg-accent text-accent-ink shadow-md ring-4 ring-bg">
                  <Plus className="size-6" aria-hidden="true" />
                </span>
              }
            >
              <AddButtonTrigger variant="mobile" />
            </Suspense>
          </div>

          {NAV_ITEMS.slice(2).map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  active ? "text-accent" : "text-muted hover:text-ink",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <Suspense fallback={null}>
        <AddSheet />
      </Suspense>

      {hasVisitedMap ? (
        <Suspense fallback={null}>
          <PersistentMap isActive={pathname === "/map"} />
        </Suspense>
      ) : null}
    </div>
  );
}
