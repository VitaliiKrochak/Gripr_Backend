CREATE TYPE "app"."order_item_kind" AS ENUM('product', 'print', 'model');--> statement-breakpoint
CREATE TYPE "app"."print_request_status" AS ENUM('draft', 'submitted', 'in_review', 'changes_requested', 'confirmed', 'in_cart', 'ordered', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TABLE "app"."print_request_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"file_id" uuid,
	"file_name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"height_mm" double precision,
	"scale_factor" double precision,
	"resin_id" uuid,
	"finish" "app"."print_finish" DEFAULT 'supports_removed' NOT NULL,
	"painted" boolean DEFAULT false NOT NULL,
	"base" jsonb,
	"printer_id" uuid,
	"painting_multiplier" double precision,
	"overrides" jsonb,
	"unit_price" integer,
	"line_total" integer,
	"price_error" text,
	"calculation" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."print_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" "app"."print_request_status" DEFAULT 'draft' NOT NULL,
	"comment" text,
	"rights_confirmed" boolean DEFAULT false NOT NULL,
	"estimate" integer,
	"confirmed_price" integer,
	"confirmed_at" timestamp with time zone,
	"staff_note" text,
	"production_days_min" integer,
	"production_days_max" integer,
	"order_id" uuid,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."messages" DROP CONSTRAINT "messages_single_thread";--> statement-breakpoint
ALTER TABLE "app"."messages" ADD COLUMN "print_request_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."order_items" ADD COLUMN "item_kind" "app"."order_item_kind" DEFAULT 'product' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."order_items" ADD COLUMN "print_request_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."print_request_items" ADD CONSTRAINT "print_request_items_request_id_print_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "app"."print_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."print_request_items" ADD CONSTRAINT "print_request_items_file_id_print_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "app"."print_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."print_request_items" ADD CONSTRAINT "print_request_items_resin_id_resins_id_fk" FOREIGN KEY ("resin_id") REFERENCES "app"."resins"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."print_request_items" ADD CONSTRAINT "print_request_items_printer_id_printers_id_fk" FOREIGN KEY ("printer_id") REFERENCES "app"."printers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."print_requests" ADD CONSTRAINT "print_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "app"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."print_requests" ADD CONSTRAINT "print_requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "app"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "print_request_items_request_idx" ON "app"."print_request_items" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "print_requests_customer_idx" ON "app"."print_requests" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "print_requests_status_idx" ON "app"."print_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "print_requests_order_idx" ON "app"."print_requests" USING btree ("order_id");--> statement-breakpoint
ALTER TABLE "app"."messages" ADD CONSTRAINT "messages_print_request_id_print_requests_id_fk" FOREIGN KEY ("print_request_id") REFERENCES "app"."print_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_print_request_idx" ON "app"."messages" USING btree ("print_request_id");--> statement-breakpoint
ALTER TABLE "app"."messages" ADD CONSTRAINT "messages_single_thread" CHECK (num_nonnulls("order_id", "custom_request_id", "print_request_id") = 1);