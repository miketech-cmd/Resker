import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface CitySpec {
  slug: string;
  listName: string;
  city: string;
  countryCode: string;
  description: string;
  icon: string;
  locationCenter: { latitude: number; longitude: number; radius: number };
  acceptCityMatch: (
    addr: string,
    components: AddressComponent[],
  ) => {
    matched: boolean;
    borderingArea?: string;
  };
}

interface CuisineSpec {
  key: "Asian" | "Indian" | "Mexican" | "Ramen" | "Pizza";
  queries: (city: string) => string[];
  allowFallbackAdjacent?: boolean;
}

interface AddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

interface RawPlaceResult {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: AddressComponent[];
  location?: { latitude?: number; longitude?: number };
  priceLevel?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  primaryType?: string;
  servesVegetarianFood?: boolean;
  businessStatus?: string;
}

export interface CuratedSpot {
  googlePlaceId: string;
  name: string;
  address: string;
  city: string;
  countryCode: string;
  lat: number;
  lng: number;
  cuisines: string[];
  priceLevel: number | null;
  googleMapsUri: string;
  curatorNote: string;
}

export interface CuratedGuide {
  slug: string;
  name: string;
  city: string;
  icon: string;
  description: string;
  spots: CuratedSpot[];
}

const NYC_BOROUGHS = new Set(["New York", "Manhattan", "Brooklyn", "Queens", "Bronx", "Astoria"]);

function extractLocality(components: AddressComponent[] = []): string | null {
  const locality = components.find((c) => c.types?.includes("locality"))?.longText;
  if (locality) return locality;
  return components.find((c) => c.types?.includes("sublocality_level_1"))?.longText ?? null;
}

const CITIES: CitySpec[] = [
  {
    slug: "nyc-vegetarian-guide",
    listName: "NYC Top Vegetarian-Friendly Picks",
    city: "New York",
    countryCode: "US",
    icon: "pizza",
    description:
      "Top-reviewed vegetarian-friendly favorites across New York City — 5 standout picks each for Asian, Indian, Mexican, Ramen, and Pizza.",
    locationCenter: { latitude: 40.7359, longitude: -73.9911, radius: 14000 },
    acceptCityMatch: (addr, components) => {
      const loc = extractLocality(components);
      const ok = Boolean(
        (loc && NYC_BOROUGHS.has(loc)) || /, (New York|Brooklyn|NY) \d{5}/.test(addr),
      );
      return { matched: ok };
    },
  },
  {
    slug: "seattle-vegetarian-guide",
    listName: "Seattle Top Vegetarian-Friendly Picks",
    city: "Seattle",
    countryCode: "US",
    icon: "coffee",
    description:
      "Top-reviewed vegetarian-friendly dining across Seattle — 5 standout spots each for Asian, Indian, Mexican, Ramen, and Pizza.",
    locationCenter: { latitude: 47.6062, longitude: -122.3321, radius: 14000 },
    acceptCityMatch: (addr, components) => {
      const loc = extractLocality(components);
      return { matched: loc === "Seattle" || addr.includes("Seattle, WA") };
    },
  },
  {
    slug: "bellevue-vegetarian-guide",
    listName: "Bellevue Top Vegetarian-Friendly Picks",
    city: "Bellevue",
    countryCode: "US",
    icon: "bowl",
    description:
      "Top-reviewed vegetarian-friendly restaurants in Bellevue — 5 standout spots each for Asian, Indian, Mexican, Ramen, and Pizza.",
    locationCenter: { latitude: 47.6101, longitude: -122.2015, radius: 9000 },
    acceptCityMatch: (addr, components) => {
      const loc = extractLocality(components);
      if (loc === "Bellevue" || addr.includes("Bellevue, WA")) return { matched: true };
      if (loc === "Kirkland" || loc === "Redmond") {
        return { matched: false, borderingArea: loc };
      }
      return { matched: false };
    },
  },
  {
    slug: "redmond-vegetarian-guide",
    listName: "Redmond Top Vegetarian-Friendly Picks",
    city: "Redmond",
    countryCode: "US",
    icon: "curry",
    description:
      "Top-reviewed vegetarian-friendly restaurants in and around Redmond — 5 standout picks each for Asian, Indian, Mexican, Ramen, and Pizza.",
    locationCenter: { latitude: 47.674, longitude: -122.1215, radius: 10000 },
    acceptCityMatch: (addr, components) => {
      const loc = extractLocality(components);
      if (loc === "Redmond" || addr.includes("Redmond, WA")) return { matched: true };
      if (loc === "Bellevue" || loc === "Kirkland") {
        return { matched: false, borderingArea: loc };
      }
      return { matched: false };
    },
  },
  {
    slug: "san-francisco-vegetarian-guide",
    listName: "San Francisco Top Vegetarian-Friendly Picks",
    city: "San Francisco",
    countryCode: "US",
    icon: "taco",
    description:
      "Top-reviewed vegetarian-friendly spots across San Francisco — 5 curated picks each for Asian, Indian, Mexican, Ramen, and Pizza.",
    locationCenter: { latitude: 37.7749, longitude: -122.4194, radius: 12000 },
    acceptCityMatch: (addr, components) => {
      const loc = extractLocality(components);
      return { matched: loc === "San Francisco" || addr.includes("San Francisco, CA") };
    },
  },
];

