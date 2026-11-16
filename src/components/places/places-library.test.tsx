import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlacesLibrary } from "./places-library";
import type { UserRestaurantItem } from "@/lib/queries/restaurants";

let currentQueryString = "";
const urlListeners = new Set<() => void>();
const replaceMock = vi.fn();

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
  usePathname: () => "/places",
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

const SAMPLE_RESTAURANTS: UserRestaurantItem[] = [
  {
    id: "r1",
    placeId: "p1",
    googlePlaceId: "ChIJ0000000001",
    googleMapsUri: null,
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
    lat: 40.722,
    lng: -73.996,
    name: "Rubirosa",
    address: "235 Mulberry St, New York, NY 10012, USA",
    city: "New York",
    countryCode: "US",
    cuisines: ["Pizza"],
    priceLevel: 2,
    status: "to_try",
    ratingHalf: null,
    notes: "Tie-dye pizza",
    visitCount: 0,
    lastVisitedOn: null,
    createdAt: "2026-11-11T00:00:00.000Z",
    updatedAt: "2026-11-13T00:00:00.000Z",
  },
  {
    id: "r3",
    placeId: "p3",
    googlePlaceId: "ChIJ0000000003",
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
    ratingHalf: 10,
    notes: "Amazing bhaji pav",
    visitCount: 1,
    lastVisitedOn: "2026-11-10",
    createdAt: "2026-11-10T00:00:00.000Z",
    updatedAt: "2026-11-12T00:00:00.000Z",
  },
];

