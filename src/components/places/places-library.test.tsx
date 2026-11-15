import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlacesLibrary } from "./places-library";
import type { UserRestaurantItem } from "@/lib/queries/restaurants";

const replaceMock = vi.fn();
let currentSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => "/places",
  useRouter: () => ({
    replace: (href: string) => {
      replaceMock(href);
      const queryIndex = href.indexOf("?");
      currentSearchParams = new URLSearchParams(queryIndex >= 0 ? href.slice(queryIndex + 1) : "");
    },
    prefetch: vi.fn(),
  }),
  useSearchParams: () => currentSearchParams,
}));

const SAMPLE_RESTAURANTS: UserRestaurantItem[] = [
  {
    id: "r1",
    placeId: "p1",
    googlePlaceId: "ChIJ0000000001",
    googleMapsUri: null,
    lat: 37.76,
    lng: -122.42,
    name: "Tartine Bakery",
    address: "600 Guerrero St, San Francisco, CA",
    city: "San Francisco",
    countryCode: "US",
    cuisines: ["Bakery", "Café"],
    priceLevel: 2,
    status: "tried",
    ratingHalf: 9,
    notes: "Morning bun",
    visitCount: 1,
    lastVisitedOn: "2026-11-10",
    createdAt: "2026-11-10T00:00:00.000Z",
    updatedAt: "2026-11-14T00:00:00.000Z",
  },
  {
    id: "r2",
    placeId: "p2",
    googlePlaceId: "ChIJ0000000002",
    googleMapsUri: null,
    lat: 35.68,
    lng: 139.69,
    name: "Fuunji",
    address: "Shibuya, Tokyo",
    city: "Tokyo",
    countryCode: "JP",
    cuisines: ["Ramen"],
    priceLevel: 1,
    status: "to_try",
    ratingHalf: null,
    notes: "Tsukemen specialist",
    visitCount: 0,
    lastVisitedOn: null,
    createdAt: "2026-11-11T00:00:00.000Z",
    updatedAt: "2026-11-13T00:00:00.000Z",
  },
];

function renderLibrary(initialQuery = "") {
  currentSearchParams = new URLSearchParams(initialQuery);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PlacesLibrary initialRestaurants={SAMPLE_RESTAURANTS} />
    </QueryClientProvider>,
  );
}

describe("PlacesLibrary", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    currentSearchParams = new URLSearchParams();
  });

  it("renders summary and filters spots by search query matching city or cuisine", () => {
    renderLibrary();

    expect(screen.getByText("2 saved spots across 2 cities.")).toBeInTheDocument();
    expect(screen.getByText("Tartine Bakery")).toBeInTheDocument();
    expect(screen.getByText("Fuunji")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search saved restaurants"), {
      target: { value: "Tokyo" },
    });

    expect(screen.queryByText("Tartine Bakery")).not.toBeInTheDocument();
    expect(screen.getByText("Fuunji")).toBeInTheDocument();
  });

  it("groups spots dynamically by City and updates URL query parameters", () => {
    const { rerender } = renderLibrary("group=city");

    expect(screen.getByText("2 cities · 2 spots")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "San Francisco" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tokyo" })).toBeInTheDocument();

    const sfToggle = screen.getByRole("button", { name: /San Francisco/, expanded: true });
    fireEvent.click(sfToggle);
    expect(screen.queryByText("Tartine Bakery")).not.toBeInTheDocument();

    currentSearchParams = new URLSearchParams("group=cuisine");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    rerender(
      <QueryClientProvider client={client}>
        <PlacesLibrary initialRestaurants={SAMPLE_RESTAURANTS} />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("heading", { name: "Bakery" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Café" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ramen" })).toBeInTheDocument();
  });
});
