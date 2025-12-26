ALTER TABLE "site_media" ALTER COLUMN "duration" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "pay_txt_code" varchar(50);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "combo" json;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "movie_title" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "movie_duration" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "movie_poster" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "ticket_package_name" varchar;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "ticket_unit_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "checked_in_at" timestamp;--> statement-breakpoint
ALTER TABLE "ticket_packages" ADD COLUMN "combo" json;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_pay_txt_code_unique" UNIQUE("pay_txt_code");