const CUISINES: CuisineSpec[] = [
  {
    key: "Asian",
    queries: (city) => [
      `best vegetarian friendly Asian restaurant in ${city}`,
      `vegetarian Thai Chinese Korean tofu restaurant in ${city}`,
    ],
  },
  {
    key: "Indian",
    queries: (city) => [
      `best vegetarian friendly Indian restaurant in ${city}`,
      `top rated Indian dosa thali restaurant in ${city}`,
    ],
  },
  {
    key: "Mexican",
    queries: (city) => [
      `best vegetarian friendly Mexican restaurant in ${city}`,
      `top rated vegetarian tacos Mexican restaurant in ${city}`,
    ],
  },
  {
    key: "Ramen",
    queries: (city) => [
      `best vegetarian ramen restaurant in ${city}`,
      `top rated ramen restaurant vegan broth in ${city}`,
    ],
    allowFallbackAdjacent: true,
  },
  {
    key: "Pizza",
    queries: (city) => [
      `best vegetarian pizza restaurant in ${city}`,
      `top rated artisan wood fired pizza in ${city}`,
    ],
  },
];

const PRICE_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 1,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

const EXCLUDE_TYPES = new Set([
  "steak_house",
  "seafood_restaurant",
  "barbecue_restaurant",
  "brazilian_restaurant",
  "hamburger_restaurant",
]);

function matchesCuisineCategory(place: RawPlaceResult, cuisine: CuisineSpec["key"]): boolean {
  const hay =
    `${place.displayName?.text ?? ""} ${place.primaryType ?? ""} ${(place.types ?? []).join(" ")}`.toLowerCase();
  if (place.primaryType && EXCLUDE_TYPES.has(place.primaryType)) {
    return false;
  }

  switch (cuisine) {
    case "Ramen":
      return hay.includes("ramen") || hay.includes("noodle") || hay.includes("izakaya");
    case "Pizza":
      return hay.includes("pizza") || hay.includes("pizzeria") || hay.includes("italian");
    case "Indian":
      return (
        hay.includes("indian") ||
        hay.includes("curry") ||
        hay.includes("masala") ||
        hay.includes("biryani") ||
        hay.includes("chaat") ||
        hay.includes("dosa") ||
        hay.includes("tandoor") ||
        hay.includes("pakora") ||
        hay.includes("south_asian")
      );
    case "Mexican":
      return (
        hay.includes("mexican") ||
        hay.includes("taco") ||
        hay.includes("taqueria") ||
        hay.includes("burrito") ||
        hay.includes("cantina") ||
        hay.includes("oaxac") ||
        hay.includes("mezcal")
      );
    case "Asian":
      return (
        !hay.includes("ramen") &&
        (hay.includes("asian") ||
          hay.includes("thai") ||
          hay.includes("chinese") ||
          hay.includes("korean") ||
          hay.includes("vietnamese") ||
          hay.includes("japanese") ||
          hay.includes("taiwanese") ||
          hay.includes("dim sum") ||
          hay.includes("dumpling") ||
          hay.includes("noodle") ||
          hay.includes("tofu") ||
          hay.includes("vegan") ||
          hay.includes("vegetarian") ||
          hay.includes("burmese") ||
          hay.includes("sichuan"))
      );
  }
}

