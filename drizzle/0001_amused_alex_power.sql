ALTER TABLE `families` ADD `month_goal` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `families` ADD `month_goal_reward` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `families` ADD `month_prize` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `families` ADD `adult_rate` real DEFAULT 0.5 NOT NULL;--> statement-breakpoint
ALTER TABLE `families` ADD `adult_cap` integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE `families` ADD `budget` text DEFAULT 'low' NOT NULL;--> statement-breakpoint
ALTER TABLE `families` ADD `champ_start` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `families` ADD `extend_cost` integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE `families` ADD `extend_max` integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `families` ADD `alarms` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `families` ADD `meds` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `log_entries` ADD `alarm_key` text;--> statement-breakpoint
ALTER TABLE `log_entries` ADD `med_key` text;--> statement-breakpoint
ALTER TABLE `log_entries` ADD `slot_at` integer;--> statement-breakpoint
ALTER TABLE `members` ADD `kind` text DEFAULT 'kid' NOT NULL;--> statement-breakpoint
ALTER TABLE `redemptions` ADD `ext` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `redemptions` ADD `alarm_id` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `once` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `members` SET `kind` = 'adult' WHERE `user_id` IS NOT NULL;--> statement-breakpoint
UPDATE `families` SET `champ_start` = CAST(strftime('%s', 'now', 'start of month', '+1 month') AS INTEGER) * 1000;
