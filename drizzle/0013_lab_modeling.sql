ALTER TABLE "app"."print_files" DROP CONSTRAINT "print_files_one_owner";--> statement-breakpoint
ALTER TABLE "app"."custom_proposals" ALTER COLUMN "specification" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."custom_proposals" ADD COLUMN "lab_specification" jsonb;--> statement-breakpoint
ALTER TABLE "app"."custom_proposals" ADD COLUMN "modeling_hours" double precision;--> statement-breakpoint
ALTER TABLE "app"."custom_proposals" ADD COLUMN "revision_terms" jsonb;--> statement-breakpoint
ALTER TABLE "app"."custom_requests" ADD COLUMN "lab_specification" jsonb;--> statement-breakpoint
ALTER TABLE "app"."orders" ADD COLUMN "modeling" jsonb;--> statement-breakpoint
ALTER TABLE "app"."print_files" ADD COLUMN "order_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."print_files" ADD CONSTRAINT "print_files_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "app"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "print_files_order_idx" ON "app"."print_files" USING btree ("order_id");--> statement-breakpoint
ALTER TABLE "app"."print_files" ADD CONSTRAINT "print_files_one_owner" CHECK (num_nonnulls("customer_id", "product_id", "order_id") <= 1);