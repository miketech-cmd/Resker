import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PersistentMap } from "@/components/map/persistent-map";
import { DEFAULT_LIBRARY_FILTERS } from "@/lib/places/facets";
import { getSharedFilters, setSharedFilters } from "@/lib/places/filter-store";
import { listQueryKeys, type ListDetailResponse } from "@/lib/queries/lists";
import { restaurantQueryKeys, type UserRestaurantItem } from "@/lib/queries/restaurants";

let currentQueryString = "";
const urlListeners = new Set<() => void>();
const replaceMock = vi.fn();
let apiProviderMountCount = 0;

function setTestQueryString(qs: string) {
  currentQueryString = qs;
  for (const listener of urlListeners) {
    listener();
  }
}

function subscribeUrl(listener: () => void) {
  urlListeners.add(listener);
  return () => {
    urlListeners.delete(listener);
  };
}

vi.mock("next/navigation", () => ({
  usePathname: () => "/map",
  useRouter: () => ({
    replace: (href: string) => {
      replaceMock(href);
      const queryIndex = href.indexOf("?");
      setTestQueryString(queryIndex >= 0 ? href.slice(queryIndex + 1) : "");
    },
    prefetch: vi.fn(),
  }),
  useSearchParams: () => {
    const qs = useSyncExternalStore(
      subscribeUrl,
      () => currentQueryString,
      () => currentQueryString,
    );
    return new URLSearchParams(qs);
  },
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

vi.mock("vaul", () => ({
  Drawer: {
    Root: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
      open ? <div role="dialog">{children}</div> : null,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Overlay: () => null,
    Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Title: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    Description: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  },
}));

const mockMapInstance = {
  panTo: vi.fn(),
  setZoom: vi.fn(),
  fitBounds: vi.fn(),
};

vi.mock("@vis.gl/react-google-maps", () => ({
  APILoadingStatus: {
    NOT_LOADED: "NOT_LOADED",
    LOADING: "LOADING",
    LOADED: "LOADED",
    FAILED: "FAILED",
    AUTH_FAILURE: "AUTH_FAILURE",
  },
  ColorScheme: {
    LIGHT: "LIGHT",
    DARK: "DARK",
  },
  APIProvider: ({ children }: { children: React.ReactNode }) => {
    useEffect(() => {
      apiProviderMountCount += 1;
    }, []);
    return <div data-testid="mock-api-provider">{children}</div>;
  },
  Map: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-google-map">{children}</div>
  ),
  AdvancedMarker: ({
    title,
    onClick,
    children,
  }: {
    title?: string;
    onClick?: () => void;
    children: React.ReactNode;
  }) => (
    <button type="button" data-testid={`marker-${title}`} onClick={onClick}>
      {children}
    </button>
  ),
  useApiLoadingStatus: () => "LOADED",
  useMapsLibrary: () => ({
    AdvancedMarkerElement: class MockAdvancedMarkerElement {},
  }),
  useMap: () => mockMapInstance,
}));

vi.mock("@googlemaps/markerclusterer", () => ({
  MarkerClusterer: class MockMarkerClusterer {
    clearMarkers = vi.fn();
    addMarkers = vi.fn();
    setMap = vi.fn();
  },
}));

const SAMPLE_RESTAURANTS: UserRestaurantItem[] = [
  {
    id: "r1",
    placeId: "p1",
    googlePlaceId: "ChIJ0000000001",
    googleMapsUri: "https://maps.google.com/?cid=1",
    lat: 40.746,
    lng: -73.984,
    name: "Hangawi",
    address: "12 E 32nd St, New York, NY 10016, USA",
    city: "New York",
    countryCode: "US",
    cuisines: ["Korean", "Vegetarian"],
    priceLevel: 2,
    status: "to_try",
    ratingHalf: null,
    notes: "Quiet Korean vegetarian spot",
    visitCount: 0,
    lastVisitedOn: null,
    createdAt: "2026-11-12T00:00:00.000Z",
    updatedAt: "2026-11-14T00:00:00.000Z",
  },
  {
    id: "r2",
    placeId: "p2",
    googlePlaceId: "ChIJ0000000002",
    googleMapsUri: null,
    lat: 47.628,
    lng: -122.142,
    name: "Honest Restaurant",
    address: "2241 148th Ave NE, Bellevue, WA 98007, USA",
    city: "Bellevue",
    countryCode: "US",
    cuisines: ["Indian"],
    priceLevel: 1,
    status: "tried",
    ratingHalf: 9,
    notes: "Pav bhaji and dosa",
    visitCount: 1,
    lastVisitedOn: "2026-11-10",
    createdAt: "2026-11-10T00:00:00.000Z",
    updatedAt: "2026-11-14T00:00:00.000Z",
  },
  {
    id: "r3",
    placeId: "p3",
    googlePlaceId: "ChIJ0000000003",
    googleMapsUri: null,
    lat: null,
    lng: null,
    name: "Mystery Noodle Bar",
    address: "Seattle, WA",
    city: "Seattle",
    countryCode: "US",
    cuisines: ["Ramen"],
    priceLevel: 2,
    status: "exploration",
    ratingHalf: null,
    notes: null,
    visitCount: 0,
    lastVisitedOn: null,
    createdAt: "2026-11-11T00:00:00.000Z",
    updatedAt: "2026-11-11T00:00:00.000Z",
  },
];

function createTestClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(restaurantQueryKeys.all, SAMPLE_RESTAURANTS);
  return client;
}

describe("PersistentMap", () => {
  const origKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  const origMapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;

  beforeEach(() => {
    apiProviderMountCount = 0;
    currentQueryString = "";
    replaceMock.mockClear();
    setSharedFilters(DEFAULT_LIBRARY_FILTERS);
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY = "test-browser-key";
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID = "test-map-id";
    vi.stubGlobal("google", {
      maps: {
        LatLngBounds: class MockBounds {
          extend = vi.fn();
        },
        marker: {
          AdvancedMarkerElement: class MockAdvancedMarker {},
        },
      },
    });
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY = origKey;
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID = origMapId;
    vi.unstubAllGlobals();
  });

  it("renders markers for mappable spots and notes missing coordinates", () => {
    const client = createTestClient();
    render(
      <QueryClientProvider client={client}>
        <PersistentMap isActive />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId("marker-Hangawi")).toBeInTheDocument();
    expect(screen.getByTestId("marker-Honest Restaurant")).toBeInTheDocument();
    expect(screen.queryByTestId("marker-Mystery Noodle Bar")).not.toBeInTheDocument();
    expect(screen.getByText(/1 spot has no saved pin coordinates yet/i)).toBeInTheDocument();
  });

  it("filters pins via status pills & search input and syncs shared filters", async () => {
    const client = createTestClient();
    render(
      <QueryClientProvider client={client}>
        <PersistentMap isActive />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "To Try" }));
    await waitFor(() => {
      expect(screen.getByTestId("marker-Hangawi")).toBeInTheDocument();
      expect(screen.queryByTestId("marker-Honest Restaurant")).not.toBeInTheDocument();
    });
    expect(getSharedFilters().facets.status).toEqual(["to_try"]);

    fireEvent.click(screen.getByRole("button", { name: /^All/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search spots on map" }), {
      target: { value: "Bellevue" },
    });

    await waitFor(() => {
      expect(screen.queryByTestId("marker-Hangawi")).not.toBeInTheDocument();
      expect(screen.getByTestId("marker-Honest Restaurant")).toBeInTheDocument();
    });
  });

  it("opens MapPeekCard with Details, Maps, Directions when a marker is tapped", async () => {
    const client = createTestClient();
    render(
      <QueryClientProvider client={client}>
        <PersistentMap isActive />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByTestId("marker-Honest Restaurant"));

    const region = await screen.findByRole("region", { name: "Selected spot: Honest Restaurant" });
    expect(region).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Details" })).toHaveAttribute("href", "/places/r2");
    expect(screen.getByRole("link", { name: "Maps" })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "Directions" })).toHaveAttribute("target", "_blank");

    fireEvent.click(screen.getByRole("button", { name: "Close selected spot" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("region", { name: "Selected spot: Honest Restaurant" }),
      ).not.toBeInTheDocument();
    });
  });

  it("scopes markers when ?list=<id> is active and keeps APIProvider mounted across tab switches", async () => {
    currentQueryString = "list=list-1";
    const client = createTestClient();
    const listDetail: ListDetailResponse = {
      list: {
        id: "list-1",
        name: "NYC Dates",
        description: null,
        icon: "heart",
        itemCount: 1,
        restaurantIds: ["r1"],
        createdAt: "2026-11-12T00:00:00.000Z",
        updatedAt: "2026-11-12T00:00:00.000Z",
      },
      items: [
        {
          ...SAMPLE_RESTAURANTS[0]!,
          position: "a0",
          addedAt: "2026-11-12T00:00:00.000Z",
        },
      ],
    };
    client.setQueryData(listQueryKeys.detail("list-1"), listDetail);

    const { rerender } = render(
      <QueryClientProvider client={client}>
        <PersistentMap isActive />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId("marker-Hangawi")).toBeInTheDocument();
    expect(screen.queryByTestId("marker-Honest Restaurant")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "List: NYC Dates" })).toBeInTheDocument();

    // Hide when user leaves /map tab: APIProvider must stay mounted (only 1 mount total)
    rerender(
      <QueryClientProvider client={client}>
        <PersistentMap isActive={false} />
      </QueryClientProvider>,
    );
    expect(screen.getByTestId("mock-api-provider").closest("[aria-hidden='true']")).toBeTruthy();

    rerender(
      <QueryClientProvider client={client}>
        <PersistentMap isActive />
      </QueryClientProvider>,
    );
    expect(apiProviderMountCount).toBe(1);
  });

  it("renders a graceful fallback and keeps filters working on Google Maps auth failure", async () => {
    const client = createTestClient();
    render(
      <QueryClientProvider client={client}>
        <PersistentMap isActive />
      </QueryClientProvider>,
    );

    const win = window as unknown as { gm_authFailure?: () => void };
    win.gm_authFailure?.();

    expect(await screen.findByText("Google Maps unavailable here")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Search spots on map" }), {
      target: { value: "Hangawi" },
    });
    expect(await screen.findByText("All · 1")).toBeInTheDocument();
  });
});
