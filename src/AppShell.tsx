import { NavLink, Route, Routes } from 'react-router-dom';
import { BarChart3, Database, Layers3, Shield } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Records from './pages/Records';
import Admin from './pages/Admin';
import Architecture from './pages/Architecture';

function Item({ to, icon: Icon, label }: any) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
          isActive ? 'bg-[#e0ffb3] text-[#1a1a1a]' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
        ].join(' ')
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  );
}

export default function AppShell({ token }: { token: string }) {
  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <div className="relative z-10 flex flex-col gap-3 rounded-[24px] border border-gray-100 bg-white p-3 md:flex-row md:items-center md:justify-between shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
          <div className="flex flex-wrap gap-2">
            <Item to="/" icon={BarChart3} label="Dashboard" />
            <Item to="/records" icon={Database} label="Records" />
            <Item to="/admin" icon={Shield} label="Admin" />
            <Item to="/architecture" icon={Layers3} label="Architecture" />
          </div>
          <div className="text-xs text-gray-400 font-medium px-2">
            Core DB vs Read DB separation • RBAC enforced in API routes
          </div>
        </div>
      </div>

      <Routes>
        <Route path="/" element={<Dashboard token={token} />} />
        <Route path="/records" element={<Records token={token} />} />
        <Route path="/admin" element={<Admin token={token} />} />
        <Route path="/architecture" element={<Architecture />} />
      </Routes>
    </div>
  );
}
