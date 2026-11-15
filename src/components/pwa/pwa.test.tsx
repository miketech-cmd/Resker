import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import manifest from "@/app/manifest";
import { AddSheet } from "@/components/places/add-sheet";
import { OfflineBanner } from "@/components/pwa/offline-banner";

const mockReplace = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  usePathname: () => "/places",
  useSearchParams: () => mockSearchParams,
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

describe("Phase 7 PWA manifest, offline banner, and Web Share Target", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    mockSearchParams = new URLSearchParams();
  });

  it("exposes Android share_target and regular + maskable PNG icons in manifest", () => {
    const m = manifest() as ReturnType<typeof manifest> & {
      share_target?: { action: string; params: Record<string, string> };
    };
    expect(m.id).toBe("/places");
    expect(m.share_target?.action).toBe("/places?add=1");
    expect(m.share_target?.params).toEqual({ title: "title", text: "text", url: "url" });
    expect(m.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/icons/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        }),
        expect.objectContaining({
          src: "/icons/icon-512.png",
          sizes: "512x512",
          type: "image/png",
        }),
        expect.objectContaining({
          src: "/icons/icon-maskable-512.png",
          sizes: "512x512",
          purpose: "maskable",
        }),
      ]),
    );
  });

  it("renders OfflineBanner only when browser goes offline", () => {
    const onlineSpy = vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    onlineSpy.mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByRole("status")).toHaveTextContent(/offline/i);

    onlineSpy.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("extracts Google Maps URL from Android share text even when ?add=1 is omitted", async () => {
    mockSearchParams = new URLSearchParams(
      "text=Check%20out%20Hangawi%20https%3A%2F%2Fmaps.app.goo.gl%2Fxyz123",
    );
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          alreadySaved: false,
          prefill: {
            googlePlaceId: "ChIJ-hangawi-share",
            googleMapsUri: "https://maps.google.com/?cid=123",
            lat: 40.7468,
            lng: -73.9846,
            name: "Hangawi",
            address: "12 E 32nd St, New York, NY",
            city: "New York",
            countryCode: "US",
            cuisines: ["Korean", "Vegetarian"],
            priceLevel: 2,
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <AddSheet />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/places/resolve",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ url: "https://maps.app.goo.gl/xyz123" }),
        }),
      );
    });
    expect(await screen.findByText("Place details powered by Google.")).toBeInTheDocument();
  });
});
