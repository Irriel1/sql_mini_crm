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
  sku VARCHAR(100) UNIQUE,
  variant_name VARCHAR(255),
  attributes JSON NULL,
  price DECIMAL(12,2) DEFAULT 0,
  stock_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
