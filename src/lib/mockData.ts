// Mock data for demo / development when backend APIs are unavailable.
// Used when running `npm run dev` (Vite only) without `vercel dev`.

export type MockRecord = {
  id: number;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
  notes: string | null;
  is_deleted: boolean;
  user_id: string;
};

const TODAY = new Date();
function daysAgo(n: number) {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

let nextId = 100;

const SEED_RECORDS: MockRecord[] = [
  { id: 1, amount: 85000, type: 'income', category: 'Salary', date: daysAgo(1), notes: 'March salary', is_deleted: false, user_id: 'demo' },
  { id: 2, amount: 15000, type: 'income', category: 'Freelance', date: daysAgo(5), notes: 'UI design project', is_deleted: false, user_id: 'demo' },
  { id: 3, amount: 3200, type: 'expense', category: 'Groceries', date: daysAgo(2), notes: 'Weekly groceries', is_deleted: false, user_id: 'demo' },
  { id: 4, amount: 1500, type: 'expense', category: 'Transport', date: daysAgo(3), notes: 'Uber rides', is_deleted: false, user_id: 'demo' },
  { id: 5, amount: 25000, type: 'expense', category: 'Rent', date: daysAgo(1), notes: 'April rent', is_deleted: false, user_id: 'demo' },
  { id: 6, amount: 2400, type: 'expense', category: 'Utilities', date: daysAgo(4), notes: 'Electricity + internet', is_deleted: false, user_id: 'demo' },
  { id: 7, amount: 5000, type: 'income', category: 'Investments', date: daysAgo(10), notes: 'Dividend payout', is_deleted: false, user_id: 'demo' },
  { id: 8, amount: 800, type: 'expense', category: 'Entertainment', date: daysAgo(6), notes: 'Movie tickets + dinner', is_deleted: false, user_id: 'demo' },
  { id: 9, amount: 4500, type: 'expense', category: 'Shopping', date: daysAgo(8), notes: 'New headphones', is_deleted: false, user_id: 'demo' },
  { id: 10, amount: 12000, type: 'income', category: 'Freelance', date: daysAgo(15), notes: 'Logo design work', is_deleted: false, user_id: 'demo' },
  { id: 11, amount: 1800, type: 'expense', category: 'Groceries', date: daysAgo(12), notes: 'Fruits & veggies', is_deleted: false, user_id: 'demo' },
  { id: 12, amount: 6000, type: 'expense', category: 'Health', date: daysAgo(20), notes: 'Doctor visit + meds', is_deleted: false, user_id: 'demo' },
  { id: 13, amount: 85000, type: 'income', category: 'Salary', date: daysAgo(31), notes: 'February salary', is_deleted: false, user_id: 'demo' },
  { id: 14, amount: 3500, type: 'expense', category: 'Dining', date: daysAgo(14), notes: 'Restaurant with friends', is_deleted: false, user_id: 'demo' },
  { id: 15, amount: 2000, type: 'expense', category: 'Subscriptions', date: daysAgo(7), notes: 'Netflix + Spotify + Cloud', is_deleted: false, user_id: 'demo' },
];

// In-memory store so additions/deletions persist during session
let records: MockRecord[] = [...SEED_RECORDS];

function activeRecords() {
  return records.filter((r) => !r.is_deleted);
}

function computeSummary() {
  const active = activeRecords();
  let totalIncome = 0;
  let totalExpenses = 0;
  for (const r of active) {
    if (r.type === 'income') totalIncome += r.amount;
    if (r.type === 'expense') totalExpenses += r.amount;
  }
  return {
    total_income: totalIncome,
    total_expenses: totalExpenses,
    net_balance: totalIncome - totalExpenses,
    computed_at: new Date().toISOString(),
  };
}

function computeCategoryTotals() {
  const active = activeRecords();
  const map = new Map<string, { type: string; category: string; total: number }>();
  for (const r of active) {
    const key = `${r.type}::${r.category}`;
    const existing = map.get(key);
    if (existing) existing.total += r.amount;
    else map.set(key, { type: r.type, category: r.category, total: r.amount });
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function computeTrends() {
  const active = activeRecords();
  const map = new Map<string, { period: string; type: string; total: number }>();
  for (const r of active) {
    const d = new Date(r.date);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const key = `${period}::${r.type}`;
    const existing = map.get(key);
    if (existing) existing.total += r.amount;
    else map.set(key, { period, type: r.type, total: r.amount });
  }
  return Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period));
}

export function isMockMode(token: string) {
  return token === 'mock-dev-token';
}

export function mockDashboard() {
  const active = activeRecords();
  return {
    summary: computeSummary(),
    category_totals: computeCategoryTotals(),
    trends_monthly: computeTrends(),
    recent_transactions: active.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
  };
}

export function mockGetRecords(opts?: { type?: string; category?: string; q?: string }) {
  let result = activeRecords();
  if (opts?.type) result = result.filter((r) => r.type === opts.type);
  if (opts?.category) result = result.filter((r) => r.category.toLowerCase().includes(opts.category!.toLowerCase()));
  if (opts?.q) result = result.filter((r) => r.notes?.toLowerCase().includes(opts.q!.toLowerCase()));
  return result.sort((a, b) => b.date.localeCompare(a.date));
}

export function mockAddRecord(body: { amount: number; type: string; category: string; date: string; notes?: string | null }) {
  const rec: MockRecord = {
    id: nextId++,
    amount: body.amount,
    type: body.type as 'income' | 'expense',
    category: body.category,
    date: body.date,
    notes: body.notes || null,
    is_deleted: false,
    user_id: 'demo',
  };
  records.unshift(rec);
  return rec;
}

export function mockDeleteRecord(id: number) {
  const rec = records.find((r) => r.id === id);
  if (rec) rec.is_deleted = true;
  return { ok: true };
}

export function mockDeleteAllRecords(type?: string, category?: string) {
  if (type && category) {
    records.forEach((r) => { if (r.type === type && r.category === category) r.is_deleted = true; });
  } else if (type) {
    records.forEach((r) => { if (r.type === type) r.is_deleted = true; });
  } else if (category) {
    records.forEach((r) => { if (r.category === category) r.is_deleted = true; });
  } else {
    records.forEach((r) => { r.is_deleted = true; });
  }
  return { ok: true, deleted: records.filter((r) => r.is_deleted).length };
}

export function mockGetUsers() {
  return [
    { user_id: 'demo-user-001', role: 'admin' as const, is_active: true, created_at: new Date().toISOString() },
    { user_id: 'demo-user-002', role: 'analyst' as const, is_active: true, created_at: new Date().toISOString() },
    { user_id: 'demo-user-003', role: 'viewer' as const, is_active: false, created_at: new Date().toISOString() },
  ];
}
