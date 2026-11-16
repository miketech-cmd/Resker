CREATE TABLE "library_share_links" (
	"owner_id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "library_share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "library_shares" (
	"owner_id" text NOT NULL,
	"viewer_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "library_shares_owner_id_viewer_id_pk" PRIMARY KEY("owner_id","viewer_id"),
	CONSTRAINT "library_shares_no_self_share" CHECK ("library_shares"."owner_id" <> "library_shares"."viewer_id")
);
--> statement-breakpoint
ALTER TABLE "library_share_links" ADD CONSTRAINT "library_share_links_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_shares" ADD CONSTRAINT "library_shares_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_shares" ADD CONSTRAINT "library_shares_viewer_id_user_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "library_shares_viewer_id_idx" ON "library_shares" USING btree ("viewer_id");