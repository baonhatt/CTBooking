import { pgTable, serial, varchar, text, integer, doublePrecision, boolean, timestamp, numeric, uniqueIndex, foreignKey, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const siteMedia = pgTable("site_media", {
	id: serial().primaryKey().notNull(),
	section: varchar({ length: 100 }).notNull(),
	type: varchar({ length: 20 }).notNull(),
	title: varchar({ length: 255 }),
	description: text(),
	publicId: varchar("public_id", { length: 255 }),
	url: varchar({ length: 1000 }).notNull(),
	format: varchar({ length: 50 }),
	width: integer(),
	height: integer(),
	duration: doublePrecision(),
	displayOrder: integer("display_order").default(0),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const toys = pgTable("toys", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	category: varchar({ length: 100 }),
	price: numeric({ precision: 10, scale:  2 }).notNull(),
	stock: integer().default(0).notNull(),
	status: varchar({ length: 20 }).default('active').notNull(),
	imageUrl: text("image_url"),
	createdAt: timestamp("created_at", { precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	fullname: varchar({ length: 100 }),
	phone: varchar({ length: 20 }),
	avatar: text(),
	gender: varchar({ length: 10 }),
	dob: timestamp({ precision: 6, withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { precision: 6, withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { precision: 6, withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
});

export const accounts = pgTable("accounts", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	email: varchar({ length: 255 }).notNull(),
	password: varchar({ length: 255 }),
	loginType: varchar("login_type", { length: 50 }).default('email').notNull(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { precision: 6, withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { precision: 6, withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	uniqueIndex("accounts_email_key").using("btree", table.email.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "accounts_user_id_fkey"
		}).onDelete("cascade"),
]);

export const bookings = pgTable("bookings", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id"),
	ticketCount: integer("ticket_count").default(1).notNull(),
	totalPrice: numeric("total_price", { precision: 10, scale:  2 }).notNull(),
	createdAt: timestamp("created_at", { precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	paidAt: timestamp("paid_at", { precision: 3, mode: 'string' }),
	paymentMethod: varchar("payment_method", { length: 50 }).default('cash'),
	paymentStatus: varchar("payment_status", { length: 50 }).default('pending'),
	transactionId: varchar("transaction_id", { length: 255 }),
	updatedAt: timestamp("updated_at", { precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	name: varchar({ length: 200 }).default(').notNull(),
	phone: varchar({ length: 20 }).default(').notNull(),
	email: varchar({ length: 100 }).default(').notNull(),
	bookingCode: varchar("booking_code", { length: 50 }),
	isUsed: boolean("is_used").default(false),
	movieId: integer("movie_id"),
	ticketPackageId: integer("ticket_package_id"),
	expiryDate: timestamp("expiry_date", { precision: 3, mode: 'string' }),
}, (table) => [
	uniqueIndex("bookings_booking_code_key").using("btree", table.bookingCode.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.movieId],
			foreignColumns: [movies.id],
			name: "bookings_movie_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.ticketPackageId],
			foreignColumns: [ticketPackages.id],
			name: "bookings_ticket_package_id_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "bookings_user_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const prismaMigrations = pgTable("_prisma_migrations", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	checksum: varchar({ length: 64 }).notNull(),
	finishedAt: timestamp("finished_at", { withTimezone: true, mode: 'string' }),
	migrationName: varchar("migration_name", { length: 255 }).notNull(),
	logs: text(),
	rolledBackAt: timestamp("rolled_back_at", { withTimezone: true, mode: 'string' }),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	appliedStepsCount: integer("applied_steps_count").default(0).notNull(),
});

export const tokens = pgTable("tokens", {
	id: serial().primaryKey().notNull(),
	accountId: integer("account_id").notNull(),
	type: varchar({ length: 50 }).notNull(),
	token: text().notNull(),
	expiredAt: timestamp("expired_at", { precision: 3, mode: 'string' }),
	createdAt: timestamp("created_at", { precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("tokens_token_key").using("btree", table.token.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.accountId],
			foreignColumns: [accounts.id],
			name: "tokens_account_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const movies = pgTable("movies", {
	id: serial().primaryKey().notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	coverImage: text("cover_image"),
	detailImages: jsonb("detail_images"),
	genres: jsonb(),
	rating: numeric({ precision: 3, scale:  1 }),
	durationMin: integer("duration_min"),
	createdAt: timestamp("created_at", { precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	isActive: boolean("is_active").default(true),
	releaseDate: timestamp("release_date", { precision: 3, mode: 'string' }),
});

export const ticketPackages = pgTable("ticket_packages", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	code: varchar({ length: 50 }),
	description: text(),
	price: numeric({ precision: 10, scale:  2 }).notNull(),
	features: jsonb(),
	type: varchar({ length: 50 }),
	minGroupSize: integer("min_group_size"),
	maxGroupSize: integer("max_group_size"),
	isMemberOnly: boolean("is_member_only").default(false),
	isActive: boolean("is_active").default(true),
	displayOrder: integer("display_order").default(0),
	createdAt: timestamp("created_at", { precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("ticket_packages_code_key").using("btree", table.code.asc().nullsLast().op("text_ops")),
]);
