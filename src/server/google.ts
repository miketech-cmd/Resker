import "server-only";

import type { FoodIconKey } from "@/components/icons/food-icons";
import {
  mapCuisinesToFoodIcon,
  mapGooglePriceLevel,
  mapGoogleTypesToCuisines,
} from "@/lib/places/cuisines";
import {
  isAllowedGoogleMapsHost,
  parseGoogleMapsUrlMetadata,
  validateGoogleMapsUrl,
  type Coordinates,
} from "@/lib/places/url-parser";

const RESOLUTION_ENDPOINT = "https://mapstools.googleapis.com/v1:resolveMapsUrls";
const PLACES_BASE_URL = "https://places.googleapis.com/v1";

const PLACE_DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "addressComponents",
  "location",
  "types",
  "primaryType",
  "priceLevel",
  "googleMapsUri",
].join(",");

const AUTOCOMPLETE_FIELD_MASK = [
  "suggestions.placePrediction.placeId",
  "suggestions.placePrediction.text",
  "suggestions.placePrediction.structuredFormat",
  "suggestions.placePrediction.types",
].join(",");

const FOOD_AUTOCOMPLETE_PRIMARY_TYPES = ["restaurant", "cafe", "bakery", "bar", "meal_takeaway"];

export class GooglePlacesError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "GooglePlacesError";
    this.status = status;
    this.code = code;
  }
}

export interface NormalizedPlaceDetails {
  googlePlaceId: string;
  name: string;
  address: string | null;
  city: string | null;
  countryCode: string | null;
  lat: number | null;
  lng: number | null;
  cuisines: string[];
  priceLevel: number | null;
  googleMapsUri: string | null;
  suggestedFoodIcon: FoodIconKey;
}

export interface AutocompleteSuggestion {
  googlePlaceId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
  cuisines: string[];
}

function getServerApiKey(): string {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim();
  if (!key) {
    throw new GooglePlacesError(
      503,
      "GOOGLE_NOT_CONFIGURED",
      "Google Maps server API key is not configured.",
    );
  }
  return key;
}

function normalizePlaceResourceId(raw: string): string {
  return raw.startsWith("places/") ? raw.slice("places/".length) : raw;
}

/**
 * Primary link resolver via Google Maps Tools Resolution API (`resolveMapsUrls`).
 * Returns `null` when Google could not resolve the link so the redirect/text fallback runs.
 */
export async function resolveMapsUrl(url: string): Promise<string | null> {
  const apiKey = getServerApiKey();

  try {
    const response = await fetch(RESOLUTION_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify({ urls: [url] }),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      entities?: Array<{ placeId?: string; place?: string }>;
    };
    const first = payload.entities?.[0];
    const candidate =
      first?.placeId || (first?.place ? normalizePlaceResourceId(first.place) : null);
    return candidate?.trim() || null;
  } catch {
    return null;
  }
}

