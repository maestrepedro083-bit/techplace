SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `products` (
  `id` VARCHAR(90) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `code` VARCHAR(45) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `category` VARCHAR(60) NOT NULL,
  `supplier` VARCHAR(100) NOT NULL DEFAULT '',
  `unit` VARCHAR(20) NOT NULL,
  `qty` BIGINT NOT NULL DEFAULT 0,
  `min_qty` BIGINT NOT NULL,
  `cost` BIGINT NOT NULL,
  `price` BIGINT NOT NULL,
  `notes` VARCHAR(500) NOT NULL DEFAULT '',
  `revision` VARCHAR(90) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `updated_at` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `deleted_at` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin,
  PRIMARY KEY (`id`),
  UNIQUE KEY `products_code_uk` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stock_moves` (
  `id` VARCHAR(90) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `product_id` VARCHAR(90) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `delta` BIGINT NOT NULL,
  `reason` VARCHAR(120) NOT NULL,
  `notes` VARCHAR(500) NOT NULL DEFAULT '',
  `actor` VARCHAR(120) NOT NULL,
  `created_at` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (`id`),
  KEY `stock_moves_created` (`created_at`),
  FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `service_orders` (
  `number` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id` VARCHAR(90) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `title` VARCHAR(120) NOT NULL,
  `customer` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(32) NOT NULL DEFAULT '',
  `status` VARCHAR(24) NOT NULL,
  `due_day` CHAR(10) CHARACTER SET ascii COLLATE ascii_bin,
  `amount` BIGINT,
  `notes` VARCHAR(500) NOT NULL DEFAULT '',
  `actor` VARCHAR(120) NOT NULL,
  `created_at` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `updated_by` VARCHAR(120) NOT NULL,
  `updated_at` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `revision` VARCHAR(90) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `deleted_at` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin,
  PRIMARY KEY (`number`),
  UNIQUE KEY `service_orders_id_uk` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `film_families` (
  `id` VARCHAR(90) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `label` VARCHAR(120) NOT NULL,
  `type` VARCHAR(90) NOT NULL,
  `models` TEXT NOT NULL,
  `product_id` VARCHAR(90) CHARACTER SET ascii COLLATE ascii_bin,
  `source_url` VARCHAR(350) NOT NULL DEFAULT '',
  `notes` VARCHAR(500) NOT NULL DEFAULT '',
  `actor` VARCHAR(120) NOT NULL,
  `updated_at` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `revision` VARCHAR(90) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `deleted_at` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `knowledge_guides` (
  `id` VARCHAR(90) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `topic` VARCHAR(100) NOT NULL,
  `title` VARCHAR(120) NOT NULL,
  `body` TEXT NOT NULL,
  `evidence` VARCHAR(220) NOT NULL DEFAULT '',
  `source_url` VARCHAR(350) NOT NULL DEFAULT '',
  `status` VARCHAR(24) NOT NULL,
  `actor` VARCHAR(120) NOT NULL,
  `updated_at` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `revision` VARCHAR(90) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `deleted_at` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `knowledge_events` (
  `id` VARCHAR(90) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `topic` VARCHAR(100) NOT NULL,
  `outcome` VARCHAR(30) NOT NULL,
  `feedback` VARCHAR(30),
  `feedback_at` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin,
  `created_at` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (`id`),
  KEY `knowledge_events_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sales` (
  `number` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id` VARCHAR(90) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `day` CHAR(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `payment` VARCHAR(40) NOT NULL,
  `customer` VARCHAR(100) NOT NULL DEFAULT '',
  `notes` VARCHAR(500) NOT NULL DEFAULT '',
  `amount` BIGINT NOT NULL,
  `cost` BIGINT NOT NULL,
  `actor` VARCHAR(120) NOT NULL,
  `created_at` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `finalized` BIGINT NOT NULL DEFAULT 0,
  `voided_at` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin,
  `voided_by` VARCHAR(120),
  `void_reason` VARCHAR(120),
  PRIMARY KEY (`number`),
  KEY `sales_day` (`day`, `number`),
  UNIQUE KEY `sales_id_uk` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sale_items` (
  `sale_id` VARCHAR(90) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `product_id` VARCHAR(90) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `code` VARCHAR(45) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `unit` VARCHAR(20) NOT NULL,
  `qty` BIGINT NOT NULL,
  `unit_cost` BIGINT NOT NULL,
  `unit_price` BIGINT NOT NULL,
  PRIMARY KEY (`sale_id`, `product_id`),
  FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cash_entries` (
  `id` VARCHAR(90) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `kind` VARCHAR(10) NOT NULL,
  `amount` BIGINT NOT NULL,
  `day` CHAR(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `description` VARCHAR(120) NOT NULL,
  `category` VARCHAR(60) NOT NULL,
  `payment` VARCHAR(40) NOT NULL,
  `contact` VARCHAR(100) NOT NULL DEFAULT '',
  `reference` VARCHAR(70) NOT NULL DEFAULT '',
  `notes` VARCHAR(500) NOT NULL DEFAULT '',
  `actor` VARCHAR(120) NOT NULL,
  `created_at` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `updated_by` VARCHAR(120) NOT NULL,
  `updated_at` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `revision` VARCHAR(90) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `voided_at` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin,
  `sale_id` VARCHAR(90) CHARACTER SET ascii COLLATE ascii_bin,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cash_entries_sale` (`sale_id`),
  KEY `cash_entries_day` (`day`, `created_at`),
  FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `service_media` (
  `id` VARCHAR(90) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `order_id` VARCHAR(90) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `type` VARCHAR(90) NOT NULL,
  `size` BIGINT NOT NULL,
  `actor` VARCHAR(120) NOT NULL,
  `created_at` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `status` VARCHAR(24) NOT NULL,
  `deleted_at` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin,
  PRIMARY KEY (`id`),
  KEY `service_media_order` (`order_id`, `status`, `created_at`),
  FOREIGN KEY (`order_id`) REFERENCES `service_orders` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `staff_accounts` (
  `id` VARCHAR(90) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `name_key` VARCHAR(160) COLLATE utf8mb4_bin NOT NULL,
  `salt` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `password_hash` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `created_at` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `disabled_at` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin,
  PRIMARY KEY (`id`),
  UNIQUE KEY `staff_accounts_name_key_uk` (`name_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `staff_invites` (
  `id` VARCHAR(90) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `token_hash` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `label` VARCHAR(120) NOT NULL,
  `created_at` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `expires_at` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `used_at` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin,
  `revoked_at` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin,
  `account_id` VARCHAR(90) CHARACTER SET ascii COLLATE ascii_bin,
  `reset_user` VARCHAR(90) CHARACTER SET ascii COLLATE ascii_bin,
  PRIMARY KEY (`id`),
  UNIQUE KEY `staff_invites_token_hash_uk` (`token_hash`),
  FOREIGN KEY (`reset_user`) REFERENCES `staff_accounts` (`id`),
  FOREIGN KEY (`account_id`) REFERENCES `staff_accounts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `staff_sessions` (
  `token_hash` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `staff_id` VARCHAR(90) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `expires_at` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (`token_hash`),
  KEY `staff_sessions_expiry` (`expires_at`),
  KEY `staff_sessions_account` (`staff_id`),
  FOREIGN KEY (`staff_id`) REFERENCES `staff_accounts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `staff_login_attempts` (
  `key` VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `window` BIGINT NOT NULL,
  `count` BIGINT NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `shop_revision` (
  `id` BIGINT NOT NULL,
  `version` BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `part_prices` (
  `part_key` VARCHAR(500) COLLATE utf8mb4_bin NOT NULL,
  `name` VARCHAR(160),
  `category` VARCHAR(60),
  `supplier` VARCHAR(100),
  `cost` BIGINT,
  `service_price` BIGINT,
  `revision` BIGINT NOT NULL,
  `updated_by` VARCHAR(120) NOT NULL,
  `updated_at` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (`part_key`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
