CREATE TYPE "app"."print_file_status" AS ENUM('uploading', 'analyzing', 'analyzed', 'manual', 'failed');--> statement-breakpoint
CREATE TABLE "app"."print_files" (
	"id" uuid PRIMARY KEY NOT NULL,
	"customer_id" uuid,
	"product_id" uuid,
	"file_name" text NOT NULL,
	"extension" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_path" text NOT NULL,
	"status" "app"."print_file_status" DEFAULT 'uploading' NOT NULL,
	"error" text,
	"volume_ml" double precision,
	"size_mm" jsonb,
	"triangles" integer,
	"is_watertight" boolean,
	"units" text,
	"parts" jsonb,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"uploaded_at" timestamp with time zone,
	"analyzed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "print_files_storage_path_unique" UNIQUE("storage_path"),
	CONSTRAINT "print_files_one_owner" CHECK (num_nonnulls("customer_id", "product_id") <= 1)
);
--> statement-breakpoint
ALTER TABLE "app"."print_files" ADD CONSTRAINT "print_files_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "app"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."print_files" ADD CONSTRAINT "print_files_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "app"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "print_files_customer_idx" ON "app"."print_files" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "print_files_product_idx" ON "app"."print_files" USING btree ("product_id");--> statement-breakpoint
UPDATE "app"."products" SET "print" = "print" || '{"printFileId": null}'::jsonb WHERE "print" IS NOT NULL;
