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

    // Viewer can read dashboard; Analyst/Admin can also access analytics; we treat this endpoint as analytics-read.
    const gate = await requireRole(auth.user.id, ['viewer', 'analyst', 'admin']);
    if (gate.error) return res.status(gate.error.status).json({ error: gate.error.message });

    if (req.method === 'GET') {
      const userId = auth.user.id;

      const [{ data: summary }, { data: cats }, { data: trends }, { data: recent }] = await Promise.all([
        supabase.from('read_dashboard_summaries').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('read_category_totals').select('*').eq('user_id', userId).order('total', { ascending: false }),
        supabase.from('read_trends_monthly').select('*').eq('user_id', userId).order('period', { ascending: true }),
        supabase
          .from('core_financial_records')
          .select('*')
          .eq('user_id', userId)
          .eq('is_deleted', false)
          .order('date', { ascending: false })
          .limit(8),
      ]);

      return res.status(200).json({
        summary: summary || { user_id: userId, total_income: 0, total_expenses: 0, net_balance: 0, computed_at: null },
        category_totals: cats || [],
        trends_monthly: trends || [],
        recent_transactions: recent || [],
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
