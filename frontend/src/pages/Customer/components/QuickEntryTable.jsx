/**
 * QuickEntryTable.jsx
 *
 * Spreadsheet-style table for fast particular data entry.
 *  - Each row = one particular with inline editable cells
 *  - Lining sub-row for Design Blouse / Aari Blouse Stitching
 *  - Quick-add chips at the bottom for instant row creation
 *  - Details (📋) button opens slide-in panel for measurements / canvas
 */
import { FileText, Trash2, Plus, Loader } from 'lucide-react';
import { ITEM_TYPES, getItemMeta } from './ParticularRow';

// ─── helpers ──────────────────────────────────────────────────────────────────
function makeBlankSub(base = {}) {
  return {
    number: 1,
    price: base.price || '',
    meter: base.meter || '',
    source: base.source || 'SHOP',
    sourcePrice: base.sourcePrice || '',
    sareeColour: '',
    description: '',
    referenceImageUrl: null,
    frontDesignNotes: '', backDesignNotes: '', sleeveDesignNotes: '',
    frontCanvasJSON: null, backCanvasJSON: null, sleeveCanvasJSON: null,
    frontCanvasImageUrl: null, backCanvasImageUrl: null, sleeveCanvasImageUrl: null,
    frontDesignImageUrl: null, backDesignImageUrl: null, sleeveDesignImageUrl: null,
    aryaWorkNotes: '',
    measurement_SL: '', measurement_SA: '', measurement_ARM: '',
    measurement_BACK_L: '', measurement_HIP: '', measurement_PAKKA: '',
    measurement_SHOULDER: '', measurement_BACKNECK: '', measurement_CHEST: '',
    measurement_FRONT_NECK: '', measurement_FRONT_LEN: '',
  };
}

