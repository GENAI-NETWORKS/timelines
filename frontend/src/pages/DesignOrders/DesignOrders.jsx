import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, History, Loader, Eye, ChevronDown } from 'lucide-react';
import { getDesignOrders, deleteDesignOrder, updateStatus, getDesignOrderAudit } from '../../api/designOrders';
import { useAuth } from '../../context/AuthContext';
import ConfirmModal from '../../components/UI/ConfirmModal';
import HistoryDrawer from '../../components/UI/HistoryDrawer';
import Pagination from '../../components/UI/Pagination';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

const STATUSES = ['Pending', 'In Progress', 'Ready', 'Delivered'];
const statusBadge = { 'Pending': 'badge-pending', 'In Progress': 'badge-progress', 'Ready': 'badge-ready', 'Delivered': 'badge-delivered' };


export default function DesignOrders() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '');
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDesignOrders({ search, page, limit: LIMIT, status: filterStatus });
      setOrders(res.data.orders);
      setTotal(res.data.total);
    } catch { toast.error('Failed to load orders.'); }
    finally { setLoading(false); }
  }, [search, page, filterStatus]);

  useEffect(() => { load(); }, [load]);


  const handleDelete = async () => {
    try { await deleteDesignOrder(deleteId); toast.success('Order deleted.'); setDeleteId(null); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
  };

  const handleStatusChange = async (id, status) => {
    try { await updateStatus(id, status); toast.success(`Status → ${status}`); load(); }
    catch (err) { toast.error('Status update failed.'); }
  };

  const openHistory = async (id, label) => {
    setHistoryFor(label); setHistoryLogs([]); setHistoryLoading(true);
    try { const res = await getDesignOrderAudit(id); setHistoryLogs(res.data); }
    catch { toast.error('Failed to load history.'); }
    finally { setHistoryLoading(false); }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Design Orders</h1>
          <p className="text-sm text-gray-500">{total} total orders</p>
        </div>
        {isAdmin && (
          <button onClick={() => navigate('/orders/new')} className="btn-primary sm:ml-auto">
            <Plus className="w-4 h-4" /> New Order
          </button>
        )}
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input className="input pl-9" placeholder="Search by Order ID or garment type…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="select w-auto min-w-[140px]" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="table-wrapper border-0 rounded-none rounded-t-xl">
          <table className="table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Garment</th>
                <th>Tailor</th>
                <th>Status</th>
                <th>Delivery</th>
                <th>Design</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="text-center py-10"><Loader className="w-6 h-6 text-brand-400 animate-spin mx-auto" /></td></tr>}
              {!loading && orders.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-gray-500">No orders found.</td></tr>}
              {orders.map(order => (
                <tr key={order.orderId}>
                  <td><span className="font-mono text-xs text-brand-400">{order.orderId}</span></td>
                  <td>
                    {isAdmin && <div className="font-medium text-white text-sm">{order.customer?.name || order.customerId?.name}</div>}
                    <div className={isAdmin ? "text-xs text-gray-500" : "font-medium text-white text-sm"}>
                      {order.customer?.customerId || order.customerId?.customerId || order.customerId}
                    </div>
                  </td>
                  <td>{order.garmentType}</td>
                  <td className="text-gray-400 text-sm">{order.tailor?.name || order.assignedTailorId?.name || <span className="text-gray-600 italic">Unassigned</span>}</td>
                  <td>
                    {isAdmin ? (
                      <select
                        className="bg-transparent text-xs border-0 cursor-pointer focus:outline-none"
                        value={order.status}
                        onChange={e => handleStatusChange(order.orderId, e.target.value)}
                      >
                        {STATUSES.map(s => <option key={s} value={s} className="bg-surface-card">{s}</option>)}
                      </select>
                    ) : (
                      <span className={statusBadge[order.status] || 'badge'}>{order.status}</span>
                    )}
                  </td>
                  <td className="text-gray-400 text-xs">{order.deliveryDate ? format(new Date(order.deliveryDate), 'dd MMM yy') : '-'}</td>
                  <td>
                    {order.designSketchUrl ? (
                      <span className="badge badge-ready">✓ Sketch</span>
                    ) : (
                      <Link to={`/canvas?orderId=${order.orderId}`} className="text-xs text-brand-400 hover:text-brand-300">+ Add</Link>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openHistory(order.orderId, order.orderId)} className="btn-icon" title="History"><History className="w-4 h-4" /></button>
                      <Link to={`/print?orderId=${order.orderId}`} className="btn-icon text-green-400" title="Print"><Eye className="w-4 h-4" /></Link>
                      {isAdmin && (
                        <>
                          <button onClick={() => navigate(`/orders/${order.orderId}/edit`)} className="btn-icon text-blue-400" title="Edit"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => setDeleteId(order.orderId)} className="btn-icon text-rose-400"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 pb-4">
          <Pagination page={page} total={total} limit={LIMIT} onPageChange={setPage} />
        </div>
      </div>

      {deleteId && <ConfirmModal title="Delete Order?" message="This cannot be undone." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />}
      {historyFor && <HistoryDrawer title={historyFor} logs={historyLogs} loading={historyLoading} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}