async function searchPlaceIdByText(
  textQuery: string,
  coords: Coordinates | null,
): Promise<string | null> {
  const apiKey = getServerApiKey();

  const body: Record<string, unknown> = {
    textQuery,
    maxResultCount: 1,
  };

  if (coords) {
    body.locationBias = {
      circle: {
        center: { latitude: coords.lat, longitude: coords.lng },
        radius: 200.0,
      },
    };
  }

  const response = await fetch(`${PLACES_BASE_URL}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { places?: Array<{ id?: string }> };
  return payload.places?.[0]?.id?.trim() || null;
}

function extractTitleFromHtml(html: string): string | null {
  const ogMatch =
    html.match(/<meta[^>]+(?:property|name)=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:title["']/i)?.[1];
  const raw = ogMatch?.trim();
  if (!raw || raw.toLowerCase() === "google maps") return null;
  return raw.replace(/\s*[-·]\s*Google Maps$/i, "").trim() || null;
}

/**
 * Fallback resolver: follows up to 5 redirects strictly across allowlisted Google hosts,
 * extracts coordinates + place name or embedded place ID, and resolves via Text Search (New).
 */
export async function resolveByRedirect(rawUrl: string): Promise<string | null> {
  const initialMeta = parseGoogleMapsUrlMetadata(rawUrl);
  if (initialMeta.queryPlaceId) {
    return initialMeta.queryPlaceId;
  }

  let currentUrl = rawUrl;
  let finalHtml = "";

  for (let hop = 0; hop < 5; hop++) {
    let parsedCurrent: URL;
    try {
      parsedCurrent = new URL(currentUrl);
    } catch {
      return null;
    }

    if (!isAllowedGoogleMapsHost(parsedCurrent.hostname)) {
      return null;
    }

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Resker/1.0)",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(4000),
        cache: "no-store",
      });
    } catch {
      return null;
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) break;

      let resolvedNext: URL;
      try {
        resolvedNext = new URL(location, currentUrl);
      } catch {
        return null;
      }

      if (!isAllowedGoogleMapsHost(resolvedNext.hostname)) {
        return null;
      }

      currentUrl = resolvedNext.toString();
      const hopMeta = parseGoogleMapsUrlMetadata(currentUrl);
      if (hopMeta.queryPlaceId) {
        return hopMeta.queryPlaceId;
      }
      continue;
    }

    if (response.ok) {
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("text/html")) {
        try {
          const text = await response.text();
          finalHtml = text.slice(0, 128_000);
        } catch {
          finalHtml = "";
        }
      }
    }
    break;
  }

  const finalMeta = parseGoogleMapsUrlMetadata(currentUrl);
  if (finalMeta.queryPlaceId) {
    return finalMeta.queryPlaceId;
  }

  if (finalHtml) {
    const htmlChij = finalHtml.match(/ChIJ[A-Za-z0-9_-]{10,}/)?.[0];
    if (htmlChij) {
      return htmlChij;
    }
  }

  const queryName = finalMeta.placeName ?? (finalHtml ? extractTitleFromHtml(finalHtml) : null);
  const coords = finalMeta.coords ?? initialMeta.coords;

  if (queryName) {
    return searchPlaceIdByText(queryName, coords);
  }

  return null;
}

export async function resolveGoogleMapsLinkToPlaceId(rawInput: string): Promise<string> {
  const validated = validateGoogleMapsUrl(rawInput);
  if (!validated.ok) {
    throw new GooglePlacesError(400, "INVALID_MAPS_URL", validated.message);
  }

  const normalized = validated.url.toString();
  const parsed = parseGoogleMapsUrlMetadata(validated.url);
  if (parsed.queryPlaceId) {
    return parsed.queryPlaceId;
  }

  const primaryPlaceId = await resolveMapsUrl(normalized);
  if (primaryPlaceId) {
    return primaryPlaceId;
  }

  const fallbackPlaceId = await resolveByRedirect(normalized);
  if (fallbackPlaceId) {
    return fallbackPlaceId;
  }

  throw new GooglePlacesError(
    422,
    "PLACE_NOT_FOUND",
    "We couldn't find a specific place in that link. Try searching by name instead.",
  );
}

interface GoogleAddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

function extractAddressPart(
  components: GoogleAddressComponent[] | undefined,
  preferredTypes: readonly string[],
  useShort = false,
): string | null {
  if (!components?.length) return null;
  for (const targetType of preferredTypes) {
    const match = components.find((c) => c.types?.includes(targetType));
    if (match) {
      const val = useShort
        ? (match.shortText ?? match.longText)
        : (match.longText ?? match.shortText);
      if (val?.trim()) return val.trim();
    }
  }
  return null;
}

/**
 * Fetches normalized Place Details (New) on the server using the strict FieldMask.
 */
export async function getPlaceDetails(
  googlePlaceId: string,
  sessionToken?: string,
): Promise<NormalizedPlaceDetails> {
  const apiKey = getServerApiKey();
  const cleanId = normalizePlaceResourceId(googlePlaceId);
  const url = new URL(`${PLACES_BASE_URL}/places/${encodeURIComponent(cleanId)}`);
  if (sessionToken) {
    url.searchParams.set("sessionToken", sessionToken);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": PLACE_DETAILS_FIELD_MASK,
    },
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 404 || response.status === 400) {
      throw new GooglePlacesError(404, "PLACE_NOT_FOUND", "Place details could not be found.");
    }
    throw new GooglePlacesError(
      502,
      "GOOGLE_UPSTREAM_ERROR",
      "Google Places couldn't load that restaurant right now.",
    );
  }

  const data = (await response.json()) as {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    addressComponents?: GoogleAddressComponent[];
    location?: { latitude?: number; longitude?: number };
    types?: string[];
    primaryType?: string;
    priceLevel?: string;
    googleMapsUri?: string;
  };

  const cuisines = mapGoogleTypesToCuisines(data.primaryType, data.types);
  const resolvedId = data.id?.trim() || cleanId;

  return {
    googlePlaceId: resolvedId,
    name: data.displayName?.text?.trim() || "Untitled Place",
    address: data.formattedAddress?.trim() || null,
    city: extractAddressPart(data.addressComponents, [
      "locality",
      "postal_town",
      "sublocality_level_1",
      "administrative_area_level_2",
    ]),
    countryCode: extractAddressPart(data.addressComponents, ["country"], true),
    lat: typeof data.location?.latitude === "number" ? data.location.latitude : null,
    lng: typeof data.location?.longitude === "number" ? data.location.longitude : null,
    cuisines,
    priceLevel: mapGooglePriceLevel(data.priceLevel),
    googleMapsUri: data.googleMapsUri?.trim() || null,
    suggestedFoodIcon: mapCuisinesToFoodIcon(cuisines),
  };
}

/**
 * Proxies Google Places Autocomplete (New) for restaurants and food establishments.
 */
export async function autocompletePlaces({
  query,
  sessionToken,
  lat,
  lng,
}: {
  query: string;
  sessionToken?: string;
  lat?: number;
  lng?: number;
}): Promise<AutocompleteSuggestion[]> {
  const apiKey = getServerApiKey();

  const body: Record<string, unknown> = {
    input: query,
    includedPrimaryTypes: FOOD_AUTOCOMPLETE_PRIMARY_TYPES,
  };

  if (sessionToken) {
    body.sessionToken = sessionToken;
  }

  if (typeof lat === "number" && typeof lng === "number") {
    body.locationBias = {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: 5000.0,
      },
    };
  }

  const response = await fetch(`${PLACES_BASE_URL}/places:autocomplete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": AUTOCOMPLETE_FIELD_MASK,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(4000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new GooglePlacesError(
      502,
      "GOOGLE_UPSTREAM_ERROR",
      "Google search is temporarily unavailable.",
    );
  }

  const payload = (await response.json()) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId?: string;
        text?: { text?: string };
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
        types?: string[];
      };
    }>;
  };

  const results: AutocompleteSuggestion[] = [];
  for (const item of payload.suggestions ?? []) {
    const prediction = item.placePrediction;
    if (!prediction?.placeId) continue;

    const mainText =
      prediction.structuredFormat?.mainText?.text?.trim() ||
      prediction.text?.text?.trim() ||
      "Unknown place";
    const secondaryText = prediction.structuredFormat?.secondaryText?.text?.trim() || "";
    const fullText =
      prediction.text?.text?.trim() || (secondaryText ? `${mainText}, ${secondaryText}` : mainText);

    results.push({
      googlePlaceId: prediction.placeId,
      mainText,
      secondaryText,
      fullText,
      cuisines: mapGoogleTypesToCuisines(null, prediction.types),
    });
  }

  return results;
}

/**
 * Essentials-tier coordinate refresh helper for Phase 6 daily cron.
 */
export async function refreshLocation(
  googlePlaceId: string,
): Promise<{ googlePlaceId: string; lat: number | null; lng: number | null }> {
  const apiKey = getServerApiKey();
  const cleanId = normalizePlaceResourceId(googlePlaceId);

  const response = await fetch(`${PLACES_BASE_URL}/places/${encodeURIComponent(cleanId)}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "id,location",
    },
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new GooglePlacesError(
      502,
      "GOOGLE_UPSTREAM_ERROR",
      "Failed to refresh place coordinates.",
    );
  }

  const data = (await response.json()) as {
    id?: string;
    location?: { latitude?: number; longitude?: number };
  };

  return {
    googlePlaceId: data.id?.trim() || cleanId,
    lat: typeof data.location?.latitude === "number" ? data.location.latitude : null,
    lng: typeof data.location?.longitude === "number" ? data.location.longitude : null,
  };
}
