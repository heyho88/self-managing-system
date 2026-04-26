import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import {
  todos,
  categories,
  transactions,
  budgets,
  timeBlocks,
  habits,
  habitLogs,
  journals,
  goals,
} from './schema';

type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
};

const app = new Hono<{ Bindings: Env }>();

const now = () => Math.floor(Date.now() / 1000);

app.get('/api/health', (c) => c.json({ ok: true, time: now() }));

// ---------- Todos ----------
app.get('/api/todos', async (c) => {
  const db = drizzle(c.env.DB);
  const date = c.req.query('date');
  const rows = date
    ? await db
        .select()
        .from(todos)
        .where(eq(todos.dueDate, date))
        .orderBy(asc(todos.done), desc(todos.priority), asc(todos.id))
    : await db
        .select()
        .from(todos)
        .orderBy(asc(todos.done), desc(todos.priority), desc(todos.id))
        .limit(200);
  return c.json(rows);
});

app.post('/api/todos', async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{
    title: string;
    priority?: number;
    dueDate?: string;
    note?: string;
  }>();
  const [row] = await db
    .insert(todos)
    .values({
      title: body.title,
      priority: body.priority ?? 0,
      dueDate: body.dueDate ?? null,
      note: body.note ?? null,
      createdAt: now(),
    })
    .returning();
  return c.json(row, 201);
});

app.patch('/api/todos/:id', async (c) => {
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param('id'));
  const body = await c.req.json<Partial<{
    title: string;
    done: boolean;
    priority: number;
    dueDate: string | null;
    note: string | null;
  }>>();
  const update: Record<string, unknown> = { ...body };
  if (body.done === true) update.completedAt = now();
  if (body.done === false) update.completedAt = null;
  const [row] = await db.update(todos).set(update).where(eq(todos.id, id)).returning();
  return c.json(row);
});

app.delete('/api/todos/:id', async (c) => {
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param('id'));
  await db.delete(todos).where(eq(todos.id, id));
  return c.json({ ok: true });
});

// ---------- Categories ----------
app.get('/api/categories', async (c) => {
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(categories).orderBy(asc(categories.type), asc(categories.name));
  return c.json(rows);
});

app.post('/api/categories', async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{
    name: string;
    type: 'income' | 'expense';
    color?: string;
    icon?: string;
  }>();
  const [row] = await db
    .insert(categories)
    .values({ name: body.name, type: body.type, color: body.color, icon: body.icon })
    .returning();
  return c.json(row, 201);
});

app.delete('/api/categories/:id', async (c) => {
  const db = drizzle(c.env.DB);
  await db.delete(categories).where(eq(categories.id, Number(c.req.param('id'))));
  return c.json({ ok: true });
});

// ---------- Transactions (가계부) ----------
app.get('/api/transactions', async (c) => {
  const db = drizzle(c.env.DB);
  const month = c.req.query('month'); // 'YYYY-MM'
  const from = c.req.query('from');
  const to = c.req.query('to');

  const where = month
    ? and(gte(transactions.date, `${month}-01`), lte(transactions.date, `${month}-31`))
    : from && to
      ? and(gte(transactions.date, from), lte(transactions.date, to))
      : undefined;

  const rows = where
    ? await db.select().from(transactions).where(where).orderBy(desc(transactions.date), desc(transactions.id))
    : await db.select().from(transactions).orderBy(desc(transactions.date), desc(transactions.id)).limit(500);
  return c.json(rows);
});

app.post('/api/transactions', async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{
    amount: number;
    type: 'income' | 'expense';
    categoryId?: number | null;
    memo?: string;
    paymentMethod?: string;
    date: string;
  }>();
  const [row] = await db
    .insert(transactions)
    .values({
      amount: body.amount,
      type: body.type,
      categoryId: body.categoryId ?? null,
      memo: body.memo ?? null,
      paymentMethod: body.paymentMethod ?? null,
      date: body.date,
      createdAt: now(),
    })
    .returning();
  return c.json(row, 201);
});

app.patch('/api/transactions/:id', async (c) => {
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const [row] = await db.update(transactions).set(body).where(eq(transactions.id, id)).returning();
  return c.json(row);
});

app.delete('/api/transactions/:id', async (c) => {
  const db = drizzle(c.env.DB);
  await db.delete(transactions).where(eq(transactions.id, Number(c.req.param('id'))));
  return c.json({ ok: true });
});

app.get('/api/transactions/summary', async (c) => {
  const db = drizzle(c.env.DB);
  const month = c.req.query('month') ?? new Date().toISOString().slice(0, 7);
  const rows = await db
    .select({
      type: transactions.type,
      categoryId: transactions.categoryId,
      total: sql<number>`SUM(${transactions.amount})`.as('total'),
    })
    .from(transactions)
    .where(and(gte(transactions.date, `${month}-01`), lte(transactions.date, `${month}-31`)))
    .groupBy(transactions.type, transactions.categoryId);
  return c.json({ month, rows });
});

// ---------- Budgets ----------
app.get('/api/budgets', async (c) => {
  const db = drizzle(c.env.DB);
  const month = c.req.query('month') ?? new Date().toISOString().slice(0, 7);
  const rows = await db.select().from(budgets).where(eq(budgets.month, month));
  return c.json(rows);
});

