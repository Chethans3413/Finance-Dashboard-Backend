import supabase from './_supabase.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function requireUser(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  // Mock dev token bypass for local development.
  if (token === 'mock-dev-token') {
    return { user: { id: 'dev-user', email: 'dev@example.com' } };
  }
  if (!token) return { error: { status: 401, message: 'Unauthorized' } };
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { error: { status: 401, message: 'Invalid token' } };
  return { user };
}

async function getRole(userId) {
  const { data, error } = await supabase
    .from('core_user_roles')
    .select('role, is_active')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { error: { status: 500, message: error.message } };
  if (!data || !data.is_active) return { error: { status: 403, message: 'User inactive or role not assigned' } };
  return { role: data.role };
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const auth = await requireUser(req);
    if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

    const roleRes = await getRole(auth.user.id);
    if (roleRes.error) return res.status(roleRes.error.status).json({ error: roleRes.error.message });
    const role = roleRes.role;

    if (req.method === 'GET') {
      const { type, category, from, to, q, limit } = req.query || {};

      let query = supabase
        .from('core_financial_records')
        .select('*')
        .eq('user_id', auth.user.id)
        .eq('is_deleted', false);

      if (type) query = query.eq('type', type);
      if (category) query = query.eq('category', category);
      if (from) query = query.gte('date', from);
      if (to) query = query.lte('date', to);
      if (q) query = query.ilike('notes', `%${q}%`);

      query = query.order('date', { ascending: false }).order('id', { ascending: false });

      const lim = Math.min(parseInt(limit || '100', 10) || 100, 500);
      query = query.limit(lim);

      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      if (role === 'viewer') return res.status(403).json({ error: 'Forbidden' });
      const { amount, type, category, date, notes } = req.body || {};
      if (amount === undefined || amount === null) return res.status(400).json({ error: 'amount is required' });
      if (!['income', 'expense'].includes(type)) return res.status(400).json({ error: 'type must be income|expense' });
      if (!category || String(category).trim().length < 2) return res.status(400).json({ error: 'category is required' });
      const iso = parseDate(date);
      if (!iso) return res.status(400).json({ error: 'date must be a valid date' });

      const num = Number(amount);
      if (!Number.isFinite(num)) return res.status(400).json({ error: 'amount must be a number' });

      const { data, error } = await supabase
        .from('core_financial_records')
        .insert({
          user_id: auth.user.id,
          amount: num,
          type,
          category: String(category).trim(),
          date: iso,
          notes: notes ? String(notes) : null,
          is_deleted: false,
        })
        .select()
        .single();
      if (error) throw error;

      // Async-ish: refresh read model for this user (best-effort)
      await refreshUserReadModel(auth.user.id);

      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      if (role === 'viewer') return res.status(403).json({ error: 'Forbidden' });
      const { id, amount, type, category, date, notes } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });

      const patch = {};
      if (amount !== undefined) {
        const num = Number(amount);
        if (!Number.isFinite(num)) return res.status(400).json({ error: 'amount must be a number' });
        patch.amount = num;
      }
      if (type !== undefined) {
        if (!['income', 'expense'].includes(type)) return res.status(400).json({ error: 'type must be income|expense' });
        patch.type = type;
      }
      if (category !== undefined) {
        if (!category || String(category).trim().length < 2) return res.status(400).json({ error: 'category is required' });
        patch.category = String(category).trim();
      }
      if (date !== undefined) {
        const iso = parseDate(date);
        if (!iso) return res.status(400).json({ error: 'date must be a valid date' });
        patch.date = iso;
      }
      if (notes !== undefined) patch.notes = notes ? String(notes) : null;

      const { data, error } = await supabase
        .from('core_financial_records')
        .update(patch)
        .eq('id', id)
        .eq('user_id', auth.user.id)
        .eq('is_deleted', false)
        .select()
        .single();
      if (error) throw error;

      await refreshUserReadModel(auth.user.id);

      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      if (role !== 'admin') return res.status(403).json({ error: 'Admin only' });
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });

      const { data, error } = await supabase
        .from('core_financial_records')
        .update({ is_deleted: true })
        .eq('id', id)
        .eq('user_id', auth.user.id)
        .select()
        .single();
      if (error) throw error;

      await refreshUserReadModel(auth.user.id);

      return res.status(200).json({ ok: true, record: data });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}

async function refreshUserReadModel(userId) {
  // Best-effort read model refresh. This is the "separate read DB layer".
  // We compute aggregates server-side and upsert into read_ tables.

  // Totals
  const { data: totals, error: totalsErr } = await supabase
    .from('core_financial_records')
    .select('type, amount')
    .eq('user_id', userId)
    .eq('is_deleted', false);
  if (totalsErr) return;

  let income = 0;
  let expense = 0;
  for (const r of totals || []) {
    if (r.type === 'income') income += Number(r.amount || 0);
    if (r.type === 'expense') expense += Number(r.amount || 0);
  }
  const net = income - expense;

  await supabase
    .from('read_dashboard_summaries')
    .upsert({
      user_id: userId,
      total_income: income,
      total_expenses: expense,
      net_balance: net,
      computed_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  // Category totals
  const { data: cats } = await supabase
    .from('core_financial_records')
    .select('type, category, amount')
    .eq('user_id', userId)
    .eq('is_deleted', false);

  const map = new Map();
  for (const r of cats || []) {
    const key = `${r.type}::${r.category}`;
    map.set(key, (map.get(key) || 0) + Number(r.amount || 0));
  }

  // Clear old and insert new (simple strategy)
  await supabase.from('read_category_totals').delete().eq('user_id', userId);
  const rows = Array.from(map.entries()).map(([key, total]) => {
    const [type, category] = key.split('::');
    return { user_id: userId, type, category, total };
  });
  if (rows.length) await supabase.from('read_category_totals').insert(rows);

  // Trends: monthly (last 12 months)
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1, 0, 0, 0));
  const { data: trendRows } = await supabase
    .from('core_financial_records')
    .select('type, amount, date')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .gte('date', start.toISOString());

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
