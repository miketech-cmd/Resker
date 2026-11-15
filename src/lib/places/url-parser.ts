export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ParsedGoogleMapsUrl {
  normalizedUrl: string;
  hostname: string;
  isShortLink: boolean;
  placeName: string | null;
  coords: Coordinates | null;
  cid: string | null;
  queryPlaceId: string | null;
}

const SHORT_LINK_HOSTS = new Set(["maps.app.goo.gl", "goo.gl"]);

const GOOGLE_MAPS_HOST_REGEX = /^(?:www\.|maps\.)?google\.(?:com|[a-z]{2}|com?\.[a-z]{2})$/i;

export const ALLOWED_GOOGLE_REDIRECT_HOSTS = [
  "maps.app.goo.gl",
  "goo.gl",
  "maps.google.com",
  "www.google.com",
  "google.com",
  "consent.google.com",
] as const;

export function isAllowedGoogleMapsHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return SHORT_LINK_HOSTS.has(lower) || GOOGLE_MAPS_HOST_REGEX.test(lower);
}

/**
 * Extracts and validates the first URL-like token from pasted share text
 * (e.g. mobile share sheets often copy `"Joe's Pizza https://maps.app.goo.gl/abc"`).
 */
export function extractUrlFromInput(rawInput: string): string | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/https?:\/\/[^\s]+/i);
  if (match) {
    return match[0].replace(/[),.;!?]+$/, "");
  }

  if (/^(?:maps\.app\.goo\.gl|goo\.gl\/maps|(?:www\.|maps\.)?google\.)/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return null;
}

/**
 * Validates that a string is a Google Maps link suitable for place resolution.
 * Rejects non-Google hosts, non-HTTPS/HTTP schemes, generic google.com searches without `/maps`,
 * and unsupported Maps paths (e.g. empty root `/maps` or `/maps/dir/` without a destination).
 */
export function validateGoogleMapsUrl(
  rawInput: string,
): { ok: true; url: URL; isShortLink: boolean } | { ok: false; message: string } {
  const extracted = extractUrlFromInput(rawInput);
  if (!extracted) {
    return { ok: false, message: "That doesn't look like a Google Maps place link." };
  }

  let parsed: URL;
  try {
    parsed = new URL(extracted);
  } catch {
    return { ok: false, message: "That doesn't look like a Google Maps place link." };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, message: "That doesn't look like a Google Maps place link." };
  }

  const host = parsed.hostname.toLowerCase();
  if (!isAllowedGoogleMapsHost(host)) {
    return { ok: false, message: "That doesn't look like a Google Maps place link." };
  }

  if (host === "maps.app.goo.gl") {
    if (parsed.pathname.length < 2) {
      return { ok: false, message: "That Google Maps short link looks incomplete." };
    }
    return { ok: true, url: parsed, isShortLink: true };
  }

  if (host === "goo.gl") {
    if (!parsed.pathname.startsWith("/maps/") || parsed.pathname.length <= "/maps/".length) {
      return { ok: false, message: "That doesn't look like a Google Maps place link." };
    }
    return { ok: true, url: parsed, isShortLink: true };
  }

  // Standard google.*/maps or maps.google.* hosts
  const isMapsSubdomain = host.startsWith("maps.google.");
  const hasMapsPath = parsed.pathname.startsWith("/maps");
  if (!isMapsSubdomain && !hasMapsPath) {
    return { ok: false, message: "That doesn't look like a Google Maps place link." };
  }

  // Reject bare `/maps` with no query/path detail
  const bareMapsPath = parsed.pathname === "/maps" || parsed.pathname === "/maps/";
  if (bareMapsPath && !parsed.search && !parsed.hash) {
    return {
      ok: false,
      message: "Open a specific restaurant in Google Maps before copying the link.",
    };
  }

  return { ok: true, url: parsed, isShortLink: false };
}

function isValidCoordPair(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function cleanPlaceName(raw: string): string | null {
  try {
    const decoded = decodeURIComponent(raw.replace(/\+/g, " ")).replace(/\s+/g, " ").trim();
    if (!decoded || /^@-?\d+(\.\d+)?,-?\d+(\.\d+)?/.test(decoded)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Extracts structured hints (place ID, name, coordinates, CID) from any resolved Google Maps URL.
 */
export function parseGoogleMapsUrlMetadata(urlInput: string | URL): ParsedGoogleMapsUrl {
  const url = typeof urlInput === "string" ? new URL(urlInput) : urlInput;
  const full = url.toString();
  const hostname = url.hostname.toLowerCase();
  const isShortLink =
    hostname === "maps.app.goo.gl" || (hostname === "goo.gl" && url.pathname.startsWith("/maps/"));

  // 1. Place ID: explicit `query_place_id` param or embedded `ChIJ...` token
  const queryPlaceIdParam = url.searchParams.get("query_place_id");
  const embeddedChijMatch = full.match(/ChIJ[A-Za-z0-9_-]{10,}/);
  const queryPlaceId = queryPlaceIdParam || embeddedChijMatch?.[0] || null;

  // 2. CID: `?cid=<digits>` or hex `0x...:0x...` (`!1s0x...:0x...`)
  const cidParam = url.searchParams.get("cid");
  const ftidMatch = full.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
  const cid = cidParam && /^\d+$/.test(cidParam) ? cidParam : ftidMatch?.[1] || null;

  // 3. Coordinates: prefer exact `!3d<lat>!4d<lng>` pin coords over viewport `@<lat>,<lng>`
  let coords: Coordinates | null = null;
  const dataPinMatch = full.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (dataPinMatch?.[1] && dataPinMatch[2]) {
    const lat = Number.parseFloat(dataPinMatch[1]);
    const lng = Number.parseFloat(dataPinMatch[2]);
    if (isValidCoordPair(lat, lng)) {
      coords = { lat, lng };
    }
  }
  if (!coords) {
    const atMatch = full.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (atMatch?.[1] && atMatch[2]) {
      const lat = Number.parseFloat(atMatch[1]);
      const lng = Number.parseFloat(atMatch[2]);
      if (isValidCoordPair(lat, lng)) {
        coords = { lat, lng };
      }
    }
  }
  if (!coords) {
    const llParam = url.searchParams.get("ll") || url.searchParams.get("sll");
    if (llParam) {
      const [latStr, lngStr] = llParam.split(",");
      const lat = Number.parseFloat(latStr ?? "");
      const lng = Number.parseFloat(lngStr ?? "");
      if (isValidCoordPair(lat, lng)) {
        coords = { lat, lng };
      }
    }
  }

  // 4. Place name: `/maps/place/<name>/` or `?q=<name>` or `?query=<name>`
  let placeName: string | null = null;
  const placePathMatch = url.pathname.match(/\/maps\/place\/([^/]+)/i);
  if (placePathMatch?.[1]) {
    placeName = cleanPlaceName(placePathMatch[1]);
  }
  if (!placeName) {
    const q = url.searchParams.get("q") || url.searchParams.get("query");
    if (q) {
      // Ignore pure coordinate queries like `q=37.76,-122.42`
      if (!/^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(q.trim())) {
        placeName = cleanPlaceName(q);
      } else if (!coords) {
        const [latStr, lngStr] = q.split(",");
        const lat = Number.parseFloat(latStr ?? "");
        const lng = Number.parseFloat(lngStr ?? "");
        if (isValidCoordPair(lat, lng)) {
          coords = { lat, lng };
        }
      }
    }
  }

  return {
    normalizedUrl: full,
    hostname,
    isShortLink,
    placeName,
    coords,
    cid,
    queryPlaceId,
  };
}
