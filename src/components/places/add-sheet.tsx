"use client";

import {
  AlertCircle,
  BookmarkCheck,
  ClipboardPaste,
  Link2,
  LocateFixed,
  MapPin,
  Search,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { FoodIcon } from "@/components/icons/food-icons";
import { ConfirmPlaceForm } from "@/components/places/confirm-place-form";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input, Label } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { mapCuisinesToFoodIcon } from "@/lib/places/cuisines";
import { parseGoogleMapsUrlMetadata, validateGoogleMapsUrl } from "@/lib/places/url-parser";
import {
  readApiResponse,
  usePlacesAutocompleteQuery,
  type AutocompleteSuggestionItem,
  type PlacePrefillData,
  type ResolvePlaceResponse,
  type UserRestaurantItem,
} from "@/lib/queries/restaurants";
import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/validation/places";

function ResolvingSkeleton() {
  return (
    <div className="space-y-4 py-2" aria-label="Loading restaurant details">
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface-elevated/60 p-3.5">
        <Skeleton className="size-11 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-12 w-full rounded-full" />
    </div>
  );
}

export function AddSheet() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const rawShareUrl = searchParams.get("url") ?? "";
  const rawShareText = searchParams.get("text") ?? "";
  const rawShareTitle = searchParams.get("title") ?? "";
  const extractedShareUrl =
    rawShareUrl.trim() || rawShareText.match(/https?:\/\/[^\s<>()]+/i)?.[0]?.trim() || "";
  const shareSearchFallback = !extractedShareUrl ? rawShareTitle.trim() || rawShareText.trim() : "";
  const quickAddPlaceId = searchParams.get("placeId")?.trim() ?? "";
  const quickAddSession = searchParams.get("session")?.trim() ?? "";
  const hasSharePayload = Boolean(extractedShareUrl || shareSearchFallback);
  const isOpen = searchParams.get("add") === "1" || hasSharePayload || Boolean(quickAddPlaceId);

  const [tab, setTab] = useState<"link" | "search">("search");
  const [linkInput, setLinkInput] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string>(() => crypto.randomUUID());
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const [alreadySaved, setAlreadySaved] = useState<UserRestaurantItem | null>(null);
  const [prefill, setPrefill] = useState<PlacePrefillData | null>(null);
  const handledShareRef = useRef<string | null>(null);
  const handledQuickAddRef = useRef<string | null>(null);

  const resetSheetState = useCallback(() => {
    setLinkError(null);
    setSearchError(null);
    setAlreadySaved(null);
    setPrefill(null);
    setIsResolving(false);
    setSessionToken(crypto.randomUUID());
    handledQuickAddRef.current = null;
  }, []);

  const closeSheet = useCallback(
    (highlightId?: string) => {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("add");
      next.delete("url");
      next.delete("text");
      next.delete("title");
      next.delete("placeId");
      next.delete("session");
      if (highlightId) {
        next.set("highlight", highlightId);
      }
      const qs = next.toString();
      const targetPath = highlightId ? "/places" : pathname;
      router.replace(qs ? `${targetPath}?${qs}` : targetPath, { scroll: false });
      resetSheetState();
      setLinkInput("");
      setSearchInput("");
      setTab("search");
    },
    [pathname, resetSheetState, router, searchParams],
  );

  function handleOpenChange(open: boolean) {
    if (!open) {
      closeSheet();
    }
  }

  const resolveLink = useCallback(async (rawUrl: string) => {
    setLinkError(null);
    setAlreadySaved(null);
    setPrefill(null);

    const check = validateGoogleMapsUrl(rawUrl);
    if (!check.ok) {
      setLinkError(check.message);
      return;
    }

    setIsResolving(true);
    try {
      const res = await fetch("/api/places/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: check.url.toString() }),
      });
      const data = await readApiResponse<ResolvePlaceResponse>(res);
      if (data.alreadySaved) {
        setAlreadySaved(data.existingRestaurant);
      } else {
        setPrefill(data.prefill);
      }
    } catch (error) {
      setLinkError(
        error instanceof Error
          ? error.message
          : "Couldn't read that Google Maps link. Try searching by name.",
      );
    } finally {
      setIsResolving(false);
    }
  }, []);

  // Support Android PWA Share Target (?add=1&url=... or ?text=... / ?title=...)
  useEffect(() => {
    if (!isOpen || !hasSharePayload) return;
    const shareKey = `${extractedShareUrl}|${shareSearchFallback}`;
    if (handledShareRef.current === shareKey) return;
    handledShareRef.current = shareKey;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      if (extractedShareUrl) {
        setTab("link");
        setLinkInput(extractedShareUrl);
        void resolveLink(extractedShareUrl);
      } else if (shareSearchFallback) {
        setTab("search");
        setSearchInput(shareSearchFallback);
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [extractedShareUrl, hasSharePayload, isOpen, resolveLink, shareSearchFallback]);

  const fetchPlaceDetails = useCallback(
    async (googlePlaceId: string, overrideSession?: string) => {
      setSearchError(null);
      setAlreadySaved(null);
      setPrefill(null);
      setIsResolving(true);

      try {
        const res = await fetch("/api/places/details", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            googlePlaceId,
            sessionToken: overrideSession || sessionToken,
          }),
        });
        const data = await readApiResponse<ResolvePlaceResponse>(res);
        setSessionToken(crypto.randomUUID());

        if (data.alreadySaved) {
          setAlreadySaved(data.existingRestaurant);
        } else {
          setPrefill(data.prefill);
        }
      } catch (error) {
        setSearchError(
          error instanceof Error ? error.message : "Couldn't load details for that restaurant.",
        );
      } finally {
        setIsResolving(false);
      }
    },
    [sessionToken],
  );

  // Support quick-add handoff from home unified search (?add=1&placeId=...&session=...)
  useEffect(() => {
    if (!isOpen || !quickAddPlaceId) return;
    if (handledQuickAddRef.current === quickAddPlaceId) return;
    handledQuickAddRef.current = quickAddPlaceId;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      setTab("search");
      void fetchPlaceDetails(quickAddPlaceId, quickAddSession);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [fetchPlaceDetails, isOpen, quickAddPlaceId, quickAddSession]);

  const autocomplete = usePlacesAutocompleteQuery({
    query: searchInput,
    sessionToken,
    coords: userCoords,
    enabled:
      isOpen && tab === "search" && !prefill && !alreadySaved && !isResolving && !quickAddPlaceId,
    debounceMs: 250,
  });

  const activeSearchError =
    searchError ?? (autocomplete.error instanceof Error ? autocomplete.error.message : null);

  async function handleClipboardPaste() {
    setLinkError(null);
    if (!navigator.clipboard?.readText) {
      setLinkError("Clipboard access isn't available here. Paste directly into the box.");
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setLinkError("Your clipboard is empty.");
        return;
      }
      setLinkInput(text.trim());
      await resolveLink(text);
    } catch {
      setLinkError("Allow clipboard access or paste the link directly into the box.");
    }
  }

  async function handleLinkSubmit(event: FormEvent) {
    event.preventDefault();
    await resolveLink(linkInput);
  }

  async function handleSelectSuggestion(item: AutocompleteSuggestionItem) {
    await fetchPlaceDetails(item.googlePlaceId);
  }

  function switchToSearchWithHint() {
    let hint = "";
    try {
      const check = validateGoogleMapsUrl(linkInput);
      if (check.ok) {
        hint = parseGoogleMapsUrlMetadata(check.url).placeName ?? "";
      }
    } catch {
      hint = "";
    }
    setLinkError(null);
    setTab("search");
    if (hint) {
      setSearchInput(hint);
    }
  }

  function handleRequestLocationBias() {
    if (userCoords) {
      setUserCoords(null);
      return;
    }
    if (!navigator.geolocation) {
      setSearchError("Location is not supported on this browser.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
        setSearchError("Couldn't read your location. You can still search with city names.");
      },
      { enableHighAccuracy: false, timeout: 6000 },
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent>
        <div className="mb-4">
          <SheetTitle>{prefill ? "Confirm restaurant" : "Add a restaurant"}</SheetTitle>
          <SheetDescription>
            {prefill
              ? "Review the details and choose where to save it."
              : "Paste a Google Maps link or search by name."}
          </SheetDescription>
        </div>

        {!prefill && !isResolving ? (
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-full border border-border bg-surface-elevated p-1">
            <button
              type="button"
              onClick={() => {
                setTab("search");
                setAlreadySaved(null);
              }}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                tab === "search" ? "bg-surface text-ink shadow-2xs" : "text-muted hover:text-ink",
              )}
            >
              <Search className="size-4" aria-hidden="true" />
              Search
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("link");
                setAlreadySaved(null);
              }}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                tab === "link" ? "bg-surface text-ink shadow-2xs" : "text-muted hover:text-ink",
              )}
            >
              <Link2 className="size-4" aria-hidden="true" />
              Paste link
            </button>
          </div>
        ) : null}

        {isResolving ? (
          <ResolvingSkeleton />
        ) : prefill ? (
          <ConfirmPlaceForm
            prefill={prefill}
            onBack={() => {
              setPrefill(null);
              if (quickAddPlaceId) {
                const next = new URLSearchParams(searchParams.toString());
                next.delete("placeId");
                next.delete("session");
                const qs = next.toString();
                router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
              }
            }}
            onSaved={(saved) => closeSheet(saved.id)}
          />
        ) : alreadySaved ? (
          <div className="space-y-4 rounded-2xl border border-border bg-surface-elevated/60 p-4 pb-5">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface text-accent">
                <BookmarkCheck className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted">Already saved in your library</p>
                <h3 className="mt-0.5 truncate font-serif text-lg font-medium text-ink">
                  {alreadySaved.name}
                </h3>
                {alreadySaved.address ? (
                  <p className="mt-0.5 truncate text-xs text-muted">{alreadySaved.address}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Chip tone={alreadySaved.status}>{STATUS_LABELS[alreadySaved.status]}</Chip>
                  {alreadySaved.cuisines[0] ? (
                    <Chip tone="neutral">{alreadySaved.cuisines[0]}</Chip>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setAlreadySaved(null)}
              >
                Try another
              </Button>
              <Button type="button" className="flex-1" onClick={() => closeSheet(alreadySaved.id)}>
                Open saved entry
              </Button>
            </div>
          </div>
        ) : tab === "link" ? (
          <form onSubmit={handleLinkSubmit} className="space-y-3 pb-3">
            <div className="space-y-1.5">
              <Label htmlFor="google-maps-link-input">Google Maps URL</Label>
              <div className="flex gap-2">
                <Input
                  id="google-maps-link-input"
                  type="url"
                  value={linkInput}
                  onChange={(e) => {
                    setLinkInput(e.target.value);
                    if (linkError) setLinkError(null);
                  }}
                  placeholder="https://maps.app.goo.gl/..."
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleClipboardPaste}
                  aria-label="Paste from clipboard"
                >
                  <ClipboardPaste className="size-4" aria-hidden="true" />
                  Paste
                </Button>
              </div>
            </div>

            {linkError ? (
              <div
                role="alert"
                className="space-y-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{linkError}</span>
                </div>
                <button
                  type="button"
                  onClick={switchToSearchWithHint}
                  className="inline-flex min-h-9 cursor-pointer items-center text-xs font-semibold text-ink underline underline-offset-2"
                >
                  Search by restaurant name instead
                </button>
              </div>
            ) : (
              <p className="text-xs text-muted">
                Copy any place link from Google Maps (`maps.app.goo.gl` or `google.com/maps`) and
                tap Paste or Look up.
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={!linkInput.trim()}>
              Look up place
            </Button>
          </form>
        ) : (
          <div className="space-y-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Label htmlFor="place-search-input" className="sr-only">
                  Search restaurants
                </Label>
                <Search
                  className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
                <Input
                  id="place-search-input"
                  type="search"
                  value={searchInput}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setSearchInput(nextValue);
                    if (nextValue.trim().length < 3) {
                      setSearchError(null);
                    }
                  }}
                  placeholder="Type at least 3 letters (e.g. Tartine)"
                  className="pl-10 pr-10"
                />
                {searchInput ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => {
                      setSearchInput("");
                      setSearchError(null);
                    }}
                    className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted hover:text-ink"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              <Button
                type="button"
                variant={userCoords ? "primary" : "outline"}
                size="icon"
                onClick={handleRequestLocationBias}
                disabled={isLocating}
                aria-label={userCoords ? "Disable nearby location bias" : "Bias search near me"}
                title={userCoords ? "Near me active" : "Bias near me"}
              >
                <LocateFixed className="size-4" aria-hidden="true" />
              </Button>
            </div>

            {activeSearchError ? (
              <p
                role="alert"
                className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger"
              >
                {activeSearchError}
              </p>
            ) : null}

            {autocomplete.isLoading ? (
              <div className="space-y-2 py-1" aria-label="Searching restaurants">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : searchInput.trim().length > 0 && searchInput.trim().length < 3 ? (
              <p className="py-3 text-center text-xs text-muted">
                Keep typing ({3 - searchInput.trim().length} more character
                {3 - searchInput.trim().length === 1 ? "" : "s"})...
              </p>
            ) : autocomplete.suggestions.length > 0 ? (
              <div className="space-y-1.5">
                <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                  {autocomplete.suggestions.map((item) => (
                    <li key={item.googlePlaceId}>
                      <button
                        type="button"
                        onClick={() => handleSelectSuggestion(item)}
                        className="flex min-h-14 w-full cursor-pointer items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-elevated/70 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-ring"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-elevated text-accent">
                          <FoodIcon
                            name={mapCuisinesToFoodIcon(item.cuisines)}
                            className="size-4"
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">
                            {item.mainText}
                          </span>
                          {item.secondaryText ? (
                            <span className="block truncate text-xs text-muted">
                              {item.secondaryText}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="flex items-center justify-end gap-1 px-1 text-[11px] text-muted">
                  <MapPin className="size-3" aria-hidden="true" />
                  Powered by Google
                </p>
              </div>
            ) : searchInput.trim().length >= 3 ? (
              <p className="py-4 text-center text-sm text-muted">
                No restaurants matched &ldquo;{searchInput.trim()}&rdquo;. Try adding a city name.
              </p>
            ) : (
              <p className="py-3 text-xs text-muted">
                Search for any restaurant, café, bakery, or bar. Tap{" "}
                <span className="font-medium text-ink">Near me</span> to prioritize local spots.
              </p>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
