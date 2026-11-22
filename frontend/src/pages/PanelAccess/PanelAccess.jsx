import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, UserPlus, Search, Edit3, Trash2, Eye, EyeOff, Check, X,
  Key, Mail, User, Shield, Lock, Copy, RefreshCw, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getPanelUsers,
  createPanelUser,
  updatePanelUser,
  updatePanelUserPermissions,
  deletePanelUser
} from '../../api/panelUsers';

const PERMISSION_CONFIG = [
  { key: 'customers',      label: 'Customers',        desc: 'Customer records & profiles' },
  { key: 'orders',         label: 'All Orders',       desc: 'Customer orders & work assignments' },
  { key: 'billing',        label: 'Billing System',   desc: 'Create bills & QR codes' },
  { key: 'paymentRecords', label: 'Payment Records',  desc: 'View & manage billing receipts' },
  { key: 'materials',      label: 'Materials',        desc: 'Inventory & stock tracking' },
  { key: 'tailorsPayment', label: 'Tailors Payment',  desc: 'Tailor work log & payouts' },
  { key: 'employees',      label: 'Employee Details', desc: 'Staff directory & proofs' },
];

const DEFAULT_PERMISSIONS = {
  customers: false,
  orders: true,
  billing: false,
  paymentRecords: false,
  materials: false,
  tailorsPayment: false,
  employees: false,
};

