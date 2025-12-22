-- Xóa bảng cũ nếu tồn tại
DROP TABLE IF EXISTS bookings;

-- Tạo lại bảng mới
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  ticket_count INTEGER NOT NULL DEFAULT 1,
  total_price REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  paid_at TEXT,
  payment_method TEXT DEFAULT 'cash',
  payment_status TEXT DEFAULT 'pending',
  transaction_id TEXT,
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  booking_code TEXT UNIQUE,
  combo TEXT,
  movie_title TEXT,
  movie_duration INTEGER DEFAULT 0,
  movie_poster TEXT,
  ticket_package_name TEXT,
  ticket_unit_price REAL,
  is_used INTEGER DEFAULT 0,
  movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
  ticket_package_id INTEGER REFERENCES ticket_packages(id),
  expiry_date TEXT
);