app.put('/api/budgets', async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{ month: string; categoryId: number | null; amount: number }>();
  await db
    .insert(budgets)
    .values({ month: body.month, categoryId: body.categoryId, amount: body.amount })
    .onConflictDoUpdate({
      target: [budgets.month, budgets.categoryId],
      set: { amount: body.amount },
    });
  return c.json({ ok: true });
});

// ---------- Time blocks ----------
app.get('/api/time-blocks', async (c) => {
  const db = drizzle(c.env.DB);
  const date = c.req.query('date') ?? new Date().toISOString().slice(0, 10);
  const rows = await db
    .select()
    .from(timeBlocks)
    .where(eq(timeBlocks.date, date))
    .orderBy(asc(timeBlocks.startMinute));
  return c.json(rows);
});

app.post('/api/time-blocks', async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{
    date: string;
    startMinute: number;
    endMinute: number;
    title: string;
    color?: string;
  }>();
  const [row] = await db.insert(timeBlocks).values(body).returning();
  return c.json(row, 201);
});

app.patch('/api/time-blocks/:id', async (c) => {
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const [row] = await db.update(timeBlocks).set(body).where(eq(timeBlocks.id, id)).returning();
  return c.json(row);
});

app.delete('/api/time-blocks/:id', async (c) => {
  const db = drizzle(c.env.DB);
  await db.delete(timeBlocks).where(eq(timeBlocks.id, Number(c.req.param('id'))));
  return c.json({ ok: true });
});

// ---------- Habits ----------
app.get('/api/habits', async (c) => {
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(habits).where(eq(habits.active, true)).orderBy(asc(habits.id));
  return c.json(rows);
});

app.post('/api/habits', async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{ name: string; emoji?: string }>();
  const [row] = await db
    .insert(habits)
    .values({ name: body.name, emoji: body.emoji, createdAt: now() })
    .returning();
  return c.json(row, 201);
});

app.patch('/api/habits/:id', async (c) => {
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const [row] = await db.update(habits).set(body).where(eq(habits.id, id)).returning();
  return c.json(row);
});

app.delete('/api/habits/:id', async (c) => {
  const db = drizzle(c.env.DB);
  await db.delete(habits).where(eq(habits.id, Number(c.req.param('id'))));
  return c.json({ ok: true });
});

app.get('/api/habit-logs', async (c) => {
  const db = drizzle(c.env.DB);
  const from = c.req.query('from');
  const to = c.req.query('to');
  const rows = from && to
    ? await db
        .select()
        .from(habitLogs)
        .where(and(gte(habitLogs.date, from), lte(habitLogs.date, to)))
    : await db.select().from(habitLogs).limit(500);
  return c.json(rows);
});

app.post('/api/habit-logs', async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{ habitId: number; date: string }>();
  await db
    .insert(habitLogs)
    .values(body)
    .onConflictDoNothing();
  return c.json({ ok: true });
});

app.delete('/api/habit-logs', async (c) => {
  const db = drizzle(c.env.DB);
  const habitId = Number(c.req.query('habitId'));
  const date = c.req.query('date')!;
  await db
    .delete(habitLogs)
    .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.date, date)));
  return c.json({ ok: true });
});

// ---------- Journals ----------
app.get('/api/journals/:date', async (c) => {
  const db = drizzle(c.env.DB);
  const date = c.req.param('date');
  const [row] = await db.select().from(journals).where(eq(journals.date, date));
  return c.json(row ?? null);
});

app.put('/api/journals/:date', async (c) => {
  const db = drizzle(c.env.DB);
  const date = c.req.param('date');
  const body = await c.req.json<{ content: string; mood?: string }>();
  await db
    .insert(journals)
    .values({ date, content: body.content, mood: body.mood, updatedAt: now() })
    .onConflictDoUpdate({
      target: journals.date,
      set: { content: body.content, mood: body.mood, updatedAt: now() },
    });
  return c.json({ ok: true });
});

// ---------- Goals ----------
app.get('/api/goals', async (c) => {
  const db = drizzle(c.env.DB);
  const period = c.req.query('period') as 'week' | 'month' | undefined;
  const periodKey = c.req.query('periodKey');
  const where = period && periodKey
    ? and(eq(goals.period, period), eq(goals.periodKey, periodKey))
    : undefined;
  const rows = where
    ? await db.select().from(goals).where(where).orderBy(asc(goals.id))
    : await db.select().from(goals).orderBy(desc(goals.createdAt)).limit(100);
  return c.json(rows);
});

app.post('/api/goals', async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{
    period: 'week' | 'month';
    periodKey: string;
    title: string;
  }>();
  const [row] = await db
    .insert(goals)
    .values({ ...body, createdAt: now() })
    .returning();
  return c.json(row, 201);
});

app.patch('/api/goals/:id', async (c) => {
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const [row] = await db.update(goals).set(body).where(eq(goals.id, id)).returning();
  return c.json(row);
});

app.delete('/api/goals/:id', async (c) => {
  const db = drizzle(c.env.DB);
  await db.delete(goals).where(eq(goals.id, Number(c.req.param('id'))));
  return c.json({ ok: true });
});

// SPA fallback handled by assets binding (single-page-application mode)
app.notFound(async (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
