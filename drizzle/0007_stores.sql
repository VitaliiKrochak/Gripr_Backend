CREATE TYPE "app"."store" AS ENUM('gripr', 'lab');--> statement-breakpoint
ALTER TYPE "app"."option_group_kind" ADD VALUE 'scale' BEFORE 'custom';--> statement-breakpoint
ALTER TYPE "app"."option_group_kind" ADD VALUE 'resin' BEFORE 'custom';--> statement-breakpoint
ALTER TYPE "app"."option_group_kind" ADD VALUE 'painting' BEFORE 'custom';--> statement-breakpoint
ALTER TYPE "app"."option_group_kind" ADD VALUE 'base' BEFORE 'custom';--> statement-breakpoint
ALTER TYPE "app"."option_group_kind" ADD VALUE 'finish' BEFORE 'custom';--> statement-breakpoint
ALTER TYPE "app"."product_type" ADD VALUE 'miniature';--> statement-breakpoint
ALTER TYPE "app"."product_type" ADD VALUE 'figurine';--> statement-breakpoint
ALTER TYPE "app"."product_type" ADD VALUE 'bust';--> statement-breakpoint
ALTER TYPE "app"."product_type" ADD VALUE 'statue';--> statement-breakpoint
ALTER TYPE "app"."product_type" ADD VALUE 'terrain';--> statement-breakpoint
ALTER TYPE "app"."product_type" ADD VALUE 'diorama';--> statement-breakpoint
ALTER TYPE "app"."product_type" ADD VALUE 'prop';--> statement-breakpoint
ALTER TYPE "app"."product_type" ADD VALUE 'other_print';--> statement-breakpoint
ALTER TABLE "app"."collections" ADD COLUMN "store" "app"."store" DEFAULT 'gripr' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."products" ADD COLUMN "store" "app"."store" DEFAULT 'gripr' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."tags" ADD COLUMN "store" "app"."store" DEFAULT 'gripr' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."custom_requests" ADD COLUMN "store" "app"."store" DEFAULT 'gripr' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."design_candidates" ADD COLUMN "store" "app"."store" DEFAULT 'gripr' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."orders" ADD COLUMN "store" "app"."store" DEFAULT 'gripr' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."production_stages" ADD COLUMN "store" "app"."store" DEFAULT 'gripr' NOT NULL;--> statement-breakpoint
CREATE INDEX "collections_store_idx" ON "app"."collections" USING btree ("store");--> statement-breakpoint
CREATE INDEX "products_store_idx" ON "app"."products" USING btree ("store");--> statement-breakpoint
CREATE INDEX "orders_store_idx" ON "app"."orders" USING btree ("store");