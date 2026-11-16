import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Edit2, Trash2, Loader, Package,
  ArrowDownCircle, ArrowUpCircle, IndianRupee, X, Check, AlertTriangle
} from 'lucide-react';
import { getMaterials, createMaterial, updateMaterial, deleteMaterial } from '../../api/materials';
import ConfirmModal from '../../components/UI/ConfirmModal';
import toast from 'react-hot-toast';

// ─── Empty form state ────────────────────────────────────────────────
const EMPTY = { name: '', stockIn: '', stockOut: '', pricing: '', unit: 'pcs', notes: '' };

// ─── Inline Material Form Modal ──────────────────────────────────────
function MaterialFormModal({ initial = null, onSave, onClose }) {
  const isEdit = !!initial;
  const [form, setForm] = useState(initial
    ? { name: initial.name, stockIn: initial.stockIn, stockOut: initial.stockOut, pricing: initial.pricing, unit: initial.unit || 'pcs', notes: initial.notes || '' }
    : EMPTY
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k, v) => {
    setForm(prev => ({ ...prev, [k]: v }));
    setErrors(prev => ({ ...prev, [k]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (form.stockIn === '' || isNaN(Number(form.stockIn))) e.stockIn = 'Enter a valid number';
    if (form.stockOut === '' || isNaN(Number(form.stockOut))) e.stockOut = 'Enter a valid number';
    if (form.pricing === '' || isNaN(Number(form.pricing))) e.pricing = 'Enter a valid price';
    if (Number(form.stockOut) > Number(form.stockIn)) e.stockOut = 'Stock Out cannot exceed Stock In';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        stockIn: Number(form.stockIn),
        stockOut: Number(form.stockOut),
        pricing: Number(form.pricing),
        unit: form.unit,
        notes: form.notes,
      };
      await onSave(payload);
    } catch {
      // parent shows toast
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center">
              <Package className="w-4.5 h-4.5 text-purple-600" />
            </div>
            <h2 className="font-bold text-gray-900 text-lg">{isEdit ? 'Edit Material' : 'Add Material'}</h2>
          </div>
          <button onClick={onClose} className="btn-icon text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              Material Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Cotton Fabric, Buttons, Zippers…"
              className={`input w-full ${errors.name ? 'border-rose-400 focus:ring-rose-400' : ''}`}
              autoFocus
            />
            {errors.name && <p className="text-xs text-rose-500 mt-1">{errors.name}</p>}
          </div>

          {/* Stock In / Stock Out */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <ArrowDownCircle className="w-3.5 h-3.5" /> Stock In
                </span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.stockIn}
                onChange={e => set('stockIn', e.target.value)}
                placeholder="0"
                className={`input w-full ${errors.stockIn ? 'border-rose-400' : ''}`}
              />
              {errors.stockIn && <p className="text-xs text-rose-500 mt-1">{errors.stockIn}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                <span className="inline-flex items-center gap-1 text-rose-600">
                  <ArrowUpCircle className="w-3.5 h-3.5" /> Stock Out
                </span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.stockOut}
                onChange={e => set('stockOut', e.target.value)}
                placeholder="0"
                className={`input w-full ${errors.stockOut ? 'border-rose-400' : ''}`}
              />
              {errors.stockOut && <p className="text-xs text-rose-500 mt-1">{errors.stockOut}</p>}
            </div>
          </div>

          {/* Pricing + Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                <span className="inline-flex items-center gap-1">
                  <IndianRupee className="w-3.5 h-3.5" /> Pricing (per unit)
                </span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">₹</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.pricing}
                  onChange={e => set('pricing', e.target.value)}
                  placeholder="0.00"
                  className={`input w-full pl-7 ${errors.pricing ? 'border-rose-400' : ''}`}
                />
              </div>
              {errors.pricing && <p className="text-xs text-rose-500 mt-1">{errors.pricing}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Unit</label>
              <select
                value={form.unit}
                onChange={e => set('unit', e.target.value)}
                className="input w-full"
              >
                {['pcs', 'meters', 'kg', 'g', 'liters', 'ml', 'rolls', 'bundles', 'pairs', 'sets', 'yards'].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Any additional details…"
              rows={2}
              className="input w-full resize-none"
            />
          </div>

          {/* Available preview */}
          {form.stockIn !== '' && form.stockOut !== '' && !isNaN(Number(form.stockIn)) && !isNaN(Number(form.stockOut)) && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
              Number(form.stockIn) - Number(form.stockOut) >= 0
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-rose-50 text-rose-700'
            }`}>
              <Check className="w-4 h-4" />
              Available Stock: <strong>{(Number(form.stockIn) - Number(form.stockOut)).toFixed(2)} {form.unit}</strong>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 min-w-[120px] justify-center">
              {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {isEdit ? 'Save Changes' : 'Add Material'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────
export default function Materials() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [showForm, setShowForm]   = useState(false);   // 'add' | null
  const [editItem, setEditItem]   = useState(null);    // material object to edit
  const [deleteId, setDeleteId]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMaterials({ search });
      setMaterials(res.data.materials || []);
    } catch {
      toast.error('Failed to load materials');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (payload) => {
    try {
      const res = await createMaterial(payload);
      setMaterials(prev => [res.data, ...prev]);
      setShowForm(false);
      toast.success('Material added successfully');
    } catch {
      toast.error('Failed to add material');
      throw new Error();
    }
  };

  const handleEdit = async (payload) => {
    try {
      const res = await updateMaterial(editItem.id, payload);
      setMaterials(prev => prev.map(m => m.id === editItem.id ? res.data : m));
      setEditItem(null);
      toast.success('Material updated');
    } catch {
      toast.error('Failed to update material');
      throw new Error();
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMaterial(deleteId);
      setMaterials(prev => prev.filter(m => m.id !== deleteId));
      setDeleteId(null);
      toast.success('Material deleted');
    } catch {
      toast.error('Failed to delete material');
    }
  };

  // Stats
  const totalMaterials = materials.length;
  const totalValue     = materials.reduce((s, m) => s + (parseFloat(m.stockAvailable) * parseFloat(m.pricing)), 0);
  const lowStock       = materials.filter(m => parseFloat(m.stockAvailable) <= 0).length;

  const fmt = (n) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900 flex items-center gap-2">
            <Package className="w-7 h-7 text-purple-500" /> Materials
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Track raw materials — stock in, stock out, and pricing.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2 shadow-md"
        >
          <Plus className="w-4 h-4" /> Add Material
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Materials</div>
            <div className="text-2xl font-bold text-gray-900">{totalMaterials}</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <IndianRupee className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Value</div>
            <div className="text-2xl font-bold text-gray-900">₹ {fmt(totalValue)}</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${lowStock > 0 ? 'bg-rose-50 text-rose-600' : 'bg-gray-100 text-gray-400'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Out of Stock</div>
            <div className={`text-2xl font-bold ${lowStock > 0 ? 'text-rose-600' : 'text-gray-900'}`}>{lowStock}</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search materials by name…"
            className="input pl-9 w-full text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Material Name</th>
                <th className="py-3 px-4 text-right">
                  <span className="inline-flex items-center gap-1 text-emerald-600">
                    <ArrowDownCircle className="w-3.5 h-3.5" /> Stock In
                  </span>
                </th>
                <th className="py-3 px-4 text-right">
                  <span className="inline-flex items-center gap-1 text-rose-600">
                    <ArrowUpCircle className="w-3.5 h-3.5" /> Stock Out
                  </span>
                </th>
                <th className="py-3 px-4 text-right">Available</th>
                <th className="py-3 px-4 text-right">Price / Unit</th>
                <th className="py-3 px-4 text-right">Stock Value</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-gray-400">
                    <Loader className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-500" />
                    Loading materials…
                  </td>
                </tr>
              ) : materials.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-gray-400">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30 text-purple-500" />
                    <p className="font-semibold text-gray-700">No materials found</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {search ? 'Try a different search term.' : 'Click "+ Add Material" to get started.'}
                    </p>
                  </td>
                </tr>
              ) : (
                materials.map((m, idx) => {
                  const avail = parseFloat(m.stockAvailable) || 0;
                  const val   = avail * parseFloat(m.pricing || 0);
                  return (
                    <tr key={m.id} className="hover:bg-purple-50/30 transition-colors group">
                      <td className="py-3.5 px-4 text-xs text-gray-400 font-mono">{idx + 1}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900">{m.name}</div>
                        {m.notes && <div className="text-xs text-gray-400 truncate max-w-[200px]">{m.notes}</div>}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="text-emerald-700 font-semibold">{fmt(m.stockIn)}</span>
                        <span className="text-xs text-gray-400 ml-1">{m.unit}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="text-rose-600 font-semibold">{fmt(m.stockOut)}</span>
                        <span className="text-xs text-gray-400 ml-1">{m.unit}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                          avail <= 0
                            ? 'bg-rose-100 text-rose-700'
                            : avail <= 5
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {fmt(avail)} {m.unit}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-gray-700">
                        ₹ {fmt(m.pricing)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-gray-900">
                        ₹ {fmt(val)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditItem(m)}
                            className="btn-icon text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                            title="Edit Material"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteId(m.id)}
                            className="btn-icon text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                            title="Delete Material"
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

      {/* Add Modal */}
      {showForm && (
        <MaterialFormModal onSave={handleAdd} onClose={() => setShowForm(false)} />
      )}

      {/* Edit Modal */}
      {editItem && (
        <MaterialFormModal initial={editItem} onSave={handleEdit} onClose={() => setEditItem(null)} />
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <ConfirmModal
          title="Delete Material?"
          message="Are you sure you want to delete this material? This action cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

