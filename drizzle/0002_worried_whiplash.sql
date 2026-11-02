CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`time` text DEFAULT '' NOT NULL,
	`who` text DEFAULT '"all"' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`prep` integer DEFAULT 0 NOT NULL,
	`repeat` text,
	`until` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `events_family_idx` ON `events` (`family_id`);--> statement-breakpoint
CREATE TABLE `handoffs` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`from_id` text NOT NULL,
	`to_id` text NOT NULL,
	`text` text NOT NULL,
	`cat` text DEFAULT 'work' NOT NULL,
	`done` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `handoffs_family_idx` ON `handoffs` (`family_id`);--> statement-breakpoint
CREATE TABLE `shopping_items` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`text` text NOT NULL,
	`aisle` text DEFAULT 'other' NOT NULL,
	`member_id` text,
	`created_at` integer NOT NULL,
	`done` integer DEFAULT 0 NOT NULL,
	`done_by` text,
	`cleared` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shopping_family_idx` ON `shopping_items` (`family_id`);--> statement-breakpoint
CREATE TABLE `todos` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`member_id` text NOT NULL,
	`text` text NOT NULL,
	`cat` text DEFAULT 'work' NOT NULL,
	`star` integer DEFAULT false NOT NULL,
	`done` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `todos_family_member_idx` ON `todos` (`family_id`,`member_id`);--> statement-breakpoint
ALTER TABLE `log_entries` ADD `fixed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `active_from` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `active_until` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `prep_for` text;