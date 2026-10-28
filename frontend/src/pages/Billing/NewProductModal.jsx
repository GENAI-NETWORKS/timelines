import { useState } from 'react';
import Modal from '../../components/UI/Modal';
import { Loader, Sparkles } from 'lucide-react';

export default function NewProductModal({ onClose, onSubmit, loading }) {
  const [form, setForm] = useState({
    name: '',
    price: '',
    quantity: '1',
    category: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSubmit({
      name: form.name.trim(),
      price: parseFloat(form.price) || 0,
      quantity: parseInt(form.quantity, 10) || 0,
      category: form.category.trim(),
    });
  };

  return (
    <Modal title="Add New Product" onClose={onClose} size="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Product Name *</label>
          <input
            type="text"
            className="input"
            placeholder="e.g., Silk Thread, Designer Saree, Lace Border"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Price (₹) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              placeholder="0.00"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label">Quantity *</label>
            <input
              type="number"
              min="0"
              className="input"
              placeholder="1"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              required
            />
          </div>
        </div>

        <div>
          <label className="label">Category / Note (Optional)</label>
          <input
            type="text"
            className="input"
            placeholder="e.g. Readymade, Material, Accessory"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
        </div>

        <div className="p-3 bg-brand-50 border border-brand-200 rounded-xl text-xs text-brand-700 flex items-center gap-2">
          <Sparkles className="w-4 h-4 flex-shrink-0 text-brand-500" />
          <span>A unique barcode (e.g. <code>TL928412</code>) will be generated automatically for instant sticker printing.</span>
        </div>

        <div className="flex gap-2 justify-end pt-3 border-t border-surface-border">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={loading || !form.name.trim()}>
            {loading ? <><Loader className="w-4 h-4 animate-spin" /> Saving…</> : 'Generate Product & Barcode'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
