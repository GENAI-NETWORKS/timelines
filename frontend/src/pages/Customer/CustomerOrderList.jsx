import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Search, Edit2, Trash2, Loader, Printer, Eye, X,
  Check, ChevronDown, FileText
} from 'lucide-react';
import {
  getTailoringOrders, getTailoringOrder, deleteTailoringOrder,
  updateOrderStatus, updateOrderNumber, assignTailoringOrder
} from '../../api/tailoringOrders';
import { getAssignableUsers } from '../../api/panelUsers';
import TailorPrintout, { TailorPrintContent } from './components/TailorPrintout';
import ConfirmModal from '../../components/UI/ConfirmModal';
import Pagination from '../../components/UI/Pagination';
import StickyNotesModal from './components/StickyNotesModal';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

// ── Status Config & Normalizer ───────────────────────────────────────────────
const normalizeStatus = (s) => {
  if (!s) return 'Not yet started';
  const l = s.trim().toLowerCase();
  if (l === 'delivered') return 'Delivered';
  if (l === 'stitching completed' || l.includes('stitching')) return 'Stitching Completed';
  if (l === 'not yet checked' || (l.includes('checked') && !l.includes('uncheck'))) return 'Not yet Checked';
  if (l === 'on progress' || l.includes('progress') || l === 'submitted' || l === 'ready' || l === 'in progress') return 'On Progress';
  if (l === 'not yet started' || l.includes('not yet') || l === 'draft' || l === 'pending') return 'Not yet started';
  return s;
};

const STATUS_CONFIG = {
  'Not yet started': {
    label: 'Not yet started',
    badge: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
    dot:   'bg-amber-400',
  },
  'On Progress': {
    label: 'On Progress',
    badge: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
    dot:   'bg-blue-500 animate-pulse',
  },
  'Stitching Completed': {
    label: 'Stitching Completed',
    badge: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
    dot:   'bg-purple-500',
  },
  'Not yet Checked': {
    label: 'Not yet Checked',
    badge: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
    dot:   'bg-rose-400',
  },
  'Delivered': {
    label: 'Delivered',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
    dot:   'bg-emerald-500',
  },
};

// ── Interactive Status Toggle Dropdown ───────────────────────────────────────
function StatusToggle({ status, onSelect, disabled }) {
  const current = normalizeStatus(status);
  const config = STATUS_CONFIG[current] || STATUS_CONFIG['Not yet started'];

  return (
    <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
      <select
        value={current}
        disabled={disabled}
        onChange={(e) => onSelect(e.target.value)}
        className={`text-xs font-semibold rounded-full pl-6 pr-7 py-1.5 border cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-400 appearance-none transition-all shadow-xs ${config.badge}`}
        title="Click to change order status"
      >
        <option value="Not yet started" className="bg-white text-gray-800 py-1">Not yet started</option>
        <option value="On Progress" className="bg-white text-gray-800 py-1">On Progress</option>
        <option value="Stitching Completed" className="bg-white text-gray-800 py-1">Stitching Completed</option>
        <option value="Not yet Checked" className="bg-white text-gray-800 py-1">Not yet Checked</option>
        <option value="Delivered" className="bg-white text-gray-800 py-1">Delivered</option>
      </select>
      <span className={`w-2 h-2 rounded-full absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${config.dot}`} />
      <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60 text-current" />
    </div>
  );
}