function renderLibrary(initialQuery = "") {
  setTestQueryString(initialQuery);
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
    setTestQueryString("");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("defaults to By City collapsed, expands all/individual groups, and auto-expands highlighted spot", () => {
    renderLibrary();

    // Defaults: By City selected, groups collapsed by default, Expand all shown
    expect(screen.getByRole("button", { name: "By City" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "New York" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bellevue" })).toBeInTheDocument();
    expect(screen.queryByText("Hangawi")).not.toBeInTheDocument();
    expect(screen.queryByText("Honest Restaurant")).not.toBeInTheDocument();

    // Expand all reveals spots in default Compact view
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    expect(screen.getByText("Hangawi")).toBeInTheDocument();
    expect(screen.getByText("Honest Restaurant")).toBeInTheDocument();

    // Collapse all collapses back
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(screen.queryByText("Hangawi")).not.toBeInTheDocument();
  });

  it("auto-expands the group containing ?highlight=id while keeping other groups collapsed", () => {
    renderLibrary("highlight=r1");
    expect(screen.getByText("Hangawi")).toBeInTheDocument();
    expect(screen.queryByText("Honest Restaurant")).not.toBeInTheDocument();
  });

  it("filters accurately via FilterSheet city selection and sticky Open filters trigger", async () => {
    renderLibrary("group=none");

    expect(screen.getByText("Hangawi")).toBeInTheDocument();
    expect(screen.getByText("Rubirosa")).toBeInTheDocument();
    expect(screen.getByText("Honest Restaurant")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open filters" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: /New York/ }));

    const applyBtn = await within(dialog).findByRole("button", { name: "Show 2 spots" });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Hangawi")).toBeInTheDocument();
    expect(screen.getByText("Rubirosa")).toBeInTheDocument();
    expect(screen.queryByText("Honest Restaurant")).not.toBeInTheDocument();
  });

  it("searches by city or cuisine and switches dynamic Group by sections", () => {
    renderLibrary();

    fireEvent.change(screen.getByLabelText("Search saved restaurants"), {
      target: { value: "Bellevue" },
    });

    expect(screen.queryByText("Hangawi")).not.toBeInTheDocument();
    expect(screen.getByText("Honest Restaurant")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    fireEvent.click(screen.getByRole("button", { name: "By City" }));

    expect(screen.getByText("2 cities · 3 spots")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "New York" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bellevue" })).toBeInTheDocument();

    // Expanding New York reveals New York cards cleanly while Bellevue stays collapsed
    fireEvent.click(screen.getByRole("button", { name: /New York/, expanded: false }));
    expect(screen.getByText("Hangawi")).toBeInTheDocument();
    expect(screen.queryByText("Honest Restaurant")).not.toBeInTheDocument();

    // Collapsing New York hides New York cards again
    fireEvent.click(screen.getByRole("button", { name: /New York/, expanded: true }));
    expect(screen.queryByText("Hangawi")).not.toBeInTheDocument();

    // Switching to By Cuisine shows all matching cuisines (collapsed by default)
    fireEvent.click(screen.getByRole("button", { name: "By Cuisine" }));
    expect(screen.getByRole("heading", { name: "Korean" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vegetarian" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pizza" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Indian" })).toBeInTheDocument();
  });

  it("isolates a single group via Filter only and filters via Status tabs", () => {
    renderLibrary("group=city");

    const filterOnlyBtn = screen.getByTitle("Filter only Bellevue");
    fireEvent.click(filterOnlyBtn);

    expect(screen.queryByText("Hangawi")).not.toBeInTheDocument();
    expect(screen.getByText("Honest Restaurant")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.getByText("Hangawi")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Tried/ }));
    expect(screen.queryByText("Hangawi")).not.toBeInTheDocument();
    expect(screen.getByText("Honest Restaurant")).toBeInTheDocument();
  });

  it("breaks out Saved Places and Google Maps results and triggers quick-add handoff", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.startsWith("/api/places/autocomplete")) {
        return new Response(
          JSON.stringify({
            suggestions: [
              {
                googlePlaceId: "ChIJBVY2Bxh-j4ARa2zO8Jd6H2A",
                mainText: "Tartine Bakery",
                secondaryText: "600 Guerrero St, San Francisco, CA",
                fullText: "Tartine Bakery, San Francisco",
                cuisines: ["Bakery"],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url === "/api/plans") {
        return new Response(JSON.stringify({ plans: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url === "/api/lists") {
        return new Response(JSON.stringify({ lists: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ restaurants: SAMPLE_RESTAURANTS }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    renderLibrary();

    const googleToggle = screen.getByRole("button", { name: /Include Google Maps/i });
    expect(googleToggle).toHaveAttribute("aria-pressed", "true");

    fireEvent.change(screen.getByLabelText("Search saved restaurants"), {
      target: { value: "Tartine" },
    });

    expect(screen.getByRole("heading", { name: "From your Saved Places" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "From Google Maps" })).toBeInTheDocument();
    expect(screen.getByText("Powered by Google")).toBeInTheDocument();

    const addBtn = await screen.findByRole(
      "button",
      { name: /Tartine Bakery/i },
      { timeout: 2500 },
    );
    fireEvent.click(addBtn);

    expect(replaceMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/places\?.*add=1.*placeId=ChIJBVY2Bxh-j4ARa2zO8Jd6H2A.*session=/),
    );
  });

  it("defaults to Compact density and toggles to Comfort density with localStorage persistence", () => {
    window.localStorage.removeItem("resker:places-density");
    renderLibrary("group=none");

    const firstCard = screen.getByText("Hangawi").closest("[data-density]");
    expect(firstCard).toHaveAttribute("data-density", "compact");

    fireEvent.click(screen.getByRole("button", { name: "Comfort" }));
    expect(window.localStorage.getItem("resker:places-density")).toBe("comfortable");

    const updatedCard = screen.getByText("Hangawi").closest("[data-density]");
    expect(updatedCard).toHaveAttribute("data-density", "comfortable");

    fireEvent.click(screen.getByRole("button", { name: "Compact" }));
    expect(window.localStorage.getItem("resker:places-density")).toBe("compact");
  });

  it("filters spots by List membership inside FilterSheet and removes active List chip", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/lists") {
        return new Response(
          JSON.stringify({
            lists: [
              {
                id: "list-date-night",
                name: "Date Night",
                description: null,
                icon: "wine",
                itemCount: 1,
                restaurantIds: ["1"],
                placeIds: ["p1"],
                createdAt: "2026-11-14T00:00:00.000Z",
                updatedAt: "2026-11-14T00:00:00.000Z",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url === "/api/plans") {
        return new Response(JSON.stringify({ plans: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ restaurants: SAMPLE_RESTAURANTS }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    renderLibrary("group=none");

    fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
    const dialog = await screen.findByRole("dialog");

    const listChip = await within(dialog).findByRole("button", { name: /Date Night/ });
    fireEvent.click(listChip);

    const applyBtn = await within(dialog).findByRole("button", { name: "Show 1 spot" });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Hangawi")).toBeInTheDocument();
    expect(screen.queryByText("Rubirosa")).not.toBeInTheDocument();
    expect(screen.queryByText("Honest Restaurant")).not.toBeInTheDocument();

    const activeChip = screen.getByRole("button", { name: /List: Date Night/ });
    fireEvent.click(activeChip);
    expect(screen.getByText("Rubirosa")).toBeInTheDocument();
  });
});
