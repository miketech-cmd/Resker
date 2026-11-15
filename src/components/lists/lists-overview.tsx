"use client";

import { ChevronRight, Compass, Globe, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";

import { FoodIcon } from "@/components/icons/food-icons";
import { PublicListBrowse } from "@/components/lists/public-list-browse";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  useListsQuery,
  type ListSummaryItem,
  type PublicListSummaryItem,
} from "@/lib/queries/lists";
import { cn } from "@/lib/utils";

const ListFormSheet = dynamic(
  () => import("@/components/lists/list-form-sheet").then((mod) => mod.ListFormSheet),
  { ssr: false },
);

export function ListsOverview({
  initialLists,
  initialPublicLists = [],
  initialTab = "mine",
}: {
  initialLists: ListSummaryItem[];
  initialPublicLists?: PublicListSummaryItem[];
  initialTab?: "mine" | "browse";
}) {
  const { data: lists = initialLists } = useListsQuery(initialLists);
  const [activeTab, setActiveTab] = useState<"mine" | "browse">(initialTab);
  const [createOpen, setCreateOpen] = useState(false);

  function switchTab(nextTab: "mine" | "browse") {
    setActiveTab(nextTab);
    if (typeof window !== "undefined") {
      const nextUrl = nextTab === "browse" ? "/lists?tab=browse" : "/lists";
      window.history.replaceState(null, "", nextUrl);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-ink">Lists</h1>
          <p className="mt-1 text-sm text-muted">
            {activeTab === "browse"
              ? "Browse curated vegetarian city guides and community public lists."
              : "Group spots into collections like \u201cNY 2026 Travel\u201d or \u201cDate Night\u201d."}
          </p>
        </div>

        <Button
          type="button"
          size="md"
          onClick={() => setCreateOpen(true)}
          className="shrink-0 gap-1.5"
        >
          <Plus className="size-4" aria-hidden="true" />
          New list
        </Button>
      </header>

      <div
        className="inline-flex rounded-full border border-border bg-surface-elevated p-0.5"
        role="tablist"
        aria-label="Lists sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "mine"}
          onClick={() => switchTab("mine")}
          className={cn(
            "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-4 text-xs font-medium transition-colors",
            activeTab === "mine" ? "bg-ink text-bg shadow-2xs" : "text-muted hover:text-ink",
          )}
        >
          My Lists
          <span className="tabular-nums opacity-75">{lists.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "browse"}
          onClick={() => switchTab("browse")}
          className={cn(
            "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-4 text-xs font-medium transition-colors",
            activeTab === "browse" ? "bg-ink text-bg shadow-2xs" : "text-muted hover:text-ink",
          )}
        >
          <Compass className="size-3.5" aria-hidden="true" />
          Browse Guides
        </button>
      </div>

      {activeTab === "browse" ? (
        <PublicListBrowse
          initialLists={initialPublicLists}
          detailBasePath="/lists/public"
          viewerSignedIn
        />
      ) : lists.length === 0 ? (
        <EmptyState
          title="No lists yet"
          description="Create custom collections to organize spots for trips, neighborhoods, or browse curated city guides."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <Button type="button" onClick={() => setCreateOpen(true)} className="gap-1.5">
                <Plus className="size-4" aria-hidden="true" />
                New list
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => switchTab("browse")}
                className="gap-1.5"
              >
                <Compass className="size-4" aria-hidden="true" />
                Browse Guides
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {lists.map((list) => (
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
                      <h2 className="truncate font-serif text-lg font-medium text-ink group-hover:text-accent">
                        {list.name}
                      </h2>
                      {list.isPublic ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                          <Globe className="size-2.5" aria-hidden="true" />
                          Public
                        </span>
                      ) : null}
                    </div>
                    {list.description ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted">{list.description}</p>
                    ) : null}
                    <p className="mt-1.5 text-xs font-medium text-muted tabular-nums">
                      {list.itemCount} {list.itemCount === 1 ? "spot" : "spots"}
                      {list.isPublic && list.city ? ` · ${list.city}` : ""}
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
      )}

      {createOpen ? <ListFormSheet open={createOpen} onOpenChange={setCreateOpen} /> : null}
    </div>
  );
}
