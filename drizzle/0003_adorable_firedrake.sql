CREATE TABLE `calendar_links` (
	`member_id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`email` text NOT NULL,
	`refresh_token` text NOT NULL,
	`calendar_id` text NOT NULL,
	`calendar_name` text NOT NULL,
	`time_zone` text NOT NULL,
	`only_mine` integer DEFAULT false NOT NULL,
	`last_error` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `calendar_links_family_idx` ON `calendar_links` (`family_id`);