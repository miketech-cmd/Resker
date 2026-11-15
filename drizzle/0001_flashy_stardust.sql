ALTER TABLE "list_items" ADD COLUMN "curator_note" text;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "is_featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "copy_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "source_list_id" uuid;--> statement-breakpoint
ALTER TABLE "lists" ADD CONSTRAINT "lists_source_list_id_lists_id_fk" FOREIGN KEY ("source_list_id") REFERENCES "public"."lists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lists_public_browse_idx" ON "lists" USING btree ("is_public","is_featured","copy_count");