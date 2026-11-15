import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GooglePlacesError, getPlaceDetails, resolveGoogleMapsLinkToPlaceId } from "./google";

describe("src/server/google.ts", () => {
  const originalKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;

  beforeEach(() => {
    process.env.GOOGLE_MAPS_SERVER_API_KEY = "test-server-key";
  });

  afterEach(() => {
    process.env.GOOGLE_MAPS_SERVER_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it("rejects non-place URLs without calling external fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(
      resolveGoogleMapsLinkToPlaceId("https://www.yelp.com/biz/tartine-sf"),
    ).rejects.toBeInstanceOf(GooglePlacesError);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("uses Resolution API when entity placeId is returned", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          entities: [{ placeId: "ChIJBVY2Bxh-j4ARa2zO8Jd6H2A" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const id = await resolveGoogleMapsLinkToPlaceId("https://maps.app.goo.gl/test123");
    expect(id).toBe("ChIJBVY2Bxh-j4ARa2zO8Jd6H2A");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("falls back to redirect + Text Search when Resolution API returns empty entity", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      // 1. resolveMapsUrls fails to resolve
      .mockResolvedValueOnce(new Response(JSON.stringify({ entities: [{}] }), { status: 200 }))
      // 2. short link redirects to canonical place URL
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: {
            location:
              "https://www.google.com/maps/place/Tartine+Bakery/@37.7614,-122.4241,17z/data=!3d37.76143!4d-122.42408",
          },
        }),
      )
      // 3. GET final URL (200 HTML without ChIJ)
      .mockResolvedValueOnce(
        new Response("<html></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
      )
      // 4. places:searchText resolves IDs-only
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ places: [{ id: "ChIJBVY2Bxh-j4ARa2zO8Jd6H2A" }] }), {
          status: 200,
        }),
      );

    const id = await resolveGoogleMapsLinkToPlaceId("https://maps.app.goo.gl/abc999");
    expect(id).toBe("ChIJBVY2Bxh-j4ARa2zO8Jd6H2A");
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it("normalizes Place Details (New) fields cleanly", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "ChIJBVY2Bxh-j4ARa2zO8Jd6H2A",
          displayName: { text: "Tartine Bakery" },
          formattedAddress: "600 Guerrero St, San Francisco, CA 94110, USA",
          addressComponents: [
            { longText: "San Francisco", shortText: "SF", types: ["locality", "political"] },
            { longText: "United States", shortText: "US", types: ["country", "political"] },
          ],
          location: { latitude: 37.76143, longitude: -122.42408 },
          primaryType: "bakery",
          types: ["bakery", "cafe", "restaurant"],
          priceLevel: "PRICE_LEVEL_INEXPENSIVE",
          googleMapsUri: "https://maps.google.com/?cid=6926389544917822571",
        }),
        { status: 200 },
      ),
    );

    const details = await getPlaceDetails("ChIJBVY2Bxh-j4ARa2zO8Jd6H2A");
    expect(details).toEqual({
      googlePlaceId: "ChIJBVY2Bxh-j4ARa2zO8Jd6H2A",
      name: "Tartine Bakery",
      address: "600 Guerrero St, San Francisco, CA 94110, USA",
      city: "San Francisco",
      countryCode: "US",
      lat: 37.76143,
      lng: -122.42408,
      cuisines: ["Bakery", "Café"],
      priceLevel: 1,
      googleMapsUri: "https://maps.google.com/?cid=6926389544917822571",
      suggestedFoodIcon: "croissant",
    });
  });
});
