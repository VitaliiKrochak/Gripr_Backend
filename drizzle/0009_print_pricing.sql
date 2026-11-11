CREATE TYPE "app"."print_finish" AS ENUM('raw', 'supports_removed', 'sanded');--> statement-breakpoint
ALTER TABLE "app"."option_values" ADD COLUMN "height_mm" real;--> statement-breakpoint
ALTER TABLE "app"."option_values" ADD COLUMN "scale_factor" real;--> statement-breakpoint
ALTER TABLE "app"."option_values" ADD COLUMN "resin_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."option_values" ADD COLUMN "painting_multiplier" real;--> statement-breakpoint
ALTER TABLE "app"."option_values" ADD COLUMN "print_finish" "app"."print_finish";--> statement-breakpoint
ALTER TABLE "app"."products" ADD COLUMN "print" jsonb;--> statement-breakpoint
ALTER TABLE "app"."option_values" ADD CONSTRAINT "option_values_resin_id_resins_id_fk" FOREIGN KEY ("resin_id") REFERENCES "app"."resins"("id") ON DELETE restrict ON UPDATE no action;