CREATE TYPE "app"."design_ip_risk" AS ENUM('low', 'review', 'blocked');--> statement-breakpoint
CREATE TYPE "app"."design_license" AS ENUM('cc0', 'cc_by');--> statement-breakpoint
CREATE TYPE "app"."design_source" AS ENUM('sketchfab');--> statement-breakpoint
CREATE TYPE "app"."design_status" AS ENUM('candidate', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "app"."design_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "app"."design_source" NOT NULL,
	"source_id" text NOT NULL,
	"source_url" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"author_name" text NOT NULL,
	"author_url" text,
	"license" "app"."design_license" NOT NULL,
	"license_url" text NOT NULL,
	"preview_url" text,
	"embed_url" text,
	"likes" integer DEFAULT 0 NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"source_published_at" timestamp with time zone,
	"suggested_type" "app"."product_type",
	"relevance_score" integer DEFAULT 0 NOT NULL,
	"popularity_score" integer DEFAULT 0 NOT NULL,
	"ip_risk" "app"."design_ip_risk" DEFAULT 'low' NOT NULL,
	"ip_matches" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "app"."design_status" DEFAULT 'candidate' NOT NULL,
	"product_id" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "design_candidates_product_id_unique" UNIQUE("product_id")
);
--> statement-breakpoint
ALTER TABLE "app"."design_candidates" ADD CONSTRAINT "design_candidates_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "app"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "design_candidates_source_idx" ON "app"."design_candidates" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "design_candidates_status_idx" ON "app"."design_candidates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "design_candidates_score_idx" ON "app"."design_candidates" USING btree ("popularity_score");