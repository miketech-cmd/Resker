"use client";

import { useState, type FormEvent } from "react";

import {
  FOOD_ICON_KEYS,
  FOOD_ICON_LABELS,
  FoodIcon,
  type FoodIconKey,
} from "@/components/icons/food-icons";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import {
  useCreateListMutation,
  useUpdateListMutation,
  type ListSummaryItem,
} from "@/lib/queries/lists";
import { cn } from "@/lib/utils";
import { createListSchema } from "@/lib/validation/lists";

export function ListFormSheet({
  list = null,
  suggestedIcon = "bowl",
  open,
  onOpenChange,
  onCreated,
}: {
  list?: ListSummaryItem | null;
  suggestedIcon?: FoodIconKey;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (list: ListSummaryItem) => void;
}) {
  const isEditing = Boolean(list);
  const createMutation = useCreateListMutation();
  const updateMutation = useUpdateListMutation();

  const initialIcon: FoodIconKey =
    list?.icon && FOOD_ICON_KEYS.includes(list.icon as FoodIconKey)
      ? (list.icon as FoodIconKey)
      : suggestedIcon;

  const [name, setName] = useState(list?.name ?? "");
  const [description, setDescription] = useState(list?.description ?? "");
  const [icon, setIcon] = useState<FoodIconKey>(initialIcon);
  const [error, setError] = useState<string | null>(null);

  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isPending) return;
    setError(null);

    const parsed = createListSchema.safeParse({
      name,
      description: description.trim() ? description.trim() : null,
      icon,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the list details.");
      return;
    }

    try {
      if (isEditing && list) {
        await updateMutation.mutateAsync({ id: list.id, data: parsed.data });
        toast("List updated");
      } else {
        const created = await createMutation.mutateAsync(parsed.data);
        toast(`Created "${created.name}"`);
        onCreated?.(created);
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save list.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <div className="mb-4">
          <SheetTitle>{isEditing ? "Edit list" : "New list"}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Update your list title, notes, or icon."
              : "Organize spots for trips, neighborhoods, or cravings."}
          </SheetDescription>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 pb-3">
          <div className="space-y-1.5">
            <Label htmlFor="list-name-input">List name</Label>
            <Input
              id="list-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. NY 2026 Travel, Date Night"
              maxLength={80}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="list-description-input">Description (optional)</Label>
            <Input
              id="list-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short theme or trip dates"
              maxLength={300}
            />
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <div
              role="radiogroup"
              aria-label="List icon"
              className="grid grid-cols-4 gap-2 sm:grid-cols-6"
            >
              {FOOD_ICON_KEYS.map((key) => {
                const selected = icon === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setIcon(key)}
                    className={cn(
                      "flex min-h-12 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                      selected
                        ? "border-accent bg-accent/12 text-accent"
                        : "border-border bg-surface text-muted hover:text-ink",
                    )}
                  >
                    <FoodIcon name={key} className="size-4.5" />
                    <span className="truncate">{FOOD_ICON_LABELS[key]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          ) : null}

          <div className="sticky bottom-0 -mx-1 bg-surface pt-2 pb-1">
            <Button type="submit" size="lg" className="w-full" disabled={isPending}>
              {isPending ? "Saving..." : isEditing ? "Save changes" : "Create list"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
