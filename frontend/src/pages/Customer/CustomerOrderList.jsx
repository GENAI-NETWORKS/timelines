import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, Loader, Printer, Eye, X } from 'lucide-react';
import { getTailoringOrders, getTailoringOrder, deleteTailoringOrder } from '../../api/tailoringOrders';
import TailorPrintout, { TailorPrintContent } from './components/TailorPrintout';
import ConfirmModal from '../../components/UI/ConfirmModal';
import Pagination from '../../components/UI/Pagination';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const statusBadge = {
  'Draft':     'badge-pending',
  'Submitted': 'badge-progress',
  'Ready':     'badge-ready',
  'Delivered': 'badge-delivered',
};

export default function CustomerOrderList() {
  const navigate = useNavigate();
  const [orders,  setOrders]  = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteId,setDeleteId]= useState(null);
  const [previewOrder, setPreviewOrder] = useState(null);
  const [printOrder, setPrintOrder] = useState(null);
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTailoringOrders({ search, page, limit: LIMIT });
      setOrders(res.data.orders); setTotal(res.data.total);
    } catch { toast.error('Failed to load orders.'); }
    finally { setLoading(false); }
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    try { await deleteTailoringOrder(deleteId); toast.success('Order deleted.'); setDeleteId(null); load(); }
    catch { toast.error('Failed.'); }
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
          setTimeout(() => setPrintOrder(null), 500); // clear after print dialog closes
        }, 300);
      }
    } catch {
      toast.error('Failed to load order', { id: 'loadOrder' });
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Customer Orders</h1>
          <p className="text-sm text-gray-500">{total} total orders</p>
        </div>
        <button onClick={() => navigate('/customer')} className="btn-primary sm:ml-auto">
          <Plus className="w-4 h-4" /> New Order
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        <input className="input pl-9" placeholder="Search by name or phone…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-elevated border-b border-surface-border">
              <tr>
                {['Customer', 'Order Date', 'Delivery Date', 'Items', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center"><Loader className="w-6 h-6 text-brand-400 animate-spin mx-auto" /></td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No orders found.</td></tr>
              ) : orders.map(o => (
                <tr key={o.id} className="border-b border-surface-border/50 hover:bg-surface-elevated/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{o.customer?.name}</div>
                    {o.customer?.phone && <div className="text-xs text-gray-500 mt-0.5">{o.customer.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{format(new Date(o.orderDate), 'dd MMM yy')}</td>
                  <td className="px-4 py-3 text-gray-400">{o.deliveryDate ? format(new Date(o.deliveryDate), 'dd MMM yy') : '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{o._count?.items ?? '—'}</td>
                  <td className="px-4 py-3"><span className={`badge ${statusBadge[o.status] || 'badge-pending'}`}>{o.status}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => handleAction(o.id, 'preview')} className="btn-icon text-indigo-400" title="Preview"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => handleAction(o.id, 'print')} className="btn-icon text-emerald-400" title="Print"><Printer className="w-4 h-4" /></button>
                      <button onClick={() => navigate(`/customer/${o.id}`)} className="btn-icon text-blue-400" title="Edit"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteId(o.id)} className="btn-icon text-rose-400" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > LIMIT && <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />}
      </div>


      {deleteId && <ConfirmModal title="Delete Order?" message="This will permanently delete the order and all its items." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />}
      
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
              <TailorPrintContent order={previewOrder} customer={previewOrder.customer} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
