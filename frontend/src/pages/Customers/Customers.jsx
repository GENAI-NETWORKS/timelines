import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, History, Phone, Mail, MapPin, Loader, UserPlus } from 'lucide-react';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer, getCustomerAudit } from '../../api/customers';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/UI/Modal';
import ConfirmModal from '../../components/UI/ConfirmModal';
import HistoryDrawer from '../../components/UI/HistoryDrawer';
import Pagination from '../../components/UI/Pagination';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const EMPTY = { name: '', phone: '', address: '', email: '', notes: '' };

function CustomerForm({ value, onChange, onSubmit, loading, onCancel, title }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Full Name *</label>
          <input className="input" value={value.name} onChange={e => onChange({ ...value, name: e.target.value })} required placeholder="e.g. Priya Sharma" />
        </div>
        <div>
          <label className="label">Phone *</label>
          <input className="input" value={value.phone} onChange={e => onChange({ ...value, phone: e.target.value })} required placeholder="9876543210" />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={value.email} onChange={e => onChange({ ...value, email: e.target.value })} placeholder="customer@email.com" />
        </div>
        <div>
          <label className="label">Address</label>
          <input className="input" value={value.address} onChange={e => onChange({ ...value, address: e.target.value })} placeholder="Street, City" />
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input min-h-[80px] resize-none" value={value.notes} onChange={e => onChange({ ...value, notes: e.target.value })} placeholder="Any special notes about this customer…" />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
          {loading ? 'Saving…' : title}
        </button>
      </div>
    </form>
  );
}

export default function Customers() {
  const { isAdmin } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'create' | 'edit'
  const [editData, setEditData] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCustomers({ search, page, limit: LIMIT });
      setCustomers(res.data.customers);
      setTotal(res.data.total);
    } catch { toast.error('Failed to load customers.'); }
    finally { setLoading(false); }
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      await createCustomer(editData);
      toast.success('Customer created!');
      setModal(null);
      setEditData(EMPTY);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    finally { setFormLoading(false); }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      await updateCustomer(editId, editData);
      toast.success('Customer updated!');
      setModal(null);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async () => {
    try {
      await deleteCustomer(deleteId);
      toast.success('Customer deleted.');
      setDeleteId(null);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
  };

  const openHistory = async (id, name) => {
    setHistoryFor(name);
    setHistoryLogs([]);
    setHistoryLoading(true);
    try {
      const res = await getCustomerAudit(id);
      setHistoryLogs(res.data);
    } catch { toast.error('Failed to load history.'); }
    finally { setHistoryLoading(false); }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Customers</h1>
          <p className="text-sm text-gray-500">{total} total records</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditData(EMPTY); setModal('create'); }} className="btn-primary sm:ml-auto">
            <UserPlus className="w-4 h-4" /> Add Customer
          </button>
        )}
      </div>

      {/* Search */}
      <div className="card p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            className="input pl-9"
            placeholder="Search by name, phone or Customer ID…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrapper border-0 rounded-none rounded-t-xl">
          <table className="table">
            <thead>
              <tr>
                <th>Customer ID</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Registered</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="text-center py-10">
                  <Loader className="w-6 h-6 text-brand-400 animate-spin mx-auto" />
                </td></tr>
              )}
              {!loading && customers.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-gray-500">No customers found.</td></tr>
              )}
              {customers.map((c) => (
                <tr key={c.customerId}>
                  <td><span className="font-mono text-xs text-brand-400">{c.customerId}</span></td>
                  <td className="font-medium text-white">{c.name}</td>
                  <td>
                    <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-gray-300 hover:text-brand-400 transition-colors">
                      <Phone className="w-3 h-3" />{c.phone}
                    </a>
                  </td>
                  <td className="text-gray-400 text-sm">{c.email || '-'}</td>
                  <td className="text-gray-500 text-xs">{format(new Date(c.createdAt), 'dd MMM yyyy')}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openHistory(c.customerId, c.name)} className="btn-icon" title="History"><History className="w-4 h-4" /></button>
                      {isAdmin && (
                        <>
                          <button onClick={() => { setEditId(c.customerId); setEditData({ name: c.name, phone: c.phone, address: c.address, email: c.email, notes: c.notes }); setModal('edit'); }} className="btn-icon text-blue-400" title="Edit"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => setDeleteId(c.customerId)} className="btn-icon text-rose-400" title="Delete"><Trash2 className="w-4 h-4" /></button>
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

      {/* Create Modal */}
      {modal === 'create' && (
        <Modal title="Add New Customer" onClose={() => setModal(null)}>
          <CustomerForm value={editData} onChange={setEditData} onSubmit={handleCreate} loading={formLoading} onCancel={() => setModal(null)} title="Create Customer" />
        </Modal>
      )}

      {/* Edit Modal */}
      {modal === 'edit' && (
        <Modal title="Edit Customer" onClose={() => setModal(null)}>
          <CustomerForm value={editData} onChange={setEditData} onSubmit={handleEdit} loading={formLoading} onCancel={() => setModal(null)} title="Save Changes" />
        </Modal>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <ConfirmModal title="Delete Customer?" message="This action cannot be undone. All linked design orders will remain but the customer reference will be removed." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
      )}

      {/* History Drawer */}
      {historyFor && (
        <HistoryDrawer title={historyFor} logs={historyLogs} loading={historyLoading} onClose={() => setHistoryFor(null)} />
      )}
    </div>
  );
}
