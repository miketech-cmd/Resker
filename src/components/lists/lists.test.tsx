import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AddToListsSheet } from "@/components/lists/add-to-lists-sheet";
import { ListDetail } from "@/components/lists/list-detail";
import { listQueryKeys, type ListDetailResponse, type ListSummaryItem } from "@/lib/queries/lists";
import type { UserRestaurantItem } from "@/lib/queries/restaurants";

const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
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

const RESTAURANT: UserRestaurantItem = {
  id: "11111111-1111-4111-8111-111111111111",
  placeId: "22222222-2222-4222-8222-222222222222",
  googlePlaceId: "ChIJ-test-1",
  googleMapsUri: "https://maps.google.com/?cid=1",
  lat: 40.72,
  lng: -73.99,
  name: "Rubirosa",
  address: "235 Mulberry St, New York, NY",
  city: "New York",
  countryCode: "US",
  cuisines: ["Pizza"],
  priceLevel: 2,
  status: "tried",
  ratingHalf: 9,
  notes: null,
  visitCount: 1,
  lastVisitedOn: "2026-11-14",
  createdAt: "2026-11-14T00:00:00.000Z",
  updatedAt: "2026-11-14T00:00:00.000Z",
};

const LIST_ONE: ListSummaryItem = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "NY 2026 Travel",
  description: "Manhattan favorites",
  icon: "pizza",
  itemCount: 1,
  restaurantIds: [RESTAURANT.id],
  createdAt: "2026-11-14T00:00:00.000Z",
  updatedAt: "2026-11-14T00:00:00.000Z",
};

const LIST_TWO: ListSummaryItem = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "Date Night",
  description: null,
  icon: "wine",
  itemCount: 0,
  restaurantIds: [],
  createdAt: "2026-11-14T00:00:00.000Z",
  updatedAt: "2026-11-14T00:00:00.000Z",
};

describe("Phase 5 Lists UI", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("toggles membership across multiple lists and creates a new list with dominant icon", async () => {
    const createdList: ListSummaryItem = {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      name: "Late Night Slices",
      description: null,
      icon: "pizza",
      itemCount: 0,
      restaurantIds: [],
      createdAt: "2026-11-14T00:00:00.000Z",
      updatedAt: "2026-11-14T00:00:00.000Z",
    };

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ added: true, position: "a0" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ list: createdList }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ added: true, position: "a0" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(listQueryKeys.all, [LIST_ONE, LIST_TWO]);

    render(
      <QueryClientProvider client={client}>
        <AddToListsSheet restaurant={RESTAURANT} open onOpenChange={() => {}} />
      </QueryClientProvider>,
    );

    const nyBtn = screen.getByRole("button", { name: /NY 2026 Travel/i });
    const dateBtn = screen.getByRole("button", { name: /Date Night/i });
    expect(nyBtn).toHaveAttribute("aria-pressed", "true");
    expect(dateBtn).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(dateBtn);
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        `/api/lists/${LIST_TWO.id}/items`,
        expect.objectContaining({ method: "POST" }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "New list" }));
    fireEvent.change(screen.getByLabelText("Create a new list"), {
      target: { value: "Late Night Slices" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/lists",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "Late Night Slices", icon: "pizza" }),
        }),
      );
    });
  });

  it("renders ListDetail with List/Map toggle, item removal, and delete confirmation", async () => {
    const detail: ListDetailResponse = {
      list: LIST_ONE,
      items: [
        {
          ...RESTAURANT,
          position: "a0",
          addedAt: "2026-11-14T00:00:00.000Z",
        },
      ],
    };

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ removed: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ deletedId: LIST_ONE.id }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(listQueryKeys.detail(LIST_ONE.id), detail);

    render(
      <QueryClientProvider client={client}>
        <ListDetail initialDetail={detail} />
      </QueryClientProvider>,
    );

    expect(screen.getByText("NY 2026 Travel")).toBeInTheDocument();
    expect(screen.getByText("Rubirosa")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Map spots" }));
    expect(screen.getByRole("link", { name: "Directions" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Order list" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Rubirosa from list" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        `/api/lists/${LIST_ONE.id}/items?userRestaurantId=${RESTAURANT.id}`,
        { method: "DELETE" },
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(
      screen.getByText("All of your saved restaurants remain safe in Places."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete list" }));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/lists");
    });
  });
});
