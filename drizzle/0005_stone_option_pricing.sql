ALTER TABLE "app"."option_values" ADD COLUMN "stone_quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."option_values" ADD COLUMN "purchase_price" integer;--> statement-breakpoint
ALTER TABLE "app"."option_values" ADD COLUMN "setting_type" text;--> statement-breakpoint
ALTER TABLE "app"."option_values" ADD COLUMN "cut" text;--> statement-breakpoint
ALTER TABLE "app"."option_values" ADD COLUMN "setting_cost" integer DEFAULT 0 NOT NULL;