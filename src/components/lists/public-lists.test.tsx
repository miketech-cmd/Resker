import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ListFormSheet } from "@/components/lists/list-form-sheet";
import { PublicListBrowse } from "@/components/lists/public-list-browse";
import { PublicListDetail } from "@/components/lists/public-list-detail";
import type { PublicListDetailResponse, PublicListSummaryItem } from "@/lib/queries/lists";

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

const PUBLIC_LISTS: PublicListSummaryItem[] = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    name: "Seattle Top Vegetarian-Friendly Picks",
    description: "5 picks per cuisine across Seattle",
    icon: "bowl",
    publicSlug: "seattle-vegetarian-guide",
    isFeatured: true,
    city: "Seattle",
    copyCount: 12,
    itemCount: 25,
    curatorName: "Resker Guides",
    curatorUsername: "resker",
    cuisines: ["Asian", "Indian", "Mexican", "Ramen", "Pizza"],
    savedCopyListId: null,
    createdAt: "2026-11-15T00:00:00.000Z",
    updatedAt: "2026-11-15T00:00:00.000Z",
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
    name: "Redmond Favorites",
    description: "My neighborhood veggie picks",
    icon: "pepper",
    publicSlug: "redmond-favorites",
    isFeatured: false,
    city: "Redmond",
    copyCount: 3,
    itemCount: 6,
    curatorName: "Mit",
    curatorUsername: "mit",
    cuisines: ["Indian", "Pizza"],
    savedCopyListId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    createdAt: "2026-11-15T00:00:00.000Z",
    updatedAt: "2026-11-15T00:00:00.000Z",
  },
];

const DETAIL: PublicListDetailResponse = {
  list: PUBLIC_LISTS[0]!,
  items: [
    {
      id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
      placeId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
      googlePlaceId: "ChIJ-sea-asian-1",
      googleMapsUri: "https://maps.google.com/?cid=101",
      lat: 47.61,
      lng: -122.33,
      name: "Chu Minh Tofu and Vegan Deli",
      address: "1043 S Jackson St, Seattle, WA",
      city: "Seattle",
      countryCode: "US",
      cuisines: ["Asian", "Vegetarian-friendly"],
      priceLevel: 1,
      curatorNote: "Great vegan banh mi",
      position: "a0",
      addedAt: "2026-11-15T00:00:00.000Z",
      savedByViewer: false,
      viewerRestaurantId: null,
    },
    {
      id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc2",
      placeId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd2",
      googlePlaceId: "ChIJ-sea-indian-1",
      googleMapsUri: "https://maps.google.com/?cid=102",
      lat: 47.62,
      lng: -122.34,
      name: "Taste of Mumbai",
      address: "123 Pike St, Seattle, WA",
      city: "Seattle",
      countryCode: "US",
      cuisines: ["Indian", "Vegetarian-friendly"],
      priceLevel: 2,
      curatorNote: null,
      position: "a1",
      addedAt: "2026-11-15T00:00:00.000Z",
      savedByViewer: true,
      viewerRestaurantId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2",
    },
  ],
};

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("Public Lists browse, detail save/clone, and public publish toggle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("filters public lists by city and search query", () => {
    renderWithQuery(
      <PublicListBrowse
        initialLists={PUBLIC_LISTS}
        detailBasePath="/lists/public"
        viewerSignedIn
      />,
    );

    expect(screen.getByText("Seattle Top Vegetarian-Friendly Picks")).toBeInTheDocument();
    expect(screen.getByText("Redmond Favorites")).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Redmond" }));
    expect(screen.queryByText("Seattle Top Vegetarian-Friendly Picks")).not.toBeInTheDocument();
    expect(screen.getByText("Redmond Favorites")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    const searchInput = screen.getByLabelText("Search public lists");
    fireEvent.change(searchInput, { target: { value: "Ramen" } });
    expect(screen.getByText("Seattle Top Vegetarian-Friendly Picks")).toBeInTheDocument();
    expect(screen.queryByText("Redmond Favorites")).not.toBeInTheDocument();
  });

  it("saves individual spot and clones entire list for signed-in users", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/save-place") && init?.method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              created: true,
              restaurant: {
                id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
              },
            }),
            { status: 201 },
          ),
        );
      }
      if (url.endsWith("/clone") && init?.method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              list: {
                id: "ffffffff-ffff-4fff-8fff-fffffffffff1",
                name: "Seattle Top Vegetarian-Friendly Picks",
              },
              addedRestaurantsCount: 1,
              totalItemsCount: 2,
            }),
            { status: 201 },
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify(DETAIL), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQuery(
      <PublicListDetail
        initialDetail={DETAIL}
        viewerSignedIn
        backHref="/lists?tab=browse"
        backLabel="Browse guides"
      />,
    );

    expect(screen.getByText("Chu Minh Tofu and Vegan Deli")).toBeInTheDocument();
    expect(screen.getByText("Taste of Mumbai")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+ Save" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/lists/public/seattle-vegetarian-guide/save-place",
        expect.objectContaining({ method: "POST" }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Save entire list" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/lists/public/seattle-vegetarian-guide/clone",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("renders read-only sign-in CTA for signed-out visitors", () => {
    renderWithQuery(
      <PublicListDetail
        initialDetail={DETAIL}
        viewerSignedIn={false}
        backHref="/explore"
        backLabel="All public lists"
      />,
    );

    const signInCta = screen.getByRole("link", { name: "Sign in to save spots" });
    expect(signInCta).toHaveAttribute("href", "/signin?next=%2Fs%2Fseattle-vegetarian-guide");
    expect(screen.queryByRole("button", { name: "Save entire list" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Save" })).not.toBeInTheDocument();
  });

  it("allows publishing a user list as public with optional city in ListFormSheet", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          list: {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9",
            name: "Bellevue Eats",
            description: null,
            icon: "bowl",
            publicSlug: "bellevue-eats-a1b2c3",
            isPublic: true,
            isFeatured: false,
            city: "Bellevue",
            copyCount: 0,
            sourceListId: null,
            itemCount: 0,
            restaurantIds: [],
            createdAt: "2026-11-15T00:00:00.000Z",
            updatedAt: "2026-11-15T00:00:00.000Z",
          },
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWithQuery(<ListFormSheet open onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("List name"), { target: { value: "Bellevue Eats" } });
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.change(screen.getByLabelText("City (optional)"), { target: { value: "Bellevue" } });
    fireEvent.click(screen.getByRole("button", { name: "Create list" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/lists",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"isPublic":true'),
        }),
      );
    });
  });
});
