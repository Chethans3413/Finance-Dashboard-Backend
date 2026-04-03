import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import StatCard from '../components/StatCard';
import DonutChart from '../components/DonutChart';
import BarChart from '../components/BarChart';
import SparklineCard from '../components/SparklineCard';
import { formatCurrency } from '../lib/format';

function money(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
}

export default function Dashboard({ token }: { token: string }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/dashboard', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = data?.summary || { total_income: 0, total_expenses: 0, net_balance: 0, computed_at: null };
  const netTone = useMemo(() => (summary.net_balance >= 0 ? 'good' : 'bad'), [summary.net_balance]);

  const expenseCategories = useMemo(
    () => (data?.category_totals || []).filter((c: any) => c.type === 'expense'),
    [data]
  );
  const incomeCategories = useMemo(
    () => (data?.category_totals || []).filter((c: any) => c.type === 'income'),
    [data]
  );
  const transactions = data?.recent_transactions || [];
  const trends = data?.trends_monthly || [];

  // Compute savings rate
  const savingsRate = useMemo(() => {
    const income = Number(summary.total_income || 0);
    const expenses = Number(summary.total_expenses || 0);
    if (income <= 0) return 0;
    return ((income - expenses) / income) * 100;
  }, [summary]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      {/* Header Section */}
      <div className="mt-4 rounded-[24px] hero-gradient p-8 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100">
        <div className="relative z-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm text-green-800 font-semibold tracking-wide uppercase">Finance Overview</div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 mt-1">Dashboard Summary</h1>
            <p className="mt-2 text-sm text-gray-800 font-medium">
              Real-time aggregates from your financial records.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/records')}
              className="btn-primary"
            >
              + Add Record
            </button>
            <button
              onClick={fetchData}
              className="btn-ghost bg-white"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[92px] animate-pulse rounded-2xl border border-white/40 bg-white/50" />
            ))}
          </div>
        ) : (
          <div className="mt-8 grid gap-3 md:grid-cols-3 relative z-10">
            <StatCard label="Total income" value={money(Number(summary.total_income || 0))} tone="good" hint={`Computed: ${summary.computed_at ? new Date(summary.computed_at).toLocaleString() : '—'}`} />
            <StatCard label="Total expenses" value={money(Number(summary.total_expenses || 0))} tone="bad" />
            <StatCard label="Net balance" value={money(Number(summary.net_balance || 0))} tone={netTone as any} />
          </div>
        )}
      </div>

      {/* Sparkline Row */}
      {!loading && transactions.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <SparklineCard transactions={transactions} label="Income Trend" type="income" colorClass="border-emerald-500/20" />
          <SparklineCard transactions={transactions} label="Expense Trend" type="expense" colorClass="border-rose-500/20" />
          <div className="glass-card p-5">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Savings Rate</div>
            <div className="mt-1 text-2xl font-bold tracking-tight text-gray-900">{savingsRate.toFixed(1)}%</div>
            <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${Math.max(0, Math.min(100, savingsRate))}%`,
                  background: savingsRate >= 30 ? 'linear-gradient(90deg, #B3FF4C, #34d399)' : savingsRate >= 10 ? 'linear-gradient(90deg, #fbbf24, #fb923c)' : 'linear-gradient(90deg, #f87171, #ef4444)',
                }}
              />
            </div>
            <div className="mt-2 text-xs text-gray-500 font-medium">
              {savingsRate >= 30 ? 'Excellent savings!' : savingsRate >= 10 ? 'Good, keep improving' : 'Try to reduce expenses'}
            </div>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Donut Chart - Expense Breakdown */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-gray-900">Expense Breakdown</div>
              <div className="text-xs text-gray-500 mt-0.5">By category</div>
            </div>
            {expenseCategories.length > 0 && (
              <div className="text-xs text-gray-600 bg-gray-100 font-medium px-2.5 py-1 rounded-lg">
                {expenseCategories.length} categories
              </div>
            )}
          </div>
          <div className="mt-6">
            {loading ? (
              <div className="flex items-center justify-center h-[220px]">
                <div className="h-[180px] w-[180px] animate-pulse rounded-full border-[24px] border-gray-100" />
              </div>
            ) : (
              <DonutChart data={expenseCategories} />
            )}
          </div>
        </div>

        {/* Donut Chart - Income Breakdown */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-gray-900">Income Sources</div>
              <div className="text-xs text-gray-500 mt-0.5">By category</div>
            </div>
            {incomeCategories.length > 0 && (
              <div className="text-xs text-gray-600 bg-gray-100 font-medium px-2.5 py-1 rounded-lg">
                {incomeCategories.length} sources
              </div>
            )}
          </div>
          <div className="mt-6">
            {loading ? (
              <div className="flex items-center justify-center h-[220px]">
                <div className="h-[180px] w-[180px] animate-pulse rounded-full border-[24px] border-gray-100" />
              </div>
            ) : (
              <DonutChart data={incomeCategories} />
            )}
          </div>
        </div>
      </div>

      {/* Monthly Trends Bar Chart */}
      <div className="mt-6 glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-sm font-bold text-gray-900">Monthly Trends</div>
            <div className="text-xs text-gray-500 mt-0.5">Income vs Expenses over time</div>
          </div>
          {trends.length > 0 && (
            <div className="text-xs text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg font-medium">
              Last {Math.min(6, new Set(trends.map((t: any) => t.period)).size)} months
            </div>
          )}
        </div>
        {loading ? (
          <div className="flex items-end gap-4 h-[180px] pt-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex-1 flex gap-1 items-end">
                <div className="flex-1 animate-pulse rounded-md bg-green-100" style={{ height: `${30 + Math.random() * 70}%` }} />
                <div className="flex-1 animate-pulse rounded-md bg-red-100" style={{ height: `${20 + Math.random() * 60}%` }} />
              </div>
            ))}
          </div>
        ) : (
          <BarChart data={trends} />
        )}
      </div>

      {/* Recent Transactions */}
      <div className="mt-6 glass-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-gray-900">Recent Transactions</div>
            <div className="text-xs text-gray-500 mt-0.5">Latest activity</div>
          </div>
          {transactions.length > 0 && (
            <button
              onClick={() => navigate('/records')}
              className="text-xs font-semibold text-green-700 hover:text-green-600 transition-colors"
            >
              View all →
            </button>
          )}
        </div>
        <div className="mt-6 space-y-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl bg-gray-100" />
            ))
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="text-3xl mb-2">📊</div>
              <div className="text-sm font-medium text-gray-900">No transactions yet</div>
              <div className="text-xs text-gray-500 mt-1">Add records to see your financial overview</div>
              <button
                onClick={() => navigate('/records')}
                className="mt-4 btn-primary text-xs py-2 px-4"
              >
                Add your first record
              </button>
            </div>
          ) : (
            transactions.slice(0, 8).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-white px-4 py-3 hover:shadow-md transition-all">
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold ${r.type === 'income' ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fee2e2] text-[#991b1b]'}`}>
                    {r.type === 'income' ? '↑' : '↓'}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">{r.category}</div>
                    <div className="text-xs text-gray-500 font-medium">{new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} {r.notes ? `• ${r.notes}` : ''}</div>
                  </div>
                </div>
                <div className={`text-sm font-bold tabular-nums ${r.type === 'income' ? 'text-[#166534]' : 'text-[#991b1b]'}`}>
                  {r.type === 'income' ? '+' : '-'}{formatCurrency(Number(r.amount || 0))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
