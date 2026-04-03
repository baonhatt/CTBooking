CREATE TABLE IF NOT EXISTS toys (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT, price REAL, stock INTEGER, status TEXT, image_url TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
DELETE FROM toys;
INSERT INTO toys (id, name, category, price, stock, status, image_url, created_at) VALUES (1, 'Robot Thông Minh', 'robot', 12, 22, 'active', '/uploads/toys/1768273745784_t4yee5.jpeg', '2026-01-12T19:12:34.278Z');
