import { useEffect, useMemo, useState } from 'react';
import supabase from '../lib/supabase';
import { signInWithGoogle } from '../lib/googleAuth';

export default function AuthGate({ children }: { children: (token: string) => any }) {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('password123');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const title = useMemo(() => (mode === 'signin' ? 'Sign in' : 'Create account'), [mode]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      setToken(session?.access_token ?? null);
      setLoading(false);
    };
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setToken(session?.access_token ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: any) {
      setErr(e.message || 'Auth failed');
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  if (token) {
    return (
      <div className="min-h-screen bg-[#F4F6F5] text-gray-900 selection:bg-[#B3FF4C]/30 selection:text-[#166534]">
        <div className="mx-auto max-w-6xl px-4 pt-6 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#84cc16] to-[#B3FF4C] shadow-lg shadow-[#B3FF4C]/20" />
            <div>
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Finance Dashboard</div>
              <div className="text-sm font-bold text-gray-900 tracking-tight">Backend Architecture Demo</div>
            </div>
          </div>
          <button onClick={signOut} className="rounded-xl border border-gray-200 bg-white shadow-sm px-4 py-1.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors">Sign out</button>
        </div>
        {children(token)}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-lg px-4 py-10">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-sky-500" />
              <div>
                <div className="text-sm text-gray-500">Secure access</div>
                <div className="text-xl font-semibold">{title}</div>
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-500">
              Email/password + Google OAuth. RBAC is enforced server-side in API routes.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <div className="mb-1 text-xs text-gray-500">Email</div>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/40" />
            </label>
            <label className="block">
              <div className="mb-1 text-xs text-gray-500">Password</div>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={6} required className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/40" />
            </label>
            {err ? <div className="text-sm text-red-300">{err}</div> : null}
            <button disabled={loading} className="w-full rounded-xl bg-emerald-500 px-3 py-2 font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-60">
              {loading ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-100" />
            <div className="text-xs text-gray-500">or</div>
            <div className="h-px flex-1 bg-gray-100" />
          </div>

          <button onClick={() => signInWithGoogle('Finance Dashboard')} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50">
            Continue with Google
          </button>
          
          <button type="button" onClick={() => setToken('mock-dev-token')} className="mt-2 w-full rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400 hover:bg-emerald-500/20">
            Bypass Auth (Dev Mode)
          </button>

          <div className="mt-4 text-sm text-gray-500">
            {mode === 'signin' ? (
              <button className="underline hover:text-gray-900" onClick={() => setMode('signup')}>Need an account? Sign up</button>
            ) : (
              <button className="underline hover:text-gray-900" onClick={() => setMode('signin')}>Already have an account? Sign in</button>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
            Demo credentials: <span className="text-gray-900">demo@example.com</span> / <span className="text-gray-900">password123</span>
          </div>
        </div>
      </div>
    </div>
  );
}
