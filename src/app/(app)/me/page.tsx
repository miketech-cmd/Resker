import { CalendarClock, ChevronRight } from "lucide-react";
import Link from "next/link";

import { SignOutButton } from "@/components/shell/sign-out-button";
import { ThemeSwitch } from "@/components/shell/theme-switch";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/server/auth-guard";
import { getUserProfileStats } from "@/server/plans";

export default async function MePage() {
  const user = await requireUser();
  const stats = await getUserProfileStats(user.id);

  return (
    <div className="mx-auto max-w-xl px-4 py-6 sm:px-6">
      <header className="mb-5">
        <h1 className="font-serif text-3xl font-medium tracking-tight text-ink">Me</h1>
      </header>

      <div className="space-y-4">
        <Card className="flex items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent/15 font-serif text-xl font-medium text-accent">
            {user.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-serif text-xl font-medium text-ink">{user.name}</h2>
            <p className="truncate text-sm text-muted">@{user.displayUsername || user.username}</p>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">Places tried</p>
            <p className="mt-1 font-serif text-2xl font-medium text-ink tabular-nums">
              {stats.placesTried}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">
              Visits this year
            </p>
            <p className="mt-1 font-serif text-2xl font-medium text-ink tabular-nums">
              {stats.visitsThisYear}
            </p>
          </Card>
        </div>

        <Link
          href="/plans"
          className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Card className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-surface-elevated/80">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <CalendarClock className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-serif text-base font-medium text-ink">Upcoming plans</p>
                <p className="text-xs text-muted">
                  {stats.upcomingPlans === 0
                    ? "No reservations scheduled yet"
                    : `${stats.upcomingPlans} upcoming ${stats.upcomingPlans === 1 ? "visit" : "visits"}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-xl font-medium text-ink tabular-nums">
                {stats.upcomingPlans}
              </span>
              <ChevronRight className="size-4 text-muted" aria-hidden="true" />
            </div>
          </Card>
        </Link>

        <Card className="space-y-3">
          <div>
            <h2 className="font-serif text-lg font-medium text-ink">Appearance</h2>
            <p className="text-sm text-muted">
              Follows your phone setting by default, or pick a theme manually.
            </p>
          </div>
          <ThemeSwitch />
        </Card>

        <div className="pt-2">
          <SignOutButton />
        </div>

        <div className="flex items-center justify-center gap-6 pt-2 text-xs text-muted">
          <Link href="/terms" className="hover:text-ink">
            Terms of Service
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
