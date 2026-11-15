import { describe, expect, it } from "vitest";

import {
  extractUrlFromInput,
  parseGoogleMapsUrlMetadata,
  validateGoogleMapsUrl,
} from "./url-parser";

describe("validateGoogleMapsUrl", () => {
  it("accepts maps.app.goo.gl and goo.gl/maps short links", () => {
    const appLink = validateGoogleMapsUrl("https://maps.app.goo.gl/XyZ123AbC");
    expect(appLink.ok).toBe(true);
    if (appLink.ok) expect(appLink.isShortLink).toBe(true);

    const legacyShort = validateGoogleMapsUrl("https://goo.gl/maps/abc123XYZ");
    expect(legacyShort.ok).toBe(true);
    if (legacyShort.ok) expect(legacyShort.isShortLink).toBe(true);
  });

  it("extracts URL from Android/iOS share text containing name + URL", () => {
    const shareText = "Check out Tartine Bakery https://maps.app.goo.gl/9f8e7d6c5b! So good.";
    expect(extractUrlFromInput(shareText)).toBe("https://maps.app.goo.gl/9f8e7d6c5b");

    const validated = validateGoogleMapsUrl(shareText);
    expect(validated.ok).toBe(true);
  });

  it("accepts google.com/maps and maps.google.com place URLs", () => {
    expect(
      validateGoogleMapsUrl(
        "https://www.google.com/maps/place/Tartine+Bakery/@37.7614,-122.4241,17z",
      ).ok,
    ).toBe(true);

    expect(validateGoogleMapsUrl("https://maps.google.com/?cid=6926389544917822571").ok).toBe(true);
  });

  it("rejects non-Google and non-place URLs cleanly", () => {
    expect(validateGoogleMapsUrl("https://www.yelp.com/biz/tartine-bakery").ok).toBe(false);
    expect(validateGoogleMapsUrl("https://www.google.com/search?q=tartine+bakery").ok).toBe(false);
    expect(validateGoogleMapsUrl("https://www.google.com/maps").ok).toBe(false);
    expect(validateGoogleMapsUrl("javascript:alert(1)").ok).toBe(false);
    expect(validateGoogleMapsUrl("not even a url").ok).toBe(false);
  });
});

describe("parseGoogleMapsUrlMetadata", () => {
  it("prefers exact !3d!4d pin coordinates over @lat,lng viewport coordinates", () => {
    const url =
      "https://www.google.com/maps/place/Nopa/@37.7749,-122.4375,15z/data=!3m1!4b1!4m6!3m5!1s0x808580b649c00001:0x1234abcd!8m2!3d37.774881!4d-122.437492!16s%2Fg%2F1t";
    const meta = parseGoogleMapsUrlMetadata(url);

    expect(meta.placeName).toBe("Nopa");
    expect(meta.coords).toEqual({ lat: 37.774881, lng: -122.437492 });
    expect(meta.cid).toBe("0x808580b649c00001:0x1234abcd");
  });

  it("falls back to @lat,lng viewport coordinates when !3d!4d is absent", () => {
    const meta = parseGoogleMapsUrlMetadata(
      "https://www.google.com/maps/place/Tartine+Bakery/@37.761417,-122.424104,17z",
    );
    expect(meta.placeName).toBe("Tartine Bakery");
    expect(meta.coords).toEqual({ lat: 37.761417, lng: -122.424104 });
  });

  it("parses decimal ?cid= and query_place_id URLs", () => {
    const cidMeta = parseGoogleMapsUrlMetadata("https://maps.google.com/?cid=6926389544917822571");
    expect(cidMeta.cid).toBe("6926389544917822571");

    const chijMeta = parseGoogleMapsUrlMetadata(
      "https://www.google.com/maps/search/?api=1&query=Tartine&query_place_id=ChIJBVY2Bxh-j4ARa2zO8Jd6H2A",
    );
    expect(chijMeta.queryPlaceId).toBe("ChIJBVY2Bxh-j4ARa2zO8Jd6H2A");
    expect(chijMeta.placeName).toBe("Tartine");
  });
});
