import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, Loader, ShoppingCart } from 'lucide-react';
import { getPurchases, createPurchase, updatePurchase, deletePurchase } from '../../api/purchases';
import { getInventory } from '../../api/inventory';
import Modal from '../../components/UI/Modal';
import ConfirmModal from '../../components/UI/ConfirmModal';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const EMPTY = { itemId: '', quantity: 0, totalCost: 0, supplier: '', purchaseDate: new Date().toISOString().slice(0, 10) };

function PurchaseForm({ value, onChange, onSubmit, loading, onCancel, title, inventoryItems }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Item *</label>
          <select className="select" value={value.itemId} onChange={e => onChange({ ...value, itemId: e.target.value })} required>
            <option value="">Select an item...</option>
            {inventoryItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Quantity Purchased *</label>
          <input className="input" type="number" step="0.01" value={value.quantity} onChange={e => onChange({ ...value, quantity: e.target.value })} required />
        </div>
        <div>
          <label className="label">Total Cost (₹) *</label>
          <input className="input" type="number" step="0.01" value={value.totalCost} onChange={e => onChange({ ...value, totalCost: e.target.value })} required />
        </div>
        <div>
          <label className="label">Purchase Date</label>
          <input className="input" type="date" value={value.purchaseDate ? value.purchaseDate.slice(0, 10) : ''} onChange={e => onChange({ ...value, purchaseDate: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Supplier</label>
          <input className="input" value={value.supplier} onChange={e => onChange({ ...value, supplier: e.target.value })} placeholder="Supplier name" />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">{loading ? 'Saving…' : title}</button>
      </div>
    </form>
  );
}

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
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
      const [purchRes, invRes] = await Promise.all([getPurchases(), getInventory()]);
      setPurchases(purchRes.data);
      setInventoryItems(invRes.data);
    } catch { toast.error('Failed to load purchases.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault(); setFormLoading(true);
    try {
      await createPurchase({ ...editData, quantity: parseFloat(editData.quantity), totalCost: parseFloat(editData.totalCost) });
      toast.success('Purchase logged!'); setModal(null); setEditData(EMPTY); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    finally { setFormLoading(false); }
  };

  const handleEdit = async (e) => {
    e.preventDefault(); setFormLoading(true);
    try {
      await updatePurchase(editId, { ...editData, quantity: parseFloat(editData.quantity), totalCost: parseFloat(editData.totalCost) });
      toast.success('Purchase updated!'); setModal(null); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async () => {
    try { await deletePurchase(deleteId); toast.success('Purchase deleted.'); setDeleteId(null); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
  };

  const filtered = purchases.filter(p => p.item?.name.toLowerCase().includes(search.toLowerCase()) || p.supplier.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Items Purchased</h1>
          <p className="text-sm text-gray-500">Log purchases and track expenses</p>
        </div>
        <button onClick={() => { setEditData(EMPTY); setModal('create'); }} className="btn-primary sm:ml-auto">
          <Plus className="w-4 h-4" /> Log Purchase
        </button>
      </div>

      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input className="input pl-9" placeholder="Search by item or supplier..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper border-0 rounded-none rounded-t-xl">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Item</th>
                <th>Supplier</th>
                <th>Quantity</th>
                <th>Total Cost</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="text-center py-10"><Loader className="w-6 h-6 text-brand-400 animate-spin mx-auto" /></td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-gray-500">No purchases found.</td></tr>}
              {filtered.map(purchase => (
                <tr key={purchase.id}>
                  <td className="text-gray-400">{purchase.purchaseDate ? format(new Date(purchase.purchaseDate), 'dd MMM yyyy') : '-'}</td>
                  <td className="font-medium text-white">{purchase.item?.name}</td>
                  <td className="text-gray-400">{purchase.supplier || '-'}</td>
                  <td><span className="badge badge-staff">{purchase.quantity} {purchase.item?.unit}</span></td>
                  <td className="font-mono text-brand-400">₹{purchase.totalCost}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditId(purchase.id); setEditData(purchase); setModal('edit'); }} className="btn-icon text-blue-400"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteId(purchase.id)} className="btn-icon text-rose-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal === 'create' && <Modal title="Log Purchase" onClose={() => setModal(null)}><PurchaseForm value={editData} onChange={setEditData} onSubmit={handleCreate} loading={formLoading} onCancel={() => setModal(null)} title="Log Purchase" inventoryItems={inventoryItems} /></Modal>}
      {modal === 'edit' && <Modal title="Edit Purchase" onClose={() => setModal(null)}><PurchaseForm value={editData} onChange={setEditData} onSubmit={handleEdit} loading={formLoading} onCancel={() => setModal(null)} title="Save Changes" inventoryItems={inventoryItems} /></Modal>}
      {deleteId && <ConfirmModal title="Delete Purchase?" message="This will also revert the stock quantity. Cannot be undone." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />}
    </div>
  );
}