// ─── Single item row ──────────────────────────────────────────────────────────
function ItemRow({ item, rowIndex, onUpdate, onDelete, onOpenDetail }) {
  const meta = getItemMeta(item.itemType);
  const sub0 = item.subItems?.[0] || {};

  const updateSub0 = (field, val) => {
    const base = item.subItems?.length ? item.subItems : [makeBlankSub()];
    const newSubs = [{ ...base[0], [field]: val }, ...base.slice(1)];
    onUpdate({ ...item, subItems: newSubs });
  };

  const updateQty = (val) => {
    const q = Math.max(1, parseInt(val) || 1);
    let subs = [...(item.subItems?.length ? item.subItems : [makeBlankSub()])];
    while (subs.length < q) subs.push({ ...makeBlankSub(subs[0]), number: subs.length + 1 });
    subs = subs.slice(0, q).map((s, i) => ({ ...s, number: i + 1 }));
    onUpdate({ ...item, quantity: q, subItems: subs });
  };

  const hasDetail = true; // All items have extras: ref image, saree colour, notes, etc.

  const inp = 'w-full bg-surface-elevated border border-surface-border/60 rounded-lg px-2 py-1.5 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/30 transition-colors';
  const na  = <span className="text-gray-600 text-sm px-2 select-none">—</span>;

  return (
    <>
      {/* ── Main row ──────────────────────────────────────────────────────── */}
      <tr className="border-b border-surface-border/40 hover:bg-surface-elevated/10 transition-colors">

        <td className="px-3 py-2 text-xs text-gray-500 font-mono w-8 text-center">{rowIndex}</td>

        {/* Item type — label only, set at creation */}
        <td className="px-2 py-2 min-w-[160px]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white truncate">{meta.label}</span>
            {meta.hasDesign && (
              <span className="hidden lg:inline px-1.5 py-0.5 rounded-full text-[10px] bg-brand-900/40 text-brand-300 border border-brand-500/20">Canvas</span>
            )}
          </div>
        </td>

        {/* Qty */}
        <td className="px-2 py-1.5 w-16">
          <input type="number" min="1" max="20" className={inp + ' text-center'}
            value={item.quantity || 1} onChange={e => updateQty(e.target.value)} />
        </td>

        {/* Price */}
        <td className="px-2 py-1.5 w-28">
          <input type="number" min="0" className={inp} placeholder="₹ 0"
            value={sub0.price || ''} onChange={e => updateSub0('price', e.target.value)} />
        </td>

        {/* Meter */}
        <td className="px-2 py-1.5 w-24">
          {meta.hasMeter
            ? <input type="text" className={inp} placeholder="1.5"
                value={sub0.meter || ''} onChange={e => updateSub0('meter', e.target.value)} />
            : na}
        </td>

        {/* Source */}
        <td className="px-2 py-1.5 w-40">
          {meta.hasSource
            ? <select className={inp}
                value={sub0.source || 'SHOP'} onChange={e => updateSub0('source', e.target.value)}>
                <option value="SHOP">Shop (Inside)</option>
                <option value="CUSTOMER">Customer (Out)</option>
              </select>
            : na}
        </td>

        {/* Source Price */}
        <td className="px-2 py-1.5 w-28">
          {meta.hasSource && sub0.source !== 'CUSTOMER'
            ? <input type="number" min="0" className={inp} placeholder="₹ 0"
                value={sub0.sourcePrice || ''} onChange={e => updateSub0('sourcePrice', e.target.value)} />
            : na}
        </td>

        {/* Notes */}
        <td className="px-2 py-1.5 min-w-[120px]">
          <input type="text" className={inp} placeholder="Quick notes…"
            value={sub0.description || ''} onChange={e => updateSub0('description', e.target.value)} />
        </td>

        {/* Actions */}
        <td className="px-2 py-1.5 w-20">
          <div className="flex items-center gap-1 justify-center">
            {hasDetail && (
              <button onClick={() => onOpenDetail(item)}
                className="p-1.5 rounded-lg text-brand-400 hover:bg-brand-900/30 hover:text-brand-300 transition-colors"
                title="Measurements, design canvas & more">
                <FileText className="w-4 h-4" />
              </button>
            )}
            <button onClick={onDelete}
              className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-900/30 hover:text-rose-300 transition-colors"
              title="Remove item">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>

      {/* ── Lining sub-row ──────────────────────────────────────────────────── */}
      {meta.hasLining && (
        <tr className="border-b border-surface-border/30 bg-violet-950/20">
          <td className="px-3 py-1.5" />
          <td className="px-2 py-1.5">
            <span className="text-[11px] text-violet-400 font-semibold uppercase tracking-wider">↳ Lining</span>
          </td>
          <td colSpan={5} className="px-2 py-1.5">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-gray-500 whitespace-nowrap">Source:</span>
                <select
                  className="bg-surface-elevated border border-violet-500/30 rounded-lg px-2 py-1 text-xs text-white focus:border-violet-400 focus:outline-none transition-colors"
                  value={item.details?.liningSource || 'SHOP'}
                  onChange={e => onUpdate({ ...item, details: { ...item.details, liningSource: e.target.value } })}>
                  <option value="SHOP">Shop (Inside)</option>
                  <option value="CUSTOMER">Customer (Out)</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-gray-500">Meter:</span>
                <input type="text" placeholder="1.5"
                  className="bg-surface-elevated border border-violet-500/30 rounded-lg px-2 py-1 text-xs text-white w-16 focus:border-violet-400 focus:outline-none transition-colors"
                  value={item.details?.liningMeter || ''}
                  onChange={e => onUpdate({ ...item, details: { ...item.details, liningMeter: e.target.value } })} />
              </div>
              {item.details?.liningSource !== 'CUSTOMER' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-500">Price (₹):</span>
                  <input type="number" min="0" placeholder="0"
                    className="bg-surface-elevated border border-violet-500/30 rounded-lg px-2 py-1 text-xs text-white w-20 focus:border-violet-400 focus:outline-none transition-colors"
                    value={item.details?.liningPrice || ''}
                    onChange={e => onUpdate({ ...item, details: { ...item.details, liningPrice: e.target.value } })} />
                </div>
              )}
            </div>
          </td>
          <td colSpan={2} />
        </tr>
      )}

      {/* ── Bag sub-row (all items) ──────────────────────────────────────────── */}
      <tr className="border-b border-surface-border/30 bg-amber-950/10">
        <td className="px-3 py-1.5" />
        <td className="px-2 py-1.5">
          <span className="text-[11px] text-amber-400 font-semibold uppercase tracking-wider">↳ Bag</span>
        </td>
        <td colSpan={5} className="px-2 py-1.5">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-500 whitespace-nowrap">Bag No:</span>
              <input
                type="text"
                placeholder="e.g. B001"
                className="bg-surface-elevated border border-amber-500/30 rounded-lg px-2 py-1 text-xs text-white w-24 focus:border-amber-400 focus:outline-none transition-colors"
                value={item.details?.bagNo || ''}
                onChange={e => onUpdate({ ...item, details: { ...item.details, bagNo: e.target.value } })}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-500 whitespace-nowrap">Bag Colour:</span>
              <input
                type="text"
                placeholder="e.g. Red, Blue…"
                className="bg-surface-elevated border border-amber-500/30 rounded-lg px-2 py-1 text-xs text-white w-32 focus:border-amber-400 focus:outline-none transition-colors"
                value={item.details?.bagColour || ''}
                onChange={e => onUpdate({ ...item, details: { ...item.details, bagColour: e.target.value } })}
              />
            </div>
          </div>
        </td>
        <td colSpan={2} />
      </tr>

    </>
  );
}

