import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AddToListsSheet } from "@/components/lists/add-to-lists-sheet";
import { ListDetail } from "@/components/lists/list-detail";
import { PublicListDetail } from "@/components/lists/public-list-detail";
import { ShareListSheet } from "@/components/lists/share-list-sheet";
import type {
  ListDetailResponse,
  ListMemberItem,
  ListSummaryItem,
  PublicListDetailResponse,
} from "@/lib/queries/lists";
import type { UserRestaurantItem } from "@/lib/queries/restaurants";

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: refreshMock }),
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

function renderWithQuery(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const OWNER_LIST: ListSummaryItem = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Seattle Shared Eats",
  description: "Best veggie spots",
  icon: "bowl",
  publicSlug: "AbCdEf123456",
  isPublic: true,
  isFeatured: false,
  city: "Seattle",
  copyCount: 0,
  sourceListId: null,
  itemCount: 1,
  restaurantIds: ["rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrr1"],
  placeIds: ["pppppppp-pppp-4ppp-8ppp-ppppppppppp1"],
  viewerRole: "owner",
  ownerName: "Alice",
  ownerUsername: "alice",
  memberCount: 1,
  createdAt: "2026-11-15T00:00:00.000Z",
  updatedAt: "2026-11-15T00:00:00.000Z",
};

const MEMBER_BOB: ListMemberItem = {
  userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  username: "bob",
  name: "Bob",
  avatarUrl: null,
  role: "viewer",
  createdAt: "2026-11-15T00:00:00.000Z",
};

