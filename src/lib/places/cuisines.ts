import type { FoodIconKey } from "@/components/icons/food-icons";

export const GOOGLE_PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 1,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

export function mapGooglePriceLevel(priceLevel?: string | null): number | null {
  if (!priceLevel) return null;
  return GOOGLE_PRICE_LEVEL_MAP[priceLevel] ?? null;
}

export function formatPriceLevel(level?: number | null): string | null {
  if (!level || level < 1 || level > 4) return null;
  return "$".repeat(level);
}

export const GOOGLE_TYPE_TO_CUISINE: Record<string, string> = {
  afghani_restaurant: "Afghan",
  african_restaurant: "African",
  american_restaurant: "American",
  asian_restaurant: "Asian",
  bagel_shop: "Bakery",
  bakery: "Bakery",
  bar: "Bar",
  bar_and_grill: "Bar & Grill",
  barbecue_restaurant: "BBQ",
  brazilian_restaurant: "Brazilian",
  breakfast_restaurant: "Breakfast",
  brunch_restaurant: "Brunch",
  buffet_restaurant: "Buffet",
  burger_restaurant: "Burgers",
  cafe: "Café",
  cafeteria: "Café",
  cat_cafe: "Café",
  chinese_restaurant: "Chinese",
  chocolate_shop: "Dessert",
  coffee_shop: "Coffee",
  confectionery: "Dessert",
  deli: "Deli",
  dessert_restaurant: "Dessert",
  dessert_shop: "Dessert",
  diner: "Diner",
  dog_cafe: "Café",
  donut_shop: "Bakery",
  fast_food_restaurant: "Fast Casual",
  fine_dining_restaurant: "Fine Dining",
  french_restaurant: "French",
  greek_restaurant: "Greek",
  hamburger_restaurant: "Burgers",
  ice_cream_shop: "Ice Cream",
  indian_restaurant: "Indian",
  indonesian_restaurant: "Indonesian",
  italian_restaurant: "Italian",
  japanese_restaurant: "Japanese",
  juice_shop: "Juice",
  korean_restaurant: "Korean",
  lebanese_restaurant: "Lebanese",
  meal_delivery: "Takeout",
  meal_takeaway: "Takeout",
  mediterranean_restaurant: "Mediterranean",
  mexican_restaurant: "Mexican",
  middle_eastern_restaurant: "Middle Eastern",
  noodle_shop: "Noodles",
  pastry_shop: "Bakery",
  pizza_restaurant: "Pizza",
  pub: "Pub",
  ramen_restaurant: "Ramen",
  sandwich_shop: "Sandwiches",
  seafood_restaurant: "Seafood",
  spanish_restaurant: "Spanish",
  steak_house: "Steakhouse",
  sushi_restaurant: "Sushi",
  tea_house: "Tea",
  thai_restaurant: "Thai",
  turkish_restaurant: "Turkish",
  vegan_restaurant: "Vegan",
  vegetarian_restaurant: "Vegetarian",
  vietnamese_restaurant: "Vietnamese",
  wine_bar: "Wine Bar",
};

const IGNORED_GENERIC_TYPES = new Set([
  "restaurant",
  "food",
  "food_store",
  "store",
  "point_of_interest",
  "establishment",
  "service",
]);

/**
 * Extracts up to 3 crisp cuisine tags from Google Places `primaryType` and `types`.
 * Falls back to `["Restaurant"]` if no more specific culinary type matches.
 */
export function mapGoogleTypesToCuisines(
  primaryType?: string | null,
  types?: readonly string[] | null,
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  const pushLabel = (label: string | undefined) => {
    if (!label || seen.has(label)) return;
    seen.add(label);
    result.push(label);
  };

  if (primaryType) {
    pushLabel(GOOGLE_TYPE_TO_CUISINE[primaryType]);
  }

  for (const type of types ?? []) {
    if (result.length >= 3) break;
    if (IGNORED_GENERIC_TYPES.has(type)) continue;
    pushLabel(GOOGLE_TYPE_TO_CUISINE[type]);
  }

  if (result.length === 0) {
    return ["Restaurant"];
  }

  return result;
}

const CUISINE_TO_ICON: Array<{ match: RegExp; icon: FoodIconKey }> = [
  { match: /pizza/i, icon: "pizza" },
  { match: /ramen|noodle|pho|udon/i, icon: "noodles" },
  { match: /sushi|japanese/i, icon: "sushi" },
  { match: /taco|mexican/i, icon: "taco" },
  { match: /burger/i, icon: "burger" },
  { match: /bakery|croissant|breakfast|brunch/i, icon: "croissant" },
  { match: /coffee|caf[eé]|tea/i, icon: "coffee" },
  { match: /wine|bar|pub/i, icon: "wine" },
  { match: /ice cream|dessert/i, icon: "ice_cream" },
  { match: /indian|thai|curry|indonesian/i, icon: "curry" },
  { match: /salad|vegan|vegetarian|mediterranean/i, icon: "salad" },
];

export function mapCuisinesToFoodIcon(cuisines: readonly string[]): FoodIconKey {
  for (const cuisine of cuisines) {
    for (const rule of CUISINE_TO_ICON) {
      if (rule.match.test(cuisine)) {
        return rule.icon;
      }
    }
  }
  return "bowl";
}

export const QUICK_CUISINE_SUGGESTIONS = [
  "Italian",
  "Japanese",
  "Ramen",
  "Sushi",
  "Mexican",
  "Chinese",
  "Thai",
  "Indian",
  "Korean",
  "French",
  "Bakery",
  "Café",
  "Pizza",
  "Burgers",
  "Mediterranean",
  "Seafood",
  "Wine Bar",
  "Dessert",
] as const;
