import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Pool, neonConfig } from "@neondatabase/serverless";
import { config as loadEnv } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

import * as schema from "./schema";
import { listItems, lists, places, user, userRestaurants } from "./schema";
import { generateNKeysBetween } from "../lib/fractional-index";

neonConfig.webSocketConstructor = ws;

const envLocal = resolve(process.cwd(), ".env.local");
if (existsSync(envLocal)) {
  loadEnv({ path: envLocal });
}
loadEnv();

const CURATOR_USER_ID = "resker-curated-guides";
const CURATOR_USERNAME = "resker";
const CURATOR_NAME = "Resker Guides";
const CURATOR_EMAIL = "resker@users.invalid";

interface CuratedSpotManifest {
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
  curatorNote: string | null;
}

interface CuratedGuideManifest {
  slug: string;
  name: string;
  city: string;
  icon: string;
  description: string;
  spots: CuratedSpotManifest[];
}

interface ManifestFile {
  guides: CuratedGuideManifest[];
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required to run db:seed-guides.");
  }

  const manifestPath = resolve(process.cwd(), "src/db/data/curated-vegetarian-guides.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ManifestFile;

  const pool = new Pool({ connectionString: url });
  const db = drizzle({ client: pool, schema });

  try {
    const now = new Date();
    let totalGuides = 0;
    let totalItems = 0;

    await db.transaction(async (tx) => {
      await tx
        .insert(user)
        .values({
          id: CURATOR_USER_ID,
          name: CURATOR_NAME,
          email: CURATOR_EMAIL,
          emailVerified: true,
          username: CURATOR_USERNAME,
          displayUsername: CURATOR_USERNAME,
        })
        .onConflictDoUpdate({
          target: user.id,
          set: {
            name: CURATOR_NAME,
            username: CURATOR_USERNAME,
            displayUsername: CURATOR_USERNAME,
          },
        });

      for (const guide of manifest.guides) {
        const [seededList] = await tx
          .insert(lists)
          .values({
            ownerId: CURATOR_USER_ID,
            name: guide.name,
            description: guide.description,
            icon: guide.icon,
            publicSlug: guide.slug,
            isPublic: true,
            isFeatured: true,
            city: guide.city,
          })
          .onConflictDoUpdate({
            target: lists.publicSlug,
            set: {
              ownerId: CURATOR_USER_ID,
              name: guide.name,
              description: guide.description,
              icon: guide.icon,
              isPublic: true,
              isFeatured: true,
              city: guide.city,
            },
          })
          .returning({ id: lists.id });

        if (!seededList) {
          throw new Error(`Failed to upsert curated guide list: ${guide.slug}`);
        }

        const positions = generateNKeysBetween(null, null, guide.spots.length);
        const itemRows: Array<typeof listItems.$inferInsert> = [];

        for (let idx = 0; idx < guide.spots.length; idx += 1) {
          const spot = guide.spots[idx]!;
          const [placeRow] = await tx
            .insert(places)
            .values({
              googlePlaceId: spot.googlePlaceId,
              lat: spot.lat,
              lng: spot.lng,
              locationFetchedAt: spot.lat != null && spot.lng != null ? now : null,
              googleMapsUri: spot.googleMapsUri,
            })
            .onConflictDoUpdate({
              target: places.googlePlaceId,
              set: {
                lat: spot.lat,
                lng: spot.lng,
                locationFetchedAt: spot.lat != null && spot.lng != null ? now : null,
                googleMapsUri: spot.googleMapsUri,
              },
            })
            .returning({ id: places.id });

          if (!placeRow) {
            throw new Error(`Failed to upsert place: ${spot.googlePlaceId}`);
          }

          const [curatorRestaurant] = await tx
            .insert(userRestaurants)
            .values({
              userId: CURATOR_USER_ID,
              placeId: placeRow.id,
              name: spot.name,
              address: spot.address,
              city: spot.city,
              countryCode: spot.countryCode,
              cuisines: spot.cuisines,
              priceLevel: spot.priceLevel,
              status: "to_try",
            })
            .onConflictDoUpdate({
              target: [userRestaurants.userId, userRestaurants.placeId],
              set: {
                name: spot.name,
                address: spot.address,
                city: spot.city,
                countryCode: spot.countryCode,
                cuisines: spot.cuisines,
                priceLevel: spot.priceLevel,
              },
            })
            .returning({ id: userRestaurants.id });

          if (!curatorRestaurant) {
            throw new Error(`Failed to upsert curator restaurant: ${spot.name}`);
          }

          itemRows.push({
            listId: seededList.id,
            userRestaurantId: curatorRestaurant.id,
            addedBy: CURATOR_USER_ID,
            position: positions[idx]!,
            curatorNote: spot.curatorNote,
          });
        }

        await tx.delete(listItems).where(eq(listItems.listId, seededList.id));
        if (itemRows.length > 0) {
          await tx.insert(listItems).values(itemRows);
        }

        totalGuides += 1;
        totalItems += itemRows.length;
        console.log(
          `[db:seed-guides] Seeded "${guide.name}" (${guide.slug}): ${itemRows.length} spots`,
        );
      }
    });

    console.log(
      `[db:seed-guides] Done: ${totalGuides} curated guides, ${totalItems} total list items.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[db:seed-guides] Failed:", err);
  process.exit(1);
});
