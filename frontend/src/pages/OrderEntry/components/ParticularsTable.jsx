import { Plus, Trash2, GripVertical } from 'lucide-react';

const DEFAULT_ITEMS = [
  { itemName: 'Aari work only', qty: '1', notes: '' },
  { itemName: 'Aari stitching',  qty: '1', notes: '' },
  { itemName: 'Lining',          qty: '1', notes: '' },
  { itemName: 'Hand Hemming',    qty: '1', notes: '' },
];

export { DEFAULT_ITEMS };

export default function ParticularsTable({ particulars, onChange, threadColors, onThreadColors, buttonsNeeded, onButtonsNeeded, disabled }) {
  const addRow = () => {
    onChange([...particulars, { itemName: '', qty: '1', notes: '' }]);
  };

  const updateRow = (i, field, val) => {
    const updated = particulars.map((r, idx) => idx === i ? { ...r, [field]: val } : r);
    onChange(updated);
  };

  const removeRow = (i) => {
    onChange(particulars.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-surface-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-elevated border-b border-surface-border">
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-8">#</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Item / Work</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-24">Qty</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Notes / Cost</th>
              {!disabled && <th className="px-3 py-2.5 w-10" />}
            </tr>
          </thead>
          <tbody>
            {particulars.length === 0 && (
              <tr>
                <td colSpan={disabled ? 4 : 5} className="px-4 py-6 text-center text-gray-500 text-sm">
                  No items yet. Click "+ Add Item" below.
                </td>
              </tr>
            )}
            {particulars.map((row, i) => (
              <tr key={i} className="border-b border-surface-border/50 hover:bg-surface-elevated/40 transition-colors">
                <td className="px-3 py-2 text-gray-600 text-xs font-mono">{i + 1}</td>
                <td className="px-3 py-1.5">
                  <input
                    className="input py-1.5 text-sm"
                    placeholder="e.g. Aari work, Lining…"
                    value={row.itemName}
                    onChange={e => updateRow(i, 'itemName', e.target.value)}
                    disabled={disabled}
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    className="input py-1.5 text-sm"
                    placeholder="1"
                    value={row.qty}
                    onChange={e => updateRow(i, 'qty', e.target.value)}
                    disabled={disabled}
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    className="input py-1.5 text-sm"
                    placeholder="Notes / amount…"
                    value={row.notes}
                    onChange={e => updateRow(i, 'notes', e.target.value)}
                    disabled={disabled}
                  />
                </td>
                {!disabled && (
                  <td className="px-3 py-1.5">
                    <button
                      onClick={() => removeRow(i)}
                      className="btn-icon text-rose-400 hover:text-rose-300 p-1.5"
                      title="Remove row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!disabled && (
        <button
          onClick={addRow}
          className="btn-secondary text-sm py-2"
        >
          <Plus className="w-4 h-4" /> Add Item
        </button>
      )}

      {/* Thread colors + Buttons needed */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-surface-border">
        <div>
          <label className="label">Thread Colors</label>
          <input
            id="thread-colors-input"
            className="input"
            placeholder="e.g. Gold #1, Maroon #3"
            value={threadColors || ''}
            onChange={e => onThreadColors(e.target.value)}
            disabled={disabled}
          />
        </div>
        <div>
          <label className="label">Buttons Needed</label>
          <input
            id="buttons-needed-input"
            className="input"
            placeholder="e.g. 6 hook-and-eye, gold finish"
            value={buttonsNeeded || ''}
            onChange={e => onButtonsNeeded(e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
