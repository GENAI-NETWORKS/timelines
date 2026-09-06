/**
 * DetailSidePanel.jsx
 *
 * Slide-in right panel that opens when user clicks the 📋 details button on a row.
 * Shows per-sub-item detail:
 *   • Measurements grid (SL / SA / ARM / …)
 *   • Aari work notes
 *   • Reference image upload
 *   • Design canvases: Front / Back / Sleeve (collapsible)
 *
 * When quantity > 1, tabs at the top switch between sub-items.
 * Changes call onUpdate(updatedItem) — debounce-saved by the parent.
 * Press Escape or click backdrop to close.
 */
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Layers, ChevronDown, ChevronUp, BookImage } from 'lucide-react';
import toast from 'react-hot-toast';
import { getItemMeta } from './ParticularRow';
import InlineCanvas from './InlineCanvas';
import ImageUploadSlot from './ImageUploadSlot';
import DesignLibraryPicker from './DesignLibraryPicker';
import { uploadItemImage, saveItemCanvas } from '../../../api/tailoringOrders';
import { getDesignLibrary } from '../../../api/designLibrary';

const BACKEND = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '');

function thumb(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${BACKEND}${url}`;
}

// ─── Measurement fields ───────────────────────────────────────────────────────
const MEASUREMENTS = [
  { key: 'SL',         label: 'SL' },
  { key: 'SA',         label: 'SA' },
  { key: 'ARM',        label: 'ARM' },
  { key: 'BACK_L',     label: 'Back L' },
  { key: 'HIP',        label: 'HIP' },
  { key: 'PAKKA',      label: 'PAKKA' },
  { key: 'SHOULDER',   label: 'Shoulder' },
  { key: 'BACKNECK',   label: 'Back Neck' },
  { key: 'CHEST',      label: 'CHEST' },
  { key: 'FRONT_NECK', label: 'Front Neck' },
  { key: 'FRONT_LEN',  label: 'Front Len' },
];

// ─── Per-sub-item content ─────────────────────────────────────────────────────
function SubDetail({ sub, meta, orderId, itemId, itemNumber, onChange, isEditing }) {
  const [canvasOpen,     setCanvasOpen]     = useState({ front: false, back: false, sleeve: false });
  const [canvasSaving,   setCanvasSaving]   = useState({});
  const [librarySection, setLibrarySection] = useState(null); // 'front'|'back'|'sleeve'|null
  const [libraryBg,      setLibraryBg]      = useState({});   // { front: url, back: url, sleeve: url }
  const [libraryImages,  setLibraryImages]  = useState({ front: [], back: [], sleeve: [] });

  const fetchLibrary = useCallback(() => {
    if (!meta?.value) return;
    getDesignLibrary(meta.value).then(res => setLibraryImages(res.data?.data || {})).catch(() => {});
  }, [meta?.value]);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  const update = (field, val) => onChange({ ...sub, [field]: val });

  const handleImageUpload = async (field, file) => {
    if (!orderId || !itemId) { toast.error('Save the order first.'); return; }
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('subItemNumber', String(itemNumber));
      fd.append('field', field);
      const res = await uploadItemImage(orderId, itemId, fd);
      const updatedSub = res.data.subItems?.find(s => s.number === itemNumber);
      if (updatedSub) onChange(updatedSub);
      toast.success('Image uploaded!');
    } catch { toast.error('Image upload failed.'); }
  };

  const handleCanvasSave = async (section, png, json) => {
    setCanvasSaving(s => ({ ...s, [section]: true }));
    try {
      // ① Persist locally immediately (for print)
      onChange({ ...sub, [`${section}CanvasJSON`]: json, [`${section}CanvasDataUrl`]: png });

      if (orderId && itemId) {
        // ② Upload to server
        const blob = await (await fetch(png)).blob();
        const file = new File([blob], `${section}-canvas.png`, { type: 'image/png' });
        const fd = new FormData();
        fd.append('canvas', file);
        fd.append('subItemNumber', String(itemNumber));
        fd.append('section', section);
        fd.append('canvasJSON', json);
        const res = await saveItemCanvas(orderId, itemId, fd);
        const serverSub = res.data.subItems?.find(s => s.number === itemNumber);
        if (serverSub) onChange({ ...serverSub, [`${section}CanvasDataUrl`]: png });
        toast.success(`${section.charAt(0).toUpperCase() + section.slice(1)} canvas saved!`);
      } else {
        toast('Canvas saved locally — submit order to upload.', { icon: '💾' });
      }
    } catch { toast.error('Canvas save failed.'); }
    finally { setCanvasSaving(s => ({ ...s, [section]: false })); }
  };

  const inp = 'bg-surface-elevated border border-surface-border/60 rounded-lg px-2 py-1.5 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/30 transition-colors';

  return (
    <div className="space-y-5">

      {/* Measurements grid */}
      {meta.hasMeasurements && (
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Measurements (inches/cm)</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-3 rounded-xl border border-surface-border/40 bg-surface-elevated/10">
            {MEASUREMENTS.map(m => (
              <div key={m.key} className="flex flex-col">
                <label className="text-[10px] text-gray-500 mb-0.5 uppercase">{m.label}</label>
                <input
                  className={inp + ' text-center'}
                  placeholder="—"
                  value={sub[`measurement_${m.key}`] || ''}
                  onChange={e => update(`measurement_${m.key}`, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saree colour */}
      {meta.isSaree && (
        <div>
          <label className="text-[11px] text-gray-400 uppercase tracking-wider mb-1 block">Saree Colour</label>
          <input className={inp + ' w-full'} placeholder="e.g. Red, Blue…"
            value={sub.sareeColour || ''} onChange={e => update('sareeColour', e.target.value)} />
        </div>
      )}

      {/* Aari work notes */}
      {meta.isArya && (
        <div>
          <label className="text-[11px] text-gray-400 uppercase tracking-wider mb-1 block">Aari Work Instructions</label>
          <textarea
            className={inp + ' w-full min-h-[60px] resize-none'}
            placeholder="Aari work details, colours, pattern…"
            value={sub.aryaWorkNotes || ''}
            onChange={e => update('aryaWorkNotes', e.target.value)}
          />
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="text-[11px] text-gray-400 uppercase tracking-wider mb-1 block">Description / Notes</label>
        <input className={inp + ' w-full'} placeholder="Notes for this item…"
          value={sub.description || ''} onChange={e => update('description', e.target.value)} />
      </div>

      {/* Reason for Edit (submitted orders) */}
      {isEditing && (
        <div>
          <label className="text-[11px] text-amber-400 uppercase tracking-wider mb-1 block">Reason for Edit</label>
          <input
            className={inp + ' w-full border-amber-500/30 focus:border-amber-500'}
            placeholder="Why is this being modified?"
            value={sub.editReason || ''} onChange={e => update('editReason', e.target.value)}
          />
        </div>
      )}

      {/* Reference Image */}
      <div>
        <label className="text-[11px] text-gray-400 uppercase tracking-wider mb-2 block">Reference Image</label>
        <ImageUploadSlot
          imageUrl={sub.referenceImageUrl}
          onUpload={(file) => handleImageUpload('referenceImageUrl', file)}
          onRemove={() => update('referenceImageUrl', null)}
          label="Reference"
        />
      </div>

      {/* Design sections: Front / Back / Sleeve */}
      {meta.hasDesign && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-3.5 h-3.5 text-pink-400" />
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Design Canvases</span>
          </div>

          {['front', 'back', 'sleeve'].map(section => {
            const noteKey      = `${section}DesignNotes`;
            const canvasKey    = `${section}CanvasJSON`;
            const canvasImgKey = `${section}CanvasImageUrl`;
            const imgKey       = `${section}DesignImageUrl`;
            const Label        = section.charAt(0).toUpperCase() + section.slice(1);
            const isOpen       = canvasOpen[section];
            const dot          = section === 'front' ? 'bg-blue-400' : section === 'back' ? 'bg-purple-400' : 'bg-pink-400';

            return (
              <div key={section} className="rounded-xl border border-surface-border/50 overflow-hidden">
                {/* Section header row */}
                <div className="flex items-stretch">
                  <button type="button"
                    onClick={() => setCanvasOpen(s => ({ ...s, [section]: !s[section] }))}
                    className="flex-1 flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-elevated/40 transition-colors">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                    <span className="text-xs font-semibold text-gray-300 flex-1">{Label} Design</span>
                    {sub[canvasImgKey] && <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-green-900/40 text-green-400 border border-green-500/20">Saved</span>}
                    {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                  </button>

                  {/* Library picker button */}
                  <button
                    type="button"
                    onClick={() => setLibrarySection(section)}
                    className="flex items-center gap-1 px-2.5 text-[11px] text-brand-400 hover:text-brand-300 hover:bg-brand-900/20 transition-colors border-l border-surface-border/40"
                    title="Pick from design library"
                  >
                    <BookImage className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Library</span>
                  </button>
                </div>

                {isOpen && (
                  <div className="p-3 space-y-3 border-t border-surface-border/30 animate-fade-in">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">{Label} Design Notes</label>
                      <textarea
                        className={inp + ' w-full min-h-[46px] resize-none'}
                        placeholder={`${Label} design details, pattern…`}
                        value={sub[noteKey] || ''}
                        onChange={e => update(noteKey, e.target.value)}
                      />

                      {/* Inline thumbnail strip for library images */}
                      {libraryImages[section]?.length > 0 && (
                        <div className="mt-2">
                          <label className="text-[10px] text-brand-400 mb-1.5 block uppercase tracking-wider font-semibold">Select from Library</label>
                          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            {libraryImages[section].map(img => (
                              <button
                                key={img.id}
                                type="button"
                                onClick={() => setLibraryBg(prev => ({ ...prev, [section]: thumb(img.url) }))}
                                className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all ${
                                  libraryBg[section] === thumb(img.url)
                                    ? 'border-brand-500 shadow-md shadow-brand-900/30'
                                    : 'border-surface-border hover:border-brand-400/50'
                                }`}
                              >
                                <img src={thumb(img.url)} alt="ref" className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Aari reference image per section */}
                    {meta.isArya && (
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">{Label} Reference Image</label>
                        <ImageUploadSlot
                          imageUrl={sub[imgKey]}
                          onUpload={(file) => handleImageUpload(imgKey, file)}
                          onRemove={() => update(imgKey, null)}
                          label={`${Label} Ref`}
                          small
                        />
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs text-gray-400">{Label} Design Canvas</label>
                        {libraryBg[section] && (
                          <span className="text-[10px] text-brand-400 flex items-center gap-1">
                            <BookImage className="w-3 h-3" /> Library image loaded
                          </span>
                        )}
                      </div>
                      <InlineCanvas
                        width={390}
                        height={220}
                        initialJSON={sub[canvasKey]}
                        savedImageUrl={sub[canvasImgKey]}
                        backgroundImageUrl={libraryBg[section] || null}
                        label={`${Label} Design`}
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

      {/* Design Library Picker */}
      {librarySection && (
        <DesignLibraryPicker
          itemType={meta.value}
          section={librarySection}
          onSelect={(url) => setLibraryBg(prev => ({ ...prev, [librarySection]: url }))}
          onClose={() => {
            setLibrarySection(null);
            fetchLibrary();
          }}
        />
      )}
    </div>
  );
}

