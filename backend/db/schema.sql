CREATE DATABASE IF NOT EXISTS sql_crm;
USE sql_crm;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role ENUM('admin','user') DEFAULT 'user',
  locale VARCHAR(10) DEFAULT 'cs',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL
);

CREATE TABLE item_variants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  sku VARCHAR(100) NOT NULL UNIQUE,
  variant_name VARCHAR(255) NOT NULL,
  price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  stock_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_item_variant_sku UNIQUE (item_id, sku),
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE TABLE inventory_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  variant_id INT NOT NULL,
  user_id INT,
  type ENUM('IN','OUT','ADJUST') NOT NULL,
  quantity INT NOT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (variant_id) REFERENCES item_variants(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(255),
  meta JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE settings (
  id INT PRIMARY KEY,
  warehouse_name VARCHAR(255),
  currency CHAR(3) DEFAULT 'CZK',
  low_stock_threshold INT DEFAULT 5
);

INSERT INTO settings (id, warehouse_name) VALUES (1, 'Default Warehouse') 
  ON DUPLICATE KEY UPDATE warehouse_name=VALUES(warehouse_name);

CREATE OR REPLACE VIEW v_items_with_stock AS
SELECT
  i.id,
  i.name,
  i.category,
  i.description,
  i.created_at,
  COALESCE(SUM(v.stock_count), 0) AS stock_total,
  COUNT(v.id) AS variants_count
FROM items i
LEFT JOIN item_variants v ON v.item_id = i.id
GROUP BY i.id, i.name, i.category, i.description, i.created_at;

-- ITEMS: list / search / category filter / sort
CREATE INDEX idx_items_name ON items (name);
CREATE INDEX idx_items_category ON items (category);
CREATE INDEX idx_items_category_name ON items (category, name);

-- VARIANTS: list per item + stock range
CREATE INDEX idx_variants_item_id ON item_variants (item_id);
CREATE INDEX idx_variants_item_stock ON item_variants (item_id, stock_count);

-- MOVEMENTS: filtr variant/type/user + date range
CREATE INDEX idx_movements_variant_created ON inventory_movements (variant_id, created_at);
CREATE INDEX idx_movements_user_created ON inventory_movements (user_id, created_at);
CREATE INDEX idx_movements_type_created ON inventory_movements (type, created_at);

-- LOGS: audit filtry user/action + date range
CREATE INDEX idx_logs_user_created ON logs (user_id, created_at);
CREATE INDEX idx_logs_action_created ON logs (action, created_at);

