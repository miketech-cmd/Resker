"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Globe,
  GripVertical,
  List as ListIcon,
  Map as MapIcon,
  MapPin,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FoodIcon } from "@/components/icons/food-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { StarRating } from "@/components/ui/star-rating";
import { toast } from "@/components/ui/toast";
import { generateKeyBetween } from "@/lib/fractional-index";
import { formatPriceLevel, mapCuisinesToFoodIcon } from "@/lib/places/cuisines";
import { buildMapsDirectionsUrl, buildMapsPlaceUrl } from "@/lib/places/maps-links";
import {
  useDeleteListMutation,
  useListDetailQuery,
  useRemoveFromListMutation,
  useReorderListItemMutation,
  type ListDetailResponse,
  type ListRestaurantEntry,
} from "@/lib/queries/lists";
import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/validation/places";

const ListFormSheet = dynamic(
  () => import("@/components/lists/list-form-sheet").then((mod) => mod.ListFormSheet),
  { ssr: false },
);

function SortableListRow({
  item,
  index,
  onRemove,
  removing,
}: {
  item: ListRestaurantEntry;
  index: number;
  onRemove: (restaurantId: string, name: string) => void;
  removing: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priceLabel = formatPriceLevel(item.priceLevel);

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-start gap-2 rounded-2xl border border-border bg-surface p-3 shadow-2xs transition-colors dark:border-[#413830]",
        isDragging && "z-10 border-accent shadow-md opacity-95",
      )}
    >
      <button
        type="button"
        aria-label={`Reorder ${item.name}`}
        className="mt-0.5 flex min-h-11 min-w-10 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl text-muted hover:bg-surface-elevated hover:text-ink active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-ring"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-xs font-semibold text-muted tabular-nums">
              {index + 1}
            </span>
            <Link
              href={`/places/${item.id}`}
              className="min-w-0 truncate font-serif text-base font-medium text-ink hover:text-accent"
            >
              {item.name}
            </Link>
          </div>
          <Chip tone={item.status} className="shrink-0 px-2 py-0.5 text-[11px]">
            {STATUS_LABELS[item.status]}
          </Chip>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
          <FoodIcon name={mapCuisinesToFoodIcon(item.cuisines)} className="size-3.5 text-accent" />
          {item.city ? <span>{item.city}</span> : null}
          {priceLabel ? <span className="font-medium text-ink">{priceLabel}</span> : null}
          {item.ratingHalf ? (
            <StarRating value={item.ratingHalf} readOnly size="sm" label={item.name} />
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <a
          href={buildMapsPlaceUrl(item)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${item.name} in Google Maps`}
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full text-accent hover:bg-surface-elevated"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
        </a>
        <button
          type="button"
          onClick={() => onRemove(item.id, item.name)}
          disabled={removing}
          aria-label={`Remove ${item.name} from list`}
          className="inline-flex min-h-10 min-w-10 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-surface-elevated hover:text-danger"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

export function ListDetail({ initialDetail }: { initialDetail: ListDetailResponse }) {
  const router = useRouter();
  const { data = initialDetail } = useListDetailQuery(initialDetail.list.id, initialDetail);
  const list = data?.list ?? initialDetail.list;
  const items = data?.items ?? initialDetail.items;

  const removeMutation = useRemoveFromListMutation();
  const reorderMutation = useReorderListItemMutation(list.id);
  const deleteListMutation = useDeleteListMutation();

  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    const prevNeighbor = reordered[newIndex - 1] ?? null;
    const nextNeighbor = reordered[newIndex + 1] ?? null;
    const nextPosition = generateKeyBetween(
      prevNeighbor?.position ?? null,
      nextNeighbor?.position ?? null,
    );

    const updatedItems = reordered.map((entry, idx) =>
      idx === newIndex ? { ...entry, position: nextPosition } : entry,
    );

    reorderMutation.mutate({
      payload: {
        userRestaurantId: String(active.id),
        afterItemId: prevNeighbor?.id ?? null,
        beforeItemId: nextNeighbor?.id ?? null,
        position: nextPosition,
      },
      nextItems: updatedItems,
    });
  }

  async function handleRemoveItem(userRestaurantId: string, name: string) {
    try {
      await removeMutation.mutateAsync({ listId: list.id, userRestaurantId });
      toast(`Removed ${name} from "${list.name}"`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove spot.");
    }
  }

  async function handleDeleteList() {
    try {
      await deleteListMutation.mutateAsync(list.id);
      toast(`Deleted "${list.name}"`);
      router.replace("/lists");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete list.");
    }
  }

  async function handleCopyShareLink() {
    if (!list.publicSlug) return;
    const shareUrl = `${window.location.origin}/s/${list.publicSlug}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShareLink(true);
      toast("Public share link copied");
      window.setTimeout(() => setCopiedShareLink(false), 2000);
    } catch {
      toast.error(`Share link: /s/${list.publicSlug}`);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/lists"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Lists
        </Link>

        <div className="flex items-center gap-2">
          {list.isPublic && list.publicSlug ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleCopyShareLink()}
              className="gap-1.5"
            >
              {copiedShareLink ? (
                <Check
                  className="size-3.5 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
              ) : (
                <Copy className="size-3.5" aria-hidden="true" />
              )}
              {copiedShareLink ? "Copied" : "Copy share link"}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="gap-1.5"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setConfirmDelete((v) => !v)}
            className="gap-1.5 text-danger hover:bg-danger/10"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            Delete
          </Button>
        </div>
      </div>

      {confirmDelete ? (
        <Card className="space-y-3 border-danger/35 bg-danger/5">
          <p className="text-sm font-medium text-ink">
            Delete <span className="font-semibold">{list.name}</span>?
          </p>
          <p className="text-xs text-muted">All of your saved restaurants remain safe in Places.</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setConfirmDelete(false)}
              disabled={deleteListMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="flex-1"
              onClick={() => void handleDeleteList()}
              disabled={deleteListMutation.isPending}
            >
              {deleteListMutation.isPending ? "Deleting..." : "Yes, delete list"}
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="space-y-4">
        <div className="flex items-start gap-3.5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-elevated text-accent">
            <FoodIcon name={list.icon} className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-serif text-2xl font-medium tracking-tight text-ink sm:text-3xl">
                {list.name}
              </h1>
              {list.isPublic ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  <Globe className="size-3" aria-hidden="true" />
                  Public
                </span>
              ) : null}
            </div>
            {list.description ? (
              <p className="mt-1 text-sm text-muted">{list.description}</p>
            ) : null}
            <p className="mt-1.5 text-xs font-medium text-muted tabular-nums">
              {items.length} {items.length === 1 ? "spot" : "spots"}
              {list.isPublic && list.city ? ` · ${list.city}` : ""}
            </p>
          </div>
        </div>

        <div className="inline-flex rounded-full border border-border bg-surface-elevated p-0.5">
          <button
            type="button"
            aria-pressed={viewMode === "list"}
            onClick={() => setViewMode("list")}
            className={cn(
              "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-colors",
              viewMode === "list" ? "bg-ink text-bg shadow-2xs" : "text-muted hover:text-ink",
            )}
          >
            <ListIcon className="size-3.5" aria-hidden="true" />
            Order list
          </button>
          <button
            type="button"
            aria-pressed={viewMode === "map"}
            onClick={() => setViewMode("map")}
            className={cn(
              "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-colors",
              viewMode === "map" ? "bg-ink text-bg shadow-2xs" : "text-muted hover:text-ink",
            )}
          >
            <MapIcon className="size-3.5" aria-hidden="true" />
            Map spots
          </button>
        </div>
      </Card>

      {items.length === 0 ? (
        <EmptyState
          title="This list has no spots yet"
          description="Open any spot in Places and tap Lists to add it here."
          action={
            <Link
              href="/places"
              className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-ink"
            >
              Browse Places
            </Link>
          }
        />
      ) : viewMode === "list" ? (
        <div className="space-y-2.5">
          <p className="px-1 text-xs text-muted">Drag handles to reorder spots in this list.</p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <ol className="space-y-2.5" aria-label={`${list.name} spots`}>
                {items.map((item, idx) => (
                  <SortableListRow
                    key={item.id}
                    item={item}
                    index={idx}
                    onRemove={(id, name) => void handleRemoveItem(id, name)}
                    removing={removeMutation.isPending}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-elevated/55 px-4 py-3 dark:bg-[#191512]">
            <p className="text-xs text-muted">
              Plot these {items.length} {items.length === 1 ? "spot" : "spots"} together or launch
              turn-by-turn directions below.
            </p>
            <Link
              href={`/map?list=${list.id}`}
              className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 text-xs font-medium text-accent-ink shadow-2xs transition-opacity hover:opacity-95 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <MapIcon className="size-3.5" aria-hidden="true" />
              Open interactive map
            </Link>
          </div>
          <ul className="space-y-2.5">
            {items.map((item) => (
              <li key={item.id}>
                <Card className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/places/${item.id}`}
                      className="truncate font-serif text-base font-medium text-ink hover:text-accent"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                      <MapPin className="size-3.5 shrink-0 text-accent" aria-hidden="true" />
                      <span className="truncate">
                        {item.address ?? item.city ?? "Saved location"}
                      </span>
                    </p>
                  </div>
                  <a
                    href={buildMapsDirectionsUrl(item)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full border border-border bg-surface-elevated px-3 text-xs font-medium text-ink hover:border-accent/50"
                  >
                    Directions
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      )}

      {editOpen ? (
        <ListFormSheet
          key={`${list.id}-${list.updatedAt}`}
          list={list}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      ) : null}
    </div>
  );
}
