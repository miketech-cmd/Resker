"use client";

import { Check, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { FoodIcon } from "@/components/icons/food-icons";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { mapCuisinesToFoodIcon } from "@/lib/places/cuisines";
import {
  useAddToListMutation,
  useCreateListMutation,
  useListsQuery,
  useRemoveFromListMutation,
} from "@/lib/queries/lists";
import type { UserRestaurantItem } from "@/lib/queries/restaurants";
import { cn } from "@/lib/utils";
import { createListSchema } from "@/lib/validation/lists";

export function AddToListsSheet({
  restaurant,
  open,
  onOpenChange,
}: {
  restaurant: UserRestaurantItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: lists = [], isLoading } = useListsQuery(undefined, open);
  const addToListMutation = useAddToListMutation();
  const removeFromListMutation = useRemoveFromListMutation();
  const createListMutation = useCreateListMutation();

  const [newListName, setNewListName] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestedIcon = mapCuisinesToFoodIcon(restaurant.cuisines);

  async function handleToggleList(listId: string, listName: string, currentlyInList: boolean) {
    setError(null);
    try {
      if (currentlyInList) {
        await removeFromListMutation.mutateAsync({
          listId,
          userRestaurantId: restaurant.id,
        });
        toast(`Removed from "${listName}"`);
      } else {
        await addToListMutation.mutateAsync({
          listId,
          userRestaurantId: restaurant.id,
        });
        toast(`Added to "${listName}"`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update list.");
    }
  }

  async function handleQuickCreateAndAdd(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = createListSchema.safeParse({
      name: newListName,
      icon: suggestedIcon,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a list name.");
      return;
    }

    try {
      const created = await createListMutation.mutateAsync(parsed.data);
      await addToListMutation.mutateAsync({
        listId: created.id,
        userRestaurantId: restaurant.id,
      });
      setNewListName("");
      setShowNewForm(false);
      toast(`Added to "${created.name}"`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create list.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <div className="mb-4">
          <SheetTitle>Add to lists</SheetTitle>
          <SheetDescription>
            Save <span className="font-medium text-ink">{restaurant.name}</span> to one or more
            collections.
          </SheetDescription>
        </div>

        <div className="space-y-4 pb-3">
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-14 animate-pulse rounded-xl bg-surface-elevated" />
              <div className="h-14 animate-pulse rounded-xl bg-surface-elevated" />
            </div>
          ) : lists.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-surface-elevated/40 px-4 py-4 text-sm text-muted">
              You don&apos;t have any lists yet. Create your first list below.
            </p>
          ) : (
            <ul className="space-y-2" aria-label="Your lists">
              {lists.map((list) => {
                const inList = list.restaurantIds.includes(restaurant.id);
                return (
                  <li key={list.id}>
                    <button
                      type="button"
                      aria-pressed={inList}
                      onClick={() => void handleToggleList(list.id, list.name, inList)}
                      className={cn(
                        "flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                        inList
                          ? "border-accent bg-accent/10 text-ink"
                          : "border-border bg-surface hover:bg-surface-elevated/60 text-ink",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-elevated text-accent">
                          <FoodIcon name={list.icon} className="size-4.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{list.name}</p>
                          <p className="text-xs text-muted tabular-nums">
                            {list.itemCount} {list.itemCount === 1 ? "spot" : "spots"}
                          </p>
                        </div>
                      </div>

                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors",
                          inList
                            ? "border-accent bg-accent text-accent-ink"
                            : "border-border bg-surface text-muted",
                        )}
                      >
                        {inList ? (
                          <Check className="size-4" aria-hidden="true" />
                        ) : (
                          <Plus className="size-4" aria-hidden="true" />
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {!showNewForm && lists.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setShowNewForm(true)}
              className="w-full gap-1.5"
            >
              <Plus className="size-4" aria-hidden="true" />
              New list
            </Button>
          ) : (
            <form
              onSubmit={(e) => void handleQuickCreateAndAdd(e)}
              className="space-y-2.5 rounded-xl border border-border bg-surface-elevated/45 p-3"
            >
              <Label htmlFor="quick-new-list-name">Create a new list</Label>
              <div className="flex gap-2">
                <Input
                  id="quick-new-list-name"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g. Date Night, Tokyo 2027"
                  maxLength={80}
                  required
                />
                <Button
                  type="submit"
                  size="md"
                  disabled={createListMutation.isPending || addToListMutation.isPending}
                  className="shrink-0"
                >
                  {createListMutation.isPending ? "Creating..." : "Create"}
                </Button>
              </div>
            </form>
          )}

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
