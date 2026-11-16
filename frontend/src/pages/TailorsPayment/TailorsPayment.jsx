import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Search, Edit2, Trash2, Loader, Scissors,
  IndianRupee, X, Check, User, Hash, Package2,
  Image as ImageIcon, Eye, AlertCircle
} from 'lucide-react';
import {
  getTailorsPayments, createTailorsPayment,
  updateTailorsPayment, deleteTailorsPayment,
} from '../../api/tailorsPayments';
import ConfirmModal from '../../components/UI/ConfirmModal';
import toast from 'react-hot-toast';

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Photo preview modal ───────────────────────────────────────────────────────
function PhotoModal({ url, name, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="font-semibold text-gray-800 text-sm">{name} — Reference Photo</span>
          <button onClick={onClose} className="btn-icon text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <img src={url} alt={name} className="w-full max-h-[70vh] object-contain bg-gray-50" />
      </div>
    </div>
  );
}

// ── Form Modal ────────────────────────────────────────────────────────────────
function TailorPaymentForm({ initial = null, onSave, onClose }) {
  const isEdit = !!initial;
  const fileRef = useRef();

  const [form, setForm] = useState({
    name:        initial?.name        || '',
    amount:      initial?.amount      || '',
    customerId:  initial?.customerId  || '',
    productName: initial?.productName || '',
    notes:       initial?.notes       || '',
  });
  const [photoFile, setPhotoFile]       = useState(null);
  const [photoPreview, setPhotoPreview] = useState(initial?.photoUrl || '');
  const [saving, setSaving]             = useState(false);
  const [errors, setErrors]             = useState({});

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    setErrors(p => ({ ...p, [k]: '' }));
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())       e.name       = 'Name is required';
    if (!form.customerId.trim()) e.customerId = 'Customer ID is required';
    if (form.amount === '' || isNaN(Number(form.amount)) || Number(form.amount) < 0)
                                 e.amount     = 'Enter a valid amount';
    return e;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name',        form.name.trim());
      fd.append('amount',      form.amount);
      fd.append('customerId',  form.customerId.trim());
      fd.append('productName', form.productName.trim());
      fd.append('notes',       form.notes);
      if (photoFile) fd.append('photo', photoFile);
      await onSave(fd);
    } catch (err) {
      // parent shows toast
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Scissors className="w-4.5 h-4.5 text-indigo-600" />
            </div>
            <h2 className="font-bold text-gray-900 text-lg">
              {isEdit ? 'Edit Tailor Payment' : 'Add Tailor Payment'}
            </h2>
          </div>
          <button onClick={onClose} className="btn-icon text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              <User className="w-3.5 h-3.5 inline mr-1" />
              Tailor Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Enter tailor's name…"
              className={`input w-full ${errors.name ? 'border-rose-400' : ''}`}
              autoFocus
            />
            {errors.name && <p className="text-xs text-rose-500 mt-1">{errors.name}</p>}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              <IndianRupee className="w-3.5 h-3.5 inline mr-1" />
              Amount <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">₹</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
                placeholder="0.00"
                className={`input w-full pl-7 ${errors.amount ? 'border-rose-400' : ''}`}
              />
            </div>
            {errors.amount && <p className="text-xs text-rose-500 mt-1">{errors.amount}</p>}
          </div>

          {/* Customer ID */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              <Hash className="w-3.5 h-3.5 inline mr-1" />
              Customer ID <span className="text-rose-500">*</span>
              <span className="text-gray-400 font-normal ml-1">(must be unique)</span>
            </label>
            <input
              type="text"
              value={form.customerId}
              onChange={e => set('customerId', e.target.value)}
              placeholder="e.g. CUST-001, TL-2024-99…"
              className={`input w-full font-mono ${errors.customerId ? 'border-rose-400' : ''}`}
            />
            {errors.customerId && <p className="text-xs text-rose-500 mt-1">{errors.customerId}</p>}
          </div>

          {/* Product Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              <Package2 className="w-3.5 h-3.5 inline mr-1" />
              Product Name
            </label>
            <input
              type="text"
              value={form.productName}
              onChange={e => set('productName', e.target.value)}
              placeholder="e.g. Blouse, Saree, Kurti…"
              className="input w-full"
            />
          </div>

          {/* Reference Photo */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              <ImageIcon className="w-3.5 h-3.5 inline mr-1" />
              Reference Photo
            </label>
            <div
              className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all"
              onClick={() => fileRef.current?.click()}
            >
              {photoPreview ? (
                <div className="relative">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="max-h-48 mx-auto rounded-lg object-contain"
                  />
                  <p className="text-xs text-indigo-600 mt-2 font-medium">Click to change photo</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <ImageIcon className="w-10 h-10 text-gray-300 mx-auto" />
                  <p className="text-sm font-medium text-gray-500">Click to upload reference photo</p>
                  <p className="text-xs text-gray-400">JPG, PNG, WEBP — up to 10 MB</p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Any extra details…"
              rows={2}
              className="input w-full resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-2 sticky bottom-0 bg-white pb-1">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex items-center gap-2 min-w-[140px] justify-center"
            >
              {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {isEdit ? 'Save Changes' : 'Add Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TailorsPayment() {
  const [payments, setPayments]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [editItem, setEditItem]     = useState(null);
  const [deleteId, setDeleteId]     = useState(null);
  const [viewPhoto, setViewPhoto]   = useState(null); // { url, name }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTailorsPayments({ search });
      setPayments(res.data.payments || []);
    } catch {
      toast.error('Failed to load tailor payments');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (fd) => {
    try {
      const res = await createTailorsPayment(fd);
      setPayments(prev => [res.data, ...prev]);
      setShowForm(false);
      toast.success('Payment record added');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to add payment';
      toast.error(msg);
      throw err;
    }
  };

  const handleEdit = async (fd) => {
    try {
      const res = await updateTailorsPayment(editItem.id, fd);
      setPayments(prev => prev.map(p => p.id === editItem.id ? res.data : p));
      setEditItem(null);
      toast.success('Payment record updated');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to update payment';
      toast.error(msg);
      throw err;
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTailorsPayment(deleteId);
      setPayments(prev => prev.filter(p => p.id !== deleteId));
      setDeleteId(null);
      toast.success('Payment record deleted');
    } catch {
      toast.error('Failed to delete record');
    }
  };

  // Stats
  const totalAmount = payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900 flex items-center gap-2">
            <Scissors className="w-7 h-7 text-indigo-500" /> Tailors Payment
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Track tailor-wise payments with reference photos.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2 shadow-md"
        >
          <Plus className="w-4 h-4" /> Add Payment
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Scissors className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Records</div>
            <div className="text-2xl font-bold text-gray-900">{payments.length}</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <IndianRupee className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount Paid</div>
            <div className="text-2xl font-bold text-gray-900">₹ {fmt(totalAmount)}</div>
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
            placeholder="Search by name, customer ID, or product…"
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
                <th className="py-3 px-4">Tailor Name</th>
                <th className="py-3 px-4">Customer ID</th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Photo</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-gray-400">
                    <Loader className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading payments…
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-gray-400">
                    <Scissors className="w-12 h-12 mx-auto mb-3 opacity-30 text-indigo-500" />
                    <p className="font-semibold text-gray-700">No payment records found</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {search ? 'Try a different search term.' : 'Click "+ Add Payment" to get started.'}
                    </p>
                  </td>
                </tr>
              ) : (
                payments.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="py-3.5 px-4 text-xs text-gray-400 font-mono">{idx + 1}</td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-gray-900">{p.name}</div>
                      {p.notes && (
                        <div className="text-xs text-gray-400 truncate max-w-[180px]">{p.notes}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-lg">
                        {p.customerId}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-sm text-gray-700">
                      {p.productName || <span className="text-gray-300">—</span>}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900">
                      ₹ {fmt(p.amount)}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {p.photoUrl ? (
                        <button
                          onClick={() => setViewPhoto({ url: p.photoUrl, name: p.name })}
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
                          title="View photo"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditItem(p)}
                          className="btn-icon text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(p.id)}
                          className="btn-icon text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Total row */}
            {payments.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50/80">
                  <td colSpan={4} className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Total ({payments.length} records)
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-gray-900 text-base">
                    ₹ {fmt(totalAmount)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showForm && (
        <TailorPaymentForm onSave={handleAdd} onClose={() => setShowForm(false)} />
      )}

      {/* Edit Modal */}
      {editItem && (
        <TailorPaymentForm initial={editItem} onSave={handleEdit} onClose={() => setEditItem(null)} />
      )}

      {/* Photo Viewer */}
      {viewPhoto && (
        <PhotoModal url={viewPhoto.url} name={viewPhoto.name} onClose={() => setViewPhoto(null)} />
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <ConfirmModal
          title="Delete Payment Record?"
          message="This will permanently delete this tailor payment record and its photo. Are you sure?"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
