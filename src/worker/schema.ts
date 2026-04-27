import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';

export const events = sqliteTable(
  'events',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(),
    startMin: integer('start_min').notNull(),
    endMin: integer('end_min').notNull(),
    title: text('title').notNull(),
    category: text('category'),
    notes: text('notes'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({ dateIdx: index('idx_events_date').on(t.date) })
);

export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    done: integer('done').notNull().default(0),
    priority: integer('priority').notNull().default(0),
    scheduledDate: text('scheduled_date'),
    dueDate: text('due_date'),
    goalId: text('goal_id'),
    parentId: text('parent_id'),
    position: integer('position'),
    notes: text('notes'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    scheduledIdx: index('idx_tasks_scheduled').on(t.scheduledDate),
    doneIdx: index('idx_tasks_done').on(t.done),
  })
);

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  type: text('type').notNull(),
  periodStart: text('period_start').notNull(),
  periodEnd: text('period_end').notNull(),
  progress: integer('progress').notNull().default(0),
  parentId: text('parent_id'),
  notes: text('notes'),
});

export const journalEntries = sqliteTable('journal_entries', {
  date: text('date').primaryKey(),
  content: text('content'),
  mood: integer('mood'),
});

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  openingBalance: integer('opening_balance').notNull().default(0),
  archived: integer('archived').notNull().default(0),
});

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  color: text('color'),
  budgetMonthly: integer('budget_monthly'),
  parentId: text('parent_id'),
});

export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(),
    accountId: text('account_id').notNull(),
    categoryId: text('category_id'),
    amount: integer('amount').notNull(),
    type: text('type').notNull(),
    memo: text('memo'),
    tags: text('tags'),
  },
  (t) => ({
    dateIdx: index('idx_transactions_date').on(t.date),
    accountIdx: index('idx_transactions_account').on(t.accountId),
  })
);

export const dailyMetrics = sqliteTable(
  'daily_metrics',
  {
    date: text('date').notNull(),
    key: text('key').notNull(),
    value: integer('value').notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.date, t.key] }) })
);

export const weeklyTemplates = sqliteTable('weekly_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  notes: text('notes'),
  isDefault: integer('is_default').notNull().default(0),
  createdAt: integer('created_at').notNull(),
});

export const weeklyTemplateBlocks = sqliteTable(
  'weekly_template_blocks',
  {
    id: text('id').primaryKey(),
    templateId: text('template_id').notNull(),
    weekday: integer('weekday').notNull(),
    startMin: integer('start_min').notNull(),
    endMin: integer('end_min').notNull(),
    title: text('title').notNull(),
    category: text('category'),
    isFixed: integer('is_fixed').notNull().default(1),
    notes: text('notes'),
  },
  (t) => ({ tplIdx: index('idx_template_blocks_template').on(t.templateId) })
);

export const agentThreads = sqliteTable('agent_threads', {
  id: text('id').primaryKey(),
  title: text('title'),
  mode: text('mode').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const agentMessages = sqliteTable(
  'agent_messages',
  {
    id: text('id').primaryKey(),
    threadId: text('thread_id').notNull(),
    role: text('role').notNull(),
    content: text('content').notNull(),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    cacheReadTokens: integer('cache_read_tokens'),
    cacheWriteTokens: integer('cache_write_tokens'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({ threadIdx: index('idx_agent_messages_thread').on(t.threadId) })
);

export const agentProposals = sqliteTable(
  'agent_proposals',
  {
    id: text('id').primaryKey(),
    threadId: text('thread_id').notNull(),
    messageId: text('message_id').notNull(),
    payload: text('payload').notNull(),
    status: text('status').notNull().default('pending'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    threadIdx: index('idx_agent_proposals_thread').on(t.threadId),
    statusIdx: index('idx_agent_proposals_status').on(t.status),
  })
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
});
