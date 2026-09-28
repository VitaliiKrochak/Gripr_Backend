CREATE TYPE "app"."finishing_kind" AS ENUM('engraving', 'coating', 'processing');--> statement-breakpoint
CREATE TYPE "app"."metal_family" AS ENUM('gold', 'silver', 'platinum', 'palladium', 'other');--> statement-breakpoint
CREATE TYPE "app"."custom_request_source" AS ENUM('custom', 'customization');--> statement-breakpoint
CREATE TYPE "app"."proposal_status" AS ENUM('sent', 'approved', 'changes_requested', 'superseded');--> statement-breakpoint
CREATE TYPE "app"."message_author_role" AS ENUM('customer', 'staff');--> statement-breakpoint
ALTER TYPE "app"."option_group_kind" ADD VALUE 'coating' BEFORE 'custom';--> statement-breakpoint
ALTER TYPE "app"."option_group_kind" ADD VALUE 'processing' BEFORE 'custom';--> statement-breakpoint
ALTER TYPE "app"."product_type" ADD VALUE 'chain' BEFORE 'bracelet';--> statement-breakpoint
ALTER TYPE "app"."product_type" ADD VALUE 'cufflinks' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "app"."custom_request_status" ADD VALUE 'changes_requested' BEFORE 'accepted';--> statement-breakpoint
ALTER TYPE "app"."order_status" ADD VALUE 'awaiting_model_payment' BEFORE 'in_production';--> statement-breakpoint
ALTER TYPE "app"."order_status" ADD VALUE 'modeling' BEFORE 'in_production';--> statement-breakpoint
ALTER TYPE "app"."order_status" ADD VALUE 'model_review' BEFORE 'in_production';--> statement-breakpoint
ALTER TYPE "app"."order_status" ADD VALUE 'awaiting_production_payment' BEFORE 'in_production';--> statement-breakpoint
ALTER TYPE "app"."order_status" ADD VALUE 'awaiting_final_payment' BEFORE 'ready';--> statement-breakpoint
ALTER TYPE "app"."payment_type" ADD VALUE 'model_prepayment' BEFORE 'remainder';--> statement-breakpoint
ALTER TYPE "app"."payment_type" ADD VALUE 'production_prepayment' BEFORE 'remainder';--> statement-breakpoint
CREATE TABLE "app"."finishing_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"kind" "app"."finishing_kind" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"default_price" integer DEFAULT 0 NOT NULL,
	"production_days" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finishing_options_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "app"."product_stones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"gemstone_id" uuid NOT NULL,
	"variation" text,
	"size_mm" real,
	"carat" real,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."custom_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" "app"."proposal_status" DEFAULT 'sent' NOT NULL,
	"title" text NOT NULL,
	"specification" jsonb NOT NULL,
	"requires_model" boolean DEFAULT true NOT NULL,
	"model_price" integer DEFAULT 0 NOT NULL,
	"product_price" integer NOT NULL,
	"production_prepayment" integer NOT NULL,
	"production_days_min" integer NOT NULL,
	"production_days_max" integer NOT NULL,
	"note" text,
	"customer_response" text,
	"responded_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_proposals_request_version_unique" UNIQUE("request_id","version")
);
--> statement-breakpoint
CREATE TABLE "app"."messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"custom_request_id" uuid,
	"author_id" uuid NOT NULL,
	"author_role" "app"."message_author_role" NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"stage_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_single_thread" CHECK (("app"."messages"."order_id" is null) <> ("app"."messages"."custom_request_id" is null))
);
--> statement-breakpoint
ALTER TABLE "app"."metals" ADD COLUMN "family" "app"."metal_family" DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."metals" ADD COLUMN "price_per_gram" integer;--> statement-breakpoint
ALTER TABLE "app"."option_values" ADD COLUMN "finishing_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."option_values" ADD COLUMN "size_value" real;--> statement-breakpoint
ALTER TABLE "app"."option_values" ADD COLUMN "weight_delta_grams" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."products" ADD COLUMN "price_from" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."products" ADD COLUMN "weight_grams" real;--> statement-breakpoint
ALTER TABLE "app"."products" ADD COLUMN "width_mm" real;--> statement-breakpoint
ALTER TABLE "app"."products" ADD COLUMN "height_mm" real;--> statement-breakpoint
ALTER TABLE "app"."products" ADD COLUMN "collection_sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."custom_requests" ADD COLUMN "source" "app"."custom_request_source" DEFAULT 'custom' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."custom_requests" ADD COLUMN "product_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."custom_requests" ADD COLUMN "product_name" text;--> statement-breakpoint
ALTER TABLE "app"."custom_requests" ADD COLUMN "product_slug" text;--> statement-breakpoint
ALTER TABLE "app"."custom_requests" ADD COLUMN "base_options" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."custom_requests" ADD COLUMN "specification" jsonb;--> statement-breakpoint
ALTER TABLE "app"."order_items" ADD COLUMN "specification" jsonb;--> statement-breakpoint
ALTER TABLE "app"."orders" ADD COLUMN "model_payment_amount" integer;--> statement-breakpoint
ALTER TABLE "app"."orders" ADD COLUMN "production_payment_amount" integer;--> statement-breakpoint
ALTER TABLE "app"."product_stones" ADD CONSTRAINT "product_stones_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "app"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."product_stones" ADD CONSTRAINT "product_stones_gemstone_id_gemstones_id_fk" FOREIGN KEY ("gemstone_id") REFERENCES "app"."gemstones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."custom_proposals" ADD CONSTRAINT "custom_proposals_request_id_custom_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "app"."custom_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."messages" ADD CONSTRAINT "messages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "app"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."messages" ADD CONSTRAINT "messages_custom_request_id_custom_requests_id_fk" FOREIGN KEY ("custom_request_id") REFERENCES "app"."custom_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."messages" ADD CONSTRAINT "messages_stage_id_production_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "app"."production_stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_stones_product_idx" ON "app"."product_stones" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "messages_order_idx" ON "app"."messages" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "messages_custom_request_idx" ON "app"."messages" USING btree ("custom_request_id");--> statement-breakpoint
ALTER TABLE "app"."option_values" ADD CONSTRAINT "option_values_finishing_id_finishing_options_id_fk" FOREIGN KEY ("finishing_id") REFERENCES "app"."finishing_options"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."custom_requests" ADD CONSTRAINT "custom_requests_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "app"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "app"."option_values" SET "size_value" = "ring_size" WHERE "ring_size" IS NOT NULL;--> statement-breakpoint
UPDATE "app"."products" SET "price_from" = "base_price";--> statement-breakpoint
UPDATE "app"."metals" SET "family" = CASE WHEN "code" LIKE 'gold%' THEN 'gold'::"app"."metal_family" WHEN "code" LIKE 'silver%' THEN 'silver'::"app"."metal_family" WHEN "code" LIKE 'platinum%' THEN 'platinum'::"app"."metal_family" WHEN "code" LIKE 'palladium%' THEN 'palladium'::"app"."metal_family" ELSE 'other'::"app"."metal_family" END;