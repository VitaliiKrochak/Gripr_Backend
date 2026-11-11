ALTER TYPE "app"."design_license" ADD VALUE 'cc_by_sa';--> statement-breakpoint
ALTER TYPE "app"."design_license" ADD VALUE 'cc_by_nd';--> statement-breakpoint
ALTER TYPE "app"."design_source" ADD VALUE 'thingiverse';--> statement-breakpoint
ALTER TYPE "app"."design_source" ADD VALUE 'printables';--> statement-breakpoint
ALTER TYPE "app"."design_source" ADD VALUE 'myminifactory';--> statement-breakpoint
DROP INDEX "app"."design_candidates_source_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "design_candidates_source_idx" ON "app"."design_candidates" USING btree ("store","source","source_id");