import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, Loader, Package } from 'lucide-react';
import { getInventory, createInventoryItem, updateInventoryItem, deleteInventoryItem } from '../../api/inventory';
import Modal from '../../components/UI/Modal';
import ConfirmModal from '../../components/UI/ConfirmModal';
import toast from 'react-hot-toast';

const EMPTY = { name: '', category: 'Raw Material', quantity: 0, unit: 'pcs', minStockLevel: 0 };

function InventoryForm({ value, onChange, onSubmit, loading, onCancel, title }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Item Name *</label>
          <input className="input" value={value.name} onChange={e => onChange({ ...value, name: e.target.value })} required placeholder="Thread, Buttons, etc." />
        </div>
        <div>
          <label className="label">Category</label>
          <select className="select" value={value.category} onChange={e => onChange({ ...value, category: e.target.value })}>
            <option value="Raw Material">Raw Material</option>
            <option value="Packaging">Packaging</option>
            <option value="Finished Good">Finished Good</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label className="label">Current Quantity</label>
          <input className="input" type="number" step="0.01" value={value.quantity} onChange={e => onChange({ ...value, quantity: e.target.value })} required />
        </div>
        <div>
          <label className="label">Unit</label>
          <select className="select" value={value.unit} onChange={e => onChange({ ...value, unit: e.target.value })}>
            <option value="pcs">Pieces (pcs)</option>
            <option value="meters">Meters (m)</option>
            <option value="spools">Spools</option>
            <option value="kg">Kilograms (kg)</option>
          </select>
        </div>
        <div>
          <label className="label">Minimum Stock Level</label>
          <input className="input" type="number" step="0.01" value={value.minStockLevel} onChange={e => onChange({ ...value, minStockLevel: e.target.value })} />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">{loading ? 'Saving…' : title}</button>
      </div>
    </form>
  );
}

export default function Inventory() {
  const [items, setItems] = useState([]);
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
      const res = await getInventory();
      setItems(res.data);
    } catch { toast.error('Failed to load inventory.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault(); setFormLoading(true);
    try {
      await createInventoryItem({
        ...editData,
        quantity: parseFloat(editData.quantity),
        minStockLevel: parseFloat(editData.minStockLevel)
      });
      toast.success('Item added!'); setModal(null); setEditData(EMPTY); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    finally { setFormLoading(false); }
  };

  const handleEdit = async (e) => {
    e.preventDefault(); setFormLoading(true);
    try {
      await updateInventoryItem(editId, {
        ...editData,
        quantity: parseFloat(editData.quantity),
        minStockLevel: parseFloat(editData.minStockLevel)
      });
      toast.success('Item updated!'); setModal(null); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async () => {
    try { await deleteInventoryItem(deleteId); toast.success('Item deleted.'); setDeleteId(null); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
  };

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.category.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Stocks & Inventory</h1>
          <p className="text-sm text-gray-500">Manage raw materials and stock levels</p>
        </div>
        <button onClick={() => { setEditData(EMPTY); setModal('create'); }} className="btn-primary sm:ml-auto">
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input className="input pl-9" placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper border-0 rounded-none rounded-t-xl">
          <table className="table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="text-center py-10"><Loader className="w-6 h-6 text-brand-400 animate-spin mx-auto" /></td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-gray-500">No items found.</td></tr>}
              {filtered.map(item => (
                <tr key={item.id}>
                  <td className="font-medium text-white">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-gray-500" />
                      {item.name}
                    </div>
                  </td>
                  <td><span className="badge badge-staff">{item.category}</span></td>
                  <td className="font-mono text-brand-400">{item.quantity}</td>
                  <td className="text-gray-400">{item.unit}</td>
                  <td>
                    {item.quantity <= item.minStockLevel ? (
                      <span className="badge badge-pending">Low Stock</span>
                    ) : (
                      <span className="badge badge-ready">In Stock</span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditId(item.id); setEditData(item); setModal('edit'); }} className="btn-icon text-blue-400"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteId(item.id)} className="btn-icon text-rose-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal === 'create' && <Modal title="Add Item" onClose={() => setModal(null)}><InventoryForm value={editData} onChange={setEditData} onSubmit={handleCreate} loading={formLoading} onCancel={() => setModal(null)} title="Add Item" /></Modal>}
      {modal === 'edit' && <Modal title="Edit Item" onClose={() => setModal(null)}><InventoryForm value={editData} onChange={setEditData} onSubmit={handleEdit} loading={formLoading} onCancel={() => setModal(null)} title="Save Changes" /></Modal>}
      {deleteId && <ConfirmModal title="Delete Item?" message="This cannot be undone." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />}
    </div>
  );
}
