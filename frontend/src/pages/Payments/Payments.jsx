import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, Loader, IndianRupee } from 'lucide-react';
import { getPayments, createPayment, updatePayment, deletePayment } from '../../api/payments';
import { getCustomers } from '../../api/customers';
import Modal from '../../components/UI/Modal';
import ConfirmModal from '../../components/UI/ConfirmModal';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const EMPTY = { customerId: '', orderId: '', amount: 0, paymentDate: new Date().toISOString().slice(0, 10), paymentMethod: 'Cash', status: 'Completed', notes: '' };

function PaymentForm({ value, onChange, onSubmit, loading, onCancel, title, customers }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Customer *</label>
          <select className="select" value={value.customerId} onChange={e => onChange({ ...value, customerId: e.target.value })} required>
            <option value="">Select customer...</option>
            {customers.map(c => <option key={c.customerId} value={c.customerId}>{c.name} ({c.customerId})</option>)}
          </select>
        </div>
        <div>
          <label className="label">Order ID (Optional)</label>
          <input className="input" value={value.orderId} onChange={e => onChange({ ...value, orderId: e.target.value })} placeholder="ORD-XXXX" />
        </div>
        <div>
          <label className="label">Amount (₹) *</label>
          <input className="input" type="number" step="0.01" value={value.amount} onChange={e => onChange({ ...value, amount: e.target.value })} required />
        </div>
        <div>
          <label className="label">Payment Date</label>
          <input className="input" type="date" value={value.paymentDate ? value.paymentDate.slice(0, 10) : ''} onChange={e => onChange({ ...value, paymentDate: e.target.value })} />
        </div>
        <div>
          <label className="label">Payment Method</label>
          <select className="select" value={value.paymentMethod} onChange={e => onChange({ ...value, paymentMethod: e.target.value })}>
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
            <option value="UPI">UPI</option>
            <option value="Transfer">Bank Transfer</option>
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="select" value={value.status} onChange={e => onChange({ ...value, status: e.target.value })}>
            <option value="Completed">Completed</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <input className="input" value={value.notes} onChange={e => onChange({ ...value, notes: e.target.value })} placeholder="Additional details..." />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">{loading ? 'Saving…' : title}</button>
      </div>
    </form>
  );
}

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [modal, setModal] = useState(null);
  const [editData, setEditData] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [payRes, custRes] = await Promise.all([getPayments(), getCustomers({ limit: 200 })]);
      setPayments(payRes.data);
      setCustomers(custRes.data.customers);
    } catch { toast.error('Failed to load payments.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault(); setFormLoading(true);
    try {
      await createPayment({ ...editData, amount: parseFloat(editData.amount) });
      toast.success('Payment recorded!'); setModal(null); setEditData(EMPTY); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    finally { setFormLoading(false); }
  };

  const handleEdit = async (e) => {
    e.preventDefault(); setFormLoading(true);
    try {
      await updatePayment(editId, { ...editData, amount: parseFloat(editData.amount) });
      toast.success('Payment updated!'); setModal(null); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async () => {
    try { await deletePayment(deleteId); toast.success('Payment deleted.'); setDeleteId(null); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
  };

  const filtered = payments.filter(p => p.customer?.name.toLowerCase().includes(search.toLowerCase()) || p.customerId.toLowerCase().includes(search.toLowerCase()) || p.orderId?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Customer Payments</h1>
          <p className="text-sm text-gray-500">Manage all customer payment records</p>
        </div>
        <button onClick={() => { setEditData(EMPTY); setModal('create'); }} className="btn-primary sm:ml-auto">
          <Plus className="w-4 h-4" /> Record Payment
        </button>
      </div>

      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input className="input pl-9" placeholder="Search by customer name, ID, or Order ID..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper border-0 rounded-none rounded-t-xl">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Order ID</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="text-center py-10"><Loader className="w-6 h-6 text-brand-400 animate-spin mx-auto" /></td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-gray-500">No payments found.</td></tr>}
              {filtered.map(payment => (
                <tr key={payment.id}>
                  <td className="text-gray-400">{payment.paymentDate ? format(new Date(payment.paymentDate), 'dd MMM yyyy') : '-'}</td>
                  <td>
                    <div className="font-medium text-white">{payment.customer?.name}</div>
                    <div className="text-xs text-gray-500">{payment.customerId}</div>
                  </td>
                  <td>
                    {payment.orderId ? (
                       <span className="font-mono text-xs text-brand-400">{payment.orderId}</span>
                    ) : '-'}
                  </td>
                  <td className="font-mono text-green-400 font-medium">₹{payment.amount}</td>
                  <td className="text-gray-400">{payment.paymentMethod}</td>
                  <td>
                    <span className={payment.status === 'Completed' ? 'badge-active' : 'badge-pending'}>
                      {payment.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditId(payment.id); setEditData(payment); setModal('edit'); }} className="btn-icon text-blue-400"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteId(payment.id)} className="btn-icon text-rose-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal === 'create' && <Modal title="Record Payment" onClose={() => setModal(null)}><PaymentForm value={editData} onChange={setEditData} onSubmit={handleCreate} loading={formLoading} onCancel={() => setModal(null)} title="Record Payment" customers={customers} /></Modal>}
      {modal === 'edit' && <Modal title="Edit Payment" onClose={() => setModal(null)}><PaymentForm value={editData} onChange={setEditData} onSubmit={handleEdit} loading={formLoading} onCancel={() => setModal(null)} title="Save Changes" customers={customers} /></Modal>}
      {deleteId && <ConfirmModal title="Delete Payment?" message="This cannot be undone." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />}
    </div>
  );
}
