import { isMockMode, mockDashboard, mockGetRecords, mockAddRecord, mockDeleteRecord, mockDeleteAllRecords, mockGetUsers } from './mockData';

/**
 * Unified fetch wrapper that automatically falls back to mock data when running in dev mode.
 * The demo token "mock-dev-token" triggers mock mode.
 */
export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = (options.headers as any)?.['Authorization']?.replace('Bearer ', '') || '';
  // Default method to GET for mock handling.
  const method = (options.method ? options.method.toString().toUpperCase() : 'GET');
  // If we are in mock mode, bypass network entirely.
  if (isMockMode(token)) {
    // Simulate network latency for realism.
    await new Promise((r) => setTimeout(r, 200));
    // Resolve based on endpoint.
    if (path.startsWith('/api/dashboard')) {
      return { ok: true, json: async () => mockDashboard() } as any;
    }
    if (path.startsWith('/api/records/bulk-delete')) {
      if (method === 'POST') {
        const body = JSON.parse(options.body as string);
        const res = mockDeleteAllRecords(body.type, body.category);
        return { ok: true, json: async () => res } as any;
      }
    }
    if (path.startsWith('/api/records')) {
      if (method === 'GET') {
        const url = new URL('http://localhost' + path);
        const params = Object.fromEntries(url.searchParams.entries());
        return { ok: true, json: async () => mockGetRecords(params) } as any;
      }
      if (method === 'POST') {
        const body = JSON.parse(options.body as string);
        const rec = mockAddRecord(body);
        return { ok: true, json: async () => rec } as any;
      }
      if (method === 'DELETE') {
        const { id } = JSON.parse(options.body as string);
        const res = mockDeleteRecord(id);
        return { ok: true, json: async () => res } as any;
      }
    }
    if (path.startsWith('/api/users')) {
      if (options.method === 'GET') {
        return { ok: true, json: async () => mockGetUsers() } as any;
      }
    }
    // Default fallback – empty array.
    return { ok: true, json: async () => [] } as any;
  }

  // Production / Vercel dev mode – real fetch.
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json');

  return fetch(path, {
    ...options,
    headers,
  });
}

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}
