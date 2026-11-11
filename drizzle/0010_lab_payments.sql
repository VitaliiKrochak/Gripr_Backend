CREATE TYPE "app"."payment_provider" AS ENUM('liqpay');--> statement-breakpoint
ALTER TABLE "app"."payments" ADD COLUMN "merchant" "app"."store" DEFAULT 'gripr' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."payments" ADD COLUMN "provider" "app"."payment_provider";--> statement-breakpoint
UPDATE "app"."payments" SET "provider" = 'liqpay' WHERE "type" <> 'manual';--> statement-breakpoint
UPDATE "app"."payments" AS "payment" SET "merchant" = "order"."store" FROM "app"."orders" AS "order" WHERE "order"."id" = "payment"."order_id";
