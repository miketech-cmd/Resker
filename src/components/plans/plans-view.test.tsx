import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlansView } from "@/components/plans/plans-view";
import type { PlannedVisitItem } from "@/lib/queries/plans";
import type { UserRestaurantItem } from "@/lib/queries/restaurants";

const mockDownloadPlanIcs = vi.fn();

vi.mock("@/lib/places/ics", () => ({
  downloadPlanIcs: (...args: unknown[]) => mockDownloadPlanIcs(...args),
}));

vi.mock("vaul", () => ({
  Drawer: {
    Root: ({ open, children }: { open: boolean; children: ReactNode }) =>
      open ? <div role="dialog">{children}</div> : null,
    Portal: ({ children }: { children: ReactNode }) => <>{children}</>,
    Overlay: () => null,
    Content: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Title: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    Description: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  },
}));

const SAMPLE_RESTAURANT: UserRestaurantItem = {
  id: "11111111-1111-4111-8111-111111111111",
  placeId: "22222222-2222-4222-8222-222222222222",
  googlePlaceId: "ChIJ-sample-hangawi",
  googleMapsUri: "https://maps.google.com/?cid=123",
  lat: 40.7468,
  lng: -73.9846,
  name: "Hangawi",
  address: "12 E 32nd St, New York, NY",
  city: "New York",
  countryCode: "US",
  cuisines: ["Korean", "Vegan"],
  priceLevel: 3,
  status: "to_try",
  ratingHalf: null,
  notes: null,
  visitCount: 0,
  lastVisitedOn: null,
  createdAt: "2026-11-14T00:00:00.000Z",
  updatedAt: "2026-11-14T00:00:00.000Z",
};

const UPCOMING_PLAN: PlannedVisitItem = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  userRestaurantId: SAMPLE_RESTAURANT.id,
  plannedFor: "2026-11-20",
  plannedTime: "19:30",
  note: "Patio reservation",
  status: "planned",
  visitId: null,
  createdAt: "2026-11-15T10:00:00.000Z",
  restaurant: {
    id: SAMPLE_RESTAURANT.id,
    placeId: SAMPLE_RESTAURANT.placeId,
    googlePlaceId: SAMPLE_RESTAURANT.googlePlaceId,
    googleMapsUri: SAMPLE_RESTAURANT.googleMapsUri,
    lat: SAMPLE_RESTAURANT.lat,
    lng: SAMPLE_RESTAURANT.lng,
    name: SAMPLE_RESTAURANT.name,
    address: SAMPLE_RESTAURANT.address,
    city: SAMPLE_RESTAURANT.city,
    countryCode: SAMPLE_RESTAURANT.countryCode,
    cuisines: SAMPLE_RESTAURANT.cuisines,
    priceLevel: SAMPLE_RESTAURANT.priceLevel,
    status: "to_try",
  },
};

function renderWithQueryClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("PlansView UI & interactions", () => {
  beforeEach(() => {
    mockDownloadPlanIcs.mockClear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports an .ics file and performs one-tap Log it conversion", async () => {
    const completedPlan: PlannedVisitItem = {
      ...UPCOMING_PLAN,
      status: "done",
      visitId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      restaurant: { ...UPCOMING_PLAN.restaurant, status: "tried" },
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/complete")) {
        return new Response(
          JSON.stringify({
            alreadyCompleted: false,
            plan: completedPlan,
            visit: {
              id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
              userRestaurantId: SAMPLE_RESTAURANT.id,
              visitedOn: "2026-11-20",
              ratingHalf: null,
              notes: "Patio reservation",
              dishes: [],
              createdAt: "2026-11-15T11:00:00.000Z",
              updatedAt: "2026-11-15T11:00:00.000Z",
            },
            restaurant: {
              ...SAMPLE_RESTAURANT,
              status: "tried",
              visitCount: 1,
              lastVisitedOn: "2026-11-20",
            },
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url === "/api/plans") {
        return new Response(JSON.stringify({ plans: [completedPlan] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ restaurants: [SAMPLE_RESTAURANT] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    renderWithQueryClient(
      <PlansView initialPlans={[UPCOMING_PLAN]} initialRestaurants={[SAMPLE_RESTAURANT]} />,
    );

    expect(screen.getByText("Hangawi")).toBeInTheDocument();
    expect(screen.getByText("7:30 PM")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Calendar \(\.ics\)/i }));
    expect(mockDownloadPlanIcs).toHaveBeenCalledWith(
      expect.objectContaining({ id: UPCOMING_PLAN.id }),
    );

    fireEvent.click(screen.getByRole("button", { name: /Log it/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        `/api/plans/${UPCOMING_PLAN.id}/complete`,
        expect.objectContaining({ method: "POST" }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Completed & Past \(1\)/i)).toBeInTheDocument();
    });
  });

  it("opens PlanVisitSheet and saves a new reservation", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/plans" && init?.method === "POST") {
        return new Response(JSON.stringify({ plan: UPCOMING_PLAN }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url === "/api/plans") {
        return new Response(JSON.stringify({ plans: [UPCOMING_PLAN] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ restaurants: [SAMPLE_RESTAURANT] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    renderWithQueryClient(<PlansView initialPlans={[]} initialRestaurants={[SAMPLE_RESTAURANT]} />);

    fireEvent.click(screen.getByRole("button", { name: /^Plan visit$/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Reservation note/i), {
      target: { value: "Corner booth" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save reservation/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/plans",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
