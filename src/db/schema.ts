import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// -----------------------------------------------------------------------------
// Better Auth Tables (user + username plugin, session, account, verification, rateLimit)
// -----------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  username: text("username").unique(),
  displayUsername: text("display_username"),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// -----------------------------------------------------------------------------
// App Enums
// -----------------------------------------------------------------------------

export const restaurantStatusEnum = pgEnum("restaurant_status", ["to_try", "tried", "exploration"]);

export const listRoleEnum = pgEnum("list_role", ["editor", "viewer"]);

export const planStatusEnum = pgEnum("plan_status", ["planned", "done", "cancelled"]);

// -----------------------------------------------------------------------------
// App Tables
// -----------------------------------------------------------------------------

/** Shared place catalogue: stores only permanent place_id + refreshed coordinates. */
export const places = pgTable("places", {
  id: uuid("id").defaultRandom().primaryKey(),
  googlePlaceId: text("google_place_id").notNull().unique(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  locationFetchedAt: timestamp("location_fetched_at", { withTimezone: true }),
  googleMapsUri: text("google_maps_uri"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Per-user saved restaurant record (all personal status, rating, notes, and user-owned fields). */
export const userRestaurants = pgTable(
  "user_restaurants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id),
    name: text("name").notNull(),
    address: text("address"),
    city: text("city"),
    countryCode: text("country_code"),
    cuisines: text("cuisines")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    priceLevel: smallint("price_level"),
    status: restaurantStatusEnum("status").notNull().default("to_try"),
    ratingHalf: smallint("rating_half"),
    notes: text("notes"),
    visitCount: integer("visit_count").notNull().default(0),
    lastVisitedOn: date("last_visited_on"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("user_restaurants_user_place_unique").on(table.userId, table.placeId),
    index("user_restaurants_user_status_idx").on(table.userId, table.status),
    index("user_restaurants_user_updated_idx").on(table.userId, table.updatedAt),
    check(
      "user_restaurants_price_level_check",
      sql`${table.priceLevel} IS NULL OR (${table.priceLevel} BETWEEN 1 AND 4)`,
    ),
    check(
      "user_restaurants_rating_half_check",
      sql`${table.ratingHalf} IS NULL OR (${table.ratingHalf} BETWEEN 1 AND 10)`,
    ),
  ],
);

export const visits = pgTable(
  "visits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userRestaurantId: uuid("user_restaurant_id")
      .notNull()
      .references(() => userRestaurants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    visitedOn: date("visited_on").notNull(),
    ratingHalf: smallint("rating_half"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("visits_restaurant_date_idx").on(table.userRestaurantId, table.visitedOn),
    index("visits_user_date_idx").on(table.userId, table.visitedOn),
    check(
      "visits_rating_half_check",
      sql`${table.ratingHalf} IS NULL OR (${table.ratingHalf} BETWEEN 1 AND 10)`,
    ),
  ],
);

export const visitDishes = pgTable(
  "visit_dishes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    visitId: uuid("visit_id")
      .notNull()
      .references(() => visits.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    note: text("note"),
    wouldOrderAgain: boolean("would_order_again"),
    position: integer("position").notNull().default(0),
  },
  (table) => [index("visit_dishes_visit_pos_idx").on(table.visitId, table.position)],
);

export const lists = pgTable(
  "lists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon"),
    publicSlug: text("public_slug").unique(),
    isPublic: boolean("is_public").notNull().default(false),
    isFeatured: boolean("is_featured").notNull().default(false),
    city: text("city"),
    copyCount: integer("copy_count").notNull().default(0),
    sourceListId: uuid("source_list_id").references((): AnyPgColumn => lists.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("lists_owner_id_idx").on(table.ownerId),
    index("lists_public_browse_idx").on(table.isPublic, table.isFeatured, table.copyCount),
  ],
);

export const listItems = pgTable(
  "list_items",
  {
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    userRestaurantId: uuid("user_restaurant_id")
      .notNull()
      .references(() => userRestaurants.id, { onDelete: "cascade" }),
    addedBy: text("added_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    position: text("position").notNull(),
    curatorNote: text("curator_note"),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.listId, table.userRestaurantId] }),
    index("list_items_list_position_idx").on(table.listId, table.position),
    index("list_items_restaurant_idx").on(table.userRestaurantId),
  ],
);

// P1: sharing with signed-in users
export const listMembers = pgTable(
  "list_members",
  {
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: listRoleEnum("role").notNull(),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.listId, table.userId] }),
    index("list_members_user_id_idx").on(table.userId),
  ],
);

// P1: planned visits
export const plannedVisits = pgTable(
  "planned_visits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userRestaurantId: uuid("user_restaurant_id")
      .notNull()
      .references(() => userRestaurants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    plannedFor: date("planned_for").notNull(),
    plannedTime: time("planned_time"),
    note: text("note"),
    status: planStatusEnum("status").notNull().default("planned"),
    visitId: uuid("visit_id").references(() => visits.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("planned_visits_user_planned_idx")
      .on(table.userId, table.plannedFor)
      .where(sql`${table.status} = 'planned'`),
  ],
);

// P1: visit photos (Vercel Blob)
export const visitPhotos = pgTable("visit_photos", {
  id: uuid("id").defaultRandom().primaryKey(),
  visitId: uuid("visit_id")
    .notNull()
    .references(() => visits.id, { onDelete: "cascade" }),
  blobUrl: text("blob_url").notNull(),
  width: integer("width"),
  height: integer("height"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Private live-library sharing ("Shared Guides" — strictly authenticated viewer-only)
export const libraryShares = pgTable(
  "library_shares",
  {
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    viewerId: text("viewer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.viewerId] }),
    index("library_shares_viewer_id_idx").on(table.viewerId),
    check("library_shares_no_self_share", sql`${table.ownerId} <> ${table.viewerId}`),
  ],
);

// Private invite tokens for accepting a live-library share (requires signed-in user)
export const libraryShareLinks = pgTable("library_share_links", {
  ownerId: text("owner_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Guard rail on metered Google calls (per-user & global daily circuit breaker)
export const apiUsage = pgTable(
  "api_usage",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    kind: text("kind").notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.day, table.kind] })],
);