export default function PanelAccess() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState({});

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff',
    isActive: true,
    permissions: { ...DEFAULT_PERMISSIONS },
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await getPanelUsers();
      setUsers(res.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load panel users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'staff',
      isActive: true,
      permissions: { ...DEFAULT_PERMISSIONS },
    });
    setShowModal(true);
  };

  const openEditModal = (u) => {
    setEditingUser(u);
    setFormData({
      name: u.name || '',
      email: u.email || '',
      password: u.plainPassword || '',
      role: u.role || 'staff',
      isActive: Boolean(u.isActive),
      permissions: {
        ...DEFAULT_PERMISSIONS,
        ...(typeof u.permissions === 'object' && u.permissions !== null ? u.permissions : {}),
      },
    });
    setShowModal(true);
  };

  const handleTogglePasswordReveal = (id) => {
    setRevealedPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name?.trim()) return toast.error('Name is required');
    if (!formData.email?.trim()) return toast.error('Email is required');
    if (!editingUser && !formData.password) return toast.error('Password is required');

    try {
      setSubmitting(true);
      if (editingUser) {
        await updatePanelUser(editingUser.id, formData);
        toast.success('Panel user updated successfully');
      } else {
        await createPanelUser(formData);
        toast.success('Panel user created successfully');
      }
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save panel user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickPermissionToggle = async (user, permKey) => {
    if (user.role === 'admin') {
      toast('Admin accounts have access to all modules', { icon: 'ℹ️' });
      return;
    }
    const current = Boolean(user.permissions?.[permKey]);
    const updatedPerms = {
      ...DEFAULT_PERMISSIONS,
      ...(user.permissions || {}),
      [permKey]: !current,
    };

    // Optimistic UI update
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, permissions: updatedPerms } : u));

    try {
      await updatePanelUserPermissions(user.id, updatedPerms);
      toast.success(`${PERMISSION_CONFIG.find(p => p.key === permKey)?.label || permKey} ${!current ? 'granted' : 'revoked'}`);
    } catch (err) {
      toast.error('Failed to update permission');
      fetchUsers();
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Are you sure you want to delete panel access for ${user.name} (${user.email})?`)) return;
    try {
      await deletePanelUser(user.id);
      toast.success('User deleted');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const filteredUsers = users.filter(u => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      u.name?.toLowerCase().includes(s) ||
      u.email?.toLowerCase().includes(s) ||
      u.role?.toLowerCase().includes(s)
    );
  });

  const totalUsers = users.length;
  const activeCount = users.filter(u => u.isActive).length;
  const adminCount = users.filter(u => u.role === 'admin').length;
  const staffCount = users.filter(u => u.role === 'staff').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Panel Access & Permissions</h1>
              <p className="text-sm text-gray-500">
                Create login credentials and toggle access to side panel modules for your team.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchUsers}
            className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openCreateModal}
            className="btn-brand flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium shadow-sm hover:shadow transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create Panel User</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <User className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">TOTAL USERS</p>
            <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Check className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">ACTIVE LOGINS</p>
            <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">ADMINS (FULL ACCESS)</p>
            <p className="text-2xl font-bold text-amber-600">{adminCount}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">STAFF / ASSIGNABLE</p>
            <p className="text-2xl font-bold text-blue-600">{staffCount}</p>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Search & Filters */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, email, or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
            />
          </div>
          <div className="text-xs text-gray-500">
            Showing <span className="font-semibold text-gray-800">{filteredUsers.length}</span> user accounts
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/70 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">User Details</th>
                <th className="py-3.5 px-4">Password</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4 min-w-[340px]">Side Panel Module Access (Toggle)</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
                    Loading panel access users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    No panel users found. Click "+ Create Panel User" to add one.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isRevealed = revealedPasswords[u.id];
                  const isAdminUser = u.role === 'admin';
                  const userPerms = u.permissions || {};

                  return (
                    <tr key={u.id} className="hover:bg-purple-50/20 transition-colors">
                      {/* Name & Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${isAdminUser ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'}`}>
                            {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 leading-tight">{u.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500">
                              <Mail className="w-3 h-3 text-gray-400" />
                              <span>{u.email}</span>
                              <button
                                onClick={() => copyToClipboard(u.email, 'Email')}
                                className="text-gray-400 hover:text-purple-600 ml-0.5"
                                title="Copy email"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Password */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs bg-gray-100 px-2.5 py-1 rounded-md text-gray-700 min-w-[90px] text-center">
                            {isRevealed
                              ? (u.plainPassword || '••••••••')
                              : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleTogglePasswordReveal(u.id)}
                            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
                            title={isRevealed ? "Hide password" : "Show password"}
                          >
                            {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          {u.plainPassword && (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(u.plainPassword, 'Password')}
                              className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-purple-600 transition-colors"
                              title="Copy password"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${isAdminUser ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                          {isAdminUser && <Shield className="w-3 h-3" />}
                          {u.role}
                        </span>
                      </td>

                      {/* Side Panel Module Toggles */}
                      <td className="py-3.5 px-4">
                        {isAdminUser ? (
                          <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200/60 inline-flex">
                            <Shield className="w-3.5 h-3.5" />
                            <span>Full Access to All Modules (Administrator)</span>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {PERMISSION_CONFIG.map(({ key, label }) => {
                              const enabled = Boolean(userPerms[key]);
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => handleQuickPermissionToggle(u, key)}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                                    enabled
                                      ? 'bg-purple-50 text-purple-700 border-purple-200 shadow-sm hover:bg-purple-100'
                                      : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600'
                                  }`}
                                  title={`Click to ${enabled ? 'revoke' : 'grant'} access to ${label}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-purple-600' : 'bg-gray-300'}`} />
                                  <span>{label}</span>
                                  {enabled ? (
                                    <Check className="w-3 h-3 text-purple-600" />
                                  ) : (
                                    <X className="w-3 h-3 text-gray-300" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                          {u.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(u)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                            title="Edit user & permissions"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    {editingUser ? 'Edit Panel User' : 'Create New Panel User'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Admin can create and edit login credentials and configure side-panel privileges.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Email Address (Login ID) *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. rahul@timelines.in"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Password {editingUser ? '(leave blank to keep current)' : '*'}
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required={!editingUser}
                      placeholder={editingUser ? 'Enter new password or keep existing' : 'e.g. pass1234'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 text-sm font-mono border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Plain text visible to admin for easy team sharing.
                  </p>
                </div>

                {/* Role */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Account Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
                  >
                    <option value="staff">Staff (Custom side panel access)</option>
                    <option value="admin">Admin (Full system access)</option>
                  </select>
                </div>
              </div>

              {/* Status active checkbox */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <p className="text-sm font-medium text-gray-800">Account Active</p>
                  <p className="text-xs text-gray-500">Allow this user to sign into the Timelines panel</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {/* Permissions Switch Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Side Panel Module Permissions
                    </h4>
                    <p className="text-xs text-gray-500">
                      Toggle which navigation items will be visible and accessible for this account.
                    </p>
                  </div>
                  {formData.role !== 'admin' && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const allTrue = {};
                          PERMISSION_CONFIG.forEach(p => { allTrue[p.key] = true; });
                          setFormData({ ...formData, permissions: allTrue });
                        }}
                        className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                      >
                        Select All
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={() => {
                          const allFalse = {};
                          PERMISSION_CONFIG.forEach(p => { allFalse[p.key] = false; });
                          setFormData({ ...formData, permissions: allFalse });
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Clear All
                      </button>
                    </div>
                  )}
                </div>

                {formData.role === 'admin' ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>Administrator accounts bypass restrictions and always have full access to all side panel modules.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {PERMISSION_CONFIG.map(({ key, label, desc }) => {
                      const isChecked = Boolean(formData.permissions?.[key]);
                      return (
                        <div
                          key={key}
                          onClick={() => {
                            setFormData({
                              ...formData,
                              permissions: {
                                ...formData.permissions,
                                [key]: !isChecked,
                              },
                            });
                          }}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            isChecked
                              ? 'bg-purple-50/50 border-purple-300 shadow-xs'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="pr-2">
                            <p className={`text-sm font-semibold ${isChecked ? 'text-purple-900' : 'text-gray-700'}`}>
                              {label}
                            </p>
                            <p className="text-[11px] text-gray-500">{desc}</p>
                          </div>
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${isChecked ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-300'}`}>
                            {isChecked ? <Check className="w-3.5 h-3.5" /> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-brand px-5 py-2 text-sm rounded-xl font-medium shadow-sm hover:shadow transition-all disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingUser ? 'Update Panel User' : 'Create Panel User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
