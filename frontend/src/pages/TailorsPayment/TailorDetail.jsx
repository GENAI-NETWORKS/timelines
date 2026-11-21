import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Save, CalendarDays,
  Upload, Eye, X, Image as ImageIcon
} from 'lucide-react';
import {
  getTailorStaffMember,
  getWorkEntries, createWorkEntry, updateWorkEntry, deleteWorkEntry,
  getPaymentHistory, savePaymentHistory
} from '../../api/tailorStaff';
import Modal from '../../components/UI/Modal';
import ConfirmModal from '../../components/UI/ConfirmModal';
import toast from 'react-hot-toast';

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toISODate = (d) => d.toISOString().slice(0, 10);
const nowMonth  = () => toISODate(new Date()).slice(0, 7);   // YYYY-MM
const today     = () => toISODate(new Date());

const getPhotoUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
  const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '');
  return `${apiBase}${url}`;
};

const ENTRY_EMPTY = {
  entryDate: today(),
  customer:  '',
  orderNo:   '',
  item:      '',
  subitem:   '',
  amount:    '',
  photoFile: null,
  photoUrl:  '',
};

// ── Photo Modal ───────────────────────────────────────────────────────────────
function PhotoLightbox({ url, title, onClose }) {
  if (!url) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
          <span className="font-semibold text-gray-800 text-sm">{title || 'Reference Photo'}</span>
          <button onClick={onClose} className="btn-icon text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-2 bg-gray-900 flex items-center justify-center min-h-[250px]">
          <img src={url} alt={title || 'Photo'} className="max-h-[75vh] max-w-full object-contain rounded" />
        </div>
      </div>
    </div>
  );
}