// ── Editable Order Number Cell ───────────────────────────────────────────────
function OrderNumberCell({ orderNo, orderId, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(orderNo || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e?.stopPropagation();
    if (!val.trim()) return;
    setSaving(true);
    try {
      await onSave(orderId, val.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = (e) => {
    e?.stopPropagation();
    setVal(orderNo || '');
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        <input
          type="text"
          className="input font-mono text-xs px-2 py-1 h-7 w-32 border-purple-400 focus:ring-1 focus:ring-purple-400"
          value={val}
          onChange={e => setVal(e.target.value)}
          autoFocus
          onKeyDown={e => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
          title="Save"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleCancel}
          className="p-1 text-gray-400 hover:bg-gray-100 rounded"
          title="Cancel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const displayNo = orderNo || `ORD-${String(orderId).slice(-6).toUpperCase()}`;

  return (
    <div className="flex items-center gap-1.5 group/ord">
      <span className="font-mono font-bold text-purple-700 text-xs">
        {displayNo}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setVal(orderNo || displayNo);
          setEditing(true);
        }}
        className="opacity-70 hover:opacity-100 text-purple-600 hover:text-purple-800 p-0.5 rounded transition-opacity"
        title="Edit Order Number"
      >
        <Edit2 className="w-3 h-3" />
      </button>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function CustomerOrderList() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders,          setOrders]          = useState([]);
  const [total,           setTotal]           = useState(0);
  const [page,            setPage]            = useState(1);
  const [search,          setSearch]          = useState('');
  const [filterStatus,    setFilterStatus]    = useState(searchParams.get('status') || '');
  const [loading,         setLoading]         = useState(true);
  const [deleteId,        setDeleteId]        = useState(null);
  const [previewOrder,    setPreviewOrder]    = useState(null);
  const [printOrder,      setPrintOrder]      = useState(null);
  const [showStickyNotes, setShowStickyNotes] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState([]);

  useEffect(() => {
    getAssignableUsers()
      .then(res => setAssignableUsers(res.data || []))
      .catch(() => {});
  }, []);
  const LIMIT = 20;

  // Sync if URL query param changes
  useEffect(() => {
    const s = searchParams.get('status');
    if (s !== null) {
      setFilterStatus(s);
    }
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTailoringOrders({
        search,
        status: filterStatus || undefined,
        page,
        limit: LIMIT
      });
      setOrders(res.data.orders || []);
      setTotal(res.data.total || 0);
    } catch {
      toast.error('Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, page]);

  useEffect(() => { load(); }, [load]);

  // ── Update Status handler ───────────────────────────────────────────────────
  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      toast.success(`Order status updated to "${newStatus}"`);
    } catch {
      toast.error('Failed to update status.');
    }
  };

  // ── Update Order Number handler ─────────────────────────────────────────────
  const handleOrderNoChange = async (orderId, newOrderNo) => {
    try {
      await updateOrderNumber(orderId, newOrderNo);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, orderNo: newOrderNo } : o));
      toast.success(`Order number updated to "${newOrderNo}"`);
    } catch {
      toast.error('Failed to update order number.');
    }
  };

  // ── Assign Work handler ────────────────────────────────────────────────────
  const handleAssignChange = async (orderId, assignedToId) => {
    const selectedUser = assignableUsers.find(u => u.id === assignedToId);
    const assignedToName = selectedUser ? selectedUser.name : '';
    try {
      await assignTailoringOrder(orderId, { assignedToId, assignedToName });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, assignedToId, assignedToName } : o));
      toast.success(assignedToName ? `Order assigned to ${assignedToName}` : 'Order unassigned');
    } catch {
      toast.error('Failed to update work assignment.');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTailoringOrder(deleteId);
      toast.success('Order deleted.');
      setDeleteId(null);
      load();
    } catch {
      toast.error('Failed to delete order.');
    }
  };

  const handleAction = async (id, action) => {
    try {
      toast.loading('Loading order details...', { id: 'loadOrder' });
      const res = await getTailoringOrder(id);
      toast.dismiss('loadOrder');
      if (action === 'preview') setPreviewOrder(res.data);
      if (action === 'print') {
        setPrintOrder(res.data);
        setTimeout(() => {
          window.print();
          setTimeout(() => setPrintOrder(null), 500);
        }, 300);
      }
    } catch {
      toast.error('Failed to load order', { id: 'loadOrder' });
    }
  };

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900">Customer Orders</h1>
          <p className="text-sm text-gray-500">{total} total orders</p>
        </div>
        <div className="sm:ml-auto flex gap-2">
          <button onClick={() => setShowStickyNotes(true)} className="btn-secondary">
            <FileText className="w-4 h-4" /> Print Sticky Notes
          </button>
          <button onClick={() => navigate('/customer')} className="btn-primary">
            <Plus className="w-4 h-4" /> New Order
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            className="input pl-9 text-sm"
            placeholder="Search by order no, customer, phone…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {/* Quick Status Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {['All', 'Not yet started', 'On Progress', 'Stitching Completed', 'Not yet Checked', 'Delivered'].map(s => {
            const active = (s === 'All' && !filterStatus) || filterStatus === s;
            return (
              <button
                key={s}
                onClick={() => {
                  const next = s === 'All' ? '' : s;
                  setFilterStatus(next);
                  setPage(1);
                  if (next) setSearchParams({ status: next });
                  else setSearchParams({});
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  active
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-elevated border-b border-surface-border">
              <tr>
                {['Order No', 'Customer', 'Order Date', 'Delivery Date', 'Items', 'Status', 'Assigned To', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center">
                    <Loader className="w-6 h-6 text-brand-400 animate-spin mx-auto mb-2" />
                    <span className="text-xs text-gray-400">Loading customer orders…</span>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-500 text-sm">
                    No orders found.
                  </td>
                </tr>
              ) : orders.map(o => (
                <tr key={o.id} className="hover:bg-purple-50/30 transition-colors">
                  {/* Order Number (Editable) */}
                  <td className="px-4 py-3">
                    <OrderNumberCell
                       orderNo={o.orderNo}
                       orderId={o.id}
                       onSave={handleOrderNoChange}
                    />
                  </td>

                  {/* Customer */}
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{o.customer?.name || 'Walk-in Customer'}</div>
                    {isAdmin && o.customer?.phone && (
                      <div className="text-xs text-gray-400 font-mono mt-0.5">{o.customer.phone}</div>
                    )}
                    {o.customer?.address && (
                      <div className="text-xs text-gray-500 mt-0.5 max-w-xs truncate" title={o.customer.address}>
                        {o.customer.address}
                      </div>
                    )}
                  </td>

                  {/* Order Date */}
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {o.orderDate ? format(new Date(o.orderDate), 'dd MMM yy') : ''}
                  </td>

                  {/* Delivery Date */}
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {o.deliveryDate ? format(new Date(o.deliveryDate), 'dd MMM yy') : ''}
                  </td>

                  {/* Items Count */}
                  <td className="px-4 py-3 text-gray-600 font-medium">
                    {o._count?.items ?? ''}
                  </td>

                  {/* Status (Refined Editable Toggle) */}
                  <td className="px-4 py-3">
                    <StatusToggle
                      status={o.status}
                      onSelect={(newStatus) => handleStatusChange(o.id, newStatus)}
                    />
                  </td>

                  {/* Assigned To (Panel User) */}
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    {isAdmin ? (
                      <select
                        value={o.assignedToId || ''}
                        onChange={(e) => handleAssignChange(o.id, e.target.value)}
                        className="text-xs font-medium rounded-lg px-2.5 py-1.5 border border-gray-200 bg-white hover:border-purple-300 focus:outline-none focus:ring-1 focus:ring-purple-400 text-gray-700 max-w-[150px] truncate"
                        title="Assign work to panel user"
                      >
                        <option value="">Unassigned</option>
                        {assignableUsers.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.role})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-1 rounded-lg">
                        {o.assignedToName || 'Unassigned'}
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => handleAction(o.id, 'preview')} className="btn-icon text-indigo-500 hover:bg-indigo-50" title="Preview">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleAction(o.id, 'print')} className="btn-icon text-emerald-500 hover:bg-emerald-50" title="Print">
                        <Printer className="w-4 h-4" />
                      </button>
                      <button onClick={() => navigate(`/customer/${o.id}`)} className="btn-icon text-blue-500 hover:bg-blue-50" title="Edit Order">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteId(o.id)} className="btn-icon text-rose-500 hover:bg-rose-50" title="Delete Order">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > LIMIT && <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />}
      </div>

      {deleteId && (
        <ConfirmModal
          title="Delete Order?"
          message="This will permanently delete the order and all its items."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
      
      {/* Hidden print portal component */}
      {printOrder && <TailorPrintout order={printOrder} customer={printOrder.customer} />}

      {/* Preview Modal */}
      {previewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white text-black w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg shadow-2xl relative flex flex-col">
            <div className="sticky top-0 right-0 p-4 flex justify-end bg-white/90 backdrop-blur-sm border-b z-10">
               <button onClick={() => setPreviewOrder(null)} className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full transition-colors">
                 <X className="w-5 h-5" />
               </button>
            </div>
            <div className="p-2">
              <TailorPrintContent order={previewOrder} customer={previewOrder.customer} showPrices={isAdmin} />
            </div>
          </div>
        </div>
      )}

      {/* Sticky Notes Modal */}
      {showStickyNotes && (
        <StickyNotesModal onClose={() => setShowStickyNotes(false)} />
      )}
    </div>
  );
}
