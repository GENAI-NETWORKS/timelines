import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Edit2, Trash2, Save, CalendarDays,
  IndianRupee, ChevronDown, ChevronUp, CheckCircle2
} from 'lucide-react';
import {
  getTailorStaffMember,
  getWorkEntries, createWorkEntry, updateWorkEntry, deleteWorkEntry,
  getPaymentHistory, savePaymentHistory
} from '../../api/tailorStaff';
import ConfirmModal from '../../components/UI/ConfirmModal';
import toast from 'react-hot-toast';

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toISODate = (d) => d.toISOString().slice(0, 10);
const nowMonth  = () => toISODate(new Date()).slice(0, 7);   // YYYY-MM
const today     = () => toISODate(new Date());

const ENTRY_EMPTY = {
  entryDate: today(),
  customer:  '',
  orderNo:   '',
  item:      '',
  subitem:   '',
  quantity:  1,
  rate:      '',
  amount:    '',
};

// ── Work Entry row (edit in-line) ─────────────────────────────────────────────
function EntryForm({ value, onChange, onSave, onCancel, loading, defaultRate = 0 }) {
  const autoAmount = (q, r) => {
    const qty = parseInt(q) || 0;
    const rt  = parseFloat(r) || 0;
    return qty && rt ? (qty * rt).toFixed(2) : '';
  };

  const handleChange = (field, val) => {
    const updated = { ...value, [field]: val };
    if (field === 'quantity' || field === 'rate') {
      updated.amount = autoAmount(
        field === 'quantity' ? val : updated.quantity,
        field === 'rate'     ? val : updated.rate,
      );
    }
    onChange(updated);
  };

  // Pre-fill rate from staff default if blank
  useEffect(() => {
    if (!value.rate && defaultRate > 0) {
      onChange({ ...value, rate: String(defaultRate), amount: autoAmount(value.quantity, defaultRate) });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultRate]);

  const inputCls = 'border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 w-full bg-white';

  return (
    <tr className="bg-purple-50/50 border-b border-purple-100">
      <td className="px-3 py-2 text-xs text-gray-400">—</td>
      <td className="px-3 py-2">
        <input type="date" className={inputCls} value={value.entryDate} onChange={e => handleChange('entryDate', e.target.value)} />
      </td>
      <td className="px-3 py-2">
        <input className={inputCls} placeholder="Customer name" value={value.customer} onChange={e => handleChange('customer', e.target.value)} />
      </td>
      <td className="px-3 py-2">
        <input className={inputCls} placeholder="Order no." value={value.orderNo} onChange={e => handleChange('orderNo', e.target.value)} />
      </td>
      <td className="px-3 py-2">
        <input className={inputCls} placeholder="Item" value={value.item} onChange={e => handleChange('item', e.target.value)} />
      </td>
      <td className="px-3 py-2">
        <input className={inputCls} placeholder="Sub-item" value={value.subitem} onChange={e => handleChange('subitem', e.target.value)} />
      </td>
      <td className="px-3 py-2">
        <input className={inputCls} type="number" min="1" placeholder="Qty" value={value.quantity} onChange={e => handleChange('quantity', e.target.value)} />
      </td>
      <td className="px-3 py-2">
        <input className={inputCls} type="number" min="0" step="0.01" placeholder="Rate ₹" value={value.rate} onChange={e => handleChange('rate', e.target.value)} />
      </td>
      <td className="px-3 py-2">
        <input className={inputCls} type="number" min="0" step="0.01" placeholder="Amount ₹" value={value.amount} onChange={e => handleChange('amount', e.target.value)} />
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <button onClick={onSave} disabled={loading} className="btn-icon text-green-600 hover:bg-green-50" title="Save">
            {loading ? <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          </button>
          <button onClick={onCancel} className="btn-icon text-gray-400 hover:bg-gray-100 text-xs font-bold" title="Cancel">✕</button>
        </div>
      </td>
    </tr>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function TailorDetail() {
  const { staffId } = useParams();
  const navigate    = useNavigate();

  const [staff,       setStaff]       = useState(null);
  const [entries,     setEntries]     = useState([]);
  const [history,     setHistory]     = useState([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [savingPayment, setSavingPayment] = useState(false);

  // Selected month filter (defaults to current month)
  const [selectedMonth, setSelectedMonth] = useState(nowMonth);

  // Inline add/edit
  const [addingEntry, setAddingEntry] = useState(false);
  const [newEntry,    setNewEntry]    = useState(ENTRY_EMPTY);
  const [editingId,   setEditingId]   = useState(null);
  const [editForm,    setEditForm]    = useState(null);
  const [entryLoading, setEntryLoading] = useState(false);
  const [deleteEntryId, setDeleteEntryId] = useState(null);

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

  // ── Add entry ───────────────────────────────────────────────────────────────
  const handleAddEntry = async () => {
    setEntryLoading(true);
    try {
      await createWorkEntry(staffId, {
        entryDate: newEntry.entryDate,
        customer:  newEntry.customer,
        orderNo:   newEntry.orderNo,
        item:      newEntry.item,
        subitem:   newEntry.subitem,
        quantity:  parseInt(newEntry.quantity) || 1,
        rate:      parseFloat(newEntry.rate) || 0,
        amount:    parseFloat(newEntry.amount) || 0,
      });
      toast.success('Entry added!');
      setAddingEntry(false);
      setNewEntry({ ...ENTRY_EMPTY, entryDate: today() });
      loadEntries();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add entry.');
    } finally {
      setEntryLoading(false);
    }
  };

  // ── Edit entry ──────────────────────────────────────────────────────────────
  const handleEditEntry = async () => {
    setEntryLoading(true);
    try {
      await updateWorkEntry(staffId, editingId, {
        entryDate: editForm.entryDate,
        customer:  editForm.customer,
        orderNo:   editForm.orderNo,
        item:      editForm.item,
        subitem:   editForm.subitem,
        quantity:  parseInt(editForm.quantity) || 1,
        rate:      parseFloat(editForm.rate) || 0,
        amount:    parseFloat(editForm.amount) || 0,
      });
      toast.success('Entry updated!');
      setEditingId(null);
      loadEntries();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update entry.');
    } finally {
      setEntryLoading(false);
    }
  };

  // ── Delete entry ────────────────────────────────────────────────────────────
  const handleDeleteEntry = async () => {
    try {
      await deleteWorkEntry(staffId, deleteEntryId);
      toast.success('Entry removed.');
      setDeleteEntryId(null);
      loadEntries();
    } catch {
      toast.error('Failed to delete entry.');
    }
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

  const thCls = 'px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-gray-500 bg-gray-50/80';

  return (
    <div className="space-y-6 animate-fade-in pb-16">

      {/* ── Employee Header ───────────────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            {/* Back */}
            <button
              onClick={() => navigate('/tailors-payment')}
              className="btn-icon text-gray-500 hover:bg-gray-100"
              title="Back to Tailors Payment"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {/* Avatar */}
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-sm flex-shrink-0">
              {staff.name[0].toUpperCase()}
            </div>

            {/* Info */}
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
              onClick={() => { setNewEntry({ ...ENTRY_EMPTY, entryDate: today(), rate: staff.ratePerPiece || '' }); setAddingEntry(true); setEditingId(null); }}
              className="btn bg-purple-600 hover:bg-purple-700 text-white text-xs flex items-center gap-1.5 px-3 py-2"
            >
              <Plus className="w-3.5 h-3.5" /> Add Entry
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className={thCls + ' w-10'}>S.No</th>
                  <th className={thCls}>Date</th>
                  <th className={thCls}>Customer</th>
                  <th className={thCls}>Order No</th>
                  <th className={thCls}>Item</th>
                  <th className={thCls}>Sub-item</th>
                  <th className={thCls + ' text-right'}>Qty</th>
                  <th className={thCls + ' text-right'}>Rate</th>
                  <th className={thCls + ' text-right'}>Amount</th>
                  <th className={thCls + ' w-20 text-center'}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {/* Inline Add Row */}
                {addingEntry && (
                  <EntryForm
                    value={newEntry}
                    onChange={setNewEntry}
                    onSave={handleAddEntry}
                    onCancel={() => setAddingEntry(false)}
                    loading={entryLoading}
                    defaultRate={staff.ratePerPiece || 0}
                  />
                )}

                {loading ? (
                  <tr>
                    <td colSpan={10} className="text-center py-10 text-gray-400">
                      <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      Loading entries…
                    </td>
                  </tr>
                ) : entries.length === 0 && !addingEntry ? (
                  <tr>
                    <td colSpan={10} className="text-center py-10 text-gray-400 text-sm">
                      No entries yet. Click <strong>"+ Add Entry"</strong> to start.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry, idx) => (
                    editingId === entry.id ? (
                      <EntryForm
                        key={entry.id}
                        value={editForm}
                        onChange={setEditForm}
                        onSave={handleEditEntry}
                        onCancel={() => setEditingId(null)}
                        loading={entryLoading}
                        defaultRate={staff.ratePerPiece || 0}
                      />
                    ) : (
                      <tr key={entry.id} className="hover:bg-purple-50/20 transition-colors">
                        <td className="px-3 py-2.5 text-xs text-gray-400 font-mono">{idx + 1}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-700 font-medium whitespace-nowrap">
                          {entry.entryDate ? new Date(entry.entryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-800 font-semibold">{entry.customer || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2.5 text-xs font-mono text-purple-700">{entry.orderNo || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-800">{entry.item || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-600">{entry.subitem || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2.5 text-xs text-right text-gray-700">{entry.quantity}</td>
                        <td className="px-3 py-2.5 text-xs text-right text-gray-600 font-mono">₹{fmt(entry.rate)}</td>
                        <td className="px-3 py-2.5 text-xs text-right font-bold text-gray-900 font-mono">₹{fmt(entry.amount)}</td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => { setEditingId(entry.id); setEditForm({ entryDate: entry.entryDate?.slice(0,10) || today(), customer: entry.customer, orderNo: entry.orderNo, item: entry.item, subitem: entry.subitem, quantity: entry.quantity, rate: entry.rate, amount: entry.amount }); setAddingEntry(false); }}
                              className="btn-icon text-blue-500 hover:bg-blue-50"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteEntryId(entry.id)}
                              className="btn-icon text-rose-500 hover:bg-rose-50"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  ))
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

      {/* Delete Entry Confirm */}
      {deleteEntryId && (
        <ConfirmModal
          title="Delete Work Entry?"
          message="This will remove this entry and reduce the total earned. This cannot be undone."
          onConfirm={handleDeleteEntry}
          onCancel={() => setDeleteEntryId(null)}
        />
      )}
    </div>
  );
}
