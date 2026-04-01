import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  boolean,
  timestamp,
  decimal,
  json,
  foreignKey,
  doublePrecision
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  fullname: varchar('fullname', { length: 100 }),
  phone: varchar('phone', { length: 20 }),
  avatar: text('avatar'),
  gender: varchar('gender', { length: 10 }),
  dob: timestamp('dob', { withTimezone: true, mode: 'string' }),
  created_at: timestamp('created_at', {
    withTimezone: true,
    mode: 'date'
  }).defaultNow(),
  updated_at: timestamp('updated_at', {
    withTimezone: true,
    mode: 'date'
  }).defaultNow()
});

export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade', onUpdate: 'no action' }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }),
  login_type: varchar('login_type', { length: 50 }).default('email').notNull(),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at', {
    withTimezone: true,
    mode: 'date'
  }).defaultNow(),
  updated_at: timestamp('updated_at', {
    withTimezone: true,
    mode: 'date'
  }).defaultNow()
});

export const tokens = pgTable('tokens', {
  id: serial('id').primaryKey(),
  account_id: integer('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(),
  token: text('token').notNull().unique(),
  expired_at: timestamp('expired_at', { mode: 'date' }),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull()
});

export const movies = pgTable('movies', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  cover_image: text('cover_image'),
  detail_images: json('detail_images'),
  genres: json('genres'),
  rating: decimal('rating', { precision: 3, scale: 1 }),
  duration_min: integer('duration_min'),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  is_active: boolean('is_active').default(true),
  release_date: timestamp('release_date', { mode: 'date' })
});

export const ticket_packages = pgTable('ticket_packages', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }).unique(),
  description: text('description'),
  combo: json('combo'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  features: json('features'),
  type: varchar('type', { length: 50 }),
  min_group_size: integer('min_group_size'),
  max_group_size: integer('max_group_size'),
  is_member_only: boolean('is_member_only').default(false),
  is_active: boolean('is_active').default(true),
  display_order: integer('display_order').default(0),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull()
});

export const bookings = pgTable('bookings', {
  id: serial('id').primaryKey(),
  // Cho phép null để hỗ trợ khách vãng lai (không có tài khoản)
  user_id: integer('user_id').references(() => users.id, {
    onDelete: 'cascade'
  }),
  ticket_count: integer('ticket_count').default(1).notNull(),
  total_price: decimal('total_price', { precision: 10, scale: 2 }).notNull(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  paid_at: timestamp('paid_at', { mode: 'date' }),
  payment_method: varchar('payment_method', { length: 50 }).default('cash'),
  payment_status: varchar('payment_status', { length: 50 }).default('pending'),
  transaction_id: varchar('transaction_id', { length: 255 }),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  name: varchar('name', { length: 200 }).default('').notNull(),
  phone: varchar('phone', { length: 20 }).default('').notNull(),
  email: varchar('email', { length: 100 }).default('').notNull(),
  booking_code: varchar('booking_code', { length: 50 }).unique(),
  pay_txt_code: varchar('pay_txt_code', { length: 50 }).unique(),
  is_used: boolean('is_used').default(false),
  combo: json('combo'),
  movie_title: text('movie_title'),
  movie_duration: text('movie_duration'),
  movie_poster: text('movie_poster'),
  ticket_package_name: varchar('ticket_package_name'),
  ticket_unit_price: decimal('ticket_unit_price', { precision: 10, scale: 2 }),
  movie_id: integer('movie_id').references(() => movies.id, {
    onDelete: 'cascade'
  }),
  ticket_package_id: integer('ticket_package_id').references(() => ticket_packages.id),
  expiry_date: timestamp('expiry_date', { mode: 'date' }),
  checked_in_at: timestamp('checked_in_at', { mode: 'date' })
});

export const toys = pgTable('toys', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  stock: integer('stock').default(0).notNull(),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  image_url: text('image_url'),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull()
});

export const email_logs = pgTable('email_logs', {
  id: serial('id').primaryKey(),
  recipient: varchar('recipient', { length: 255 }).notNull(),
  subject: text('subject').notNull(),
  email_type: varchar('email_type', { length: 50 }).notNull(), // 'welcome', 'reset_password', 'booking_confirmation'
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending', 'sent', 'failed'
  provider: varchar('provider', { length: 50 }), // 'mailtrap', 'brevo', 'mailchannels', 'resend'
  error_message: text('error_message'),
  user_id: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  booking_id: integer('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
  metadata: json('metadata'), // Additional context (e.g., template data)
  sent_at: timestamp('sent_at', { mode: 'date' }),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull()
});

export const site_media = pgTable('site_media', {
  id: serial('id').primaryKey(),
  section: varchar('section', { length: 100 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  title: varchar('title', { length: 255 }),
  description: text('description'),
  public_id: varchar('public_id', { length: 255 }),
  url: varchar('url', { length: 1000 }).notNull(),
  format: varchar('format', { length: 50 }),
  width: integer('width'),
  height: integer('height'),
  duration: doublePrecision('duration'),
  display_order: integer('display_order').default(0),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull()
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).unique(),
  content: text('content').notNull(),
  excerpt: text('excerpt'),
  featured_image: text('featured_image'),
  author_id: integer('author_id').references(() => users.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 20 }).default('draft').notNull(),
  is_featured: boolean('is_featured').default(false),
  view_count: integer('view_count').default(0),
  published_at: timestamp('published_at', { mode: 'date' }),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull()
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  accounts: many(accounts),
  bookings: many(bookings)
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, {
    fields: [accounts.user_id],
    references: [users.id]
  }),
  tokens: many(tokens)
}));

export const tokensRelations = relations(tokens, ({ one }) => ({
  account: one(accounts, {
    fields: [tokens.account_id],
    references: [accounts.id]
  })
}));

export const moviesRelations = relations(movies, ({ many }) => ({
  bookings: many(bookings)
}));

export const ticketPackagesRelations = relations(ticket_packages, ({ many }) => ({
  bookings: many(bookings)
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  user: one(users, {
    fields: [bookings.user_id],
    references: [users.id]
  }),
  movie: one(movies, {
    fields: [bookings.movie_id],
    references: [movies.id]
  }),
  ticket_package: one(ticket_packages, {
    fields: [bookings.ticket_package_id],
    references: [ticket_packages.id]
  })
}));
