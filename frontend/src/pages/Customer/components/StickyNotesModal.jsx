import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Printer, Trash2 } from 'lucide-react';
import { getTailoringOrders } from '../../../api/tailoringOrders';

export default function StickyNotesModal({ onClose }) {
  const [notes, setNotes] = useState([
    { id: Date.now(), customerName: '', customerId: '', deliveryDate: '', text: '' }
  ]);
  const [orders, setOrders] = useState([]);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    // Load recent orders to populate the dropdown
    getTailoringOrders({ limit: 50 }).then(res => setOrders(res.data.orders)).catch(() => {});
  }, []);

  const handleAdd = () => {
    setNotes([...notes, { id: Date.now(), customerName: '', customerId: '', deliveryDate: '', text: '' }]);
  };

  const handleRemove = (id) => {
    setNotes(notes.filter(n => n.id !== id));
  };

  const updateNote = (id, key, val) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, [key]: val } : n));
  };

  const handleCustomerSelect = (id, orderId) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      setNotes(prev => prev.map(n => {
        if (n.id !== id) return n;
        return {
          ...n,
          customerName: order.customer?.name || '',
          customerId: order.customer?.customerId || order.customerId || '',
          deliveryDate: order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : n.deliveryDate
        };
      }));
    }
  };

  const handlePrint = () => {
    setIsPrinting(true);
    document.body.classList.add('printing-sticky');
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
      document.body.classList.remove('printing-sticky');
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white text-black w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg shadow-2xl relative flex flex-col">
        <div className="sticky top-0 bg-white/90 backdrop-blur border-b p-4 flex justify-between items-center z-10">
          <h2 className="text-xl font-bold">Print Sticky Notes (4x4 inch)</h2>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="btn-secondary text-sm">
              <Plus className="w-4 h-4" /> Add Note
            </button>
            <button onClick={handlePrint} className="btn-primary text-sm">
              <Printer className="w-4 h-4" /> Print Sheet
            </button>
            <button onClick={onClose} className="p-2 ml-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-500">
            Fill out the sticky notes below. You can select an existing customer from the dropdown to auto-fill, or type manually.
            When you click Print, they will be arranged in a grid of 4x4 inch boxes.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {notes.map((note, index) => (
              <div key={note.id} className="border border-gray-300 p-4 rounded bg-gray-50 relative">
                <button 
                  onClick={() => handleRemove(note.id)} 
                  className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                  title="Remove note"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="font-semibold mb-2">Note {index + 1}</div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Select Customer (Optional)</label>
                    <select 
                      className="input py-1.5 text-sm" 
                      onChange={(e) => handleCustomerSelect(note.id, e.target.value)}
                      defaultValue=""
                    >
                      <option value="" disabled>-- Select to auto-fill --</option>
                      {orders.map(o => (
                        <option key={o.id} value={o.id}>{o.customer?.name} (ID: {o.customer?.customerId || o.customerId})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Customer Name / ID</label>
                      <input 
                        className="input py-1.5 text-sm" 
                        value={note.customerName + (note.customerId ? ` (${note.customerId})` : '')}
                        onChange={(e) => updateNote(note.id, 'customerName', e.target.value)}
                        placeholder="Name..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Delivery Date</label>
                      <input 
                        className="input py-1.5 text-sm" 
                        value={note.deliveryDate}
                        onChange={(e) => updateNote(note.id, 'deliveryDate', e.target.value)}
                        placeholder="e.g. 15 Sep 2026"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                    <textarea 
                      className="input py-1.5 text-sm min-h-[80px]" 
                      value={note.text}
                      onChange={(e) => updateNote(note.id, 'text', e.target.value)}
                      placeholder="Add details for the sticky note..."
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hidden print portal */}
      {isPrinting && createPortal(
        <div className="sticky-print-only">
          <div className="sticky-notes-grid">
            {notes.map(note => (
              <div key={note.id} className="sticky-note-box flex flex-col">
                <div className="font-bold text-lg border-b border-black pb-1 mb-2 whitespace-pre-wrap">
                  {note.customerName || '—'}{note.customerId && ` (ID: ${note.customerId})`}
                </div>
                <div className="text-md font-semibold mb-3">
                  Delivery: {note.deliveryDate || '—'}
                </div>
                <div className="flex-1 border border-dashed border-gray-400 p-2 text-sm whitespace-pre-wrap bg-yellow-50/50">
                  {note.text || 'No notes added.'}
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
