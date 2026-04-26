import { sqliteTable, integer, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const todos = sqliteTable('todos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  done: integer('done', { mode: 'boolean' }).notNull().default(false),
  priority: integer('priority').notNull().default(0),
  dueDate: text('due_date'),
  note: text('note'),
  createdAt: integer('created_at').notNull(),
  completedAt: integer('completed_at'),
});

export const categories = sqliteTable(
  'categories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    type: text('type', { enum: ['income', 'expense'] }).notNull(),
    color: text('color'),
    icon: text('icon'),
  },
  (t) => ({
    nameTypeUnique: uniqueIndex('categories_name_type_unique').on(t.name, t.type),
  }),
);

export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  amount: integer('amount').notNull(),
  type: text('type', { enum: ['income', 'expense'] }).notNull(),
  categoryId: integer('category_id').references(() => categories.id),
  memo: text('memo'),
  paymentMethod: text('payment_method'),
  date: text('date').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const budgets = sqliteTable(
  'budgets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    month: text('month').notNull(),
    categoryId: integer('category_id').references(() => categories.id),
    amount: integer('amount').notNull(),
  },
  (t) => ({
    monthCatUnique: uniqueIndex('budgets_month_cat_unique').on(t.month, t.categoryId),
  }),
);

export const timeBlocks = sqliteTable('time_blocks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(),
  startMinute: integer('start_minute').notNull(),
  endMinute: integer('end_minute').notNull(),
  title: text('title').notNull(),
  color: text('color'),
  done: integer('done', { mode: 'boolean' }).notNull().default(false),
});

export const habits = sqliteTable('habits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  emoji: text('emoji'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
});

export const habitLogs = sqliteTable(
  'habit_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    habitId: integer('habit_id')
      .notNull()
      .references(() => habits.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
  },
  (t) => ({
    habitDateUnique: uniqueIndex('habit_logs_habit_date_unique').on(t.habitId, t.date),
  }),
);

export const journals = sqliteTable('journals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(),
  content: text('content').notNull(),
  mood: text('mood'),
  updatedAt: integer('updated_at').notNull(),
});

export const goals = sqliteTable('goals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  period: text('period', { enum: ['week', 'month'] }).notNull(),
  periodKey: text('period_key').notNull(),
  title: text('title').notNull(),
  done: integer('done', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
});

export type Todo = typeof todos.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type TimeBlock = typeof timeBlocks.$inferSelect;
export type Habit = typeof habits.$inferSelect;
export type HabitLog = typeof habitLogs.$inferSelect;
export type Journal = typeof journals.$inferSelect;
export type Goal = typeof goals.$inferSelect;
