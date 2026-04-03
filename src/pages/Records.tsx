import { useEffect, useState } from 'react';
import { apiFetch, cx } from '../lib/api';
import { formatCurrency } from '../lib/format';

// Deterministic mock token for demo mode.
const DEMO_TOKEN = 'mock-dev-token';

export default function Records({ token }: { token: string }) {
  const authToken = token || DEMO_TOKEN; // fallback to demo token if none provided
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state for new record
  const [form, setForm] = useState({ amount: '', type: 'income', category: '', date: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/records', { headers: { Authorization: `Bearer ${authToken}` } });
      if (!res.ok) throw new Error('Failed to fetch records');
      const data = await res.json();
      setRecords(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
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
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to add record');
      await fetchRecords();
      setForm({ amount: '', type: 'income', category: '', date: '', notes: '' });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this record?')) return;
    try {
      const res = await apiFetch('/api/records', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Delete failed');
      await fetchRecords();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        {/* New Record Form */}
        <div className="glass-card p-5 animate-fadeInUp">
          <h2 className="text-sm font-bold text-gray-900">Add New Record</h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <div className="mb-1 text-xs text-gray-500 font-medium font-bold">Amount (₹)</div>
                <input name="amount" type="number" value={form.amount} onChange={handleChange} required className="input-field" />
              </label>
              <label className="block">
                <div className="mb-1 text-xs text-gray-500 font-medium font-bold">Type</div>
                <select name="type" value={form.type} onChange={handleChange} className="input-field">
                  <option className="bg-white text-gray-900" value="income">Income</option>
                  <option className="bg-white text-gray-900" value="expense">Expense</option>
                </select>
              </label>
            </div>
            <label className="block">
              <div className="mb-1 text-xs text-gray-500 font-medium font-bold">Category</div>
              <input name="category" value={form.category} onChange={handleChange} required className="input-field" />
            </label>
            <label className="block">
              <div className="mb-1 text-xs text-gray-500 font-medium font-bold">Date</div>
              <input name="date" type="date" value={form.date} onChange={handleChange} required className="input-field" />
            </label>
            <label className="block">
              <div className="mb-1 text-xs text-gray-500 font-medium font-bold">Notes (optional)</div>
              <input name="notes" value={form.notes} onChange={handleChange} className="input-field" />
            </label>
            {error && <div className="text-sm text-red-300">{error}</div>}
            <button type="submit" disabled={submitting} className="btn-primary w-full animate-float">
              {submitting ? 'Saving…' : 'Add Record'}
            </button>
          </form>
        </div>
        {/* Records Table */}
        <div className="glass-card p-5 animate-fadeInUp">
          <h2 className="text-sm font-bold text-gray-900">Recent Records</h2>
          {loading ? (
            <div className="mt-4 text-center text-gray-500">Loading…</div>
          ) : error ? (
            <div className="mt-4 text-center text-red-500">{error}</div>
          ) : records.length === 0 ? (
            <div className="mt-4 text-center text-gray-500">No records yet.</div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs text-gray-500 font-medium">{new Date(r.date).toLocaleDateString()}</td>
                      <td className="px-3 py-2 text-gray-900 font-bold">{r.category}</td>
                      <td className="px-3 py-2 font-bold text-[#166534]">{formatCurrency(r.amount)}</td>
                      <td className="px-3 py-2">
                        <span className={cx('badge', r.type === 'income' ? 'badge-income' : 'badge-expense')}>{r.type}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => handleDelete(r.id)} className="text-xs text-red-500 font-bold hover:text-red-600 transition-colors">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