// ─── DetailSidePanel ──────────────────────────────────────────────────────────
export default function DetailSidePanel({ item, orderId, isEditing, onUpdate, onClose }) {
  const [activeIdx,    setActiveIdx]    = useState(0);
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const meta = getItemMeta(item.itemType);
  // Guarantee at least one sub-item so all fields are always visible.
  // If the server hasn't created subItems yet (e.g. item just added), we
  // show a blank one locally — any edit will push it into the array.
  const qty      = Math.max(1, item.quantity || 1);
  const subItems = item.subItems?.length
    ? item.subItems
    : Array.from({ length: qty }, (_, i) => ({ number: i + 1 }));

  // Keyboard: Escape closes
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Reset tab when item switches
  useEffect(() => { setActiveIdx(0); }, [item.id]);

  const updateSubItem = useCallback((idx, updated) => {
    // Build a complete subs array — handles the case where subItems was empty
    const base = item.subItems?.length
      ? item.subItems
      : Array.from({ length: qty }, (_, i) => ({ number: i + 1 }));
    const newSubs = base.map((s, i) => i === idx ? updated : s);
    onUpdate({ ...item, subItems: newSubs });
  }, [item, qty, onUpdate]);

  const handleCopyFrom = (targetIdx, sourceIdx) => {
    if (!subItems[sourceIdx]) return;
    const source = {
      ...subItems[sourceIdx],
      number: targetIdx + 1,
      referenceImageUrl: null,
      frontCanvasImageUrl: null,
      backCanvasImageUrl: null,
      sleeveCanvasImageUrl: null,
    };
    updateSubItem(targetIdx, source);
    setCopyMenuOpen(false);
    toast.success(`Item ${targetIdx + 1} copied from Item ${sourceIdx + 1}`);
  };

  const activeSub = subItems[activeIdx] || {};

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-full z-[1001] w-full max-w-[560px] bg-surface-card border-l border-surface-border shadow-2xl flex flex-col"
        style={{ animation: 'slideInRight 0.22s cubic-bezier(0.4,0,0.2,1)' }}
      >
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-border bg-surface-elevated/40 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-white text-base truncate">{meta.label}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {item.quantity > 1
                ? `${item.quantity} items — select tab to switch`
                : 'Measurements & design details'}
            </p>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-surface-elevated transition-colors flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Sub-item tabs (qty > 1) ───────────────────────────────────────── */}
        {item.quantity > 1 && (
          <div className="flex gap-1.5 px-4 py-2.5 border-b border-surface-border/50 flex-shrink-0 overflow-x-auto">
            {subItems.map((_, i) => (
              <button key={i} onClick={() => setActiveIdx(i)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  activeIdx === i
                    ? 'bg-gradient-brand text-white shadow-lg'
                    : 'bg-surface-elevated text-gray-400 hover:text-white border border-surface-border'
                }`}>
                Item {i + 1}
              </button>
            ))}
          </div>
        )}

        {/* ── Copy-from-any helper ──────────────────────────────────────────── */}
        {subItems.length > 1 && (
          <div className="px-5 py-2 border-b border-surface-border/30 flex-shrink-0 relative">
            <button
              onClick={() => setCopyMenuOpen(o => !o)}
              className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 transition-colors px-2 py-1 rounded-lg hover:bg-brand-900/20"
            >
              <Copy className="w-3 h-3" />
              Copy measurements from…
              <svg className={`w-3 h-3 ml-0.5 transition-transform ${copyMenuOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
            </button>

            {copyMenuOpen && (
              <>
                {/* click-away overlay */}
                <div className="fixed inset-0 z-[1010]" onClick={() => setCopyMenuOpen(false)} />
                <div className="absolute left-2 top-full mt-1 z-[1011] bg-surface-card border border-surface-border rounded-xl shadow-2xl py-1 min-w-[160px] animate-fade-in">
                  {subItems.map((_, i) => i === activeIdx ? null : (
                    <button
                      key={i}
                      onClick={() => handleCopyFrom(activeIdx, i)}
                      className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:text-white hover:bg-surface-elevated transition-colors flex items-center gap-2"
                    >
                      <Copy className="w-3 h-3 text-brand-400 flex-shrink-0" />
                      Same as Item {i + 1}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Scrollable content ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Blouse type (item-level) — Design/Lining/Aari blouses only */}
          {meta.hasBlouseType && (
            <div className="rounded-xl border border-sky-500/20 bg-sky-950/20 p-4 space-y-3">
              <p className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider">Blouse Type</p>

              {/* Toggle */}
              <div className="flex gap-2">
                {['SAMPLE', 'MEASUREMENT'].map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onUpdate({ ...item, details: { ...item.details, blouseType: item.details?.blouseType === opt ? '' : opt } })}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all border ${
                      item.details?.blouseType === opt
                        ? 'bg-sky-600 text-white border-sky-500 shadow-lg shadow-sky-900/30'
                        : 'bg-surface-elevated text-gray-400 border-surface-border hover:border-sky-500/50 hover:text-white'
                    }`}
                  >
                    {opt === 'SAMPLE' ? 'Sample Blouse' : 'Measurement Blouse'}
                  </button>
                ))}
              </div>

              {/* Notes */}
              <div>
                <label className="text-[11px] text-gray-400 uppercase tracking-wider mb-1 block">Blouse Notes</label>
                <input
                  className="w-full bg-surface-elevated border border-sky-500/20 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-500/20 transition-colors"
                  placeholder="Add blouse notes here…"
                  value={item.details?.blouseNotes || ''}
                  onChange={e => onUpdate({ ...item, details: { ...item.details, blouseNotes: e.target.value } })}
                />
              </div>
            </div>
          )}

          <SubDetail
            key={`${item.id}-${activeIdx}`}
            sub={activeSub}
            meta={meta}
            orderId={orderId}
            itemId={item.id}
            itemNumber={activeIdx + 1}
            onChange={(updated) => updateSubItem(activeIdx, updated)}
            isEditing={isEditing}
          />
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className="px-5 py-3 border-t border-surface-border bg-surface-elevated/20 flex-shrink-0">
          <p className="text-[11px] text-gray-500 text-center">
            Changes auto-save · Press <kbd className="px-1 py-0.5 rounded bg-surface-elevated text-gray-400 text-[10px] font-mono">Esc</kbd> to close
          </p>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
      `}</style>
    </>,
    document.body
  );
}
