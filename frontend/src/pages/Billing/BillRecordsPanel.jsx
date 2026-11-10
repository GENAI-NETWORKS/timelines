import { useState, useEffect, useCallback } from 'react';
import {
  X, Search, Filter, IndianRupee, Receipt, Calendar, CreditCard,
  Trash2, ChevronDown, ChevronUp, RefreshCw, TrendingUp, Users,
  Tag, BarChart2
} from 'lucide-react';
import { getBillingRecords, deleteBillingRecord } from '../../api/billingRecords';
import { formatINR } from './billUtils';
import toast from 'react-hot-toast';

const PAYMENT_MODES = ['Cash', 'UPI', 'Scanner', 'Phone Number'];

function StatCard({ icon: Icon, label, value, color = 'brand' }) {
  const colors = {
    brand:  'bg-purple-50  text-purple-700  border-purple-200',
    green:  'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber:  'bg-amber-50   text-amber-700   border-amber-200',
    blue:   'bg-blue-50    text-blue-700    border-blue-200',
  };
  return (
    <div className={`flex items-center gap-2.5 rounded-xl border p-3 ${colors[color]}`}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70 truncate">{label}</div>
        <div className="text-sm font-bold truncate">{value}</div>
      </div>
    </div>
  );
}

function RecordRow({ record, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  const modeColor = {
    'Cash':         'bg-emerald-100 text-emerald-700',
    'UPI':          'bg-blue-100    text-blue-700',
    'Scanner':      'bg-purple-100  text-purple-700',
    'Phone Number': 'bg-amber-100   text-amber-700',
  }[record.paymentMode] || 'bg-gray-100 text-gray-600';

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden hover:border-purple-200 transition-colors">
      {/* Summary Row */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50 select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-bold text-gray-800 truncate">{record.billNo}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${modeColor}`}>
              {record.paymentMode}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-gray-500">
              {record.billDate ? new Date(record.billDate).toLocaleDateString('en-IN') : '—'}
            </span>
            {record.customerName && record.customerName !== 'Walk-in Customer' && (
              <span className="text-[10px] text-gray-500 truncate">· {record.customerName}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm font-black text-gray-900">₹{formatINR(record.grandTotal)}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(record.id); }}
            className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
            title="Delete record"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
        </div>
      </div>

      {/* Expanded Items */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-3 py-2 space-y-1">
          {(record.items || []).map((item, i) => (
            <div key={i} className="flex justify-between text-xs text-gray-700">
              <span className="truncate pr-2">{item.name} × {item.quantity}</span>
              <span className="font-semibold flex-shrink-0">₹{formatINR(item.price * item.quantity)}</span>
            </div>
          ))}
          <div className="border-t border-gray-200 mt-1 pt-1 flex justify-between text-xs">
            {record.discountAmount > 0 && (
              <span className="text-emerald-600">Discount: -₹{formatINR(record.discountAmount)}</span>
            )}
            {record.taxRate > 0 && (
              <span className="text-gray-500">Tax: {record.taxRate}%</span>
            )}
            <span className="ml-auto font-bold text-gray-900">Net: ₹{formatINR(record.grandTotal)}</span>
          </div>
          {record.customerPhone && (
            <div className="text-[10px] text-gray-400">📞 {record.customerPhone}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BillRecordsPanel({ open, onClose }) {
  const [records, setRecords]       = useState([]);
  const [stats, setStats]           = useState({});
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(false);
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(false);

  // Filters
  const [search, setSearch]         = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const LIMIT = 20;

  const fetchRecords = useCallback(async (reset = true) => {
    setLoading(true);
    try {
      const pg = reset ? 1 : page;
      const res = await getBillingRecords({
        search, paymentMode, dateFrom, dateTo,
        page: pg, limit: LIMIT,
      });
      const { records: rows, total: tot, stats: s } = res.data;
      if (reset) {
        setRecords(rows);
        setPage(1);
      } else {
        setRecords(prev => [...prev, ...rows]);
      }
      setTotal(tot);
      setStats(s || {});
      setHasMore(rows.length === LIMIT && (reset ? LIMIT : (page * LIMIT)) < tot);
    } catch (err) {
      toast.error('Failed to load payment records');
    } finally {
      setLoading(false);
    }
  }, [search, paymentMode, dateFrom, dateTo, page]);

  useEffect(() => {
    if (open) fetchRecords(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, search, paymentMode, dateFrom, dateTo]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this bill record?')) return;
    try {
      await deleteBillingRecord(id);
      setRecords(prev => prev.filter(r => r.id !== id));
      setTotal(t => t - 1);
      toast.success('Record deleted');
    } catch {
      toast.error('Delete failed');
    }
  };

  const loadMore = async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    setLoading(true);
    try {
      const res = await getBillingRecords({
        search, paymentMode, dateFrom, dateTo,
        page: nextPage, limit: LIMIT,
      });
      const { records: rows } = res.data;
      setRecords(prev => [...prev, ...rows]);
      setHasMore(rows.length === LIMIT);
    } catch {
      toast.error('Failed to load more');
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearch(''); setPaymentMode(''); setDateFrom(''); setDateTo('');
  };

  const hasActiveFilters = search || paymentMode || dateFrom || dateTo;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-[400]"
        onClick={onClose}
      />

      {/* Slide-in Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white z-[401] shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-purple-700 text-white">
          <div className="flex items-center gap-2.5">
            <Receipt className="w-5 h-5" />
            <div>
              <h2 className="font-bold text-base leading-tight">Payment Records</h2>
              <p className="text-xs text-purple-200 leading-tight">Auto-saved on every bill print</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchRecords(true)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
          <StatCard
            icon={BarChart2}
            label="Total Bills"
            value={total.toLocaleString('en-IN')}
            color="brand"
          />
          <StatCard
            icon={IndianRupee}
            label="Total Revenue"
            value={`₹${formatINR(stats.totalRevenue || 0)}`}
            color="green"
          />
          <StatCard
            icon={Tag}
            label="Total Discounts"
            value={`₹${formatINR(stats.totalDiscount || 0)}`}
            color="amber"
          />
          <StatCard
            icon={TrendingUp}
            label="Avg Bill Value"
            value={total > 0 ? `₹${formatINR((stats.totalRevenue || 0) / total)}` : '—'}
            color="blue"
          />
        </div>

        {/* Search & Filter Bar */}
        <div className="px-4 pt-3 pb-2 space-y-2">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search bill no, customer…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
            <button
              onClick={() => setShowFilters(f => !f)}
              className={`px-3 py-2 rounded-lg border text-sm font-medium flex items-center gap-1.5 transition-colors ${
                showFilters || hasActiveFilters
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
              {hasActiveFilters && (
                <span className="bg-white/30 text-white text-[10px] font-bold px-1 rounded">
                  {[search, paymentMode, dateFrom, dateTo].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 space-y-2.5">
              {/* Payment Mode */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Payment Mode</label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setPaymentMode('')}
                    className={`px-2 py-1 text-xs rounded-full border font-medium transition-colors ${
                      !paymentMode ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200'
                    }`}
                  >
                    All
                  </button>
                  {PAYMENT_MODES.map(m => (
                    <button
                      key={m}
                      onClick={() => setPaymentMode(p => p === m ? '' : m)}
                      className={`px-2 py-1 text-xs rounded-full border font-medium transition-colors ${
                        paymentMode === m ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">From Date</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">To Date</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Clear all filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Records List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {loading && records.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center space-y-2">
              <Receipt className="w-10 h-10 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">No payment records yet</p>
              <p className="text-xs text-gray-400">Bills will appear here automatically when you print them</p>
            </div>
          ) : (
            <>
              <div className="text-xs text-gray-400 font-medium pb-1">
                Showing {records.length} of {total} records
              </div>
              {records.map(record => (
                <RecordRow key={record.id} record={record} onDelete={handleDelete} />
              ))}
              {hasMore && (
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="w-full py-2 text-sm text-purple-600 font-semibold hover:bg-purple-50 rounded-xl border border-purple-200 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Loading…' : 'Load more'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

