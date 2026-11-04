CREATE TABLE "app"."market_rates" (
	"code" text PRIMARY KEY NOT NULL,
	"market_rate" double precision,
	"manual_rate" double precision,
	"rate_date" text,
	"source" text,
	"fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."pricing_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"settings" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."metals" ADD COLUMN "pricing_profile" jsonb;--> statement-breakpoint
ALTER TABLE "app"."product_stones" ADD COLUMN "purchase_price" integer;--> statement-breakpoint
ALTER TABLE "app"."product_stones" ADD COLUMN "setting_type" text;--> statement-breakpoint
ALTER TABLE "app"."product_stones" ADD COLUMN "cut" text;--> statement-breakpoint
ALTER TABLE "app"."product_stones" ADD COLUMN "setting_cost" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."products" ADD COLUMN "pricing" jsonb;