async function searchPlacesText(
  apiKey: string,
  textQuery: string,
  bias: { latitude: number; longitude: number; radius: number },
): Promise<RawPlaceResult[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.addressComponents",
        "places.location",
        "places.priceLevel",
        "places.googleMapsUri",
        "places.rating",
        "places.userRatingCount",
        "places.types",
        "places.primaryType",
        "places.servesVegetarianFood",
        "places.businessStatus",
      ].join(","),
    },
    body: JSON.stringify({
      textQuery,
      maxResultCount: 20,
      locationBias: {
        circle: {
          center: { latitude: bias.latitude, longitude: bias.longitude },
          radius: bias.radius,
        },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Places searchText failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { places?: RawPlaceResult[] };
  return data.places ?? [];
}

function scorePlace(p: RawPlaceResult): number {
  const rating = p.rating ?? 0;
  const reviews = p.userRatingCount ?? 0;
  const vegBoost = p.servesVegetarianFood === true ? 0.65 : 0;
  return rating + Math.log10(Math.max(reviews, 10)) * 0.38 + vegBoost;
}

function buildCuratorNote(
  cuisine: CuisineSpec["key"],
  city: string,
  place: RawPlaceResult,
  borderingArea?: string,
): string {
  const parts: string[] = [];
  if (place.servesVegetarianFood) {
    parts.push(`Top-reviewed vegetarian-friendly ${cuisine.toLowerCase()} spot`);
  } else {
    parts.push(`Highly rated ${cuisine.toLowerCase()} favorite with vegetarian options`);
  }
  if (borderingArea) {
    parts.push(`Nearby ${borderingArea} pick serving greater ${city}`);
  }
  return `${parts.join(" · ")}.`;
}

async function main() {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_SERVER_API_KEY is required.");
  }

  const guides: CuratedGuide[] = [];

  for (const citySpec of CITIES) {
    const usedPlaceIds = new Set<string>();
    const citySpots: CuratedSpot[] = [];

    for (const cuisine of CUISINES) {
      const candidates = new Map<string, RawPlaceResult>();

      for (const query of cuisine.queries(citySpec.city)) {
        const batch = await searchPlacesText(apiKey, query, citySpec.locationCenter);
        for (const item of batch) {
          if (item.id && !candidates.has(item.id)) {
            candidates.set(item.id, item);
          }
        }
      }

      // If suburban Ramen bucket needs neighboring Eastside reach, run a wider query too
      if (citySpec.city === "Redmond" || citySpec.city === "Bellevue") {
        const wider = await searchPlacesText(
          apiKey,
          `best vegetarian friendly ${cuisine.key} restaurant near ${citySpec.city} Bellevue Kirkland`,
          { ...citySpec.locationCenter, radius: 15000 },
        );
        for (const item of wider) {
          if (item.id && !candidates.has(item.id)) {
            candidates.set(item.id, item);
          }
        }
      }

      const eligible = Array.from(candidates.values()).filter((p) => {
        if (!p.id || !p.displayName?.text || !p.formattedAddress) return false;
        if (usedPlaceIds.has(p.id)) return false;
        if (p.businessStatus && p.businessStatus !== "OPERATIONAL") return false;
        if ((p.rating ?? 0) < 4.1 || (p.userRatingCount ?? 0) < 40) return false;
        if (!p.location?.latitude || !p.location?.longitude) return false;
        if (!matchesCuisineCategory(p, cuisine.key)) return false;
        return true;
      });

      const exactCity = eligible
        .filter(
          (p) => citySpec.acceptCityMatch(p.formattedAddress!, p.addressComponents ?? []).matched,
        )
        .sort((a, b) => scorePlace(b) - scorePlace(a));

      const bordering = eligible
        .filter((p) => {
          const check = citySpec.acceptCityMatch(p.formattedAddress!, p.addressComponents ?? []);
          return !check.matched && Boolean(check.borderingArea);
        })
        .sort((a, b) => scorePlace(b) - scorePlace(a));

      const chosen: Array<{ place: RawPlaceResult; borderingArea?: string }> = [];
      for (const p of exactCity) {
        if (chosen.length >= 5) break;
        chosen.push({ place: p });
      }
      if (chosen.length < 5) {
        for (const p of bordering) {
          if (chosen.length >= 5) break;
          const check = citySpec.acceptCityMatch(p.formattedAddress!, p.addressComponents ?? []);
          chosen.push({ place: p, borderingArea: check.borderingArea });
        }
      }

      if (chosen.length < 5) {
        console.warn(
          `[WARN] ${citySpec.city} / ${cuisine.key} only found ${chosen.length} spots cleanly!`,
        );
      }

      for (const { place, borderingArea } of chosen) {
        usedPlaceIds.add(place.id);
        const cuisines: string[] = [cuisine.key];
        if (place.servesVegetarianFood) {
          cuisines.push("Vegetarian-friendly");
        }
        citySpots.push({
          googlePlaceId: place.id,
          name: place.displayName!.text!,
          address: place.formattedAddress!,
          city: borderingArea ?? citySpec.city,
          countryCode: citySpec.countryCode,
          lat: place.location!.latitude!,
          lng: place.location!.longitude!,
          cuisines,
          priceLevel: place.priceLevel ? (PRICE_MAP[place.priceLevel] ?? null) : null,
          googleMapsUri:
            place.googleMapsUri ??
            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.displayName!.text!)}&query_place_id=${encodeURIComponent(place.id)}`,
          curatorNote: buildCuratorNote(cuisine.key, citySpec.city, place, borderingArea),
        });
      }
    }

    guides.push({
      slug: citySpec.slug,
      name: citySpec.listName,
      city: citySpec.city,
      icon: citySpec.icon,
      description: citySpec.description,
      spots: citySpots,
    });

    console.log(`${citySpec.listName}: curated ${citySpots.length} spots`);
  }

  const outPath = resolve(process.cwd(), "src/db/data/curated-vegetarian-guides.json");
  writeFileSync(outPath, `${JSON.stringify({ guides }, null, 2)}\n`, "utf8");
  console.log(`Wrote verified guides manifest to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
