import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("@/components/ui/toast", () => ({
  toast: Object.assign((...args: unknown[]) => toastMock(...args), {
    error: (...args: unknown[]) => toastErrorMock(...args),
  }),
}));

import {
  resetPendingDeletesForTests,
  scheduleRestaurantDelete,
  undoRestaurantDelete,
} from "@/lib/places/pending-delete";
import { restaurantQueryKeys, type UserRestaurantItem } from "@/lib/queries/restaurants";

const SAMPLE_SPOT: UserRestaurantItem = {
  id: "rest-undo-1",
  placeId: "place-undo-1",
  googlePlaceId: "ChIJ-undo-1",
  googleMapsUri: null,
  lat: 40.74,
  lng: -73.98,
  name: "Hangawi",
  address: "12 E 32nd St, New York, NY",
  city: "New York",
  countryCode: "US",
  cuisines: ["Korean", "Vegan"],
  priceLevel: 3,
  status: "tried",
  ratingHalf: 9,
  notes: null,
  visitCount: 1,
  lastVisitedOn: "2026-11-14",
  createdAt: "2026-11-10T00:00:00.000Z",
  updatedAt: "2026-11-14T00:00:00.000Z",
};

describe("pending-delete (5s Undo Toast)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    toastMock.mockReset();
    toastErrorMock.mockReset();
    resetPendingDeletesForTests();
  });

  afterEach(() => {
    resetPendingDeletesForTests();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("defers DELETE for 5000ms and cancels + restores on Undo click", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const queryClient = new QueryClient();
    queryClient.setQueryData(restaurantQueryKeys.all, [SAMPLE_SPOT]);

    const onUndo = vi.fn();
    scheduleRestaurantDelete({
      restaurant: SAMPLE_SPOT,
      queryClient,
      onUndo,
    });

    expect(queryClient.getQueryData(restaurantQueryKeys.all)).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      "Removed Hangawi",
      expect.objectContaining({
        duration: 5000,
        action: expect.objectContaining({ label: "Undo" }),
      }),
    );

    vi.advanceTimersByTime(3000);
    expect(fetchSpy).not.toHaveBeenCalled();

    undoRestaurantDelete(SAMPLE_SPOT.id, onUndo);
    vi.advanceTimersByTime(5000);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(restaurantQueryKeys.all)).toEqual([SAMPLE_SPOT]);
    expect(onUndo).toHaveBeenCalledWith(SAMPLE_SPOT);
    expect(toastMock).toHaveBeenCalledWith("Restored Hangawi", expect.any(Object));
  });

  it("commits DELETE /api/restaurants/[id] after 5000ms if not undone", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ deletedId: SAMPLE_SPOT.id }), { status: 200 }),
      );

    const queryClient = new QueryClient();
    queryClient.setQueryData(restaurantQueryKeys.all, [SAMPLE_SPOT]);

    scheduleRestaurantDelete({
      restaurant: SAMPLE_SPOT,
      queryClient,
    });

    await vi.advanceTimersByTimeAsync(5000);

    expect(fetchSpy).toHaveBeenCalledWith(
      `/api/restaurants/${SAMPLE_SPOT.id}`,
      expect.objectContaining({ method: "DELETE", keepalive: true }),
    );
  });
});
