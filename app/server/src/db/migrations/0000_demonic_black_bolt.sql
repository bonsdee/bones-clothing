CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shop_id` int NOT NULL,
	`actor` varchar(100) NOT NULL DEFAULT 'system',
	`action` varchar(100) NOT NULL,
	`entity_type` varchar(100),
	`entity_id` varchar(100),
	`message` varchar(512),
	`metadata` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `drop_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`drop_id` int NOT NULL,
	`product_id` int NOT NULL,
	`baseline_inventory` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `drop_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `drop_products_drop_product_idx` UNIQUE(`drop_id`,`product_id`)
);
--> statement-breakpoint
CREATE TABLE `drops` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shop_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`status` enum('draft','scheduled','active','ended') NOT NULL DEFAULT 'draft',
	`starts_at` timestamp NOT NULL,
	`ends_at` timestamp,
	`waitlist_enabled` boolean NOT NULL DEFAULT true,
	`low_stock_threshold` int NOT NULL DEFAULT 5,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `drops_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`shopify_variant_id` bigint NOT NULL,
	`title` varchar(255),
	`sku` varchar(255),
	`price` decimal(10,2) DEFAULT '0.00',
	`inventory_quantity` int DEFAULT 0,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_variants_id` PRIMARY KEY(`id`),
	CONSTRAINT `variants_shopify_variant_idx` UNIQUE(`shopify_variant_id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shop_id` int NOT NULL,
	`shopify_product_id` bigint NOT NULL,
	`title` varchar(255) NOT NULL,
	`handle` varchar(255),
	`image_url` varchar(1024),
	`status` varchar(50) DEFAULT 'active',
	`synced_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_shop_product_idx` UNIQUE(`shop_id`,`shopify_product_id`)
);
--> statement-breakpoint
CREATE TABLE `restock_scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shop_id` int NOT NULL,
	`product_id` int NOT NULL,
	`drop_id` int,
	`score` decimal(6,2) NOT NULL,
	`waitlist_count` int NOT NULL DEFAULT 0,
	`sell_through_rate` decimal(5,2) NOT NULL DEFAULT '0.00',
	`days_since_sold_out` int,
	`computed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `restock_scores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(255) NOT NULL,
	`shop_id` int,
	`shop` varchar(255) NOT NULL,
	`is_online` boolean NOT NULL DEFAULT false,
	`state` varchar(255),
	`scope` varchar(512),
	`expires` timestamp,
	`payload` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shops` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shop_domain` varchar(255) NOT NULL,
	`access_token` varchar(512),
	`scope` varchar(512),
	`plan_name` varchar(100),
	`installed_at` timestamp NOT NULL DEFAULT (now()),
	`uninstalled_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shops_id` PRIMARY KEY(`id`),
	CONSTRAINT `shops_shop_domain_idx` UNIQUE(`shop_domain`)
);
--> statement-breakpoint
CREATE TABLE `waitlist_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shop_id` int NOT NULL,
	`product_id` int NOT NULL,
	`variant_id` int,
	`drop_id` int,
	`email` varchar(320) NOT NULL,
	`source` varchar(50) NOT NULL DEFAULT 'storefront',
	`notified_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `waitlist_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `waitlist_shop_email_product_idx` UNIQUE(`shop_id`,`email`,`product_id`)
);
--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_shop_id_shops_id_fk` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `drop_products` ADD CONSTRAINT `drop_products_drop_id_drops_id_fk` FOREIGN KEY (`drop_id`) REFERENCES `drops`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `drop_products` ADD CONSTRAINT `drop_products_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `drops` ADD CONSTRAINT `drops_shop_id_shops_id_fk` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_shop_id_shops_id_fk` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `restock_scores` ADD CONSTRAINT `restock_scores_shop_id_shops_id_fk` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `restock_scores` ADD CONSTRAINT `restock_scores_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `restock_scores` ADD CONSTRAINT `restock_scores_drop_id_drops_id_fk` FOREIGN KEY (`drop_id`) REFERENCES `drops`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_shop_id_shops_id_fk` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `waitlist_entries` ADD CONSTRAINT `waitlist_entries_shop_id_shops_id_fk` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `waitlist_entries` ADD CONSTRAINT `waitlist_entries_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `waitlist_entries` ADD CONSTRAINT `waitlist_entries_variant_id_product_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `waitlist_entries` ADD CONSTRAINT `waitlist_entries_drop_id_drops_id_fk` FOREIGN KEY (`drop_id`) REFERENCES `drops`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `activity_shop_created_idx` ON `activity_logs` (`shop_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `drops_shop_status_idx` ON `drops` (`shop_id`,`status`);--> statement-breakpoint
CREATE INDEX `restock_scores_product_computed_idx` ON `restock_scores` (`product_id`,`computed_at`);--> statement-breakpoint
CREATE INDEX `sessions_shop_idx` ON `sessions` (`shop`);--> statement-breakpoint
CREATE INDEX `waitlist_product_idx` ON `waitlist_entries` (`product_id`);