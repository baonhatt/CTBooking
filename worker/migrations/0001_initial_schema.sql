-- Initial schema for CTBooking database

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fullname TEXT,
  phone TEXT,
  avatar TEXT,
  gender TEXT,
  dob TEXT,
  created_at TEXT,
  updated_at TEXT
);

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password TEXT,
  login_type TEXT NOT NULL DEFAULT 'email',
  is_active INTEGER DEFAULT 1,
  created_at TEXT,
  updated_at TEXT
);

-- Tokens table
CREATE TABLE IF NOT EXISTS tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expired_at TEXT,
  created_at TEXT NOT NULL
);

-- Branches table
CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  is_default INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Movies table
CREATE TABLE IF NOT EXISTS movies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  cover_image TEXT,
  detail_images TEXT,
  genres TEXT,
  rating REAL,
  duration_min INTEGER,
  branch_id INTEGER REFERENCES branches(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  release_date TEXT
);

-- Ticket packages table
CREATE TABLE IF NOT EXISTS ticket_packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  description TEXT,
  price REAL NOT NULL,
  features TEXT,
  type TEXT,
  combo TEXT,
  min_group_size INTEGER,
  max_group_size INTEGER,
  is_member_only INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  display_order INTEGER DEFAULT 0,
  branch_id INTEGER REFERENCES branches(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  ticket_count INTEGER DEFAULT 1 NOT NULL,
  total_price REAL NOT NULL,
  created_at TEXT NOT NULL,
  paid_at TEXT,
  payment_method TEXT DEFAULT 'cash',
  payment_status TEXT DEFAULT 'pending',
  transaction_id TEXT,
  updated_at TEXT NOT NULL,
  name TEXT DEFAULT '' NOT NULL,
  phone TEXT DEFAULT '' NOT NULL,
  email TEXT DEFAULT '' NOT NULL,
  booking_code TEXT UNIQUE,
  pay_txt_code TEXT UNIQUE,
  combo TEXT,
  movie_title TEXT,
  movie_duration TEXT,
  movie_poster TEXT,
  ticket_package_name TEXT,
  ticket_unit_price REAL,
  is_used INTEGER DEFAULT 0,
  movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
  ticket_package_id INTEGER REFERENCES ticket_packages(id),
  expiry_date TEXT,
  checked_in_at TEXT,
  branch_id INTEGER REFERENCES branches(id) ON DELETE RESTRICT
);

-- Toys table
CREATE TABLE IF NOT EXISTS toys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT,
  price REAL NOT NULL,
  stock INTEGER DEFAULT 0 NOT NULL,
  status TEXT DEFAULT 'active' NOT NULL,
  image_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Email logs table
CREATE TABLE IF NOT EXISTS email_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  email_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT,
  error_message TEXT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  metadata TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Site media table
CREATE TABLE IF NOT EXISTS site_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT,
  description TEXT,
  public_id TEXT,
  url TEXT NOT NULL,
  format TEXT,
  width INTEGER,
  height INTEGER,
  duration REAL,
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  content TEXT NOT NULL,
  excerpt TEXT,
  featured_image TEXT,
  meta_description TEXT,
  meta_keywords TEXT,
  seo_title TEXT,
  og_image TEXT,
  canonical_url TEXT,
  schema_type TEXT DEFAULT 'Article',
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft' NOT NULL,
  is_featured INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  published_at TEXT,
  created_at TEXT,
  updated_at TEXT
);