describe("Phase 8 Sharing & Collaboration UI", () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("invites collaborator, changes role, regenerates and revokes share slug in ShareListSheet", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            member: {
              ...MEMBER_BOB,
              role: "editor",
            },
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            list: {
              ...OWNER_LIST,
              publicSlug: "XyZ987654321",
              isPublic: true,
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            list: {
              ...OWNER_LIST,
              publicSlug: null,
              isPublic: false,
            },
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    renderWithQuery(
      <ShareListSheet
        list={OWNER_LIST}
        members={[MEMBER_BOB]}
        currentUserId="11111111-1111-4111-8111-111111111111"
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("/s/AbCdEf123456")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Invite by username"), { target: { value: "@bob" } });
    fireEvent.change(screen.getByLabelText("Collaborator role"), { target: { value: "editor" } });
    fireEvent.click(screen.getByRole("button", { name: "Invite" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/lists/${OWNER_LIST.id}/members`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ username: "bob", role: "editor" }),
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Regenerate link" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/lists/${OWNER_LIST.id}`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ regenerateSlug: true }),
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Revoke link" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/lists/${OWNER_LIST.id}`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ revokeSlug: true }),
        }),
      );
    });
  });

  it("enforces viewer read-only UI, hides owner private ratings, and saves shared spot in ListDetail", async () => {
    const viewerDetail: ListDetailResponse = {
      list: {
        ...OWNER_LIST,
        viewerRole: "viewer",
      },
      items: [
        {
          id: "rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrr1",
          placeId: "pppppppp-pppp-4ppp-8ppp-ppppppppppp1",
          googlePlaceId: "ChIJ-shared-1",
          googleMapsUri: "https://maps.google.com/?cid=55",
          lat: 47.61,
          lng: -122.33,
          name: "Cafe Flora",
          address: "2901 E Madison St, Seattle, WA",
          city: "Seattle",
          countryCode: "US",
          cuisines: ["Vegetarian-friendly"],
          priceLevel: 2,
          status: "to_try",
          ratingHalf: null,
          notes: null,
          visitCount: 0,
          lastVisitedOn: null,
          createdAt: "2026-11-15T00:00:00.000Z",
          updatedAt: "2026-11-15T00:00:00.000Z",
          position: "a0",
          addedAt: "2026-11-15T00:00:00.000Z",
          isOwnedByViewer: false,
          viewerRestaurantId: null,
        },
      ],
      members: [MEMBER_BOB],
    };

    const savedRestaurant: UserRestaurantItem = {
      id: "99999999-9999-4999-8999-999999999999",
      placeId: "pppppppp-pppp-4ppp-8ppp-ppppppppppp1",
      googlePlaceId: "ChIJ-shared-1",
      googleMapsUri: "https://maps.google.com/?cid=55",
      lat: 47.61,
      lng: -122.33,
      name: "Cafe Flora",
      address: "2901 E Madison St, Seattle, WA",
      city: "Seattle",
      countryCode: "US",
      cuisines: ["Vegetarian-friendly"],
      priceLevel: 2,
      status: "to_try",
      ratingHalf: null,
      notes: null,
      visitCount: 0,
      lastVisitedOn: null,
      createdAt: "2026-11-15T00:00:00.000Z",
      updatedAt: "2026-11-15T00:00:00.000Z",
    };

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ created: true, restaurant: savedRestaurant }), {
        status: 201,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWithQuery(<ListDetail initialDetail={viewerDetail} currentUserId={MEMBER_BOB.userId} />);

    expect(screen.getByText("Viewer")).toBeInTheDocument();
    expect(screen.getByText(/Shared by @alice/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reorder Cafe Flora" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove Cafe Flora from list" }),
    ).not.toBeInTheDocument();

    // Spot title is not linked to Alice's /places/[id] before saving
    expect(screen.queryByRole("link", { name: "Cafe Flora" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/lists/${OWNER_LIST.id}/save-place`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ sourceRestaurantId: "rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrr1" }),
        }),
      );
    });
  });

  it("shows drag & remove controls for editor collaborators while hiding Edit and Delete", () => {
    const editorDetail: ListDetailResponse = {
      list: { ...OWNER_LIST, viewerRole: "editor" },
      items: [
        {
          id: "rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrr1",
          placeId: "pppppppp-pppp-4ppp-8ppp-ppppppppppp1",
          googlePlaceId: "ChIJ-shared-1",
          googleMapsUri: null,
          lat: 47.61,
          lng: -122.33,
          name: "Cafe Flora",
          address: "Seattle, WA",
          city: "Seattle",
          countryCode: "US",
          cuisines: ["Pizza"],
          priceLevel: 2,
          status: "tried",
          ratingHalf: 9,
          notes: null,
          visitCount: 1,
          lastVisitedOn: null,
          createdAt: "2026-11-15T00:00:00.000Z",
          updatedAt: "2026-11-15T00:00:00.000Z",
          position: "a0",
          addedAt: "2026-11-15T00:00:00.000Z",
          isOwnedByViewer: true,
          viewerRestaurantId: "rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrr1",
        },
      ],
      members: [],
    };

    renderWithQuery(<ListDetail initialDetail={editorDetail} currentUserId={MEMBER_BOB.userId} />);

    expect(screen.getByText("Editor")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reorder Cafe Flora" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Cafe Flora from list" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("filters out viewer lists and matches placeIds in AddToListsSheet", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    client.setQueryData(
      ["lists"],
      [
        {
          ...OWNER_LIST,
          name: "Editable Collab",
          viewerRole: "editor",
          restaurantIds: ["someone-else-row"],
          placeIds: ["pppppppp-pppp-4ppp-8ppp-ppppppppppp1"],
        },
        {
          ...OWNER_LIST,
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          name: "ReadOnly Friend List",
          viewerRole: "viewer",
        },
      ],
    );

    const spot: UserRestaurantItem = {
      id: "99999999-9999-4999-8999-999999999999",
      placeId: "pppppppp-pppp-4ppp-8ppp-ppppppppppp1",
      googlePlaceId: "ChIJ-1",
      googleMapsUri: null,
      lat: 47.6,
      lng: -122.3,
      name: "Cafe Flora",
      address: "Seattle, WA",
      city: "Seattle",
      countryCode: "US",
      cuisines: ["Pizza"],
      priceLevel: 2,
      status: "to_try",
      ratingHalf: null,
      notes: null,
      visitCount: 0,
      lastVisitedOn: null,
      createdAt: "2026-11-15T00:00:00.000Z",
      updatedAt: "2026-11-15T00:00:00.000Z",
    };

    render(
      <QueryClientProvider client={client}>
        <AddToListsSheet restaurant={spot} open onOpenChange={vi.fn()} />
      </QueryClientProvider>,
    );

    const editableBtn = screen.getByRole("button", { name: /Editable Collab/ });
    expect(editableBtn).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("ReadOnly Friend List")).not.toBeInTheDocument();
  });

  it("switches to Map view in PublicListDetail", async () => {
    const detail: PublicListDetailResponse = {
      list: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        name: "Seattle Vegan Guide",
        description: "Top picks",
        icon: "bowl",
        publicSlug: "AbCdEf123456",
        isFeatured: false,
        city: "Seattle",
        copyCount: 1,
        itemCount: 1,
        curatorName: "Alice",
        curatorUsername: "alice",
        cuisines: ["Asian"],
        savedCopyListId: null,
        createdAt: "2026-11-15T00:00:00.000Z",
        updatedAt: "2026-11-15T00:00:00.000Z",
      },
      items: [
        {
          id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
          placeId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
          googlePlaceId: "ChIJ-1",
          googleMapsUri: "https://maps.google.com/?cid=101",
          lat: 47.61,
          lng: -122.33,
          name: "Chu Minh Tofu",
          address: "Seattle, WA",
          city: "Seattle",
          countryCode: "US",
          cuisines: ["Asian"],
          priceLevel: 1,
          curatorNote: null,
          position: "a0",
          addedAt: "2026-11-15T00:00:00.000Z",
          savedByViewer: false,
          viewerRestaurantId: null,
        },
      ],
    };

    renderWithQuery(
      <PublicListDetail
        initialDetail={detail}
        viewerSignedIn
        backHref="/explore"
        backLabel="All public lists"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Map" }));
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Directions/ })).toBeInTheDocument();
    });
  });
});
