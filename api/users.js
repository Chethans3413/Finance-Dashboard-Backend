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

    // Only Admin can manage users
    const gate = await requireRole(auth.user.id, ['admin']);
    if (gate.error) return res.status(gate.error.status).json({ error: gate.error.message });

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('core_user_roles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { user_id, email, role = 'viewer', is_active = true } = req.body || {};
      if (!user_id && !email) return res.status(400).json({ error: 'user_id or email is required' });
      if (!['viewer', 'analyst', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

      let uid = user_id;
      if (!uid && email) {
        // Look up auth user by email using auth admin API
        const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 2000 });
        if (listErr) throw listErr;
        const found = list?.users?.find((u) => (u.email || '').toLowerCase() === String(email).toLowerCase());
        if (!found) return res.status(404).json({ error: 'Auth user not found for email' });
        uid = found.id;
      }

      const { data, error } = await supabase
        .from('core_user_roles')
        .upsert({ user_id: uid, role, is_active }, { onConflict: 'user_id' })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const { user_id, role, is_active } = req.body || {};
      if (!user_id) return res.status(400).json({ error: 'user_id is required' });
      const patch = {};
      if (role !== undefined) {
        if (!['viewer', 'analyst', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
        patch.role = role;
      }
      if (is_active !== undefined) patch.is_active = !!is_active;

      const { data, error } = await supabase
        .from('core_user_roles')
        .update(patch)
        .eq('user_id', user_id)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
