import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ListsOverview } from "@/components/lists/lists-overview";
import { ShareLibrarySheet } from "@/components/lists/share-library-sheet";
import { SharedGuideDetail } from "@/components/lists/shared-guide-detail";
import type { ListSummaryItem } from "@/lib/queries/lists";
import type {
  SharedGuidesOverviewResponse,
  SharedLibraryGuideDetailResponse,
} from "@/lib/queries/shared-guides";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
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

function renderWithQuery(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const OWNED_LIST: ListSummaryItem = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "NYC Wishlist",
  description: "Weekend eats",
  icon: "pizza",
  itemCount: 3,
  restaurantIds: [],
  viewerRole: "owner",
  createdAt: "2026-11-14T00:00:00.000Z",
  updatedAt: "2026-11-14T00:00:00.000Z",
};

const VIEWER_LIST: ListSummaryItem = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Partner's Date Spots",
  description: "Special occasion",
  icon: "wine",
  itemCount: 4,
  restaurantIds: [],
  viewerRole: "viewer",
  ownerName: "Alex",
  ownerUsername: "alex",
  createdAt: "2026-11-14T00:00:00.000Z",
  updatedAt: "2026-11-14T00:00:00.000Z",
};

const SHARED_OVERVIEW: SharedGuidesOverviewResponse = {
  sharedWithMe: [
    {
      ownerId: "owner-alex",
      ownerName: "Alex",
      ownerUsername: "alex",
      itemCount: 12,
      citiesCount: 2,
      cuisines: ["Indian", "Ramen"],
      sharedAt: "2026-11-15T00:00:00.000Z",
    },
  ],
  sharingWith: [],
  inviteToken: null,
  myLibraryCount: 8,
};

const SHARED_DETAIL: SharedLibraryGuideDetailResponse = {
  guide: SHARED_OVERVIEW.sharedWithMe[0]!,
  items: [
    {
      id: "rest-alex-1",
      placeId: "place-1",
      googlePlaceId: "ChIJ-1",
      googleMapsUri: "https://maps.google.com/?cid=1",
      lat: 47.61,
      lng: -122.33,
      name: "Chu Minh Tofu",
      address: "1043 S Jackson St, Seattle, WA",
      city: "Seattle",
      countryCode: "US",
      cuisines: ["Asian", "Vegan"],
      priceLevel: 1,
      curatorNote: null,
      position: "0",
      addedAt: "2026-11-14T00:00:00.000Z",
      savedByViewer: false,
      viewerRestaurantId: null,
    },
  ],
  isOwnPreview: false,
};

describe("Shared Guides UI", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("separates My Lists from Shared Guides tab (showing shared libraries + viewer lists)", () => {
    renderWithQuery(
      <ListsOverview
        initialLists={[OWNED_LIST, VIEWER_LIST]}
        initialPublicLists={[]}
        initialSharedOverview={SHARED_OVERVIEW}
      />,
    );

    expect(screen.getByText("NYC Wishlist")).toBeInTheDocument();
    expect(screen.queryByText("Alex's Saved Places")).not.toBeInTheDocument();
    expect(screen.queryByText("Partner's Date Spots")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Shared Guides/i }));

    expect(screen.getByText("Alex's Saved Places")).toBeInTheDocument();
    expect(screen.getByText("Partner's Date Spots")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Manage sharing/i })).toBeInTheDocument();
  });

  it("invites a viewer by @username and creates a private invite link in ShareLibrarySheet", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/shared-guides" && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            viewer: {
              userId: "u-partner",
              name: "Jordan",
              username: "jordan",
              createdAt: "2026-11-15T12:00:00.000Z",
            },
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url === "/api/shared-guides/invite-link" && init?.method === "POST") {
        return new Response(JSON.stringify({ inviteToken: "privtok_12345678" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(SHARED_OVERVIEW), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    renderWithQuery(
      <ShareLibrarySheet
        viewers={[]}
        inviteToken={null}
        myLibraryCount={8}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("switch")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "@jordan" } });
    fireEvent.click(screen.getByRole("button", { name: /^Share$/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/shared-guides",
        expect.objectContaining({ method: "POST" }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /Create private invite link/i }));
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/shared-guides/invite-link",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("renders read-only SharedGuideDetail and saves a spot one-tap to Places", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/save-place") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            created: true,
            restaurant: {
              id: "rest-viewer-new",
              placeId: "place-1",
              googlePlaceId: "ChIJ-1",
              googleMapsUri: null,
              lat: 47.61,
              lng: -122.33,
              name: "Chu Minh Tofu",
              address: "1043 S Jackson St, Seattle, WA",
              city: "Seattle",
              countryCode: "US",
              cuisines: ["Asian", "Vegan"],
              priceLevel: 1,
              status: "to_try",
              ratingHalf: null,
              notes: null,
              visitCount: 0,
              lastVisitedOn: null,
              createdAt: "2026-11-15T12:00:00.000Z",
              updatedAt: "2026-11-15T12:00:00.000Z",
            },
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify(SHARED_DETAIL), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    renderWithQuery(<SharedGuideDetail initialDetail={SHARED_DETAIL} />);

    expect(screen.getByText("Alex's Saved Places")).toBeInTheDocument();
    expect(screen.getByText("Chu Minh Tofu")).toBeInTheDocument();
    expect(screen.queryByText("To Try")).not.toBeInTheDocument();
    expect(screen.queryByText("Tried")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/shared-guides/owner-alex/save-place",
        expect.objectContaining({ method: "POST" }),
      );
    });

    expect(await screen.findByRole("link", { name: /Saved/i })).toHaveAttribute(
      "href",
      "/places/rest-viewer-new",
    );
  });
});
