CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `families` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`invite_code` text NOT NULL,
	`goal` integer DEFAULT 0 NOT NULL,
	`goal_reward` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `families_invite_code_unique` ON `families` (`invite_code`);--> statement-breakpoint
CREATE TABLE `log_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`task_id` text,
	`name` text NOT NULL,
	`member_id` text NOT NULL,
	`at` integer NOT NULL,
	`pts` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `log_family_at_idx` ON `log_entries` (`family_id`,`at`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`emoji` text NOT NULL,
	`color` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `members_family_idx` ON `members` (`family_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_family_user_uq` ON `members` (`family_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `redemptions` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`member_id` text NOT NULL,
	`name` text NOT NULL,
	`emoji` text NOT NULL,
	`cost` integer NOT NULL,
	`at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `redemptions_family_at_idx` ON `redemptions` (`family_id`,`at`);--> statement-breakpoint
CREATE TABLE `rewards` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`emoji` text NOT NULL,
	`name` text NOT NULL,
	`cost` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rewards_family_idx` ON `rewards` (`family_id`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`key` text,
	`name` text NOT NULL,
	`emoji` text NOT NULL,
	`color` text NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rooms_family_idx` ON `rooms` (`family_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`room_id` text NOT NULL,
	`name` text NOT NULL,
	`every` integer DEFAULT 7 NOT NULL,
	`mins` integer DEFAULT 5 NOT NULL,
	`pts` integer,
	`who` text,
	`team` text,
	`each` integer DEFAULT false NOT NULL,
	`only` text,
	`days` text,
	`carry` integer DEFAULT false NOT NULL,
	`routine` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`last` integer DEFAULT 0 NOT NULL,
	`last_by` text,
	`last_for` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tasks_family_idx` ON `tasks` (`family_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
