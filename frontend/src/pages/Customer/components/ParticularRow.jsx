/**
 * ParticularRow.jsx
 *
 * Renders one "particular" (order item) as a table section with:
 *  - A header row: Dropdown | Qty | Price(s) | Units | Image | Edit | Delete | Design
 *  - Expanded view with per-sub-item detail rows (one per quantity unit)
 *  - Per-sub-item: price, meter, source (where applicable), notes, image upload,
 *    and collapsible Front / Back / Sleeve canvas panels
 *
 * Based on the paper form structure from the reference image.
 */
import { useState, useCallback } from 'react';
import { Trash2, Edit2, ChevronDown, ChevronUp, Copy, Layers } from 'lucide-react';
import InlineCanvas from './InlineCanvas';
import ImageUploadSlot from './ImageUploadSlot';
import toast from 'react-hot-toast';
import { uploadItemImage, saveItemCanvas } from '../../../api/tailoringOrders';

// ─── Product type metadata ────────────────────────────────────────────────
export const ITEM_TYPES = [
  { value: 'DESIGN_BLOUSE',     label: 'Design Blouse',       hasMeter: true,  hasSource: false, hasDesign: true,  hasLining: true,  hasMeasurements: true },
  { value: 'LINING_BLOUSE',     label: 'Lining Blouse',       hasMeter: true,  hasSource: true,  hasDesign: true,  hasLining: false, hasMeasurements: true },
  { value: 'LINING',            label: 'Lining',              hasMeter: true,  hasSource: true,  hasDesign: false, hasLining: false },
  { value: 'SILK_COTTON_BLOUSE',label: 'Silk Cotton Blouse',  hasMeter: true,  hasSource: true,  hasDesign: false, hasLining: false, hasMeasurements: false },
  { value: 'SAREE_FALLS',       label: 'Saree Falls',         hasMeter: false, hasSource: true,  hasDesign: false, hasLining: false, isSaree: true },
  { value: 'SAREE_BORDER',      label: 'Saree Border / Ooram',hasMeter: false, hasSource: false, hasDesign: false, hasLining: false, isSaree: true },
  { value: 'ARYA_WORK_BLOUSE',  label: 'Aari Work Blouse',    hasMeter: true,  hasSource: false, hasDesign: true,  hasLining: false, hasMeasurements: true, isArya: true },
  { value: 'AARI_WORK_BLOUSE_STITCHING', label: 'Aari Work Blouse Stitching', hasMeter: true, hasSource: false, hasDesign: true, hasLining: true, hasMeasurements: true, isArya: true },

];

export function getItemMeta(itemType) {
  return ITEM_TYPES.find(t => t.value === itemType) || ITEM_TYPES[0];
}

