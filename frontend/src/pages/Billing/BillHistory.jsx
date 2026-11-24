import { useState, useEffect, useCallback } from 'react';
import {
  History, Search, Filter, Calendar, User, FileText,
  RefreshCw, TrendingUp, CheckCircle2, Edit2, Trash2,
  Eye, ArrowLeft, IndianRupee, Layers, ExternalLink, Printer,
  ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';
import { getBillHistory, getBillingRecordByBillNo } from '../../api/billingRecords';
import { formatINR } from './billUtils';
import Pagination from '../../components/UI/Pagination';
import Modal from '../../components/UI/Modal';
import BillDesignerModal from './BillDesignerModal';
import toast from 'react-hot-toast';

function StatCard({ icon: Icon, label, value, subtext, color = 'brand' }) {
  const styles = {
    brand: 'bg-white border-purple-100 shadow-sm text-purple-700',
    green: 'bg-white border-emerald-100 shadow-sm text-emerald-700',
    amber: 'bg-white border-amber-100 shadow-sm text-amber-700',
    rose:  'bg-white border-rose-100 shadow-sm text-rose-700',
  }[color];

  return (
    <div className={`card p-4 border rounded-2xl flex items-center gap-4 ${styles}`}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold flex-shrink-0 bg-current/10">
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</div>
        <div className="text-xl sm:text-2xl font-black text-gray-900 truncate mt-0.5">{value}</div>
        {subtext && <div className="text-[11px] text-gray-400 truncate mt-0.5">{subtext}</div>}
      </div>
    </div>
  );
}

function getActionBadge(action) {
  const act = String(action).toUpperCase();
  if (act === 'CREATED') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Created
      </span>
    );
  }
  if (act === 'EDITED') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
        <Edit2 className="w-3 h-3 text-blue-600" /> Edited
      </span>
    );
  }
  if (act === 'DELETED') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
        <Trash2 className="w-3 h-3 text-rose-600" /> Deleted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">
      {action}
    </span>
  );
}

