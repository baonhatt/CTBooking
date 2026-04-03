CREATE TABLE IF NOT EXISTS ticket_packages (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price REAL NOT NULL, is_active INTEGER DEFAULT 1, display_order INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
DELETE FROM ticket_packages;
INSERT INTO ticket_packages (id, name, price, is_active, display_order, created_at) VALUES (1, 'Vé đơn', 5000, 1, 1, '2025-12-13T06:10:12.168Z');
INSERT INTO ticket_packages (id, name, price, is_active, display_order, created_at) VALUES (2, 'Vé đôi', 550000, 1, 2, '2025-12-13T06:11:27.834Z');
INSERT INTO ticket_packages (id, name, price, is_active, display_order, created_at) VALUES (3, 'Gói đơn thân', 450000, 1, 3, '2025-12-13T06:13:36.060Z');
INSERT INTO ticket_packages (id, name, price, is_active, display_order, created_at) VALUES (4, 'Vé gia đình', 720000, 1, 4, '2025-12-13T06:15:01.834Z');
