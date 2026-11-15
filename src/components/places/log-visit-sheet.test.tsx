import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LogVisitSheet } from "@/components/places/log-visit-sheet";
import { VisitTimeline } from "@/components/places/visit-timeline";
import { restaurantQueryKeys, type UserRestaurantItem } from "@/lib/queries/restaurants";
import { visitQueryKeys, type VisitItem } from "@/lib/queries/visits";

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

const SAMPLE_RESTAURANT: UserRestaurantItem = {
  id: "11111111-1111-4111-8111-111111111111",
  placeId: "22222222-2222-4222-8222-222222222222",
  googlePlaceId: "ChIJ-sample-rubirosa",
  googleMapsUri: "https://maps.google.com/?cid=123",
  lat: 40.7227,
  lng: -73.9962,
  name: "Rubirosa",
  address: "235 Mulberry St, New York, NY 10012, USA",
  city: "New York",
  countryCode: "US",
  cuisines: ["Pizza", "Italian"],
  priceLevel: 2,
  status: "to_try",
  ratingHalf: 8,
  notes: null,
  visitCount: 0,
  lastVisitedOn: null,
  createdAt: "2026-11-14T00:00:00.000Z",
  updatedAt: "2026-11-14T00:00:00.000Z",
};

const SAMPLE_VISIT: VisitItem = {
  id: "33333333-3333-4333-8333-333333333333",
  userRestaurantId: SAMPLE_RESTAURANT.id,
  visitedOn: "2026-11-14",
  ratingHalf: 9,
  notes: "Worth the wait.",
  dishes: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      visitId: "33333333-3333-4333-8333-333333333333",
      name: "Tie Dye Pizza",
      note: "Extra basil",
      wouldOrderAgain: true,
      position: 0,
    },
    {
      id: "55555555-5555-4555-8555-555555555555",
      visitId: "33333333-3333-4333-8333-333333333333",
      name: "Mini Rice Balls",
      note: null,
      wouldOrderAgain: false,
      position: 1,
    },
  ],
  createdAt: "2026-11-14T18:00:00.000Z",
  updatedAt: "2026-11-14T18:00:00.000Z",
};

describe("LogVisitSheet & VisitTimeline", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("supports rapid dish entry via Enter and posts transactional visit update", async () => {
    const updatedRestaurant: UserRestaurantItem = {
      ...SAMPLE_RESTAURANT,
      status: "tried",
      visitCount: 1,
      lastVisitedOn: "2026-11-14",
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ visit: SAMPLE_VISIT, restaurant: updatedRestaurant }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(restaurantQueryKeys.all, [SAMPLE_RESTAURANT]);
    client.setQueryData(restaurantQueryKeys.detail(SAMPLE_RESTAURANT.id), SAMPLE_RESTAURANT);

    const onOpenChange = vi.fn();

    render(
      <QueryClientProvider client={client}>
        <LogVisitSheet restaurant={SAMPLE_RESTAURANT} open onOpenChange={onOpenChange} />
      </QueryClientProvider>,
    );

    const dishInput = screen.getByLabelText("Dish name");
    fireEvent.change(dishInput, { target: { value: "Tie Dye Pizza" } });
    fireEvent.keyDown(dishInput, { key: "Enter" });

    expect(screen.getByText("Tie Dye Pizza")).toBeInTheDocument();
    expect(dishInput).toHaveValue("");

    fireEvent.change(dishInput, { target: { value: "Mini Rice Balls" } });
    fireEvent.click(screen.getByRole("button", { name: "Add dish" }));

    const skipButtons = screen.getAllByRole("button", { name: "Skip next time" });
    fireEvent.click(skipButtons[1]!);

    fireEvent.change(screen.getByLabelText("Note for Tie Dye Pizza"), {
      target: { value: "Extra basil" },
    });
    fireEvent.change(screen.getByLabelText("Visit notes"), {
      target: { value: "Worth the wait." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Log visit" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe(`/api/restaurants/${SAMPLE_RESTAURANT.id}/visits`);
    expect(init?.method).toBe("POST");
    const sentBody = JSON.parse(String(init?.body));
    expect(sentBody.dishes).toEqual([
      { name: "Tie Dye Pizza", note: "Extra basil", wouldOrderAgain: true },
      { name: "Mini Rice Balls", note: null, wouldOrderAgain: false },
    ]);

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(
      client.getQueryData<UserRestaurantItem>(restaurantQueryKeys.detail(SAMPLE_RESTAURANT.id))
        ?.status,
    ).toBe("tried");
    expect(
      client.getQueryData<VisitItem[]>(visitQueryKeys.byRestaurant(SAMPLE_RESTAURANT.id)),
    ).toHaveLength(1);
  });

  it("renders dishes in VisitTimeline and confirms delete", async () => {
    const updatedRestaurant: UserRestaurantItem = {
      ...SAMPLE_RESTAURANT,
      status: "tried",
      visitCount: 0,
      lastVisitedOn: null,
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          deletedId: SAMPLE_VISIT.id,
          restaurantId: SAMPLE_RESTAURANT.id,
          restaurant: updatedRestaurant,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(visitQueryKeys.byRestaurant(SAMPLE_RESTAURANT.id), [SAMPLE_VISIT]);

    const onEdit = vi.fn();
    render(
      <QueryClientProvider client={client}>
        <VisitTimeline
          restaurant={{ ...SAMPLE_RESTAURANT, status: "tried", visitCount: 1 }}
          visits={[SAMPLE_VISIT]}
          onOpenLogNew={() => {}}
          onOpenEdit={onEdit}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Tie Dye Pizza")).toBeInTheDocument();
    expect(screen.getByText("Extra basil")).toBeInTheDocument();
    expect(screen.getByText("Mini Rice Balls")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit visit on 2026-11-14" }));
    expect(onEdit).toHaveBeenCalledWith(SAMPLE_VISIT);

    fireEvent.click(screen.getByRole("button", { name: "Delete visit on 2026-11-14" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(`/api/visits/${SAMPLE_VISIT.id}`, {
        method: "DELETE",
      });
    });

    await waitFor(() => {
      expect(
        client.getQueryData<VisitItem[]>(visitQueryKeys.byRestaurant(SAMPLE_RESTAURANT.id)),
      ).toHaveLength(0);
    });
  });
});
