import supabase from './_supabase.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function requireUser(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return { error: { status: 401, message: 'Unauthorized' } };
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { error: { status: 401, message: 'Invalid token' } };
  return { user };
}

async function requireRole(userId, allowedRoles) {
  const { data, error } = await supabase
    .from('core_user_roles')
    .select('role, is_active')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { error: { status: 500, message: error.message } };
  if (!data || !data.is_active) return { error: { status: 403, message: 'User inactive or role not assigned' } };
  if (!allowedRoles.includes(data.role)) return { error: { status: 403, message: 'Forbidden' } };
  return { role: data.role };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const auth = await requireUser(req);
    if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

    const gate = await requireRole(auth.user.id, ['analyst', 'admin']);
    if (gate.error) return res.status(gate.error.status).json({ error: gate.error.message });

    if (req.method === 'POST') {
      await refreshUserReadModel(auth.user.id);
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}

async function refreshUserReadModel(userId) {
  const { data: totals, error: totalsErr } = await supabase
    .from('core_financial_records')
    .select('type, amount')
    .eq('user_id', userId)
    .eq('is_deleted', false);
  if (totalsErr) throw totalsErr;

  let income = 0;
  let expense = 0;
  for (const r of totals || []) {
    if (r.type === 'income') income += Number(r.amount || 0);
    if (r.type === 'expense') expense += Number(r.amount || 0);
  }

  await supabase
    .from('read_dashboard_summaries')
    .upsert({
      user_id: userId,
      total_income: income,
      total_expenses: expense,
      net_balance: income - expense,
      computed_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  const { data: cats, error: catsErr } = await supabase
    .from('core_financial_records')
    .select('type, category, amount')
    .eq('user_id', userId)
    .eq('is_deleted', false);
  if (catsErr) throw catsErr;

  const map = new Map();
  for (const r of cats || []) {
    const key = `${r.type}::${r.category}`;
    map.set(key, (map.get(key) || 0) + Number(r.amount || 0));
  }

  await supabase.from('read_category_totals').delete().eq('user_id', userId);
  const rows = Array.from(map.entries()).map(([key, total]) => {
    const [type, category] = key.split('::');
    return { user_id: userId, type, category, total };
  });
  if (rows.length) await supabase.from('read_category_totals').insert(rows);

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1, 0, 0, 0));
  const { data: trendRows, error: trendErr } = await supabase
    .from('core_financial_records')
    .select('type, amount, date')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .gte('date', start.toISOString());
  if (trendErr) throw trendErr;

  const monthKey = (iso) => {
    const d = new Date(iso);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  };

  const tmap = new Map();
  for (const r of trendRows || []) {
    const m = monthKey(r.date);
    const k = `${m}::${r.type}`;
    tmap.set(k, (tmap.get(k) || 0) + Number(r.amount || 0));
  }

  await supabase.from('read_trends_monthly').delete().eq('user_id', userId);
  const tInserts = Array.from(tmap.entries()).map(([k, total]) => {
    const [period, type] = k.split('::');
    return { user_id: userId, period, type, total };
  });
  if (tInserts.length) await supabase.from('read_trends_monthly').insert(tInserts);
}
