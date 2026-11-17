CREATE TABLE `attendance_records` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`user_email` text NOT NULL,
	`user_name` text,
	`clock_in_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`clock_out_at` text,
	`status` text DEFAULT 'NORMAL' NOT NULL,
	`late_minutes` integer DEFAULT 0 NOT NULL,
	`ip_address` text,
	`note` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `attendance_records_store_id_clock_in_at_idx` ON `attendance_records` (`store_id`,`clock_in_at`);--> statement-breakpoint
CREATE TABLE `attendances` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`user_email` text NOT NULL,
	`clock_in_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`clock_out_at` text,
	`status` text DEFAULT 'NORMAL' NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`operator_id` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`before_state` text,
	`after_state` text,
	`delta` real,
	`reason` text NOT NULL,
	`ip_address` text,
	`prev_hash` text,
	`current_hash` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_logs_target_type_target_id_idx` ON `audit_logs` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_operator_id_idx` ON `audit_logs` (`operator_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_at_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `cash_register_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`opened_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`closed_at` text,
	`opened_by` text NOT NULL,
	`closed_by` text,
	`opening_cash` integer DEFAULT 0 NOT NULL,
	`expected_cash` integer,
	`actual_cash` integer,
	`discrepancy` integer,
	`total_revenue` integer DEFAULT 0,
	`cash_revenue` integer DEFAULT 0,
	`card_revenue` integer DEFAULT 0,
	`remit_revenue` integer DEFAULT 0,
	`points_issued` integer DEFAULT 0,
	`points_redeemed` integer DEFAULT 0,
	`tx_count` integer DEFAULT 0,
	`void_count` integer DEFAULT 0,
	`void_amount` integer DEFAULT 0,
	`note` text,
	`status` text DEFAULT 'OPEN' NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cash_register_sessions_store_id_status_idx` ON `cash_register_sessions` (`store_id`,`status`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text,
	`parent_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_code_unique` ON `categories` (`code`);--> statement-breakpoint
CREATE INDEX `categories_parent_id_idx` ON `categories` (`parent_id`);--> statement-breakpoint
CREATE TABLE `emergency_notices` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`level` text DEFAULT 'INFO' NOT NULL,
	`target_store_ids` text DEFAULT ('[]') NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`publisher_email` text NOT NULL,
	`published_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`expires_at` text
);
--> statement-breakpoint
CREATE INDEX `emergency_notices_is_active_idx` ON `emergency_notices` (`is_active`);--> statement-breakpoint
CREATE TABLE `integration_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`is_enabled` integer DEFAULT true NOT NULL,
	`updated_by` text,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integration_configs_key_unique` ON `integration_configs` (`key`);--> statement-breakpoint
CREATE TABLE `inventory_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`product_id` text NOT NULL,
	`change_type` text NOT NULL,
	`delta` integer NOT NULL,
	`balance` integer NOT NULL,
	`order_id` text,
	`stocktake_id` text,
	`operator` text,
	`reason` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `inventory_logs_store_id_product_id_idx` ON `inventory_logs` (`store_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `inventory_logs_created_at_idx` ON `inventory_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `lucky_bag_prizes` (
	`id` text PRIMARY KEY NOT NULL,
	`bag_id` text NOT NULL,
	`prize_grade` text NOT NULL,
	`prize_name` text NOT NULL,
	`product_id` text,
	`points` integer DEFAULT 0 NOT NULL,
	`draws` integer DEFAULT 1 NOT NULL,
	`drawn_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`bag_id`) REFERENCES `lucky_bags`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "lucky_bag_prizes_drawn_count_check" CHECK("lucky_bag_prizes"."drawn_count" <= "lucky_bag_prizes"."draws")
);
--> statement-breakpoint
CREATE INDEX `lucky_bag_prizes_bag_id_idx` ON `lucky_bag_prizes` (`bag_id`);--> statement-breakpoint
CREATE TABLE `lucky_bags` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`name` text NOT NULL,
	`unit_price` integer DEFAULT 0 NOT NULL,
	`is_points_set` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`barcode` text,
	`line_user_id` text,
	`name` text NOT NULL,
	`tier` text DEFAULT 'GENERAL' NOT NULL,
	`gender` text,
	`birthday` text,
	`registered_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`note` text,
	`is_active` integer DEFAULT true NOT NULL,
	`total_spent` integer DEFAULT 0 NOT NULL,
	`order_count` integer DEFAULT 0 NOT NULL,
	`last_purchase_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_phone_unique` ON `members` (`phone`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_barcode_unique` ON `members` (`barcode`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_line_user_id_unique` ON `members` (`line_user_id`);--> statement-breakpoint
CREATE INDEX `members_phone_idx` ON `members` (`phone`);--> statement-breakpoint
CREATE INDEX `members_line_user_id_idx` ON `members` (`line_user_id`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`item_type` text NOT NULL,
	`bag_id` text,
	`prize_grade` text,
	`prize_name` text,
	`pick_type` text,
	`draws` integer DEFAULT 1,
	`product_id` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_price` integer DEFAULT 0 NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`points_impact` integer DEFAULT 0 NOT NULL,
	`remark` text,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bag_id`) REFERENCES `lucky_bags`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`checkout_uid` text NOT NULL,
	`store_id` text NOT NULL,
	`session_id` text NOT NULL,
	`member_id` text,
	`status` text DEFAULT 'COMPLETED' NOT NULL,
	`total_due` integer DEFAULT 0 NOT NULL,
	`received_amount` integer DEFAULT 0 NOT NULL,
	`payments` text,
	`discounts` text,
	`cash` integer DEFAULT 0 NOT NULL,
	`credit_card` integer DEFAULT 0 NOT NULL,
	`line_pay` integer DEFAULT 0 NOT NULL,
	`remittance` integer DEFAULT 0 NOT NULL,
	`points_used` integer DEFAULT 0 NOT NULL,
	`net_points_delta` integer DEFAULT 0 NOT NULL,
	`cashier_email` text NOT NULL,
	`order_note` text,
	`void_reason` text,
	`voided_at` text,
	`voided_by` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `cash_register_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_checkout_uid_unique` ON `orders` (`checkout_uid`);--> statement-breakpoint
CREATE INDEX `orders_store_id_created_at_idx` ON `orders` (`store_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_session_id_idx` ON `orders` (`session_id`);--> statement-breakpoint
CREATE INDEX `orders_member_id_idx` ON `orders` (`member_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_checkout_uid_unique_idx` ON `orders` (`checkout_uid`);--> statement-breakpoint
CREATE TABLE `outbox_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`task_type` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`max_retries` integer DEFAULT 5 NOT NULL,
	`last_error` text,
	`next_retry_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`processed_at` text
);
--> statement-breakpoint
CREATE INDEX `outbox_tasks_status_next_retry_at_idx` ON `outbox_tasks` (`status`,`next_retry_at`);--> statement-breakpoint
CREATE TABLE `point_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`type` text NOT NULL,
	`delta` integer NOT NULL,
	`balance` integer NOT NULL,
	`order_id` text,
	`reason` text,
	`operator` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `point_logs_member_id_idx` ON `point_logs` (`member_id`);--> statement-breakpoint
CREATE TABLE `pre_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`version` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`deposit` integer DEFAULT 0 NOT NULL,
	`final_payment` integer DEFAULT 0 NOT NULL,
	`shipping_fee` integer DEFAULT 0 NOT NULL,
	`total_cost` integer DEFAULT 0 NOT NULL,
	`supplier` text,
	`target_store_id` text,
	`product_id` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`arrived_at` text,
	`note` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`target_store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pre_orders_status_idx` ON `pre_orders` (`status`);--> statement-breakpoint
CREATE INDEX `pre_orders_supplier_idx` ON `pre_orders` (`supplier`);--> statement-breakpoint
CREATE INDEX `pre_orders_created_at_idx` ON `pre_orders` (`created_at`);--> statement-breakpoint
CREATE TABLE `prize_allocation_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`total_draws` integer NOT NULL,
	`price1` integer DEFAULT 0 NOT NULL,
	`price3` integer DEFAULT 0 NOT NULL,
	`price5` integer DEFAULT 0 NOT NULL,
	`price10` integer DEFAULT 0 NOT NULL,
	`is_ten_plus_one` integer DEFAULT false NOT NULL,
	`target_margin` real DEFAULT 0 NOT NULL,
	`items` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `prize_allocation_plans_store_id_status_idx` ON `prize_allocation_plans` (`store_id`,`status`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`barcode` text,
	`name` text NOT NULL,
	`category_id` text,
	`main_category` text DEFAULT 'GK' NOT NULL,
	`sub_category` text,
	`category` text DEFAULT 'GENERAL' NOT NULL,
	`brand` text,
	`series` text,
	`condition` text DEFAULT 'NEW' NOT NULL,
	`cost_price` integer DEFAULT 0 NOT NULL,
	`allocation_cost` integer DEFAULT 0,
	`selling_price` integer DEFAULT 0 NOT NULL,
	`suggested_points` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`is_special` integer DEFAULT false NOT NULL,
	`remark` text,
	`parent_id` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_barcode_unique` ON `products` (`barcode`);--> statement-breakpoint
CREATE INDEX `products_category_idx` ON `products` (`category`);--> statement-breakpoint
CREATE INDEX `products_main_category_idx` ON `products` (`main_category`);--> statement-breakpoint
CREATE INDEX `products_main_sub_category_idx` ON `products` (`main_category`,`sub_category`);--> statement-breakpoint
CREATE INDEX `products_category_id_idx` ON `products` (`category_id`);--> statement-breakpoint
CREATE INDEX `products_parent_id_idx` ON `products` (`parent_id`);--> statement-breakpoint
CREATE INDEX `products_condition_idx` ON `products` (`condition`);--> statement-breakpoint
CREATE INDEX `products_created_at_idx` ON `products` (`created_at`);--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_no` text NOT NULL,
	`title` text NOT NULL,
	`supplier` text,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`unit_price` integer DEFAULT 0 NOT NULL,
	`qty_chupei` integer DEFAULT 0 NOT NULL,
	`qty_jinshan` integer DEFAULT 0 NOT NULL,
	`total_qty` integer DEFAULT 0 NOT NULL,
	`total_amount` integer DEFAULT 0 NOT NULL,
	`note` text,
	`raw_quote` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_orders_order_no_unique` ON `purchase_orders` (`order_no`);--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`date` text NOT NULL,
	`staff_name` text NOT NULL,
	`is_closed` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `schedules_store_id_date_unique` ON `schedules` (`store_id`,`date`);--> statement-breakpoint
CREATE TABLE `shift_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`date` text NOT NULL,
	`staff_name` text NOT NULL,
	`staff_email` text,
	`shift_type` text DEFAULT 'FULL' NOT NULL,
	`is_closed` integer DEFAULT false NOT NULL,
	`note` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shift_schedules_store_id_date_unique` ON `shift_schedules` (`store_id`,`date`);--> statement-breakpoint
CREATE TABLE `stocktake_items` (
	`id` text PRIMARY KEY NOT NULL,
	`stocktake_id` text NOT NULL,
	`product_id` text NOT NULL,
	`system_qty` integer NOT NULL,
	`actual_qty` integer NOT NULL,
	`variance` integer NOT NULL,
	`item_remark` text,
	FOREIGN KEY (`stocktake_id`) REFERENCES `stocktakes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stocktake_items_stocktake_id_product_id_unique` ON `stocktake_items` (`stocktake_id`,`product_id`);--> statement-breakpoint
CREATE TABLE `stocktakes` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`counted_by` text NOT NULL,
	`posted_by` text,
	`posted_at` text,
	`note` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `store_inventories` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`safety_stock` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "store_inventories_quantity_check" CHECK("store_inventories"."quantity" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `store_inventories_store_id_product_id_unique` ON `store_inventories` (`store_id`,`product_id`);--> statement-breakpoint
CREATE TABLE `stores` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`type` text DEFAULT 'RETAIL' NOT NULL,
	`address` text,
	`phone` text,
	`is_active` integer DEFAULT true NOT NULL,
	`open_time` text,
	`standard_hours` integer DEFAULT 8 NOT NULL,
	`late_grace_minutes` integer DEFAULT 15 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stores_code_unique` ON `stores` (`code`);--> statement-breakpoint
CREATE TABLE `transfer_order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`transfer_id` text NOT NULL,
	`product_id` text NOT NULL,
	`requested_qty` integer NOT NULL,
	`shipped_qty` integer DEFAULT 0 NOT NULL,
	`received_qty` integer DEFAULT 0 NOT NULL,
	`remark` text,
	FOREIGN KEY (`transfer_id`) REFERENCES `transfer_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transfer_order_items_transfer_id_product_id_unique` ON `transfer_order_items` (`transfer_id`,`product_id`);--> statement-breakpoint
CREATE TABLE `transfer_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`transfer_no` text NOT NULL,
	`source_store_id` text NOT NULL,
	`target_store_id` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`dispatched_at` text,
	`received_at` text,
	`dispatched_by` text,
	`received_by` text,
	`note` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`source_store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transfer_orders_transfer_no_unique` ON `transfer_orders` (`transfer_no`);--> statement-breakpoint
CREATE INDEX `transfer_orders_source_store_id_status_idx` ON `transfer_orders` (`source_store_id`,`status`);--> statement-breakpoint
CREATE INDEX `transfer_orders_target_store_id_status_idx` ON `transfer_orders` (`target_store_id`,`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'CASHIER' NOT NULL,
	`assigned_store_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `void_set_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`bag_id` text NOT NULL,
	`bag_name` text NOT NULL,
	`unit_price` integer NOT NULL,
	`total_draws` integer NOT NULL,
	`drawn_count` integer NOT NULL,
	`realized_income` integer DEFAULT 0 NOT NULL,
	`total_cost` integer DEFAULT 0 NOT NULL,
	`residual_value` integer DEFAULT 0 NOT NULL,
	`net_profit_loss` integer DEFAULT 0 NOT NULL,
	`restored_items` text,
	`is_points_set` integer DEFAULT false NOT NULL,
	`details` text NOT NULL,
	`operator` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
