"use client";

import { ChevronRight, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";

import { FoodIcon } from "@/components/icons/food-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useListsQuery, type ListSummaryItem } from "@/lib/queries/lists";

const ListFormSheet = dynamic(
  () => import("@/components/lists/list-form-sheet").then((mod) => mod.ListFormSheet),
  { ssr: false },
);

export function ListsOverview({ initialLists }: { initialLists: ListSummaryItem[] }) {
  const { data: lists = initialLists } = useListsQuery(initialLists);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-ink">Lists</h1>
          <p className="mt-1 text-sm text-muted">
            Group spots into collections like &ldquo;NY 2026 Travel&rdquo; or &ldquo;Date
            Night&rdquo;.
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

      {lists.length === 0 ? (
        <EmptyState
          title="No lists yet"
          description="Create custom collections to organize spots for trips, neighborhoods, or date nights."
          action={
            <Button type="button" onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="size-4" aria-hidden="true" />
              New list
            </Button>
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
                    <h2 className="truncate font-serif text-lg font-medium text-ink group-hover:text-accent">
                      {list.name}
                    </h2>
                    {list.description ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted">{list.description}</p>
                    ) : null}
                    <p className="mt-1.5 text-xs font-medium text-muted tabular-nums">
                      {list.itemCount} {list.itemCount === 1 ? "spot" : "spots"}
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
