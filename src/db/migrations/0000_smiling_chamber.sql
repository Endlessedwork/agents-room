CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`avatar_color` text NOT NULL,
	`avatar_icon` text NOT NULL,
	`prompt_role` text NOT NULL,
	`prompt_personality` text,
	`prompt_rules` text,
	`prompt_constraints` text,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`temperature` real DEFAULT 0.7 NOT NULL,
	`preset_id` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`room_agent_id` text,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`model` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`room_agent_id`) REFERENCES `room_agents`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `provider_keys` (
	`provider` text PRIMARY KEY NOT NULL,
	`api_key` text,
	`base_url` text,
	`status` text DEFAULT 'unconfigured' NOT NULL,
	`last_tested_at` integer,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `room_agents` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`source_agent_id` text,
	`name` text NOT NULL,
	`avatar_color` text NOT NULL,
	`avatar_icon` text NOT NULL,
	`prompt_role` text NOT NULL,
	`prompt_personality` text,
	`prompt_rules` text,
	`prompt_constraints` text,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`temperature` real DEFAULT 0.7 NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`topic` text,
	`status` text DEFAULT 'idle' NOT NULL,
	`turn_limit` integer DEFAULT 20 NOT NULL,
	`speaker_strategy` text DEFAULT 'round-robin' NOT NULL,
	`parallel_first_round` integer DEFAULT false NOT NULL,
	`last_activity_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
