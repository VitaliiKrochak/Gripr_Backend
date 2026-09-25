CREATE SCHEMA "app";
--> statement-breakpoint
CREATE TYPE "app"."option_group_kind" AS ENUM('metal', 'stone', 'size', 'engraving', 'custom');--> statement-breakpoint
CREATE TYPE "app"."product_availability" AS ENUM('in_stock', 'made_to_order');--> statement-breakpoint
CREATE TYPE "app"."product_type" AS ENUM('ring', 'earrings', 'pendant', 'necklace', 'bracelet', 'brooch', 'other');--> statement-breakpoint
CREATE TYPE "app"."publication_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "app"."custom_request_status" AS ENUM('new', 'in_review', 'quoted', 'accepted', 'declined', 'rejected');--> statement-breakpoint
CREATE TYPE "app"."order_kind" AS ENUM('catalog', 'custom');--> statement-breakpoint
CREATE TYPE "app"."order_status" AS ENUM('pending_payment', 'paid', 'in_production', 'ready', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "app"."payment_status" AS ENUM('pending', 'success', 'failure', 'reversed');--> statement-breakpoint
CREATE TYPE "app"."payment_type" AS ENUM('full', 'deposit', 'remainder', 'manual');--> statement-breakpoint
CREATE TYPE "app"."production_step_state" AS ENUM('pending', 'in_progress', 'done', 'skipped');--> statement-breakpoint
CREATE TABLE "app"."collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"subtitle" text,
	"description" text,
	"cover_image" jsonb,
	"gallery" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "app"."publication_status" DEFAULT 'draft' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_set" boolean DEFAULT false NOT NULL,
	"set_discount_percent" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collections_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "app"."gemstones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gemstones_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "app"."metals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"purity" text,
	"color" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "metals_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "app"."option_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"kind" "app"."option_group_kind" NOT NULL,
	"name" text NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."option_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"label" text NOT NULL,
	"metal_id" uuid,
	"gemstone_id" uuid,
	"stone_carat" real,
	"stone_size_mm" real,
	"ring_size" real,
	"price_delta" integer DEFAULT 0 NOT NULL,
	"production_days_delta" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"public_id" text NOT NULL,
	"url" text NOT NULL,
	"alt" text,
	"option_value_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."product_tags" (
	"product_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "product_tags_product_id_tag_id_pk" PRIMARY KEY("product_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "app"."products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"type" "app"."product_type" NOT NULL,
	"short_description" text,
	"description" text,
	"specifications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"collection_id" uuid,
	"status" "app"."publication_status" DEFAULT 'draft' NOT NULL,
	"is_hot" boolean DEFAULT false NOT NULL,
	"is_new" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"base_price" integer NOT NULL,
	"production_days_min" integer DEFAULT 0 NOT NULL,
	"production_days_max" integer DEFAULT 0 NOT NULL,
	"availability" "app"."product_availability" DEFAULT 'made_to_order' NOT NULL,
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "app"."tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"group" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "app"."custom_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" "app"."custom_request_status" DEFAULT 'new' NOT NULL,
	"product_type" "app"."product_type" NOT NULL,
	"description" text NOT NULL,
	"reference_images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"budget_min" integer,
	"budget_max" integer,
	"desired_metal" text,
	"ring_size" real,
	"quote_title" text,
	"quote_price" integer,
	"quote_deposit_amount" integer,
	"quote_production_days_min" integer,
	"quote_production_days_max" integer,
	"quote_note" text,
	"admin_note" text,
	"order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."customers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"phone" text,
	"first_name" text,
	"last_name" text,
	"email" text,
	"ring_size" real,
	"delivery_city_ref" text,
	"delivery_city_name" text,
	"delivery_warehouse_ref" text,
	"delivery_warehouse_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"option_value_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"engraving_text" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."favorites" (
	"customer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_customer_id_product_id_pk" PRIMARY KEY("customer_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "app"."order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"product_slug" text,
	"product_name" text NOT NULL,
	"image_url" text,
	"selected_options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"engraving_text" text,
	"from_stock" boolean DEFAULT false NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"line_total" integer NOT NULL,
	"production_days_min" integer DEFAULT 0 NOT NULL,
	"production_days_max" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."order_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"from_status" "app"."order_status",
	"to_status" "app"."order_status" NOT NULL,
	"note" text,
	"changed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer GENERATED ALWAYS AS IDENTITY (sequence name "app"."orders_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1001 CACHE 1),
	"kind" "app"."order_kind" NOT NULL,
	"status" "app"."order_status" DEFAULT 'pending_payment' NOT NULL,
	"customer_id" uuid NOT NULL,
	"contact_name" text NOT NULL,
	"contact_phone" text NOT NULL,
	"contact_email" text,
	"delivery_city_ref" text NOT NULL,
	"delivery_city_name" text NOT NULL,
	"delivery_warehouse_ref" text NOT NULL,
	"delivery_warehouse_name" text NOT NULL,
	"tracking_number" text,
	"subtotal" integer NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"deposit_amount" integer,
	"paid_amount" integer DEFAULT 0 NOT NULL,
	"production_days_min" integer DEFAULT 0 NOT NULL,
	"production_days_max" integer DEFAULT 0 NOT NULL,
	"customer_comment" text,
	"admin_note" text,
	"paid_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "app"."payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"type" "app"."payment_type" NOT NULL,
	"status" "app"."payment_status" DEFAULT 'pending' NOT NULL,
	"amount" integer NOT NULL,
	"provider_payment_id" text,
	"provider_status" text,
	"raw_callback" jsonb,
	"note" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."production_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"default_for_catalog" boolean DEFAULT false NOT NULL,
	"default_for_custom" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "production_stages_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "app"."production_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"state" "app"."production_step_state" DEFAULT 'pending' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"note" text,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"visible_to_customer" boolean DEFAULT true NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "production_steps_item_stage_unique" UNIQUE("order_item_id","stage_id")
);
--> statement-breakpoint
ALTER TABLE "app"."option_groups" ADD CONSTRAINT "option_groups_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "app"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."option_values" ADD CONSTRAINT "option_values_group_id_option_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "app"."option_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."option_values" ADD CONSTRAINT "option_values_metal_id_metals_id_fk" FOREIGN KEY ("metal_id") REFERENCES "app"."metals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."option_values" ADD CONSTRAINT "option_values_gemstone_id_gemstones_id_fk" FOREIGN KEY ("gemstone_id") REFERENCES "app"."gemstones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "app"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."product_images" ADD CONSTRAINT "product_images_option_value_id_option_values_id_fk" FOREIGN KEY ("option_value_id") REFERENCES "app"."option_values"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."product_tags" ADD CONSTRAINT "product_tags_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "app"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."product_tags" ADD CONSTRAINT "product_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "app"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."products" ADD CONSTRAINT "products_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "app"."collections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."custom_requests" ADD CONSTRAINT "custom_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "app"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."custom_requests" ADD CONSTRAINT "custom_requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "app"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."cart_items" ADD CONSTRAINT "cart_items_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "app"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "app"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."favorites" ADD CONSTRAINT "favorites_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "app"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."favorites" ADD CONSTRAINT "favorites_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "app"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "app"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "app"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "app"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "app"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "app"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."production_steps" ADD CONSTRAINT "production_steps_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "app"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."production_steps" ADD CONSTRAINT "production_steps_stage_id_production_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "app"."production_stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collections_status_idx" ON "app"."collections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "option_groups_product_idx" ON "app"."option_groups" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "option_values_group_idx" ON "app"."option_values" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "app"."product_images" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "app"."products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "products_collection_idx" ON "app"."products" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "custom_requests_customer_idx" ON "app"."custom_requests" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "custom_requests_status_idx" ON "app"."custom_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cart_items_customer_idx" ON "app"."cart_items" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "app"."order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_status_history_order_idx" ON "app"."order_status_history" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "app"."orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "app"."orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "app"."payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "production_steps_item_idx" ON "app"."production_steps" USING btree ("order_item_id");