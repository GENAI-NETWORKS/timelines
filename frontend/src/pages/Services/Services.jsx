import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, Loader, Scissors } from 'lucide-react';
import { getServices, createService, updateService, deleteService } from '../../api/services';
import Modal from '../../components/UI/Modal';
import ConfirmModal from '../../components/UI/ConfirmModal';
import toast from 'react-hot-toast';

const EMPTY = { name: '', description: '', basePrice: 0, isActive: true };

function ServiceForm({ value, onChange, onSubmit, loading, onCancel, title }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="label">Service Name *</label>
          <input className="input" value={value.name} onChange={e => onChange({ ...value, name: e.target.value })} required placeholder="Stitching, Alteration, etc." />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Description</label>
          <textarea className="input min-h-[80px]" value={value.description} onChange={e => onChange({ ...value, description: e.target.value })} placeholder="Details about this service..." />
        </div>
        <div>
          <label className="label">Base Price (₹) *</label>
          <input className="input" type="number" step="1" value={value.basePrice} onChange={e => onChange({ ...value, basePrice: e.target.value })} required />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="select" value={value.isActive} onChange={e => onChange({ ...value, isActive: e.target.value === 'true' })}>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">{loading ? 'Saving…' : title}</button>
      </div>
    </form>
  );
}

export default function Services() {
  const [services, setServices] = useState([]);
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
      const res = await getServices();
      setServices(res.data);
    } catch { toast.error('Failed to load services.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault(); setFormLoading(true);
    try {
      await createService({ ...editData, basePrice: parseFloat(editData.basePrice) });
      toast.success('Service added!'); setModal(null); setEditData(EMPTY); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    finally { setFormLoading(false); }
  };

  const handleEdit = async (e) => {
    e.preventDefault(); setFormLoading(true);
    try {
      await updateService(editId, { ...editData, basePrice: parseFloat(editData.basePrice) });
      toast.success('Service updated!'); setModal(null); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async () => {
    try { await deleteService(deleteId); toast.success('Service deleted.'); setDeleteId(null); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
  };

  const filtered = services.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Services List</h1>
          <p className="text-sm text-gray-500">Manage offered services and pricing</p>
        </div>
        <button onClick={() => { setEditData(EMPTY); setModal('create'); }} className="btn-primary sm:ml-auto">
          <Plus className="w-4 h-4" /> Add Service
        </button>
      </div>

      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input className="input pl-9" placeholder="Search services..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper border-0 rounded-none rounded-t-xl">
          <table className="table">
            <thead>
              <tr>
                <th>Service Name</th>
                <th>Description</th>
                <th>Base Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="text-center py-10"><Loader className="w-6 h-6 text-brand-400 animate-spin mx-auto" /></td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-gray-500">No services found.</td></tr>}
              {filtered.map(service => (
                <tr key={service.id}>
                  <td className="font-medium text-white">
                    <div className="flex items-center gap-2">
                      <Scissors className="w-4 h-4 text-brand-400" />
                      {service.name}
                    </div>
                  </td>
                  <td className="text-gray-400 text-sm max-w-[200px] truncate" title={service.description}>{service.description || '-'}</td>
                  <td className="font-mono text-white">₹{service.basePrice}</td>
                  <td>
                    <span className={service.isActive ? 'badge-active' : 'badge-inactive'}>
                      {service.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditId(service.id); setEditData(service); setModal('edit'); }} className="btn-icon text-blue-400"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteId(service.id)} className="btn-icon text-rose-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal === 'create' && <Modal title="Add Service" onClose={() => setModal(null)}><ServiceForm value={editData} onChange={setEditData} onSubmit={handleCreate} loading={formLoading} onCancel={() => setModal(null)} title="Add Service" /></Modal>}
      {modal === 'edit' && <Modal title="Edit Service" onClose={() => setModal(null)}><ServiceForm value={editData} onChange={setEditData} onSubmit={handleEdit} loading={formLoading} onCancel={() => setModal(null)} title="Save Changes" /></Modal>}
      {deleteId && <ConfirmModal title="Delete Service?" message="This cannot be undone." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />}
    </div>
  );
}
