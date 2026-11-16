import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, ShoppingBag, QrCode, LogOut, Wallet, Package,
  Scissors, Menu, UserCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { logout } from '../../api/auth';

const navItems = [
  { to: '/',                 label: 'Dashboard',        icon: LayoutDashboard },
  { to: '/customers',        label: 'Customers',        icon: Users,          adminOnly: true },
  { to: '/customer/list',    label: 'All Orders',       icon: ShoppingBag,    adminOnly: true },
  { to: '/billing',          label: 'Billing System',   icon: QrCode,         adminOnly: true },
  { to: '/payment-records',  label: 'Payment Records',  icon: Wallet,         adminOnly: true },
  { to: '/materials',        label: 'Materials',        icon: Package,        adminOnly: true },
  { to: '/tailors-payment',  label: 'Tailors Payment',  icon: Scissors,       adminOnly: true },
  { to: '/employees',        label: 'Employee Details', icon: UserCheck,      adminOnly: true },
];

export default function Sidebar({ open, onToggle }) {
  const { user, isAdmin, logoutUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await logout(); } catch {}
    logoutUser();
    navigate('/login');
  };

  const filtered = navItems.filter((n) => !n.adminOnly || isAdmin);

  return (
    <aside className={`
      h-full bg-surface-card border-r border-surface-border z-40
      flex flex-col transition-all duration-300 flex-shrink-0
      ${open ? 'w-64' : 'w-16'}
    `}>
      {/* Header — Hamburger button replaces the scissor logo */}
      <div className={`flex items-center h-16 border-b border-surface-border px-3.5 ${open ? 'gap-3' : 'justify-center'}`}>
        <button
          onClick={onToggle}
          type="button"
          className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center shadow-brand flex-shrink-0 hover:opacity-90 active:scale-95 transition-all cursor-pointer"
          title={open ? "Collapse sidebar" : "Expand sidebar"}
        >
          <Menu className="w-5 h-5 text-gray-900" />
        </button>
        {open && (
          <div className="overflow-hidden min-w-0">
            <h1 className="font-display font-bold text-gray-900 text-sm leading-tight truncate">Timelines</h1>
            <p className="text-xs text-gray-500 truncate">Costume Designers</p>
          </div>
        )}
      </div>

      {/* Navigation — NO auto-close on link click; only opens/closes via hamburger icon */}
      <nav className="flex-1 px-2.5 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden">
        {filtered.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={label}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${!open ? 'justify-center px-0' : ''}`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {open && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="p-2.5 border-t border-surface-border space-y-2">
        {open ? (
          <>
            <div className="px-3 py-2 rounded-lg bg-slate-200">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name || 'Admin User'}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email || 'admin@timelines.in'}</p>
              <span className={`badge mt-1 ${user?.role === 'admin' ? 'badge-admin' : 'badge-staff'}`}>
                {user?.role || 'admin'}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="nav-item w-full text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <span>Logout</span>
            </button>
          </>
        ) : (
          <button
            onClick={handleLogout}
            title="Logout"
            className="nav-item w-full justify-center px-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
          </button>
        )}
      </div>
    </aside>
  );
}
