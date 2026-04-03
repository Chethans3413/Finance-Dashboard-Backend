import { useEffect, useState } from 'react';
import { apiFetch, cx } from '../lib/api';
import { formatCurrency } from '../lib/format';

type RoleRow = {
  user_id: string;
  role: 'viewer' | 'analyst' | 'admin';
  is_active: boolean;
  created_at: string;
};

type DbRecord = {
  id: number;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
  notes: string | null;
};

const CATEGORY_PRESETS = {
  income: ['Salary', 'Freelance', 'Investments', 'Bonus', 'Rental', 'Other'],
  expense: ['Groceries', 'Rent', 'Transport', 'Utilities', 'Shopping', 'Entertainment', 'Health', 'Dining', 'Subscriptions', 'Education', 'Other'],
};

// ─── Smart category suggestion based on amount ───
// Each rule: { min, max, category, confidence }
// confidence: 'high' | 'medium' — high = auto-select, medium = suggest with highlight
const AMOUNT_CATEGORY_RULES: Record<'income' | 'expense', { min: number; max: number; category: string; confidence: 'high' | 'medium' }[]> = {
  income: [
    { min: 50000, max: Infinity, category: 'Salary', confidence: 'high' },
    { min: 20000, max: 49999, category: 'Freelance', confidence: 'high' },
    { min: 10000, max: 19999, category: 'Freelance', confidence: 'medium' },
    { min: 5000, max: 9999, category: 'Investments', confidence: 'medium' },
    { min: 1000, max: 4999, category: 'Bonus', confidence: 'medium' },
    { min: 1, max: 999, category: 'Other', confidence: 'medium' },
  ],
  expense: [
    { min: 15000, max: Infinity, category: 'Rent', confidence: 'high' },
    { min: 5000, max: 14999, category: 'Shopping', confidence: 'medium' },
    { min: 3000, max: 4999, category: 'Health', confidence: 'medium' },
    { min: 2000, max: 2999, category: 'Utilities', confidence: 'medium' },
    { min: 1000, max: 1999, category: 'Groceries', confidence: 'high' },
    { min: 500, max: 999, category: 'Dining', confidence: 'medium' },
    { min: 200, max: 499, category: 'Transport', confidence: 'medium' },
    { min: 100, max: 199, category: 'Entertainment', confidence: 'medium' },
    { min: 1, max: 99, category: 'Subscriptions', confidence: 'medium' },
  ],
};

function getSuggestedCategory(amount: number, type: 'income' | 'expense'): { category: string; confidence: 'high' | 'medium' } | null {
  if (!amount || amount <= 0) return null;
  const rules = AMOUNT_CATEGORY_RULES[type];
  for (const rule of rules) {
    if (amount >= rule.min && amount <= rule.max) {
      return { category: rule.category, confidence: rule.confidence };
    }
  }
  return null;
}

type Tab = 'database' | 'users' | 'seed';

