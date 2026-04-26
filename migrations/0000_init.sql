CREATE TABLE `todos` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `title` text NOT NULL,
  `done` integer DEFAULT 0 NOT NULL,
  `priority` integer DEFAULT 0 NOT NULL,
  `due_date` text,
  `note` text,
  `created_at` integer NOT NULL,
  `completed_at` integer
);

CREATE TABLE `categories` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `type` text NOT NULL,
  `color` text,
  `icon` text
);
CREATE UNIQUE INDEX `categories_name_type_unique` ON `categories` (`name`,`type`);

CREATE TABLE `transactions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `amount` integer NOT NULL,
  `type` text NOT NULL,
  `category_id` integer REFERENCES `categories`(`id`),
  `memo` text,
  `payment_method` text,
  `date` text NOT NULL,
  `created_at` integer NOT NULL
);
CREATE INDEX `transactions_date_idx` ON `transactions` (`date`);

CREATE TABLE `budgets` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `month` text NOT NULL,
  `category_id` integer REFERENCES `categories`(`id`),
  `amount` integer NOT NULL
);
CREATE UNIQUE INDEX `budgets_month_cat_unique` ON `budgets` (`month`,`category_id`);

CREATE TABLE `time_blocks` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `date` text NOT NULL,
  `start_minute` integer NOT NULL,
  `end_minute` integer NOT NULL,
  `title` text NOT NULL,
  `color` text,
  `done` integer DEFAULT 0 NOT NULL
);
CREATE INDEX `time_blocks_date_idx` ON `time_blocks` (`date`);

CREATE TABLE `habits` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `emoji` text,
  `active` integer DEFAULT 1 NOT NULL,
  `created_at` integer NOT NULL
);

CREATE TABLE `habit_logs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `habit_id` integer NOT NULL REFERENCES `habits`(`id`) ON DELETE CASCADE,
  `date` text NOT NULL
);
CREATE UNIQUE INDEX `habit_logs_habit_date_unique` ON `habit_logs` (`habit_id`,`date`);

CREATE TABLE `journals` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `date` text NOT NULL,
  `content` text NOT NULL,
  `mood` text,
  `updated_at` integer NOT NULL
);
CREATE UNIQUE INDEX `journals_date_unique` ON `journals` (`date`);

CREATE TABLE `goals` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `period` text NOT NULL,
  `period_key` text NOT NULL,
  `title` text NOT NULL,
  `done` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL
);
CREATE INDEX `goals_period_key_idx` ON `goals` (`period`,`period_key`);