// ── Add / Edit Entry Modal Form ───────────────────────────────────────────────
function EntryModalForm({ value, onChange, onSubmit, onCancel, onDelete, loading, isEdit }) {
  const fileRef = useRef();
  const [preview, setPreview] = useState(getPhotoUrl(value.photoUrl));

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
      onChange({ ...value, photoFile: file, removePhoto: false });
    }
  };

  const removePhoto = () => {
    setPreview('');
    onChange({ ...value, photoFile: null, photoUrl: '', removePhoto: true });
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Date */}
        <div>
          <label className="label text-xs font-bold uppercase tracking-wider text-gray-600">Date *</label>
          <input
            type="date"
            className="input"
            value={value.entryDate}
            onChange={e => onChange({ ...value, entryDate: e.target.value })}
            required
          />
        </div>

        {/* Customer */}
        <div>
          <label className="label text-xs font-bold uppercase tracking-wider text-gray-600">Customer</label>
          <input
            className="input"
            placeholder="Customer name"
            value={value.customer}
            onChange={e => onChange({ ...value, customer: e.target.value })}
          />
        </div>

        {/* Order No */}
        <div>
          <label className="label text-xs font-bold uppercase tracking-wider text-gray-600">Order No</label>
          <input
            className="input font-mono"
            placeholder="e.g. ORD-1002"
            value={value.orderNo}
            onChange={e => onChange({ ...value, orderNo: e.target.value })}
          />
        </div>

        {/* Amount */}
        <div>
          <label className="label text-xs font-bold uppercase tracking-wider text-gray-600">Amount (₹) *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input font-semibold"
            placeholder="0.00"
            value={value.amount}
            onChange={e => onChange({ ...value, amount: e.target.value })}
            required
          />
        </div>

        {/* Item */}
        <div>
          <label className="label text-xs font-bold uppercase tracking-wider text-gray-600">Item</label>
          <input
            className="input"
            placeholder="e.g. Kurti / Blouse / Shirt"
            value={value.item}
            onChange={e => onChange({ ...value, item: e.target.value })}
          />
        </div>

        {/* Subitem */}
        <div>
          <label className="label text-xs font-bold uppercase tracking-wider text-gray-600">Sub-Item</label>
          <input
            className="input"
            placeholder="e.g. Lining / Neck design"
            value={value.subitem}
            onChange={e => onChange({ ...value, subitem: e.target.value })}
          />
        </div>
      </div>

      {/* Reference Photo Upload */}
      <div>
        <label className="label text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
          Reference Photo
        </label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />

        {preview ? (
          <div className="relative border-2 border-purple-200 rounded-2xl p-2.5 bg-purple-50/40 flex items-center gap-4">
            <img
              src={preview}
              alt="Reference"
              className="w-20 h-20 object-cover rounded-xl border border-purple-200 shadow-sm bg-white"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-800">Photo attached</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Click Change to replace or Remove to detach.</p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={removePhoto}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-300 hover:border-purple-400 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-gray-50/50 hover:bg-purple-50/20"
          >
            <Upload className="w-6 h-6 mx-auto text-purple-500 mb-1" />
            <p className="text-xs font-bold text-gray-700">Click to upload reference photo</p>
            <p className="text-[11px] text-gray-400 mt-0.5">JPG, PNG, WEBP up to 10MB</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100">
        {isEdit ? (
          <button
            type="button"
            onClick={onDelete}
            className="btn text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs px-3 py-2 flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" /> Delete Entry
          </button>
        ) : <div />}

        <div className="flex items-center gap-2">
          <button type="button" onClick={onCancel} className="btn-secondary text-xs px-4 py-2">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs px-5 py-2 shadow-sm"
          >
            {loading ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Entry')}
          </button>
        </div>
      </div>
    </form>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function TailorDetail() {
  const { staffId } = useParams();
  const navigate    = useNavigate();

  const [staff,         setStaff]         = useState(null);
  const [entries,       setEntries]       = useState([]);
  const [history,       setHistory]       = useState([]);
  const [totalEarned,   setTotalEarned]   = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [savingPayment, setSavingPayment] = useState(false);

  // Selected month filter
  const [selectedMonth, setSelectedMonth] = useState(nowMonth);

  // Modals
  const [modal,         setModal]         = useState(null); // 'create' | 'edit'
  const [entryForm,     setEntryForm]     = useState(ENTRY_EMPTY);
  const [editingId,     setEditingId]     = useState(null);
  const [formLoading,   setFormLoading]   = useState(false);
  const [deleteEntryId, setDeleteEntryId] = useState(null);
  const [lightboxUrl,   setLightboxUrl]   = useState('');
  const [lightboxTitle, setLightboxTitle] = useState('');

  // ── Load staff info ─────────────────────────────────────────────────────────
  useEffect(() => {
    getTailorStaffMember(staffId)
      .then(r => setStaff(r.data))
      .catch(() => { toast.error('Employee not found.'); navigate('/tailors-payment'); });
  }, [staffId, navigate]);

  // ── Load entries for selected month ────────────────────────────────────────
  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getWorkEntries(staffId, { month: selectedMonth });
      setEntries(res.data.entries || []);
      setTotalEarned(res.data.totalEarned || 0);
    } catch {
      toast.error('Failed to load work entries.');
    } finally {
      setLoading(false);
    }
  }, [staffId, selectedMonth]);

  // ── Load payment history ────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    try {
      const res = await getPaymentHistory(staffId);
      setHistory(res.data.history || []);
    } catch {}
  }, [staffId]);

  useEffect(() => {
    loadEntries();
    loadHistory();
  }, [loadEntries, loadHistory]);

  // ── Create Entry ────────────────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const fd = new FormData();
      fd.append('entryDate', entryForm.entryDate);
      fd.append('customer',  entryForm.customer.trim());
      fd.append('orderNo',   entryForm.orderNo.trim());
      fd.append('item',      entryForm.item.trim());
      fd.append('subitem',   entryForm.subitem.trim());
      fd.append('amount',    parseFloat(entryForm.amount) || 0);
      if (entryForm.photoFile) fd.append('photo', entryForm.photoFile);

      await createWorkEntry(staffId, fd);
      toast.success('Work entry added!');
      setModal(null);
      setEntryForm(ENTRY_EMPTY);
      loadEntries();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add entry.');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Edit Entry ──────────────────────────────────────────────────────────────
  const handleEdit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const fd = new FormData();
      fd.append('entryDate', entryForm.entryDate);
      fd.append('customer',  entryForm.customer.trim());
      fd.append('orderNo',   entryForm.orderNo.trim());
      fd.append('item',      entryForm.item.trim());
      fd.append('subitem',   entryForm.subitem.trim());
      fd.append('amount',    parseFloat(entryForm.amount) || 0);
      if (entryForm.photoFile) fd.append('photo', entryForm.photoFile);
      if (entryForm.removePhoto) fd.append('removePhoto', 'true');

      await updateWorkEntry(staffId, editingId, fd);
      toast.success('Work entry updated!');
      setModal(null);
      loadEntries();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update entry.');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Delete Entry ────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    try {
      await deleteWorkEntry(staffId, deleteEntryId);
      toast.success('Entry removed.');
      setDeleteEntryId(null);
      setModal(null);
      loadEntries();
    } catch {
      toast.error('Failed to delete entry.');
    }
  };

  // ── Open Edit modal ─────────────────────────────────────────────────────────
  const openEdit = (entry) => {
    setEditingId(entry.id);
    setEntryForm({
      entryDate: entry.entryDate ? entry.entryDate.slice(0, 10) : today(),
      customer:  entry.customer || '',
      orderNo:   entry.orderNo || '',
      item:      entry.item || '',
      subitem:   entry.subitem || '',
      amount:    entry.amount ?? '',
      photoUrl:  entry.photoUrl || '',
      photoFile: null,
      removePhoto: false,
    });
    setModal('edit');
  };

  // ── Save Payment Details ────────────────────────────────────────────────────
  const handleSavePayment = async () => {
    if (totalEarned <= 0) {
      toast.error('No earnings to save for this month.');
      return;
    }
    setSavingPayment(true);
    try {
      await savePaymentHistory(staffId, {
        monthYear:   selectedMonth,
        totalAmount: totalEarned,
        notes:       '',
      });
      toast.success(`Payment of ₹${fmt(totalEarned)} saved for ${selectedMonth}!`);
      loadHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save payment.');
    } finally {
      setSavingPayment(false);
    }
  };

  if (!staff) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const thCls = 'px-3.5 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 bg-gray-50/80';

  return (
    <div className="space-y-6 animate-fade-in pb-16">

      {/* Lightbox */}
      <PhotoLightbox
        url={lightboxUrl}
        title={lightboxTitle}
        onClose={() => setLightboxUrl('')}
      />

      {/* ── Employee Header ───────────────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/tailors-payment')}
              className="btn-icon text-gray-500 hover:bg-gray-100"
              title="Back to Tailors Payment"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-sm flex-shrink-0">
              {staff.name[0].toUpperCase()}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-black text-xl text-gray-900 uppercase tracking-wide">{staff.name}</h2>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                <span className="font-semibold text-purple-600">ID: {staff.employeeId}</span>
                <span className="text-gray-400">•</span>
                <span className="font-medium text-blue-600">{staff.role}</span>
              </div>
            </div>
          </div>

          {/* Month picker */}
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-gray-400" />
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
        </div>
      </div>

      {/* ── Work Entries + Sidebar ────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-5">

        {/* ── Left: Work Entries ─────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 card overflow-hidden">
          {/* Table header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">Work Entries</h3>
              <p className="text-xs text-gray-400 mt-0.5">{selectedMonth} — {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}</p>
            </div>
            <button
              onClick={() => { setEntryForm({ ...ENTRY_EMPTY, entryDate: today() }); setModal('create'); }}
              className="btn bg-purple-600 hover:bg-purple-700 text-white text-xs flex items-center gap-1.5 px-3 py-2 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Add Entry
            </button>
          </div>

          {/* Table without QTY, RATE, or ACTIONS */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className={thCls + ' w-12'}>S.No</th>
                  <th className={thCls}>Date</th>
                  <th className={thCls}>Customer</th>
                  <th className={thCls}>Order No</th>
                  <th className={thCls}>Item</th>
                  <th className={thCls}>Sub-Item</th>
                  <th className={thCls}>Photo</th>
                  <th className={thCls + ' text-right'}>Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-gray-400">
                      <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      Loading entries…
                    </td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-400 text-sm">
                      No entries yet. Click <strong>"+ Add Entry"</strong> to start.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry, idx) => {
                    const fullPhoto = getPhotoUrl(entry.photoUrl);
                    return (
                      <tr
                        key={entry.id}
                        onClick={() => openEdit(entry)}
                        className="hover:bg-purple-50/40 transition-colors cursor-pointer group"
                        title="Click to edit or delete"
                      >
                        <td className="px-3.5 py-3 text-xs text-gray-400 font-mono">{idx + 1}</td>
                        <td className="px-3.5 py-3 text-xs text-gray-700 font-medium whitespace-nowrap">
                          {entry.entryDate ? new Date(entry.entryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="px-3.5 py-3 text-xs text-gray-800 font-semibold">{entry.customer || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3.5 py-3 text-xs font-mono text-purple-700 font-semibold">{entry.orderNo || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3.5 py-3 text-xs text-gray-800">{entry.item || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3.5 py-3 text-xs text-gray-600">{entry.subitem || <span className="text-gray-300">—</span>}</td>

                        {/* Photo column */}
                        <td className="px-3.5 py-3 text-xs">
                          {fullPhoto ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxUrl(fullPhoto);
                                setLightboxTitle(`${entry.customer || 'Entry'} - ${entry.item || 'Photo'}`);
                              }}
                              className="inline-flex items-center gap-1.5 text-purple-600 hover:text-purple-800 font-medium"
                              title="Click to view full photo"
                            >
                              <img
                                src={fullPhoto}
                                alt="preview"
                                className="w-8 h-8 object-cover rounded-lg border border-purple-200 shadow-sm"
                              />
                              <span className="flex items-center gap-0.5 text-[11px] underline">
                                <Eye className="w-3 h-3" /> View
                              </span>
                            </button>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>

                        {/* Amount */}
                        <td className="px-3.5 py-3 text-xs text-right font-bold text-gray-900 font-mono text-sm">
                          ₹{fmt(entry.amount)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Right Sidebar ─────────────────────────────────────────────────── */}
        <div className="w-full lg:w-72 flex flex-col gap-5">

          {/* Current Month History */}
          <div className="card p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
              Current Month History
            </h4>
            {history.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No payments saved for this month yet.</p>
            ) : (
              <div className="space-y-2.5">
                {history
                  .filter(h => h.monthYear === selectedMonth)
                  .slice(0, 5)
                  .map(h => (
                    <div key={h.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <div>
                        <div className="text-xs font-semibold text-gray-700">{h.monthYear}</div>
                        {h.notes && <div className="text-[11px] text-gray-400">{h.notes}</div>}
                      </div>
                      <div className="font-bold text-purple-700 text-sm font-mono">₹{fmt(h.totalAmount)}</div>
                    </div>
                  ))}
                {history.filter(h => h.monthYear === selectedMonth).length === 0 && (
                  <p className="text-xs text-gray-400 italic">No saved payments for {selectedMonth}.</p>
                )}
              </div>
            )}

            {/* All past months */}
            {history.filter(h => h.monthYear !== selectedMonth).length > 0 && (
              <details className="mt-3">
                <summary className="text-xs text-purple-600 font-semibold cursor-pointer hover:text-purple-700 select-none">
                  View older history ({history.filter(h => h.monthYear !== selectedMonth).length})
                </summary>
                <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                  {history.filter(h => h.monthYear !== selectedMonth).map(h => (
                    <div key={h.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <div className="text-xs font-semibold text-gray-700">{h.monthYear}</div>
                      <div className="font-bold text-gray-700 text-xs font-mono">₹{fmt(h.totalAmount)}</div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* Payment Calculation */}
          <div className="card p-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">Payment Calculation</h4>

            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Total Entries</span>
                <span className="font-semibold text-gray-800">{entries.length}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-t border-gray-100 pt-2.5">
                <span className="font-bold text-gray-900">Total Earned</span>
                <span className="font-black text-gray-900 text-lg font-mono">₹{fmt(totalEarned)}</span>
              </div>
            </div>

            <button
              onClick={handleSavePayment}
              disabled={savingPayment || totalEarned <= 0}
              className="mt-5 w-full btn bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white flex items-center justify-center gap-2 py-3 font-semibold"
            >
              {savingPayment
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Save className="w-4 h-4" />
              }
              {savingPayment ? 'Saving…' : 'Save Payment Details'}
            </button>
          </div>
        </div>
      </div>

      {/* Add Entry Modal */}
      {modal === 'create' && (
        <Modal title="Add Work Entry" onClose={() => setModal(null)}>
          <EntryModalForm
            value={entryForm}
            onChange={setEntryForm}
            onSubmit={handleCreate}
            onCancel={() => setModal(null)}
            loading={formLoading}
            isEdit={false}
          />
        </Modal>
      )}

      {/* Edit Entry Modal */}
      {modal === 'edit' && (
        <Modal title="Edit Work Entry" onClose={() => setModal(null)}>
          <EntryModalForm
            value={entryForm}
            onChange={setEntryForm}
            onSubmit={handleEdit}
            onCancel={() => setModal(null)}
            onDelete={() => setDeleteEntryId(editingId)}
            loading={formLoading}
            isEdit={true}
          />
        </Modal>
      )}

      {/* Delete Entry Confirm */}
      {deleteEntryId && (
        <ConfirmModal
          title="Delete Work Entry?"
          message="Are you sure you want to remove this entry? This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setDeleteEntryId(null)}
        />
      )}
    </div>
  );
}