export default function Admin({ token }: { token: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('database');

  // ─── User Management ───
  const [rows, setRows] = useState<RoleRow[]>([]);
  const [userLoading, setUserLoading] = useState(true);
  const [userErr, setUserErr] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<'viewer' | 'analyst' | 'admin'>('viewer');
  const [active, setActive] = useState(true);

  // ─── Database Management ───
  const [records, setRecords] = useState<DbRecord[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [dbSuccess, setDbSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form for adding records
  const [form, setForm] = useState({
    amount: '',
    type: 'expense' as 'income' | 'expense',
    category: '',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  // Bulk insert
  const [bulkCount, setBulkCount] = useState(5);
  const [bulkInserting, setBulkInserting] = useState(false);

  // ─── Fetch Functions ───
  const fetchUsers = async () => {
    setUserLoading(true);
    setUserErr(null);
    try {
      const res = await apiFetch('/api/users', { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Fetch failed');
      setRows(json);
    } catch (e: any) {
      setUserErr(e.message);
    } finally {
      setUserLoading(false);
    }
  };

  const fetchRecords = async () => {
    setDbLoading(true);
    setDbError(null);
    try {
      let url = '/api/records';
      const params: string[] = [];
      if (filterType !== 'all') params.push(`type=${filterType}`);
      if (searchQuery) params.push(`q=${encodeURIComponent(searchQuery)}`);
      if (params.length) url += '?' + params.join('&');

      const res = await apiFetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch records');
      const data = await res.json();
      setRecords(data);
    } catch (e: any) {
      setDbError(e.message);
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, searchQuery]);

  // ─── Handlers ───
  const upsertUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserErr(null);
    const res = await apiFetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ user_id: userId, role, is_active: active }),
    });
    const json = await res.json();
    if (!res.ok) {
      setUserErr(json?.error || 'Upsert failed');
      return;
    }
    setUserId('');
    fetchUsers();
  };

  const toggleUser = async (r: RoleRow) => {
    const res = await apiFetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ user_id: r.user_id, is_active: !r.is_active }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json?.error || 'Update failed');
      return;
    }
    fetchUsers();
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const newForm = { ...form, [e.target.name]: e.target.value };

    // Auto-suggest category when amount changes
    if (e.target.name === 'amount') {
      const amt = Number(e.target.value);
      if (amt > 0) {
        const suggestion = getSuggestedCategory(amt, newForm.type as 'income' | 'expense');
        // Auto-fill if confidence is high and user hasn't manually picked a category
        if (suggestion && suggestion.confidence === 'high' && !form.category) {
          newForm.category = suggestion.category;
        }
      }
    }

    setForm(newForm);
  };

  // Computed suggestion for current amount
  const currentSuggestion = getSuggestedCategory(Number(form.amount), form.type);

  const addRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setDbError(null);
    setDbSuccess(null);
    try {
      const payload = {
        amount: Number(form.amount),
        type: form.type,
        category: form.category,
        date: form.date,
        notes: form.notes || null,
      };
      const res = await apiFetch('/api/records', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to add record');
      setDbSuccess(`✓ Added ${form.type}: ${form.category} — ${formatCurrency(Number(form.amount))}`);
      setTimeout(() => setDbSuccess(null), 3000);
      setForm({ amount: '', type: 'expense', category: '', date: new Date().toISOString().slice(0, 10), notes: '' });
      await fetchRecords();
    } catch (e: any) {
      setDbError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteRecord = async (id: number) => {
    if (!window.confirm('Delete this record from database?')) return;
    try {
      const res = await apiFetch('/api/records', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Delete failed');
      setDbSuccess('✓ Record deleted');
      setTimeout(() => setDbSuccess(null), 2500);
      await fetchRecords();
    } catch (e: any) {
      setDbError(e.message);
    }
  };

  const seedBulkRecords = async () => {
    setBulkInserting(true);
    setDbError(null);
    const categories = {
      income: ['Salary', 'Freelance', 'Investments', 'Bonus', 'Rental'],
      expense: ['Groceries', 'Rent', 'Transport', 'Utilities', 'Shopping', 'Entertainment', 'Health', 'Dining'],
    };
    const notePool = ['Monthly payment', 'Weekly spend', 'One-time', 'Recurring cost', 'Side project', 'Auto-debit', 'Cash payment', ''];

    try {
      for (let i = 0; i < bulkCount; i++) {
        const isIncome = Math.random() > 0.55;
        const type = isIncome ? 'income' : 'expense';
        const catList = categories[type];
        const category = catList[Math.floor(Math.random() * catList.length)];
        const amount = isIncome
          ? Math.round((Math.random() * 80000 + 5000) / 100) * 100
          : Math.round((Math.random() * 15000 + 200) / 50) * 50;
        const daysAgo = Math.floor(Math.random() * 60);
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);

        await apiFetch('/api/records', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            amount,
            type,
            category,
            date: date.toISOString().slice(0, 10),
            notes: notePool[Math.floor(Math.random() * notePool.length)] || null,
          }),
        });
      }
      setDbSuccess(`✓ Seeded ${bulkCount} random records`);
      setTimeout(() => setDbSuccess(null), 3000);
      await fetchRecords();
    } catch (e: any) {
      setDbError(e.message);
    } finally {
      setBulkInserting(false);
    }
  };

  // ─── Stats ───
  const totalIncome = records.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const totalExpense = records.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0);

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'database', label: 'Database Records', icon: '🗄️' },
    { key: 'users', label: 'User Roles', icon: '👥' },
    { key: 'seed', label: 'Seed & Tools', icon: '⚙️' },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      {/* Tab Navigation */}
      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cx(
              'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all',
              activeTab === t.key
                ? 'bg-[#e0ffb3] border border-lime-300 text-lime-900'
                : 'border border-gray-100 text-gray-500 font-medium hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Success / Error Toasts */}
      {dbSuccess && (
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-[#B3FF4C]/10 px-4 py-2.5 text-sm text-[#166534] animate-fadeIn">
          {dbSuccess}
        </div>
      )}
      {dbError && (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-red-100 px-4 py-2.5 text-sm text-red-600 animate-fadeIn">
          {dbError}
        </div>
      )}

      {/* ─── DATABASE TAB ─── */}
      {activeTab === 'database' && (
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          {/* Add Record Form */}
          <div className="lg:col-span-1">
            <div className="glass-card p-6">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-[#e0ffb3] flex items-center justify-center text-xs">+</div>
                <div className="text-sm font-semibold">Add to Database</div>
              </div>
              <p className="mt-2 text-xs text-gray-500 font-medium">Insert a new financial record directly.</p>

              <form onSubmit={addRecord} className="mt-4 space-y-3">
                <label className="block">
                  <div className="mb-1 text-xs text-gray-500 font-bold uppercase tracking-wider">Amount (₹)</div>
                  <input
                    name="amount"
                    type="number"
                    min="1"
                    step="1"
                    value={form.amount}
                    onChange={handleFormChange}
                    required
                    placeholder="e.g. 5000"
                    className="w-full rounded-xl border border-gray-200 bg-white shadow-sm px-3 py-2 outline-none focus:border-[#B3FF4C] transition-colors placeholder:text-gray-500"
                  />
                </label>

                <label className="block">
                  <div className="mb-1 text-xs text-gray-500 font-bold uppercase tracking-wider">Type</div>
                  <div className="flex gap-2">
                    {(['income', 'expense'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          const newType = t;
                          const amt = Number(form.amount);
                          const suggestion = amt > 0 ? getSuggestedCategory(amt, newType) : null;
                          setForm({ ...form, type: newType, category: suggestion?.confidence === 'high' ? suggestion.category : '' });
                        }}
                        className={cx(
                          'flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-all',
                          form.type === t
                            ? t === 'income'
                              ? 'border-emerald-500/40 bg-[#B3FF4C]/10 text-[#166534]'
                              : 'border-rose-500/40 bg-red-100 text-red-600'
                            : 'border-gray-200 text-gray-500 font-medium hover:bg-gray-100'
                        )}
                      >
                        {t === 'income' ? '↑ Income' : '↓ Expense'}
                      </button>
                    ))}
                  </div>
                </label>

                <label className="block">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Category</span>
                    {currentSuggestion && form.category !== currentSuggestion.category && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, category: currentSuggestion.category })}
                        className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-300 transition-colors animate-fadeIn"
                      >
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Suggested: {currentSuggestion.category}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {CATEGORY_PRESETS[form.type].map((cat) => {
                      const isSuggested = currentSuggestion?.category === cat && form.category !== cat;
                      const isSelected = form.category === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setForm({ ...form, category: cat })}
                          className={cx(
                            'rounded-lg px-2 py-1 text-xs transition-all relative',
                            isSelected
                              ? 'bg-[#B3FF4C]/20 text-[#166534] border border-emerald-500/40'
                              : isSuggested
                              ? 'bg-amber-50 text-amber-600 border border-amber-200 ring-1 ring-amber-500/20'
                              : 'bg-gray-100 text-gray-500 font-medium hover:text-gray-700 border border-transparent'
                          )}
                        >
                          {cat}
                          {isSuggested && (
                            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    name="category"
                    value={form.category}
                    onChange={handleFormChange}
                    required
                    placeholder="Or type custom..."
                    className={cx(
                      'w-full rounded-xl border bg-gray-50 px-3 py-2 outline-none transition-colors placeholder:text-gray-500',
                      currentSuggestion && form.category === currentSuggestion.category
                        ? 'border-amber-200 focus:border-amber-500/50'
                        : 'border-gray-200 focus:border-[#B3FF4C]'
                    )}
                  />
                  {currentSuggestion && form.category === currentSuggestion.category && (
                    <div className="mt-1.5 text-xs text-amber-600/70 flex items-center gap-1">
                      <span>✦</span>
                      Auto-suggested based on ₹{Number(form.amount).toLocaleString('en-IN')} amount
                      {currentSuggestion.confidence === 'high' && <span className="ml-1 bg-amber-100 px-1.5 py-0.5 rounded text-amber-600 text-[10px]">HIGH MATCH</span>}
                    </div>
                  )}
                </label>

                <label className="block">
                  <div className="mb-1 text-xs text-gray-500 font-bold uppercase tracking-wider">Date</div>
                  <input
                    name="date"
                    type="date"
                    value={form.date}
                    onChange={handleFormChange}
                    required
                    className="w-full rounded-xl border border-gray-200 bg-white shadow-sm px-3 py-2 outline-none focus:border-[#B3FF4C] transition-colors"
                  />
                </label>

                <label className="block">
                  <div className="mb-1 text-xs text-gray-500 font-bold uppercase tracking-wider">Notes (optional)</div>
                  <input
                    name="notes"
                    value={form.notes}
                    onChange={handleFormChange}
                    placeholder="Description..."
                    className="w-full rounded-xl border border-gray-200 bg-white shadow-sm px-3 py-2 outline-none focus:border-[#B3FF4C] transition-colors placeholder:text-gray-500"
                  />
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-[#B3FF4C] px-3 py-2.5 font-medium text-[#1a1a1a] font-bold hover:bg-[#a1e645] transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Inserting…' : '+ Insert Record'}
                </button>
              </form>
            </div>

            {/* Quick Stats */}
            <div className="mt-4 glass-card p-6">
              <div className="text-sm font-semibold mb-3">Database Stats</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                  <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Records</span>
                  <span className="text-sm font-medium tabular-nums">{records.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-[#f0fcf4] border border-[#dcfce7] px-3 py-2">
                  <span className="text-xs text-[#166534]/70">Income Total</span>
                  <span className="text-sm font-medium tabular-nums text-[#166534]">{formatCurrency(totalIncome)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-[#fef2f2] border border-[#fee2e2] px-3 py-2">
                  <span className="text-xs text-red-600/70">Expense Total</span>
                  <span className="text-sm font-medium tabular-nums text-red-600">{formatCurrency(totalExpense)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2">
                  <span className="text-xs text-indigo-600/70">Net</span>
                  <span className={cx('text-sm font-medium tabular-nums', totalIncome - totalExpense >= 0 ? 'text-[#166534]' : 'text-red-600')}>
                    {formatCurrency(totalIncome - totalExpense)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Records Table */}
          <div className="lg:col-span-2">
            <div className="glass-card p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold">All Database Records</div>
                  <div className="text-xs text-gray-500 font-medium mt-0.5">Browse, filter, and manage stored records</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={fetchRecords} className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors">
                    ↻ Refresh
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <div className="flex gap-1.5">
                  {(['all', 'income', 'expense'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setFilterType(t)}
                      className={cx(
                        'rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                        filterType === t
                          ? t === 'income' ? 'bg-[#e0ffb3] text-[#166534] border border-emerald-500/30'
                            : t === 'expense' ? 'bg-red-100 text-red-600 border border-rose-500/30'
                            : 'bg-gray-100 text-gray-900 font-bold border border-gray-200'
                          : 'text-gray-500 font-medium hover:text-gray-700 border border-transparent'
                      )}
                    >
                      {t === 'all' ? 'All' : t === 'income' ? '↑ Income' : '↓ Expense'}
                    </button>
                  ))}
                </div>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notes..."
                  className="flex-1 rounded-xl border border-gray-200 bg-white shadow-sm px-3 py-1.5 text-sm outline-none focus:border-[#B3FF4C] transition-colors placeholder:text-gray-500"
                />
              </div>

              {/* Table */}
              <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200">
                <div className="max-h-[500px] overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 font-bold uppercase tracking-wider sticky top-0">
                      <tr>
                        <th className="px-3 py-2.5">ID</th>
                        <th className="px-3 py-2.5">Date</th>
                        <th className="px-3 py-2.5">Category</th>
                        <th className="px-3 py-2.5">Type</th>
                        <th className="px-3 py-2.5 text-right">Amount</th>
                        <th className="px-3 py-2.5">Notes</th>
                        <th className="px-3 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {dbLoading ? (
                        <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-500 font-medium">Loading…</td></tr>
                      ) : records.length === 0 ? (
                        <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-500 font-medium">
                          No records found. Add some data above or use the seed tool.
                        </td></tr>
                      ) : (
                        records.map((r) => (
                          <tr key={r.id} className="border-t border-gray-200/60 hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-2 font-mono text-xs text-gray-500 font-medium">#{r.id}</td>
                            <td className="px-3 py-2 font-mono text-xs text-gray-700">{new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                            <td className="px-3 py-2 text-gray-900 font-bold">{r.category}</td>
                            <td className="px-3 py-2">
                              <span className={cx(
                                'inline-flex px-2 py-0.5 rounded-md text-xs font-medium',
                                r.type === 'income' ? 'bg-[#B3FF4C]/10 text-[#166534]' : 'bg-red-100 text-red-600'
                              )}>
                                {r.type}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-medium tabular-nums text-gray-900 font-bold">{formatCurrency(r.amount)}</td>
                            <td className="px-3 py-2 text-xs text-gray-500 font-medium max-w-[120px] truncate">{r.notes || '—'}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                onClick={() => deleteRecord(r.id)}
                                className="rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-100 transition-colors"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── USERS TAB ─── */}
      {activeTab === 'users' && (
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="glass-card p-6">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-indigo-100 flex items-center justify-center text-xs">👤</div>
                <div className="text-sm font-semibold">Add / Update User</div>
              </div>
              <p className="mt-2 text-xs text-gray-500 font-medium">Manage user roles for RBAC enforcement in API routes.</p>

              <form onSubmit={upsertUser} className="mt-4 space-y-3">
                <label className="block">
                  <div className="mb-1 text-xs text-gray-500 font-bold uppercase tracking-wider">Auth User ID</div>
                  <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="uuid" required className="w-full rounded-xl border border-gray-200 bg-white shadow-sm px-3 py-2 outline-none focus:border-violet-500/50 transition-colors placeholder:text-gray-500" />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs text-gray-500 font-bold uppercase tracking-wider">Role</div>
                  <select value={role} onChange={(e) => setRole(e.target.value as any)} className="w-full rounded-xl border border-gray-200 bg-white shadow-sm px-3 py-2 outline-none">
                    <option className="bg-white text-gray-900" value="viewer">Viewer</option>
                    <option className="bg-white text-gray-900" value="analyst">Analyst</option>
                    <option className="bg-white text-gray-900" value="admin">Admin</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-violet-500" />
                  Active
                </label>
                {userErr ? <div className="text-sm text-red-300">{userErr}</div> : null}
                <button className="w-full rounded-xl bg-violet-500 px-3 py-2.5 font-medium text-white hover:bg-violet-400 transition-colors">
                  Upsert User
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="glass-card p-6">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-sm font-semibold">Assigned Roles</div>
                  <div className="mt-1 text-xs text-gray-500 font-medium">RBAC checks happen in API routes using this table.</div>
                </div>
                <button onClick={fetchUsers} className="rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 transition-colors">
                  ↻ Refresh
                </button>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2.5">User ID</th>
                      <th className="px-3 py-2.5">Role</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.user_id} className="border-t border-gray-200">
                        <td className="px-3 py-2.5 font-mono text-xs text-gray-700">{r.user_id}</td>
                        <td className="px-3 py-2.5">
                          <span className={cx(
                            'inline-flex px-2 py-0.5 rounded-md text-xs font-medium',
                            r.role === 'admin' ? 'bg-amber-50 text-amber-600' :
                            r.role === 'analyst' ? 'bg-blue-500/10 text-blue-400' :
                            'bg-gray-100 text-gray-500 font-bold uppercase tracking-wider'
                          )}>
                            {r.role}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={cx(
                            'inline-flex items-center gap-1.5 text-xs',
                            r.is_active ? 'text-[#166534]' : 'text-gray-500 font-medium'
                          )}>
                            <div className={cx('h-1.5 w-1.5 rounded-full', r.is_active ? 'bg-emerald-400' : 'bg-gray-300')} />
                            {r.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button onClick={() => toggleUser(r)} className="rounded-lg border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50 transition-colors">
                            Toggle
                          </button>
                        </td>
                      </tr>
                    ))}
                    {userLoading ? (
                      <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500 font-medium">Loading…</td></tr>
                    ) : rows.length === 0 ? (
                      <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500 font-medium">No role assignments</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── SEED & TOOLS TAB ─── */}
      {activeTab === 'seed' && (
        <div className="mt-4 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Bulk Seed */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-amber-100 flex items-center justify-center text-xs">🌱</div>
                <div className="text-sm font-semibold">Seed Random Records</div>
              </div>
              <p className="mt-2 text-xs text-gray-500 font-medium">
                Generate random income/expense records for testing. Data is inserted into the in-memory mock database.
              </p>

              <div className="mt-4 flex items-end gap-3">
                <label className="block flex-1">
                  <div className="mb-1 text-xs text-gray-500 font-bold uppercase tracking-wider">Number of records</div>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={bulkCount}
                    onChange={(e) => setBulkCount(Math.max(1, Math.min(100, Number(e.target.value))))}
                    className="w-full rounded-xl border border-gray-200 bg-white shadow-sm px-3 py-2 outline-none focus:border-amber-500/50 transition-colors"
                  />
                </label>
                <button
                  onClick={seedBulkRecords}
                  disabled={bulkInserting}
                  className="rounded-xl bg-amber-500 px-4 py-2.5 font-medium text-[#1a1a1a] font-bold hover:bg-amber-400 transition-colors disabled:opacity-50"
                >
                  {bulkInserting ? 'Seeding…' : `Seed ${bulkCount} Records`}
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-gray-200/50 bg-gray-50 p-3">
                <div className="text-xs text-gray-500 font-medium font-mono leading-relaxed">
                  Categories used:<br />
                  • Income: Salary, Freelance, Investments, Bonus, Rental<br />
                  • Expense: Groceries, Rent, Transport, Utilities, Shopping, Entertainment, Health, Dining
                </div>
              </div>
            </div>

            {/* Data Info */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-blue-100 flex items-center justify-center text-xs">ℹ️</div>
                <div className="text-sm font-semibold">Database Info</div>
              </div>
              <p className="mt-2 text-xs text-gray-500 font-medium">
                Current data source information and storage mode.
              </p>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5">
                  <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Mode</span>
                  <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                    Mock / In-Memory
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5">
                  <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Persistence</span>
                  <span className="text-xs text-gray-700">Session only (resets on reload)</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5">
                  <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Backend</span>
                  <span className="text-xs text-gray-700">Supabase (when deployed)</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5">
                  <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Records</span>
                  <span className="text-xs text-gray-700 tabular-nums">{records.length} rows</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5">
                  <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Users</span>
                  <span className="text-xs text-gray-700 tabular-nums">{rows.length} roles assigned</span>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-xl border border-blue-500/20 bg-blue-500/5">
                <div className="text-xs text-blue-400/80 leading-relaxed">
                  💡 <strong>Tip:</strong> Changes made here are reflected in the Dashboard graphs in real-time. Add records, then visit the Dashboard to see updated charts.
                </div>
              </div>
            </div>
          </div>

          {/* ─── DELETE DATA SECTION ─── */}
          <div className="rounded-3xl border border-rose-500/20 glass-card p-5">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-red-100 flex items-center justify-center text-xs">🗑️</div>
              <div className="text-sm font-semibold text-red-600">Delete Data</div>
            </div>
            <p className="mt-2 text-xs text-gray-500 font-medium">
              Remove records from the database. These actions cannot be undone.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Delete All */}
              <button
                onClick={async () => {
                  if (!window.confirm(`⚠️ Delete ALL ${records.length} records? This cannot be undone.`)) return;
                  try {
                    await apiFetch('/api/records/bulk-delete', {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}` },
                      body: JSON.stringify({}),
                    });
                    setDbSuccess(`✓ Deleted all records`);
                    setTimeout(() => setDbSuccess(null), 3000);
                    await fetchRecords();
                  } catch (e: any) { setDbError(e.message); }
                }}
                disabled={records.length === 0}
                className="group rounded-2xl border border-red-200 bg-red-50 p-4 text-left hover:border-red-300 hover:bg-red-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <div className="text-red-600 text-sm font-medium group-hover:text-rose-300">🗑️ Delete All</div>
                <div className="mt-1 text-xs text-gray-500 font-medium">{records.length} records</div>
              </button>

              {/* Delete All Income */}
              <button
                onClick={async () => {
                  const count = records.filter(r => r.type === 'income').length;
                  if (!window.confirm(`Delete all ${count} income records?`)) return;
                  try {
                    await apiFetch('/api/records/bulk-delete', {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ type: 'income' }),
                    });
                    setDbSuccess(`✓ Deleted all income records`);
                    setTimeout(() => setDbSuccess(null), 3000);
                    await fetchRecords();
                  } catch (e: any) { setDbError(e.message); }
                }}
                disabled={records.filter(r => r.type === 'income').length === 0}
                className="group rounded-2xl border border-emerald-500/20 bg-[#B3FF4C]/5 p-4 text-left hover:border-red-300 hover:bg-red-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <div className="text-[#166534] text-sm font-medium group-hover:text-rose-300">↑ Delete Income</div>
                <div className="mt-1 text-xs text-gray-500 font-medium">{records.filter(r => r.type === 'income').length} records</div>
              </button>

              {/* Delete All Expenses */}
              <button
                onClick={async () => {
                  const count = records.filter(r => r.type === 'expense').length;
                  if (!window.confirm(`Delete all ${count} expense records?`)) return;
                  try {
                    await apiFetch('/api/records/bulk-delete', {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ type: 'expense' }),
                    });
                    setDbSuccess(`✓ Deleted all expense records`);
                    setTimeout(() => setDbSuccess(null), 3000);
                    await fetchRecords();
                  } catch (e: any) { setDbError(e.message); }
                }}
                disabled={records.filter(r => r.type === 'expense').length === 0}
                className="group rounded-2xl border border-red-200 bg-red-50 p-4 text-left hover:border-red-300 hover:bg-red-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <div className="text-red-600 text-sm font-medium group-hover:text-rose-300">↓ Delete Expenses</div>
                <div className="mt-1 text-xs text-gray-500 font-medium">{records.filter(r => r.type === 'expense').length} records</div>
              </button>

              {/* Delete by Category */}
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-gray-500 font-bold uppercase tracking-wider text-sm font-medium mb-2">By Category</div>
                <select
                  id="delete-category-select"
                  className="w-full rounded-lg border border-gray-200 bg-white shadow-sm px-2 py-1.5 text-xs outline-none mb-2"
                  defaultValue=""
                >
                  <option className="bg-white text-gray-900" value="" disabled>Select category…</option>
                  {Array.from(new Set(records.map(r => r.category))).sort().map(cat => (
                    <option className="bg-white text-gray-900" key={cat} value={cat}>{cat} ({records.filter(r => r.category === cat).length})</option>
                  ))}
                </select>
                <button
                  onClick={async () => {
                    const select = document.getElementById('delete-category-select') as HTMLSelectElement;
                    const cat = select?.value;
                    if (!cat) { alert('Select a category first'); return; }
                    const count = records.filter(r => r.category === cat).length;
                    if (!window.confirm(`Delete all ${count} "${cat}" records?`)) return;
                    try {
                      await apiFetch('/api/records/bulk-delete', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ category: cat }),
                      });
                      setDbSuccess(`✓ Deleted all "${cat}" records`);
                      setTimeout(() => setDbSuccess(null), 3000);
                      await fetchRecords();
                    } catch (e: any) { setDbError(e.message); }
                  }}
                  className="w-full rounded-lg border border-rose-500/30 px-2 py-1.5 text-xs text-red-600 hover:bg-red-100 transition-colors"
                >
                  Delete Category
                </button>
              </div>
            </div>

            {/* Warning */}
            <div className="mt-4 p-3 rounded-xl border border-red-200 bg-red-50">
              <div className="text-xs text-red-600/70 leading-relaxed">
                ⚠️ <strong>Warning:</strong> In mock mode, deleted data persists until you reload the page. In production, deletions are permanent.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
