CREATE TABLE `order_voids` (
	`order_id` text PRIMARY KEY NOT NULL,
	`voided_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`operator` text NOT NULL,
	`reason` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `session_closures` (
	`session_id` text PRIMARY KEY NOT NULL,
	`closed_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`closed_by` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `cash_register_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `store_id` text DEFAULT 'chupei' NOT NULL REFERENCES stores(id);--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `sequence_num` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `audit_logs_store_sequence_unique` ON `audit_logs` (`store_id`,`sequence_num`);--> statement-breakpoint
CREATE UNIQUE INDEX `audit_logs_store_prev_hash_unique` ON `audit_logs` (`store_id`,`prev_hash`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_orders` (
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
	`is_walkin` integer DEFAULT 0 NOT NULL,
	`cashier_email` text NOT NULL,
	`order_note` text,
	`void_reason` text,
	`voided_at` text,
	`voided_by` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `cash_register_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "orders_walkin_points_check" CHECK("__new_orders"."is_walkin" = 0 OR "__new_orders"."points_used" = 0)
);
--> statement-breakpoint
INSERT INTO `__new_orders`("id", "checkout_uid", "store_id", "session_id", "member_id", "status", "total_due", "received_amount", "payments", "discounts", "cash", "credit_card", "line_pay", "remittance", "points_used", "net_points_delta", "is_walkin", "cashier_email", "order_note", "void_reason", "voided_at", "voided_by", "created_at", "updated_at") SELECT "id", "checkout_uid", "store_id", "session_id", "member_id", "status", "total_due", "received_amount", "payments", "discounts", "cash", "credit_card", "line_pay", "remittance", "points_used", "net_points_delta", 0, "cashier_email", "order_note", "void_reason", "voided_at", "voided_by", "created_at", "updated_at" FROM `orders`;--> statement-breakpoint
DROP TABLE `orders`;--> statement-breakpoint
ALTER TABLE `__new_orders` RENAME TO `orders`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_checkout_uid_unique` ON `orders` (`checkout_uid`);--> statement-breakpoint
CREATE INDEX `orders_store_id_created_at_idx` ON `orders` (`store_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_session_id_idx` ON `orders` (`session_id`);--> statement-breakpoint
CREATE INDEX `orders_member_id_idx` ON `orders` (`member_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_checkout_uid_unique_idx` ON `orders` (`checkout_uid`);--> statement-breakpoint
CREATE UNIQUE INDEX `cash_register_sessions_store_id_open_unique` ON `cash_register_sessions` (`store_id`) WHERE "cash_register_sessions"."status" = 'OPEN';--> statement-breakpoint
CREATE TABLE `__new_members` (
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
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	CONSTRAINT "members_points_check" CHECK("__new_members"."points" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_members`("id", "phone", "barcode", "line_user_id", "name", "tier", "gender", "birthday", "registered_at", "points", "version", "note", "is_active", "total_spent", "order_count", "last_purchase_at", "created_at", "updated_at") SELECT "id", "phone", "barcode", "line_user_id", "name", "tier", "gender", "birthday", "registered_at", "points", "version", "note", "is_active", "total_spent", "order_count", "last_purchase_at", "created_at", "updated_at" FROM `members`;--> statement-breakpoint
DROP TABLE `members`;--> statement-breakpoint
ALTER TABLE `__new_members` RENAME TO `members`;--> statement-breakpoint
CREATE UNIQUE INDEX `members_phone_unique` ON `members` (`phone`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_barcode_unique` ON `members` (`barcode`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_line_user_id_unique` ON `members` (`line_user_id`);--> statement-breakpoint
CREATE INDEX `members_phone_idx` ON `members` (`phone`);--> statement-breakpoint
CREATE INDEX `members_line_user_id_idx` ON `members` (`line_user_id`);