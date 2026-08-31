import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, History, Loader, Eye, UserCheck, ChevronDown } from 'lucide-react';
import { getDesignOrders, createDesignOrder, updateDesignOrder, deleteDesignOrder, assignTailor, updateStatus, getDesignOrderAudit } from '../../api/designOrders';
import { getCustomers } from '../../api/customers';
import { getTailors } from '../../api/employees';
import { getGarmentTemplates } from '../../api/garmentTemplates';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/UI/Modal';
import ConfirmModal from '../../components/UI/ConfirmModal';
import HistoryDrawer from '../../components/UI/HistoryDrawer';
import Pagination from '../../components/UI/Pagination';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { Link, useSearchParams } from 'react-router-dom';

const STATUSES = ['Pending', 'In Progress', 'Ready', 'Delivered'];
const statusBadge = { 'Pending': 'badge-pending', 'In Progress': 'badge-progress', 'Ready': 'badge-ready', 'Delivered': 'badge-delivered' };

function OrderForm({ value, onChange, onSubmit, loading, onCancel, title, customers, tailors, templates }) {
  const template = templates.find(t => t.garmentType === value.garmentType);

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Customer *</label>
          <select className="select" value={value.customerId} onChange={e => onChange({ ...value, customerId: e.target.value })} required>
            <option value="">Select customer…</option>
            {customers.map(c => <option key={c.customerId} value={c.customerId}>{c.name} ({c.customerId})</option>)}
          </select>
        </div>
        <div>
          <label className="label">Garment Type *</label>
          <select className="select" value={value.garmentType} onChange={e => onChange({ ...value, garmentType: e.target.value, measurements: {} })} required>
            <option value="">Select garment…</option>
            {templates.map(t => <option key={t.id} value={t.garmentType}>{t.garmentType}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Order Date</label>
          <input className="input" type="date" value={value.orderDate || ''} onChange={e => onChange({ ...value, orderDate: e.target.value })} />
        </div>
        <div>
          <label className="label">Delivery Date</label>
          <input className="input" type="date" value={value.deliveryDate || ''} onChange={e => onChange({ ...value, deliveryDate: e.target.value })} />
        </div>
        <div>
          <label className="label">Assign Tailor</label>
          <select className="select" value={value.assignedTailorId || ''} onChange={e => onChange({ ...value, assignedTailorId: e.target.value })}>
            <option value="">Unassigned</option>
            {tailors.map(t => <option key={t.employeeId} value={t.employeeId}>{t.name} ({t.employeeId})</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="select" value={value.status || 'Pending'} onChange={e => onChange({ ...value, status: e.target.value })}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Dynamic measurements */}
      {template && template.fields.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gradient-brand inline-block" />
            Measurements ({value.garmentType})
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[...template.fields].sort((a, b) => a.order - b.order).map(field => (
              <div key={field.name}>
                <label className="label">{field.label} {field.required && <span className="text-rose-400">*</span>}</label>
                <div className="flex">
                  <input
                    className="input rounded-r-none flex-1"
                    value={value.measurements?.[field.name] || ''}
                    onChange={e => onChange({ ...value, measurements: { ...value.measurements, [field.name]: e.target.value } })}
                    required={field.required}
                    placeholder="0"
                    type="number"
                    step="0.25"
                    min="0"
                  />
                  <span className="px-2 bg-surface-elevated border border-l-0 border-surface-border rounded-r-lg text-xs text-gray-500 flex items-center">{field.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="label">Fabric Notes</label>
        <textarea className="input min-h-[70px] resize-none" value={value.fabricNotes || ''} onChange={e => onChange({ ...value, fabricNotes: e.target.value })} placeholder="e.g. Kanjivaram silk, maroon colour" />
      </div>
      <div>
        <label className="label">Special Instructions</label>
        <textarea className="input min-h-[70px] resize-none" value={value.specialInstructions || ''} onChange={e => onChange({ ...value, specialInstructions: e.target.value })} placeholder="e.g. Puff sleeves, embroidery on collar" />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">{loading ? 'Saving…' : title}</button>
      </div>
    </form>
  );
}

const EMPTY = { customerId: '', garmentType: '', measurements: {}, fabricNotes: '', specialInstructions: '', assignedTailorId: '', status: 'Pending', orderDate: new Date().toISOString().slice(0, 10), deliveryDate: '' };

export default function DesignOrders() {
  const { isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [editData, setEditData] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [tailors, setTailors] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [viewOrder, setViewOrder] = useState(null);
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

  useEffect(() => {
    getCustomers({ limit: 500 }).then(r => setCustomers(r.data.customers)).catch(() => {});
    getTailors().then(r => setTailors(r.data)).catch(() => {});
    getGarmentTemplates().then(r => setTemplates(r.data)).catch(() => {});
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault(); setFormLoading(true);
    try { await createDesignOrder(editData); toast.success('Order created!'); setModal(null); setEditData(EMPTY); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    finally { setFormLoading(false); }
  };

  const handleEdit = async (e) => {
    e.preventDefault(); setFormLoading(true);
    try { await updateDesignOrder(editId, editData); toast.success('Order updated!'); setModal(null); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    finally { setFormLoading(false); }
  };

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
          <button onClick={() => { setEditData(EMPTY); setModal('create'); }} className="btn-primary sm:ml-auto">
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
                          <button onClick={() => {
                            setEditId(order.orderId);
                            setEditData({
                              customerId: typeof order.customerId === 'string' ? order.customerId : (order.customer?.customerId || order.customerId?.customerId || ''),
                              garmentType: order.garmentType,
                              measurements: order.measurements || {},
                              fabricNotes: order.fabricNotes,
                              specialInstructions: order.specialInstructions,
                              assignedTailorId: typeof order.assignedTailorId === 'string' ? order.assignedTailorId : (order.tailor?.employeeId || order.assignedTailorId?.employeeId || ''),
                              status: order.status,
                              orderDate: order.orderDate?.slice(0, 10) || '',
                              deliveryDate: order.deliveryDate?.slice(0, 10) || '',
                            });
                            setModal('edit');
                          }} className="btn-icon text-blue-400"><Edit2 className="w-4 h-4" /></button>
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

      {modal === 'create' && (
        <Modal title="New Design Order" onClose={() => setModal(null)} size="max-w-4xl">
          <OrderForm value={editData} onChange={setEditData} onSubmit={handleCreate} loading={formLoading} onCancel={() => setModal(null)} title="Create Order" customers={customers} tailors={tailors} templates={templates} />
        </Modal>
      )}
      {modal === 'edit' && (
        <Modal title="Edit Design Order" onClose={() => setModal(null)} size="max-w-4xl">
          <OrderForm value={editData} onChange={setEditData} onSubmit={handleEdit} loading={formLoading} onCancel={() => setModal(null)} title="Save Changes" customers={customers} tailors={tailors} templates={templates} />
        </Modal>
      )}
      {deleteId && <ConfirmModal title="Delete Order?" message="This cannot be undone." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />}
      {historyFor && <HistoryDrawer title={historyFor} logs={historyLogs} loading={historyLoading} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}
