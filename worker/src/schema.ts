import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fullname: text("fullname"),
  phone: text("phone"),
  avatar: text("avatar"),
  gender: text("gender"),
  dob: text("dob"),
  created_at: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  updated_at: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
});

export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  user_id: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  password: text("password"),
  login_type: text("login_type").default("email").notNull(),
  is_active: integer("is_active", { mode: "boolean" }).default(true),
  created_at: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  updated_at: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
});

export const tokens = sqliteTable("tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  account_id: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  token: text("token").notNull().unique(),
  expired_at: text("expired_at"),
  created_at: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const movies = sqliteTable("movies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  cover_image: text("cover_image"),
  detail_images: text("detail_images"), // JSON string in SQLite
  genres: text("genres"), // JSON string in SQLite
  rating: real("rating"),
  duration_min: integer("duration_min"),
  created_at: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updated_at: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  is_active: integer("is_active", { mode: "boolean" }).default(true),
  release_date: text("release_date"),
});

export const ticket_packages = sqliteTable("ticket_packages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  code: text("code").unique(),
  description: text("description"),
  price: real("price").notNull(),
  features: text("features"), // JSON
  type: text("type"),
  bombo: text("type"),
  min_group_size: integer("min_group_size"),
  max_group_size: integer("max_group_size"),
  is_member_only: integer("is_member_only", { mode: "boolean" }).default(false),
  is_active: integer("is_active", { mode: "boolean" }).default(true),
  display_order: integer("display_order").default(0),
  created_at: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updated_at: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const bookings = sqliteTable("bookings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // Cho phép null để lưu booking của khách vãng lai (không có user/account)
  user_id: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  ticket_count: integer("ticket_count").default(1).notNull(),
  total_price: real("total_price").notNull(),
  created_at: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  paid_at: text("paid_at"),
  payment_method: text("payment_method").default("cash"),
  payment_status: text("payment_status").default("pending"),
  transaction_id: text("transaction_id"),
  updated_at: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  name: text("name").default("").notNull(),
  phone: text("phone").default("").notNull(),
  email: text("email").default("").notNull(),
  booking_code: text("booking_code").unique(),
  is_used: integer("is_used", { mode: "boolean" }).default(false),
  movie_id: integer("movie_id").references(() => movies.id, { onDelete: "cascade" }),
  ticket_package_id: integer("ticket_package_id").references(() => ticket_packages.id),
  expiry_date: text("expiry_date"),
});

export const toys = sqliteTable("toys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category"),
  price: real("price").notNull(),
  stock: integer("stock").default(0).notNull(),
  status: text("status").default("active").notNull(),
  image_url: text("image_url"),
  created_at: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updated_at: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const site_media = sqliteTable("site_media", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  section: text("section").notNull(),
  type: text("type").notNull(),
  title: text("title"),
  description: text("description"),
  public_id: text("public_id"),
  url: text("url").notNull(),
  format: text("format"),
  width: integer("width"),
  height: integer("height"),
  duration: real("duration"),
  display_order: integer("display_order").default(0),
  is_active: integer("is_active", { mode: "boolean" }).default(true),
  created_at: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updated_at: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  bookings: many(bookings),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.user_id],
    references: [users.id],
  }),
}));

export const moviesRelations = relations(movies, ({ many }) => ({
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  user: one(users, {
    fields: [bookings.user_id],
    references: [users.id],
  }),
  movie: one(movies, {
    fields: [bookings.movie_id],
    references: [movies.id],
  }),
  ticket_package: one(ticket_packages, {
    fields: [bookings.ticket_package_id],
    references: [ticket_packages.id],
  }),
}));
