import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserSquare2, ShoppingBag, Palette,
  IndianRupee, Printer, ClipboardList, Settings, LogOut, Menu, X, Scissors,
  Package, ShoppingCart, CreditCard
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { logout } from '../../api/auth';

const navItems = [
  { to: '/',          label: 'Dashboard',     icon: LayoutDashboard },
  { to: '/customers', label: 'Customers',     icon: Users, adminOnly: true },
  { to: '/employees', label: 'Employees',     icon: UserSquare2, adminOnly: true },
  { to: '/orders',    label: 'Design Orders', icon: ShoppingBag },
  { to: '/canvas',    label: 'Design Canvas', icon: Palette },
  { to: '/salary',    label: 'Salary',        icon: IndianRupee, adminOnly: true },
  { to: '/print',     label: 'Print',         icon: Printer },
  { to: '/inventory', label: 'Stocks (Inv)',  icon: Package, adminOnly: true },
  { to: '/purchases', label: 'Purchases',     icon: ShoppingCart, adminOnly: true },
  { to: '/services',  label: 'Services',      icon: Scissors, adminOnly: true },
  { to: '/payments',  label: 'Payments',      icon: CreditCard, adminOnly: true },
  { to: '/audit',     label: 'Audit Log',     icon: ClipboardList, adminOnly: true },
  { to: '/garments',  label: 'Garment Types', icon: Settings, adminOnly: true },
];

export default function Sidebar({ open, onClose }) {
  const { user, isAdmin, logoutUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await logout(); } catch {}
    logoutUser();
    navigate('/login');
  };

  const filtered = navItems.filter((n) => !n.adminOnly || isAdmin);

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-surface-card border-r border-surface-border z-40
        flex flex-col transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-surface-border">
          <div className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center shadow-brand">
            <Scissors className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-white text-sm leading-tight">Timelines</h1>
            <p className="text-xs text-gray-500">Costume Designers</p>
          </div>
          <button onClick={onClose} className="ml-auto btn-icon lg:hidden">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {filtered.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="px-3 py-4 border-t border-surface-border space-y-2">
          <div className="px-3 py-2.5 rounded-lg bg-surface-elevated/50">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            <span className={`badge mt-1 ${user?.role === 'admin' ? 'badge-admin' : 'badge-staff'}`}>
              {user?.role}
            </span>
          </div>
          <button onClick={handleLogout} className="nav-item w-full text-rose-400 hover:text-rose-300 hover:bg-rose-900/20">
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
