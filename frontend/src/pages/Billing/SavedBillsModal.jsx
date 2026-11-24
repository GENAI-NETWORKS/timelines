import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Search, RefreshCw, Printer, Edit2, Trash2, FileText,
  IndianRupee, Calendar, User, Phone, CheckCircle2, AlertTriangle, Eye, ShieldAlert
} from 'lucide-react';
import { getBillingRecords, deleteBillingRecord } from '../../api/billingRecords';
import { getAssignableUsers } from '../../api/panelUsers';
import { formatINR } from './billUtils';
import BillDesignerModal from './BillDesignerModal';
import Pagination from '../../components/UI/Pagination';
import toast from 'react-hot-toast';

export default function SavedBillsModal({ isOpen, onClose }) {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 10;

  // Edit Bill State
  const [editingRecord, setEditingRecord] = useState(null);

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletedBy, setDeletedBy] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Panel users list for actor selection
  const [panelUsers, setPanelUsers] = useState([]);

  // Fetch panel users for delete authorization
  useEffect(() => {
    if (isOpen) {
      getAssignableUsers()
        .then(res => setPanelUsers(res.data || []))
        .catch(() => {});
    }
  }, [isOpen]);

  const loadBills = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const res = await getBillingRecords({
        search,
        page,
        limit: LIMIT,
      });
      setRecords(res.data.records || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      toast.error('Failed to load saved bills');
    } finally {
      setLoading(false);
    }
  }, [isOpen, search, page]);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  // Handle Delete Confirmation
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    if (!deletedBy || !deletedBy.trim()) {
      toast.error('Please select who is deleting this bill (Mandatory)');
      return;
    }

    setIsDeleting(true);
    try {
      await deleteBillingRecord(deleteTarget.id, deletedBy.trim());
      toast.success(`Bill ${deleteTarget.billNo} deleted & recorded in Bill History`);
      setDeleteTarget(null);
      setDeletedBy('');
      loadBills();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete bill');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col border border-purple-100 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-700 via-purple-800 to-indigo-800 text-white flex items-center justify-between flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
              <FileText className="w-5 h-5 text-purple-200" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Saved Bills Manager</h2>
              <p className="text-xs text-purple-200">
                View, edit, or delete existing bills. All modifications are logged to Bill History.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="input pl-9 text-xs w-full bg-white shadow-sm"
              placeholder="Search by Bill No, customer name or phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadBills}
              disabled={loading}
              className="btn btn-secondary text-xs flex items-center gap-1.5 py-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <div className="text-xs font-semibold text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-xl shadow-sm">
              Total Bills: <span className="text-purple-700 font-bold">{total}</span>
            </div>
          </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-20 text-center">
              <div className="w-9 h-9 border-3 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-gray-500 font-medium">Loading saved bills...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="py-20 text-center px-4">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-gray-700">No Bills Found</h3>
              <p className="text-xs text-gray-400 max-w-xs mx-auto mt-1">
                {search ? 'No bills match your search criteria.' : 'No bills have been created yet.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Bill No & Date</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Items</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4 text-right">Amount (₹)</th>
                    <th className="py-3 px-4">Created / Edited By</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {records.map((bill) => {
                    const items = Array.isArray(bill.items) ? bill.items : [];
                    const itemsSummary = items.map(i => `${i.name || 'Item'} (x${i.quantity || 1})`).join(', ');

                    return (
                      <tr key={bill.id} className="hover:bg-purple-50/40 transition-colors">
                        {/* Bill No & Date */}
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-purple-900 text-sm">
                            {bill.billNo}
                          </div>
                          <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            {bill.billDate ? String(bill.billDate).slice(0, 10) : ''}
                          </div>
                        </td>

                        {/* Customer */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span>{bill.customerName || 'Walk-in Customer'}</span>
                          </div>
                          {bill.customerPhone && (
                            <div className="text-[11px] text-gray-500 font-mono flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-gray-400" />
                              {bill.customerPhone}
                            </div>
                          )}
                        </td>

                        {/* Items */}
                        <td className="py-3.5 px-4 max-w-[200px]">
                          <div className="font-semibold text-gray-800">
                            {items.length} item{items.length !== 1 ? 's' : ''}
                          </div>
                          <div className="text-[11px] text-gray-400 truncate" title={itemsSummary}>
                            {itemsSummary || '—'}
                          </div>
                        </td>

                        {/* Payment Mode */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-800 border border-gray-200">
                            {bill.paymentMode || 'Cash'}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="font-mono font-bold text-gray-900 text-sm">
                            ₹ {formatINR(bill.grandTotal)}
                          </div>
                          {Number(bill.advanceAmount) > 0 && (
                            <div className="text-[11px] text-emerald-700 font-medium">
                              Adv: -₹{formatINR(bill.advanceAmount)}
                            </div>
                          )}
                          {Number(bill.advanceAmount) > 0 && (
                            <div className="text-[11px] text-blue-900 font-bold font-mono">
                              Due: ₹{formatINR(bill.balanceAmount !== undefined ? bill.balanceAmount : Math.max(0, bill.grandTotal - bill.advanceAmount))}
                            </div>
                          )}
                        </td>

                        {/* Created / Edited By */}
                        <td className="py-3.5 px-4">
                          <div className="text-xs">
                            <span className="text-gray-400">By:</span>{' '}
                            <span className="font-semibold text-purple-900">{bill.createdBy || bill.cashier || 'Admin'}</span>
                          </div>
                          {bill.lastEditedBy && bill.lastEditedBy !== bill.createdBy && (
                            <div className="text-[11px] text-amber-700 mt-0.5">
                              Edit by: <span className="font-semibold">{bill.lastEditedBy}</span>
                              {bill.editCount > 0 && (
                                <span className="ml-1 text-[10px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-bold">
                                  #{bill.editCount}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <a
                              href={`/bill/view/${encodeURIComponent(bill.billNo)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-icon text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                              title="View & Print Digital Bill"
                            >
                              <Printer className="w-4 h-4" />
                            </a>

                            <button
                              onClick={() => setEditingRecord(bill)}
                              className="btn-icon text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                              title="Edit Bill Details"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => {
                                setDeleteTarget(bill);
                                setDeletedBy('');
                              }}
                              className="btn-icon text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                              title="Delete Bill (Mandatory Selector)"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer with Pagination */}
        {total > LIMIT && (
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between flex-shrink-0">
            <Pagination
              page={page}
              total={total}
              limit={LIMIT}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Edit Bill Modal */}
      {editingRecord && (
        <BillDesignerModal
          editRecord={editingRecord}
          onClose={() => setEditingRecord(null)}
          onBillSaved={() => {
            setEditingRecord(null);
            loadBills();
          }}
        />
      )}

      {/* Mandatory Actor Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-rose-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-gray-900 text-center">
              Delete Bill {deleteTarget.billNo}?
            </h3>
            <p className="text-xs text-gray-500 text-center mt-1">
              Customer: <strong className="text-gray-800">{deleteTarget.customerName}</strong> • Total: <strong className="text-gray-800">₹{formatINR(deleteTarget.grandTotal)}</strong>
            </p>
            <p className="text-xs text-rose-600 text-center font-medium mt-1">
              This action will be logged in Bill History. Selecting who is deleting is mandatory.
            </p>

            <div className="mt-5 bg-rose-50/50 p-4 rounded-2xl border border-rose-200">
              <label className="block text-xs font-bold text-gray-800 mb-1.5">
                Who is deleting this bill? <span className="text-rose-600">* (Mandatory)</span>
              </label>
              <select
                value={deletedBy}
                onChange={(e) => setDeletedBy(e.target.value)}
                className={`input text-xs w-full bg-white font-medium ${!deletedBy ? 'border-rose-400 ring-1 ring-rose-300' : 'border-purple-300'}`}
                required
              >
                <option value="">-- Select Person (Required) --</option>
                {panelUsers.map((u) => (
                  <option key={u.id} value={u.name}>
                    {u.name} ({u.role || 'Staff'})
                  </option>
                ))}
              </select>
              {!deletedBy && (
                <p className="text-[11px] text-rose-500 mt-1 font-semibold">
                  ⚠️ You must select your name before deleting.
                </p>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeletedBy('');
                }}
                disabled={isDeleting}
                className="btn btn-secondary text-xs px-4"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={!deletedBy || isDeleting}
                className="btn bg-rose-600 hover:bg-rose-700 text-white text-xs px-5 flex items-center gap-2 disabled:opacity-50 shadow-md"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" /> Confirm Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
