import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AddSheet } from "./add-sheet";

const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/places",
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => new URLSearchParams("add=1"),
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

function renderAddSheet() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AddSheet />
    </QueryClientProvider>,
  );
}

describe("AddSheet", () => {
  beforeEach(() => {
    replaceMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("validates invalid URLs client-side without calling /api/places/resolve", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderAddSheet();

    const input = screen.getByLabelText("Google Maps URL");
    fireEvent.change(input, { target: { value: "https://example.com/not-maps" } });
    fireEvent.click(screen.getByRole("button", { name: "Look up place" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That doesn't look like a Google Maps place link.",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows 'Already saved' and opens existing entry when link is already saved", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          alreadySaved: true,
          googlePlaceId: "ChIJBVY2Bxh-j4ARa2zO8Jd6H2A",
          prefill: null,
          existingRestaurant: {
            id: "rest-123",
            placeId: "place-123",
            googlePlaceId: "ChIJBVY2Bxh-j4ARa2zO8Jd6H2A",
            googleMapsUri: "https://maps.google.com/?cid=123",
            lat: 37.76,
            lng: -122.42,
            name: "Tartine Bakery",
            address: "600 Guerrero St, San Francisco, CA",
            city: "San Francisco",
            countryCode: "US",
            cuisines: ["Bakery"],
            priceLevel: 1,
            status: "to_try",
            ratingHalf: null,
            notes: null,
            visitCount: 0,
            lastVisitedOn: null,
            createdAt: "2026-11-14T00:00:00.000Z",
            updatedAt: "2026-11-14T00:00:00.000Z",
          },
        }),
        { status: 200 },
      ),
    );

    renderAddSheet();
    fireEvent.change(screen.getByLabelText("Google Maps URL"), {
      target: { value: "https://maps.app.goo.gl/abc123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Look up place" }));

    expect(await screen.findByText("Already saved in your library")).toBeInTheDocument();
    expect(screen.getByText("Tartine Bakery")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open saved entry" }));
    expect(replaceMock).toHaveBeenCalledWith("/places?highlight=rest-123", { scroll: false });
  });

  it("debounces Search tab autocomplete and completes the confirm-and-save flow", async () => {
    vi.useFakeTimers();

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            suggestions: [
              {
                googlePlaceId: "ChIJBVY2Bxh-j4ARa2zO8Jd6H2A",
                mainText: "Tartine Bakery",
                secondaryText: "Guerrero Street, San Francisco, CA",
                fullText: "Tartine Bakery, Guerrero Street",
                cuisines: ["Bakery"],
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            alreadySaved: false,
            googlePlaceId: "ChIJBVY2Bxh-j4ARa2zO8Jd6H2A",
            existingRestaurant: null,
            prefill: {
              googlePlaceId: "ChIJBVY2Bxh-j4ARa2zO8Jd6H2A",
              name: "Tartine Bakery",
              address: "600 Guerrero St, San Francisco, CA",
              city: "San Francisco",
              countryCode: "US",
              lat: 37.7614,
              lng: -122.4241,
              cuisines: ["Bakery"],
              priceLevel: 1,
              googleMapsUri: "https://maps.google.com/?cid=6926389544917822571",
              suggestedFoodIcon: "croissant",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            created: true,
            restaurant: {
              id: "rest-new",
              placeId: "place-new",
              googlePlaceId: "ChIJBVY2Bxh-j4ARa2zO8Jd6H2A",
              googleMapsUri: "https://maps.google.com/?cid=6926389544917822571",
              lat: 37.7614,
              lng: -122.4241,
              name: "Tartine Bakery",
              address: "600 Guerrero St, San Francisco, CA",
              city: "San Francisco",
              countryCode: "US",
              cuisines: ["Bakery"],
              priceLevel: 1,
              status: "to_try",
              ratingHalf: null,
              notes: null,
              visitCount: 0,
              lastVisitedOn: null,
              createdAt: "2026-11-14T00:00:00.000Z",
              updatedAt: "2026-11-14T00:00:00.000Z",
            },
          }),
          { status: 201 },
        ),
      );

    renderAddSheet();
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    fireEvent.change(screen.getByLabelText("Search restaurants"), {
      target: { value: "Tartine" },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(260);
    });

    vi.useRealTimers();

    const suggestionBtn = await screen.findByRole("button", { name: /Tartine Bakery/ });
    fireEvent.click(suggestionBtn);

    const saveBtn = await screen.findByRole("button", { name: "Save to To Try" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/places?highlight=rest-new", { scroll: false });
    });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
});
