import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  FileText, Search, Filter, Calendar, IndianRupee, Trash2,
  RefreshCw, TrendingUp, BarChart2, Tag, ChevronDown, ChevronUp,
  ExternalLink, ArrowLeft, CheckCircle2, Wallet, Phone, Smartphone, CreditCard
} from 'lucide-react';
import { getBillingRecords, deleteBillingRecord } from '../../api/billingRecords';
import { formatINR } from './billUtils';
import Pagination from '../../components/UI/Pagination';
import ConfirmModal from '../../components/UI/ConfirmModal';
import toast from 'react-hot-toast';

// Fixed Payment Methods as requested: UPI, Scanner, phone number, Cash
const PAYMENT_METHODS = [
  { key: 'UPI',          label: 'UPI',          color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'Scanner',      label: 'Scanner',      color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { key: 'phone number', label: 'phone number', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { key: 'Cash',         label: 'Cash',         color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
];

function getPaymentBadgeClass(mode = '') {
  const m = String(mode).toLowerCase().trim();
  if (m === 'cash') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (m === 'upi') return 'bg-blue-100 text-blue-800 border-blue-200';
  if (m === 'scanner') return 'bg-purple-100 text-purple-800 border-purple-200';
  if (m.includes('phone') || m.includes('number')) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

function StatCard({ icon: Icon, label, value, subtext, color = 'brand' }) {
  const styles = {
    brand:  'bg-white border-purple-100 shadow-sm text-purple-700',
    green:  'bg-white border-emerald-100 shadow-sm text-emerald-700',
    amber:  'bg-white border-amber-100 shadow-sm text-amber-700',
    blue:   'bg-white border-blue-100 shadow-sm text-blue-700',
  }[color];

  return (
    <div className={`card p-4 border rounded-2xl flex items-center gap-4 ${styles}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold flex-shrink-0 bg-current/10`}>
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

export default function PaymentRecords() {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const LIMIT = 15;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBillingRecords({
        search,
        paymentMode,
        dateFrom,
        dateTo,
        page,
        limit: LIMIT,
      });
      setRecords(res.data.records || []);
      setTotal(res.data.total || 0);
      setStats(res.data.stats || {});
    } catch (err) {
      toast.error('Failed to load payment records');
    } finally {
      setLoading(false);
    }
  }, [search, paymentMode, dateFrom, dateTo, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Quick preset date filters
  const applyDatePreset = (preset) => {
    const today = new Date();
    const toIso = (d) => d.toISOString().slice(0, 10);

    if (preset === 'today') {
      const t = toIso(today);
      setDateFrom(t);
      setDateTo(t);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const s = toIso(y);
      setDateFrom(s);
      setDateTo(s);
    } else if (preset === 'week') {
      const w = new Date();
      w.setDate(w.getDate() - 7);
      setDateFrom(toIso(w));
      setDateTo(toIso(today));
    } else if (preset === 'month') {
      const m = new Date();
      m.setDate(1);
      setDateFrom(toIso(m));
      setDateTo(toIso(today));
    } else {
      setDateFrom('');
      setDateTo('');
    }
    setPage(1);
  };

  const clearAllFilters = () => {
    setSearch('');
    setPaymentMode('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasActiveFilters = Boolean(search || paymentMode || dateFrom || dateTo);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteBillingRecord(deleteId);
      toast.success('Payment record deleted');
      setDeleteId(null);
      loadData();
    } catch {
      toast.error('Failed to delete payment record');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">Payment Records</h1>
              <p className="text-sm text-gray-500">
                Every bill is automatically recorded here. Filter by payment method, date, or customer.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadData}
            className="btn btn-secondary flex items-center gap-2"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-600' : ''}`} />
            Refresh
          </button>
          <Link
            to="/billing"
            className="btn bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 shadow-sm"
          >
            <Wallet className="w-4 h-4" /> Go to Billing System
          </Link>
        </div>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={BarChart2}
          label="Total Bills"
          value={total.toLocaleString('en-IN')}
          subtext="Saved transaction receipts"
          color="brand"
        />
        <StatCard
          icon={IndianRupee}
          label="Total Revenue"
          value={`₹ ${formatINR(stats.totalRevenue || 0)}`}
          subtext="Gross collections"
          color="green"
        />
        <StatCard
          icon={Tag}
          label="Total Discounts"
          value={`₹ ${formatINR(stats.totalDiscount || 0)}`}
          subtext="Discount deductions"
          color="amber"
        />
        <StatCard
          icon={TrendingUp}
          label="Average Bill"
          value={total > 0 ? `₹ ${formatINR((stats.totalRevenue || 0) / total)}` : '₹ 0.00'}
          subtext="Per receipt average"
          color="blue"
        />
      </div>

      {/* Filters Toolbar */}
      <div className="card p-5 space-y-4">
        {/* Top search & quick dates */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by Bill No, Customer Name, or Phone..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input pl-9 text-sm w-full"
            />
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Period:</span>
            {[
              { id: 'all',       label: 'All Time' },
              { id: 'today',     label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week',      label: 'Last 7 Days' },
              { id: 'month',     label: 'This Month' },
            ].map((p) => {
              const isSelected =
                (p.id === 'all' && !dateFrom && !dateTo) ||
                (p.id === 'today' && dateFrom === new Date().toISOString().slice(0, 10) && dateTo === dateFrom);
              return (
                <button
                  key={p.id}
                  onClick={() => applyDatePreset(p.id)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                    isSelected
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Payment Methods & Date Range Pickers */}
        <div className="pt-3 border-t border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Payment Method Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Method:</span>
            <button
              onClick={() => { setPaymentMode(''); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                !paymentMode
                  ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
              }`}
            >
              All Methods
            </button>
            {PAYMENT_METHODS.map((m) => {
              const active = paymentMode.toLowerCase() === m.key.toLowerCase();
              return (
                <button
                  key={m.key}
                  onClick={() => {
                    setPaymentMode(active ? '' : m.key);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    active
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* Date range pickers */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400 font-medium">From:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="input py-1 px-2 text-xs border rounded-lg"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400 font-medium">To:</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="input py-1 px-2 text-xs border rounded-lg"
              />
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1 rounded hover:bg-rose-50 transition-colors ml-2"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Payment Records Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="py-3 px-4">Bill No</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4 text-right">Amount (₹)</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-400">
                    <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading payment records…
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-16 text-center text-gray-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-40 text-purple-600" />
                    <p className="font-semibold text-gray-700">No payment records found</p>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                      {hasActiveFilters
                        ? 'Try clearing some filters to see matching records.'
                        : 'Bills printed in the Billing System will automatically appear here as payment records.'}
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={clearAllFilters}
                        className="mt-3 btn btn-secondary text-xs"
                      >
                        Clear All Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const isExpanded = expandedId === r.id;
                  const itemsList = Array.isArray(r.items) ? r.items : [];
                  const itemsSummary = itemsList.map((it) => it.name).filter(Boolean).join(', ');

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-purple-50/30 transition-colors group"
                    >
                      {/* Bill No */}
                      <td className="py-3.5 px-4 font-mono font-bold text-gray-900">
                        <Link
                          to={`/bill/view/${encodeURIComponent(r.billNo)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-purple-700 hover:text-purple-900 hover:underline"
                        >
                          <FileText className="w-4 h-4 text-purple-500" />
                          <span>{r.billNo}</span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-xs text-gray-600 whitespace-nowrap">
                        <div className="font-medium">
                          {r.billDate ? new Date(r.billDate).toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric'
                          }) : '—'}
                        </div>
                        {r.createdAt && (
                          <div className="text-[10px] text-gray-400">
                            {new Date(r.createdAt).toLocaleTimeString('en-IN', {
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </div>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-semibold text-gray-900 truncate max-w-[180px]">
                          {r.customerName || 'Walk-in Customer'}
                        </div>
                        {r.customerPhone && (
                          <div className="text-[11px] text-gray-400 font-mono flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" />
                            {r.customerPhone}
                          </div>
                        )}
                      </td>

                      {/* Payment Method Badge */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${getPaymentBadgeClass(r.paymentMode)}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {r.paymentMode || 'Cash'}
                        </span>
                      </td>

                      {/* Items */}
                      <td className="py-3.5 px-4 text-xs">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : r.id)}
                          className="inline-flex items-center gap-1.5 font-medium text-gray-700 hover:text-purple-700"
                        >
                          <span className="font-bold text-purple-700">{itemsList.length}</span> items
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                        </button>
                        <div className="text-[11px] text-gray-400 truncate max-w-[200px]">
                          {itemsSummary || '—'}
                        </div>

                        {/* Expanded items preview */}
                        {isExpanded && (
                          <div className="mt-2 p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-1">
                            {itemsList.map((it, idx) => (
                              <div key={idx} className="flex justify-between text-gray-700">
                                <span>{it.name} × {it.quantity}</span>
                                <span className="font-mono font-semibold">₹ {formatINR((it.price || 0) * (it.quantity || 1))}</span>
                              </div>
                            ))}
                            {r.discountAmount > 0 && (
                              <div className="flex justify-between text-emerald-700 pt-1 border-t border-gray-200 font-medium">
                                <span>Discount:</span>
                                <span>- ₹ {formatINR(r.discountAmount)}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-mono font-black text-gray-900 text-base">
                          ₹ {formatINR(r.grandTotal)}
                        </div>
                        {r.discountAmount > 0 && (
                          <div className="text-[10px] text-emerald-600 font-medium">
                            Saved ₹ {formatINR(r.discountAmount)}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            to={`/bill/view/${encodeURIComponent(r.billNo)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-icon text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                            title="View / Print Receipt"
                          >
                            <Receipt className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => setDeleteId(r.id)}
                            className="btn-icon text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                            title="Delete Record"
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

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <ConfirmModal
          title="Delete Payment Record?"
          message="Are you sure you want to delete this payment record? This will permanently remove the logged transaction."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