export default function BillHistory() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modals
  const [viewChangesLog, setViewChangesLog] = useState(null);
  const [activeBillModal, setActiveBillModal] = useState(null);
  const [fetchingBill, setFetchingBill] = useState(false);

  const LIMIT = 20;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBillHistory({
        search,
        action,
        dateFrom,
        dateTo,
        page,
        limit: LIMIT,
      });
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
      setStats(res.data.stats || {});
    } catch (err) {
      toast.error('Failed to load bill history');
    } finally {
      setLoading(false);
    }
  }, [search, action, dateFrom, dateTo, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Bill Designer directly from a history entry
  const handleOpenBill = async (billNo, isEdit = true) => {
    setFetchingBill(true);
    try {
      const res = await getBillingRecordByBillNo(billNo);
      if (res.data) {
        setActiveBillModal({ record: res.data, isEdit });
      } else {
        toast.error('Bill details not found');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Bill might have been deleted');
    } finally {
      setFetchingBill(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setAction('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasFilters = Boolean(search || action || dateFrom || dateTo);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 shadow-sm">
              <History className="w-6 h-6" />
            </div>
            Bill History & Audit Log
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Complete audit trail of all bill creations, updates, and who edited each bill
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="btn-secondary btn-sm flex items-center gap-1.5"
            title="Refresh history"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={History}
          label="Total Log Entries"
          value={stats.totalLogs || total || 0}
          subtext="Creation & edit events"
          color="brand"
        />
        <StatCard
          icon={CheckCircle2}
          label="Bills Created"
          value={stats.totalCreated || 0}
          subtext="Initial bill issues"
          color="green"
        />
        <StatCard
          icon={Edit2}
          label="Bills Edited"
          value={stats.totalEdited || 0}
          subtext="Modifications logged"
          color="amber"
        />
        <StatCard
          icon={Trash2}
          label="Bills Deleted"
          value={stats.totalDeleted || 0}
          subtext="Removed records"
          color="rose"
        />
      </div>

      {/* Filter Bar */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Bill No, customer, editor name, or action…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input pl-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 font-medium">Action:</span>
              <select
                value={action}
                onChange={(e) => { setAction(e.target.value); setPage(1); }}
                className="select py-1.5 text-xs w-auto min-w-[130px]"
              >
                <option value="">All Actions</option>
                <option value="CREATED">Created</option>
                <option value="EDITED">Edited</option>
                <option value="DELETED">Deleted</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 font-medium">From:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="input py-1 px-2 text-xs border rounded-lg w-auto"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 font-medium">To:</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="input py-1 px-2 text-xs border rounded-lg w-auto"
              />
            </div>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1 rounded hover:bg-rose-50 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Bill No</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Performed By</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Total / Advance</th>
                <th className="py-3 px-4">Summary of Changes</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs">Loading bill history…</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-gray-400">
                    <History className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="font-semibold text-gray-600">No history records found</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {hasFilters ? 'Try adjusting your filters.' : 'Bill creations and edits will appear here automatically.'}
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-purple-50/20 transition-colors">
                    {/* Timestamp */}
                    <td className="py-3.5 px-4 text-xs text-gray-600 whitespace-nowrap">
                      <div className="font-medium text-gray-800">
                        {log.createdAt ? new Date(log.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric'
                        }) : ''}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                        {log.createdAt ? new Date(log.createdAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit', minute: '2-digit', second: '2-digit'
                        }) : ''}
                      </div>
                    </td>

                    {/* Bill No */}
                    <td className="py-3.5 px-4 font-mono font-bold text-xs text-purple-700 whitespace-nowrap">
                      {log.billNo}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>

                    {/* Performed By */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        <User className="w-3.5 h-3.5 text-slate-600" />
                        {log.performedBy || 'Admin'}
                      </span>
                    </td>

                    {/* Customer */}
                    <td className="py-3.5 px-4 text-xs text-gray-700 truncate max-w-[150px]">
                      {log.customerName || 'Walk-in Customer'}
                    </td>

                    {/* Amount & Advance */}
                    <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                      <div className="font-mono font-bold text-gray-900">
                        ₹ {formatINR(log.grandTotal)}
                      </div>
                      {Number(log.advanceAmount) > 0 && (
                        <div className="text-[10px] text-emerald-700 font-semibold font-mono">
                          Adv: ₹{formatINR(log.advanceAmount)}
                        </div>
                      )}
                    </td>

                    {/* Summary */}
                    <td className="py-3.5 px-4 text-xs text-gray-600 max-w-[280px]">
                      <div className="truncate font-medium text-gray-800" title={log.summary}>
                        {log.summary || '—'}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {log.action !== 'DELETED' && (
                          <button
                            onClick={() => handleOpenBill(log.billNo, false)}
                            disabled={fetchingBill}
                            className="btn-icon text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                            title="View / Print Bill"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        )}

                        {log.action !== 'DELETED' && (
                          <button
                            onClick={() => handleOpenBill(log.billNo, true)}
                            disabled={fetchingBill}
                            className="btn-icon text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            title="Edit this Bill"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}

                        {log.previousData && (
                          <button
                            onClick={() => setViewChangesLog(log)}
                            className="btn-icon text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            title="Compare Changes (Before vs After)"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > LIMIT && (
          <div className="px-5 py-4 border-t border-gray-100">
            <Pagination
              page={page}
              total={total}
              limit={LIMIT}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Changes Comparison Modal */}
      {viewChangesLog && (
        <Modal
          title={`Audit Changes — Bill ${viewChangesLog.billNo}`}
          onClose={() => setViewChangesLog(null)}
          size="max-w-2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-purple-900">Edited By: </span>
                <span className="font-semibold text-purple-700">{viewChangesLog.performedBy}</span>
              </div>
              <div className="text-gray-500 font-mono">
                {viewChangesLog.createdAt}
              </div>
            </div>

            <div className="text-xs text-gray-700 font-medium">
              <span className="font-bold">Summary: </span>
              {viewChangesLog.summary}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-200">
                <div className="font-bold text-rose-800 uppercase tracking-wider mb-2">Previous State</div>
                <pre className="text-[11px] font-mono text-gray-800 bg-white p-2 rounded border border-rose-100 overflow-x-auto max-h-60">
                  {JSON.stringify(viewChangesLog.previousData, null, 2)}
                </pre>
              </div>

              <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200">
                <div className="font-bold text-emerald-800 uppercase tracking-wider mb-2">New State</div>
                <pre className="text-[11px] font-mono text-gray-800 bg-white p-2 rounded border border-emerald-100 overflow-x-auto max-h-60">
                  {JSON.stringify(viewChangesLog.newData, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Bill Designer / Editor Modal */}
      {activeBillModal && (
        <BillDesignerModal
          editRecord={activeBillModal.record}
          onClose={() => setActiveBillModal(null)}
          onBillSaved={() => {
            setActiveBillModal(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
