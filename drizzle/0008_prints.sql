CREATE TYPE "app"."cost_currency" AS ENUM('UAH', 'USD');--> statement-breakpoint
CREATE TYPE "app"."resin_kind" AS ENUM('standard', 'abs_like', 'tough', 'water_washable', 'flexible', 'castable', 'clear', 'other');--> statement-breakpoint
CREATE TABLE "app"."print_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"settings" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."printers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"build_x_mm" double precision NOT NULL,
	"build_y_mm" double precision NOT NULL,
	"build_z_mm" double precision NOT NULL,
	"layer_height_mm" double precision NOT NULL,
	"seconds_per_layer" double precision NOT NULL,
	"bottom_layers" integer NOT NULL,
	"bottom_layer_seconds" double precision NOT NULL,
	"fixed_minutes" double precision NOT NULL,
	"cost_currency" "app"."cost_currency" NOT NULL,
	"price" integer NOT NULL,
	"lifetime_hours" integer NOT NULL,
	"lcd_price" integer NOT NULL,
	"lcd_lifetime_hours" integer NOT NULL,
	"film_price" integer NOT NULL,
	"layers_per_film" integer NOT NULL,
	"electricity_per_hour" integer NOT NULL,
	"plate_fill_rate" double precision NOT NULL,
	"spacing_mm" double precision NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "printers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "app"."resins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"kind" "app"."resin_kind" NOT NULL,
	"colour" text,
	"description" text,
	"density_g_per_ml" double precision NOT NULL,
	"price_per_kg" integer NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resins_code_unique" UNIQUE("code")
);