// ─── QuickEntryTable ──────────────────────────────────────────────────────────
export default function QuickEntryTable({ items, onAdd, onUpdate, onDelete, onOpenDetail, adding }) {
  return (
    <div className="rounded-xl border border-surface-border overflow-hidden bg-surface-card">

      {items.length === 0 ? (
        <div className="p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-elevated flex items-center justify-center mx-auto mb-4">
            <Plus className="w-8 h-8 text-gray-500" />
          </div>
          <p className="font-semibold text-gray-300 mb-1">No particulars yet</p>
          <p className="text-sm text-gray-500">Click any type below to add the first row instantly</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: 780 }}>
            <thead>
              <tr className="bg-surface-elevated/60 border-b border-surface-border">
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-8">#</th>
                <th className="px-2 py-2.5 text-left   text-[11px] font-semibold text-gray-400 uppercase tracking-wider min-w-[160px]">Item Type</th>
                <th className="px-2 py-2.5 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-16">Qty</th>
                <th className="px-2 py-2.5 text-left   text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-28">Stitching Price</th>
                <th className="px-2 py-2.5 text-left   text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-24">Meter</th>
                <th className="px-2 py-2.5 text-left   text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-40">Source</th>
                <th className="px-2 py-2.5 text-left   text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-28">Src Price</th>
                <th className="px-2 py-2.5 text-left   text-[11px] font-semibold text-gray-400 uppercase tracking-wider min-w-[120px]">Notes</th>
                <th className="px-2 py-2.5 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  rowIndex={idx + 1}
                  onUpdate={onUpdate}
                  onDelete={() => onDelete(item.id)}
                  onOpenDetail={onOpenDetail}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Quick-add chip bar ────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-surface-border/50 bg-surface-elevated/10">
        <div className="flex items-center flex-wrap gap-2">
          <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider whitespace-nowrap">+ Add:</span>
          {ITEM_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => onAdd(t.value)}
              disabled={adding}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-surface-elevated border border-surface-border text-gray-300 hover:border-brand-500/70 hover:text-white hover:bg-brand-900/20 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-3 h-3 flex-shrink-0" />
              {t.label}
            </button>
          ))}
          {adding && <Loader className="w-4 h-4 text-brand-400 animate-spin" />}
        </div>
      </div>
    </div>
  );
}
