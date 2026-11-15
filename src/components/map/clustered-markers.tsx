"use client";

import { MarkerClusterer, type Cluster } from "@googlemaps/markerclusterer";
import {
  APILoadingStatus,
  AdvancedMarker,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { FoodIcon } from "@/components/icons/food-icons";
import { mapCuisinesToFoodIcon } from "@/lib/places/cuisines";
import type { UserRestaurantItem } from "@/lib/queries/restaurants";
import { cn } from "@/lib/utils";
import type { RestaurantStatus } from "@/lib/validation/places";

export interface MappableRestaurant extends UserRestaurantItem {
  lat: number;
  lng: number;
}

const PIN_STATUS_STYLE: Record<RestaurantStatus, string> = {
  to_try: "bg-[#E9A23B] text-[#1F1B16] border-[#FFFDF8]",
  exploration: "bg-[#5B6CD9] text-white border-[#FFFDF8]",
  tried: "bg-[#3B7D4F] text-white border-[#FFFDF8]",
};

function createClusterElement(count: number, sizePx: number) {
  const badge = document.createElement("div");
  badge.style.width = `${sizePx}px`;
  badge.style.height = `${sizePx}px`;
  badge.style.borderRadius = "9999px";
  badge.style.backgroundColor = "#1F1B16";
  badge.style.color = "#FAF7F2";
  badge.style.border = "2.5px solid #E4572E";
  badge.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.28)";
  badge.style.display = "flex";
  badge.style.alignItems = "center";
  badge.style.justifyContent = "center";
  badge.style.fontWeight = "700";
  badge.style.fontSize = count >= 100 ? "12px" : "13px";
  badge.style.fontFamily = "var(--font-inter), ui-sans-serif, system-ui, sans-serif";
  badge.style.cursor = "pointer";
  badge.textContent = String(count);
  return badge;
}

export function fitMapToRestaurants(
  map: google.maps.Map,
  items: MappableRestaurant[],
  padding = { top: 145, right: 28, bottom: 170, left: 28 },
) {
  if (items.length === 0) return;

  try {
    if (items.length === 1) {
      const only = items[0]!;
      map.panTo({ lat: only.lat, lng: only.lng });
      map.setZoom(15);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    for (const item of items) {
      bounds.extend({ lat: item.lat, lng: item.lng });
    }
    map.fitBounds(bounds, padding);
  } catch {
    // Ignore Google Maps SDK errors when map instance is torn down or unauthorized.
  }
}

export function ClusteredMarkers({
  items,
  selectedId,
  onSelect,
  fitTrigger,
}: {
  items: MappableRestaurant[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  fitTrigger: number;
}) {
  const map = useMap();
  const apiStatus = useApiLoadingStatus();
  const markerLib = useMapsLibrary("marker");
  const isApiReady =
    apiStatus === APILoadingStatus.LOADED && Boolean(markerLib?.AdvancedMarkerElement);

  const markersRef = useRef<Record<string, google.maps.marker.AdvancedMarkerElement>>({});
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const lastFitSignatureRef = useRef<string>("");

  const renderer = useMemo(
    () => ({
      render({ count, position }: Cluster) {
        const sizePx = count >= 50 ? 44 : count >= 10 ? 38 : 34;
        const MarkerClass =
          markerLib?.AdvancedMarkerElement ?? google.maps.marker.AdvancedMarkerElement;
        return new MarkerClass({
          position,
          content: createClusterElement(count, sizePx),
          zIndex: 1000 + count,
        });
      },
    }),
    [markerLib],
  );

  useEffect(() => {
    if (!map || !isApiReady) return;

    const clusterer = new MarkerClusterer({
      map,
      markers: [],
      renderer,
    });
    clustererRef.current = clusterer;

    return () => {
      try {
        clusterer.clearMarkers(true);
        clusterer.setMap(null);
      } catch {
        // Ignore teardown errors when Google Maps JS SDK rejects origin/auth.
      } finally {
        clustererRef.current = null;
      }
    };
  }, [isApiReady, map, renderer]);

  const syncClusterer = useCallback(() => {
    const clusterer = clustererRef.current;
    if (!clusterer || !isApiReady) return;

    const activeIds = new Set(items.map((item) => item.id));
    const visibleMarkers: google.maps.marker.AdvancedMarkerElement[] = [];

    for (const [id, marker] of Object.entries(markersRef.current)) {
      if (activeIds.has(id)) {
        visibleMarkers.push(marker);
      } else {
        delete markersRef.current[id];
      }
    }

    try {
      clusterer.clearMarkers(true);
      if (visibleMarkers.length > 0) {
        clusterer.addMarkers(visibleMarkers);
      }
    } catch {
      // Ignore clustering errors if Google Maps SDK was invalidated.
    }
  }, [isApiReady, items]);

  const setMarkerRef = useCallback(
    (id: string) => (marker: google.maps.marker.AdvancedMarkerElement | null) => {
      if (marker) {
        if (markersRef.current[id] !== marker) {
          markersRef.current[id] = marker;
          syncClusterer();
        }
      } else if (markersRef.current[id]) {
        delete markersRef.current[id];
        syncClusterer();
      }
    },
    [syncClusterer],
  );

  // Refit map bounds when visible pin set changes cleanly or user taps Fit all.
  useEffect(() => {
    if (!map || !isApiReady || items.length === 0) return;
    const signature = `${fitTrigger}:${items.map((i) => i.id).join(",")}`;
    if (lastFitSignatureRef.current === signature) return;
    lastFitSignatureRef.current = signature;
    fitMapToRestaurants(map, items);
  }, [fitTrigger, isApiReady, items, map]);

  // Keep clusterer synced whenever items list shrinks/grows cleanly.
  useEffect(() => {
    syncClusterer();
  }, [syncClusterer]);

  if (!isApiReady) {
    return null;
  }

  return (
    <>
      {items.map((item) => {
        const selected = selectedId === item.id;
        return (
          <AdvancedMarker
            key={item.id}
            ref={setMarkerRef(item.id)}
            position={{ lat: item.lat, lng: item.lng }}
            title={item.name}
            zIndex={selected ? 500 : undefined}
            onClick={() => {
              onSelect(item.id);
              map?.panTo({ lat: item.lat, lng: item.lng });
            }}
          >
            <div
              className={cn(
                "flex size-9 cursor-pointer items-center justify-center rounded-full border-2 shadow-md transition-transform duration-150",
                PIN_STATUS_STYLE[item.status],
                selected && "scale-125 ring-4 ring-accent/35",
              )}
            >
              <FoodIcon name={mapCuisinesToFoodIcon(item.cuisines)} className="size-4.5" />
            </div>
          </AdvancedMarker>
        );
      })}
    </>
  );
}
