import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fullname: text('fullname'),
  phone: text('phone'),
  avatar: text('avatar'),
  gender: text('gender'),
  dob: text('dob'),
  role: text('role').default('admin').notNull(),
  created_by: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  created_at: text('created_at'),
  updated_at: text('updated_at')
});

export const accounts = sqliteTable('accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  email: text('email').notNull().unique(),
  password: text('password'),
  login_type: text('login_type').default('email').notNull(),
  is_active: integer('is_active', { mode: 'boolean' }).default(true),
  created_at: text('created_at'),
  updated_at: text('updated_at')
});

export const tokens = sqliteTable('tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  account_id: integer('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  token: text('token').notNull().unique(),
  expired_at: text('expired_at'),
  created_at: text('created_at').notNull()
});

export const permissions = sqliteTable('permissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  group: text('group').notNull()
});

export const user_permissions = sqliteTable('user_permissions', {
  user_id: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  permission_id: integer('permission_id')
    .notNull()
    .references(() => permissions.id, { onDelete: 'cascade' }),
  granted_by: integer('granted_by').references(() => users.id, { onDelete: 'set null' }),
  granted_at: text('granted_at')
});

export const movies = sqliteTable('movies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  cover_image: text('cover_image'),
  detail_images: text('detail_images'), // JSON string in SQLite
  genres: text('genres'), // JSON string in SQLite
  rating: real('rating'),
  duration_min: integer('duration_min'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  is_active: integer('is_active', { mode: 'boolean' }).default(true),
  release_date: text('release_date')
});

export const ticket_packages = sqliteTable('ticket_packages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  code: text('code').unique(),
  description: text('description'),
  price: real('price').notNull(),
  features: text('features'), // JSON
  type: text('type'),
  combo: text('combo'),
  min_group_size: integer('min_group_size'),
  max_group_size: integer('max_group_size'),
  is_member_only: integer('is_member_only', { mode: 'boolean' }).default(false),
  is_active: integer('is_active', { mode: 'boolean' }).default(true),
  display_order: integer('display_order').default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

export const bookings = sqliteTable('bookings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // Cho phép null để lưu booking của khách vãng lai (không có user/account)
  user_id: integer('user_id').references(() => users.id, {
    onDelete: 'cascade'
  }),
  ticket_count: integer('ticket_count').default(1).notNull(),
  total_price: real('total_price').notNull(),
  created_at: text('created_at').notNull(),
  paid_at: text('paid_at'),
  payment_method: text('payment_method').default('cash'),
  payment_status: text('payment_status').default('pending'),
  transaction_id: text('transaction_id'),
  updated_at: text('updated_at').notNull(),
  name: text('name').default('').notNull(),
  phone: text('phone').default('').notNull(),
  email: text('email').default('').notNull(),
  booking_code: text('booking_code').unique(),
  pay_txt_code: text('pay_txt_code').unique(),
  combo: text('combo'),
  movie_title: text('movie_title'),
  movie_duration: text('movie_duration'),
  movie_poster: text('movie_poster'),
  ticket_package_name: text('ticket_package_name'),
  ticket_unit_price: real('ticket_unit_price'),
  is_used: integer('is_used', { mode: 'boolean' }).default(false),
  movie_id: integer('movie_id').references(() => movies.id, {
    onDelete: 'cascade'
  }),
  ticket_package_id: integer('ticket_package_id').references(() => ticket_packages.id),
  expiry_date: text('expiry_date'),
  checked_in_at: text('checked_in_at')
});

export const toys = sqliteTable('toys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  category: text('category'),
  price: real('price').notNull(),
  stock: integer('stock').default(0).notNull(),
  status: text('status').default('active').notNull(),
  image_url: text('image_url'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

export const email_logs = sqliteTable('email_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  recipient: text('recipient').notNull(),
  subject: text('subject').notNull(),
  email_type: text('email_type').notNull(), // 'welcome', 'reset_password', 'booking_confirmation'
  status: text('status').notNull().default('pending'), // 'pending', 'sent', 'failed'
  provider: text('provider'), // 'mailtrap', 'brevo', 'mailchannels', 'resend'
  error_message: text('error_message'),
  user_id: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  booking_id: integer('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
  metadata: text('metadata'), // JSON string
  sent_at: text('sent_at'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

export const site_media = sqliteTable('site_media', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  section: text('section').notNull(),
  type: text('type').notNull(),
  title: text('title'),
  description: text('description'),
  public_id: text('public_id'),
  url: text('url').notNull(),
  format: text('format'),
  width: integer('width'),
  height: integer('height'),
  duration: real('duration'),
  display_order: integer('display_order').default(0),
  is_active: integer('is_active', { mode: 'boolean' }).default(true),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  slug: text('slug').unique(),
  content: text('content').notNull(),
  excerpt: text('excerpt'),
  featured_image: text('featured_image'),
  meta_description: text('meta_description'),
  meta_keywords: text('meta_keywords'),
  seo_title: text('seo_title'),
  og_image: text('og_image'),
  canonical_url: text('canonical_url'),
  schema_type: text('schema_type').default('Article'),
  author_id: integer('author_id').references(() => users.id, { onDelete: 'set null' }),
  status: text('status').default('draft').notNull(),
  is_featured: integer('is_featured', { mode: 'boolean' }).default(false),
  view_count: integer('view_count').default(0),
  published_at: text('published_at'),
  created_at: text('created_at'),
  updated_at: text('updated_at')
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  bookings: many(bookings),
  permissions: many(user_permissions)
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

export const permissionsRelations = relations(permissions, ({ many }) => ({
  users: many(user_permissions)
}));

export const userPermissionsRelations = relations(user_permissions, ({ one }) => ({
  user: one(users, {
    fields: [user_permissions.user_id],
    references: [users.id]
  }),
  permission: one(permissions, {
    fields: [user_permissions.permission_id],
    references: [permissions.id]
  })
}));

export const moviesRelations = relations(movies, ({ many }) => ({
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