// ─── Single sub-item detail panel ────────────────────────────────────────
function SubItemPanel({ sub, itemNumber, meta, orderId, itemId, onChange, onImageUpload, canCopy, onCopyFrom, isEditing }) {
  const [canvasOpen, setCanvasOpen] = useState({ front: false, back: false, sleeve: false });
  const [canvasSaving, setCanvasSaving] = useState({});

  const update = (field, val) => onChange({ ...sub, [field]: val });

  const handleImageUpload = async (field, file) => {
    if (!orderId || !itemId) { toast.error('Save the order first.'); return; }
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('subItemNumber', String(itemNumber));
      fd.append('field', field);
      await onImageUpload(fd, field);
    } catch { toast.error('Image upload failed.'); }
  };

  const handleCanvasSave = async (section, png, json) => {
    setCanvasSaving(s => ({ ...s, [section]: true }));
    try {
      // ① Always store data URL immediately in local state for print/preview
      onChange({
        ...sub,
        [`${section}CanvasJSON`]:    json,
        [`${section}CanvasDataUrl`]: png,   // <-- local fallback for print
      });

      if (orderId && itemId) {
        // ② Also upload to server for persistence
        const blob = await (await fetch(png)).blob();
        const file = new File([blob], `${section}-canvas.png`, { type: 'image/png' });
        const fd = new FormData();
        fd.append('canvas', file);
        fd.append('subItemNumber', String(itemNumber));
        fd.append('section', section);
        fd.append('canvasJSON', json);
        const res = await saveItemCanvas(orderId, itemId, fd);
        const serverSub = res.data.subItems?.find(s => s.number === itemNumber);
        if (serverSub) {
          // Merge server sub with local dataUrl so print still works immediately
          onChange({ ...serverSub, [`${section}CanvasDataUrl`]: png });
        }
        toast.success(`${section.charAt(0).toUpperCase() + section.slice(1)} canvas saved!`);
      } else {
        toast('Canvas saved locally. Submit order to upload.', { icon: '💾' });
      }
    } catch { toast.error('Canvas save failed.'); }
    finally { setCanvasSaving(s => ({ ...s, [section]: false })); }
  };


  const toggleCanvas = (section) => setCanvasOpen(s => ({ ...s, [section]: !s[section] }));

  return (
    <div className="border border-surface-border/50 rounded-xl overflow-hidden bg-surface-elevated/10">
      {/* Sub-item header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-elevated/30 border-b border-surface-border/30">
        <span className="w-6 h-6 rounded-full bg-gradient-brand text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{itemNumber}</span>
        <span className="text-sm font-medium text-gray-300 flex-1">Item {itemNumber}</span>
        {canCopy && (
          <button onClick={onCopyFrom} className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors px-2 py-1 rounded-lg hover:bg-brand-900/20">
            <Copy className="w-3 h-3" /> Same as Item 1
          </button>
        )}
      </div>

      {/* Detail fields */}
      <div className="p-3 space-y-3">
        {/* Row 1: Price + Meter + Source */}
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[100px]">
            <label className="label text-xs">Price (₹)</label>
            <input className="input text-sm py-1.5" type="number" min="0" placeholder="0" value={sub.price || ''} onChange={e => update('price', e.target.value)} />
          </div>
          {meta.hasMeter && (
            <div className="flex-1 min-w-[100px]">
              <label className="label text-xs">Meter</label>
              <input className="input text-sm py-1.5" placeholder="e.g. 1.5" value={sub.meter || ''} onChange={e => update('meter', e.target.value)} />
            </div>
          )}
          {meta.hasSource && (
            <>
              <div className="flex-1 min-w-[130px]">
                <label className="label text-xs">Source</label>
                <select className="select text-sm py-1.5" value={sub.source || 'SHOP'} onChange={e => update('source', e.target.value)}>
                  <option value="SHOP">Shop purchase (Inside)</option>
                  <option value="CUSTOMER">Customer purchased(outside)</option>
                </select>
              </div>
              {sub.source !== 'CUSTOMER' && (
                <div className="flex-1 min-w-[100px]">
                  <label className="label text-xs">Source Price (₹)</label>
                  <input className="input text-sm py-1.5" type="number" min="0" placeholder="0" value={sub.sourcePrice || ''} onChange={e => update('sourcePrice', e.target.value)} />
                </div>
              )}
            </>
          )}
          {meta.isSaree && (
            <div className="flex-1 min-w-[120px]">
              <label className="label text-xs">Saree Colour</label>
              <input className="input text-sm py-1.5" type="text" placeholder="e.g. Red, Blue..." value={sub.sareeColour || ''} onChange={e => update('sareeColour', e.target.value)} />
            </div>
          )}

        </div>

        {/* Description / Notes */}
        <div>
          <label className="label text-xs">Description / Notes</label>
          <input className="input text-sm py-1.5" placeholder="Notes for this item…" value={sub.description || ''} onChange={e => update('description', e.target.value)} />
        </div>

        {/* Reason for Edit */}
        {isEditing && (
          <div>
            <label className="label text-xs text-amber-500">Reason for Edit</label>
            <input className="input text-sm py-1.5 border-amber-500/30 focus:border-amber-500" placeholder="If modifying an existing order, why?" value={sub.editReason || ''} onChange={e => update('editReason', e.target.value)} />
          </div>
        )}

        {/* Measurements */}
        {meta.hasMeasurements && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-gray-300">Measurements (inches/cm)</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 border border-surface-border/30 rounded-lg p-2 bg-surface-elevated/10">
              {[
                { key: 'SL', label: 'SL' },
                { key: 'SA', label: 'SA' },
                { key: 'ARM', label: 'ARM' },
                { key: 'BACK_L', label: 'BACK L' },
                { key: 'HIP', label: 'HIP' },
                { key: 'PAKKA', label: 'PAKKA' },
                { key: 'SHOULDER', label: 'SHOULDER' },
                { key: 'BACKNECK', label: 'BACKNECK' },
                { key: 'CHEST', label: 'CHEST' },
                { key: 'FRONT_NECK', label: 'FRONT NECK' },
                { key: 'FRONT_LEN', label: 'FRONT LEN' },
              ].map(m => (
                <div key={m.key} className="flex flex-col">
                  <label className="text-[10px] text-gray-400 mb-0.5 uppercase">{m.label}</label>
                  <input
                    className="input text-sm py-1 px-1.5"
                    placeholder="—"
                    value={sub[`measurement_${m.key}`] || ''}
                    onChange={e => update(`measurement_${m.key}`, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Arya work notes */}
        {meta.isArya && (
          <div>
            <label className="label text-xs">Aari Work Instructions</label>
            <textarea className="input text-sm py-1.5 min-h-[50px] resize-none" placeholder="Aari work details, colors, pattern…" value={sub.aryaWorkNotes || ''} onChange={e => update('aryaWorkNotes', e.target.value)} />
          </div>
        )}

        {/* Image upload row */}
        <div>
          <label className="label text-xs mb-1">Reference Image</label>
          <ImageUploadSlot
            imageUrl={sub.referenceImageUrl}
            onUpload={(file) => handleImageUpload('referenceImageUrl', file)}
            onRemove={() => update('referenceImageUrl', null)}
            label="Reference"
          />
        </div>

        {/* Design section (Front / Back / Sleeve) */}
        {meta.hasDesign && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-pink-400" />
              <span className="text-xs font-semibold text-gray-300">Design</span>
            </div>
            {['front', 'back', 'sleeve'].map(section => {
              const noteKey    = `${section}DesignNotes`;
              const imgKey     = meta.isArya ? `${section}DesignImageUrl` : `${section}DesignImageUrl`;
              const canvasKey  = `${section}CanvasJSON`;
              const canvasImgKey = `${section}CanvasImageUrl`;
              const SectionLabel = section.charAt(0).toUpperCase() + section.slice(1);

              return (
                <div key={section} className="rounded-xl border border-surface-border/50 overflow-hidden">
                  {/* Section header */}
                  <button
                    type="button"
                    onClick={() => toggleCanvas(section)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-elevated/40 transition-colors"
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${section === 'front' ? 'bg-blue-400' : section === 'back' ? 'bg-purple-400' : 'bg-pink-400'}`} />
                    <span className="text-xs font-semibold text-gray-300 flex-1">{SectionLabel} Design</span>
                    {sub[canvasImgKey] && <span className="badge badge-ready text-xs">Saved</span>}
                    {canvasOpen[section] ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                  </button>

                  {canvasOpen[section] && (
                    <div className="p-3 space-y-3 border-t border-surface-border/30 animate-fade-in">
                      {/* Notes */}
                      <div>
                        <label className="label text-xs">{SectionLabel} Design Notes</label>
                        <textarea
                          className="input text-sm py-1.5 min-h-[50px] resize-none"
                          placeholder={`${SectionLabel} design details, measurements, pattern…`}
                          value={sub[noteKey] || ''}
                          onChange={e => update(noteKey, e.target.value)}
                        />
                      </div>

                      {/* Design image upload (for Arya Work) */}
                      {meta.isArya && (
                        <div>
                          <label className="label text-xs">{SectionLabel} Design Reference Image</label>
                          <ImageUploadSlot
                            imageUrl={sub[imgKey]}
                            onUpload={(file) => handleImageUpload(imgKey, file)}
                            onRemove={() => update(imgKey, null)}
                            label={`${SectionLabel} Ref`}
                            small
                          />
                        </div>
                      )}

                      {/* Canvas */}
                      <div>
                        <label className="label text-xs mb-2">{SectionLabel} Design Canvas</label>
                        <InlineCanvas
                          width={460}
                          height={260}
                          initialJSON={sub[canvasKey]}
                          savedImageUrl={sub[canvasImgKey]}
                          label={`${SectionLabel} Design`}
                          saving={canvasSaving[section]}
                          onSave={(png, json) => handleCanvasSave(section, png, json)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main ParticularRow component ─────────────────────────────────────────
export default function ParticularRow({
  item,           // { id, itemType, quantity, details, subItems, sortOrder }
  rowIndex,       // display index (1-based)
  orderId,        // null if order not yet saved
  isEditing,
  onUpdate,       // (updatedItem) => void  — local state update
  onDelete,       // () => void
  onSaveToServer, // (updatedItem) => Promise  — sends PUT to backend
}) {
  const [expanded, setExpanded] = useState(true);
  const [editingQty, setEditingQty] = useState(false);
  const meta = getItemMeta(item.itemType);

  // Ensure subItems array matches quantity
  const subItems = Array.isArray(item.subItems) ? item.subItems : [];

  const updateSubItem = useCallback((index, updated) => {
    const newSubs = subItems.map((s, i) => i === index ? updated : s);
    const updatedItem = { ...item, subItems: newSubs };
    onUpdate(updatedItem);
    // Debounced server save handled by parent
  }, [item, subItems, onUpdate]);

  const handleQuantityChange = (newQty) => {
    const q = Math.max(1, parseInt(newQty) || 1);
    let newSubs = [...subItems];
    if (q > newSubs.length) {
      // Grow
      while (newSubs.length < q) {
        newSubs.push({ number: newSubs.length + 1, price: '', referenceImageUrl: null, meter: '', frontDesignNotes: '', backDesignNotes: '', sleeveDesignNotes: '', frontCanvasJSON: null, backCanvasJSON: null, sleeveCanvasJSON: null, frontCanvasImageUrl: null, backCanvasImageUrl: null, sleeveCanvasImageUrl: null, aryaWorkNotes: '', aryaWorkPrice: '', frontDesignImageUrl: null, backDesignImageUrl: null, sleeveDesignImageUrl: null, source: 'SHOP', description: '', numberOfSarees: '', numberOfFalls: '', fallsSource: 'SHOP' });
      }
    } else {
      newSubs = newSubs.slice(0, q);
    }
    onUpdate({ ...item, quantity: q, subItems: newSubs });
    setEditingQty(false);
  };

  const handleCopyFromFirst = (index) => {
    if (subItems.length === 0) return;
    const first = { ...subItems[0], number: index + 1, referenceImageUrl: null, frontCanvasImageUrl: null, backCanvasImageUrl: null, sleeveCanvasImageUrl: null };
    updateSubItem(index, first);
    toast.success(`Item ${index + 1} copied from Item 1`);
  };

  const handleImageUpload = async (fd, field, subIdx) => {
    if (!orderId || !item.id) { toast.error('Save the order first to upload images.'); return; }
    try {
      const res = await uploadItemImage(orderId, item.id, fd);
      const updatedSubs = res.data.subItems;
      onUpdate({ ...item, subItems: updatedSubs });
      toast.success('Image uploaded!');
    } catch { toast.error('Upload failed.'); }
  };

  return (
    <div className="rounded-xl border border-surface-border overflow-hidden bg-surface-card">
      {/* ── Header row ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-3 bg-surface-elevated/50 border-b border-surface-border">
        {/* Row number */}
        <span className="text-xs font-mono text-gray-500 w-5">{rowIndex})</span>

        {/* Product type badge */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="font-semibold text-white text-sm truncate">{meta.label}</span>
          {meta.hasMeter    && <span className="badge badge-pending text-xs hidden sm:inline">Meter</span>}
          {meta.hasDesign   && <span className="badge badge-progress text-xs hidden sm:inline">Canvas</span>}
          {meta.hasSource   && <span className="badge text-xs bg-surface-elevated text-gray-400 border border-surface-border hidden sm:inline">Source</span>}
        </div>

        {/* Qty control */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">Qty:</span>
          {editingQty ? (
            <input
              autoFocus
              type="number"
              min="1"
              max="20"
              className="input py-0.5 px-1.5 text-sm w-14 text-center"
              defaultValue={item.quantity}
              onBlur={e => handleQuantityChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleQuantityChange(e.target.value); if (e.key === 'Escape') setEditingQty(false); }}
            />
          ) : (
            <button
              onClick={() => setEditingQty(true)}
              className="font-bold text-white text-sm px-2 py-0.5 rounded-lg hover:bg-surface-elevated transition-colors"
            >
              {item.quantity}
            </button>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(e => !e)}
            className="btn-icon text-gray-400"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button onClick={onDelete} className="btn-icon text-rose-400" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>

      {/* ── Sub-item panels ──────────────────────────────────────────────── */}
      {expanded && (
        <div className="p-3 space-y-3 animate-fade-in">
          {/* Lining sub-row for Design Blouse */}
          {meta.hasLining && (
            <div className="flex flex-wrap gap-3 px-1 pb-2 border-b border-surface-border/40">
              <div>
                <label className="label text-xs">Lining Source</label>
                <select
                  className="select text-sm py-1.5"
                  value={item.details?.liningSource || 'SHOP'}
                  onChange={e => onUpdate({ ...item, details: { ...item.details, liningSource: e.target.value } })}
                >
                  <option value="SHOP">Shop purchase (Inside)</option>
                  <option value="CUSTOMER">Customer purchased(outside)</option>
                </select>
              </div>
              <div>
                <label className="label text-xs">Lining Meter</label>
                <input
                  className="input text-sm py-1.5 w-28"
                  placeholder="e.g. 1.5"
                  value={item.details?.liningMeter || ''}
                  onChange={e => onUpdate({ ...item, details: { ...item.details, liningMeter: e.target.value } })}
                />
              </div>
              {item.details?.liningSource !== 'CUSTOMER' && (
                <div>
                  <label className="label text-xs">Lining Price (₹)</label>
                  <input
                    className="input text-sm py-1.5 w-28"
                    type="number" min="0" placeholder="0"
                    value={item.details?.liningPrice || ''}
                    onChange={e => onUpdate({ ...item, details: { ...item.details, liningPrice: e.target.value } })}
                  />
                </div>
              )}
            </div>
          )}

          {subItems.map((sub, i) => (
            <SubItemPanel
              key={i}
              sub={sub}
              itemNumber={i + 1}
              meta={meta}
              orderId={orderId}
              itemId={item.id}
              onChange={(updatedSub) => updateSubItem(i, updatedSub)}
              onImageUpload={(fd, field) => handleImageUpload(fd, field, i)}
              canCopy={i > 0}
              onCopyFrom={() => handleCopyFromFirst(i)}
              isEditing={isEditing}
            />
          ))}
        </div>
      )}
    </div>
  );
}
