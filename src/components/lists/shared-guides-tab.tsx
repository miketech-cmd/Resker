"use client";

import { ChevronRight, Lock, Share2, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { FoodIcon } from "@/components/icons/food-icons";
import { ShareLibrarySheet } from "@/components/lists/share-library-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { ListSummaryItem } from "@/lib/queries/lists";
import {
  useSharedGuidesOverviewQuery,
  type SharedGuidesOverviewResponse,
} from "@/lib/queries/shared-guides";

export function SharedGuidesTab({
  initialOverview,
  viewerLists,
}: {
  initialOverview: SharedGuidesOverviewResponse;
  viewerLists: ListSummaryItem[];
}) {
  const { data: overview = initialOverview } = useSharedGuidesOverviewQuery(initialOverview);
  const [shareOpen, setShareOpen] = useState(false);

  const hasIncoming = overview.sharedWithMe.length > 0 || viewerLists.length > 0;

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-3.5 border-accent/25 bg-surface-elevated/45 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-accent/25 dark:bg-[#191512]">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Users className="size-5" aria-hidden="true" />
          </span>
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-lg font-medium text-ink">Share your saved places</h2>
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">
                <Lock className="size-2.5 text-accent" aria-hidden="true" />
                {overview.sharingWith.length === 0
                  ? "Private"
                  : `Sharing with ${overview.sharingWith.length}`}
              </span>
            </div>
            <p className="text-xs text-muted">
              Every spot you save updates live in your partner&apos;s Shared Guides. Ratings and
              Tried status stay private.
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setShareOpen(true)}
          className="shrink-0 gap-1.5 self-start sm:self-center"
        >
          <Share2 className="size-3.5" aria-hidden="true" />
          Manage sharing
        </Button>
      </Card>

      {!hasIncoming ? (
        <EmptyState
          title="No guides shared with you yet"
          description="Ask a partner or friend to share their live Saved Places guide with your @username or send you a private invite link."
          action={
            <Button type="button" variant="outline" onClick={() => setShareOpen(true)}>
              Share yours first
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          {overview.sharedWithMe.length > 0 ? (
            <section aria-label="Shared libraries" className="space-y-3">
              <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">
                Live libraries shared with you
              </h2>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                {overview.sharedWithMe.map((guide) => (
                  <Link
                    key={guide.ownerId}
                    href={`/lists/shared/${encodeURIComponent(guide.ownerId)}`}
                    className="group block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Card className="flex h-full items-start justify-between gap-3 transition-colors group-hover:border-accent/45 dark:border-[#413830] dark:group-hover:border-accent/55">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
                          <Users className="size-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="truncate font-serif text-lg font-medium text-ink group-hover:text-accent">
                              {guide.ownerName}&apos;s Saved Places
                            </h3>
                            <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                              Live · Read-only
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted tabular-nums">
                            {guide.ownerUsername ? `@${guide.ownerUsername} · ` : ""}
                            {guide.itemCount} {guide.itemCount === 1 ? "spot" : "spots"}
                            {guide.citiesCount > 0
                              ? ` across ${guide.citiesCount} ${guide.citiesCount === 1 ? "city" : "cities"}`
                              : ""}
                          </p>
                          {guide.cuisines.length > 0 ? (
                            <p className="mt-1 truncate text-[11px] text-muted">
                              {guide.cuisines.slice(0, 4).join(" · ")}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <ChevronRight
                        className="mt-1 size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                        aria-hidden="true"
                      />
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {viewerLists.length > 0 ? (
            <section aria-label="Read-only shared lists" className="space-y-3">
              <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">
                Read-only lists shared with you
              </h2>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                {viewerLists.map((list) => (
                  <Link
                    key={list.id}
                    href={`/lists/${list.id}`}
                    className="group block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Card className="flex h-full items-start justify-between gap-3 transition-colors group-hover:border-accent/45 dark:border-[#413830] dark:group-hover:border-accent/55">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-elevated text-accent">
                          <FoodIcon name={list.icon} className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="truncate font-serif text-lg font-medium text-ink group-hover:text-accent">
                              {list.name}
                            </h3>
                            <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                              Shared · Viewer
                            </span>
                          </div>
                          {list.description ? (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                              {list.description}
                            </p>
                          ) : null}
                          <p className="mt-1 text-xs font-medium text-muted tabular-nums">
                            {list.itemCount} {list.itemCount === 1 ? "spot" : "spots"}
                            {list.ownerUsername ? ` · by @${list.ownerUsername}` : ""}
                          </p>
                        </div>
                      </div>
                      <ChevronRight
                        className="mt-1 size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                        aria-hidden="true"
                      />
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      {shareOpen ? (
        <ShareLibrarySheet
          viewers={overview.sharingWith}
          inviteToken={overview.inviteToken}
          myLibraryCount={overview.myLibraryCount}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />
      ) : null}
    </div>
  );
}
