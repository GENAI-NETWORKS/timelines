/**
 * QuickEntryTable.jsx
 *
 * A spreadsheet-style table for entering order particulars quickly.
 * Supports multiple sub-items (quantity > 1) with per-item theming.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Plus, ChevronDown, ChevronUp, FileText, Image as ImageIcon, Ruler, Scissors, Copy, Layers, Text, Palette } from 'lucide-react';
import ParticularRow, { getItemMeta, ITEM_TYPES } from './ParticularRow';
import ImageUploadSlot from './ImageUploadSlot';
import toast from 'react-hot-toast';
const THEMES = [
  {
    name: 'pink',
    tabActive: 'bg-pink-600 text-white shadow-lg shadow-pink-500/20 border-pink-500',
    tabInactive: 'bg-pink-50 text-pink-700 hover:bg-pink-100 hover:text-pink-800 border-pink-200',
    rowBg: 'bg-pink-50/50',
    text: 'text-pink-700',
    border: 'border-pink-200',
    focusBorder: 'focus:border-pink-400',
    focusRing: 'focus:ring-pink-500/20'
  },
  {
    name: 'amber',
    tabActive: 'bg-amber-600 text-white shadow-lg shadow-amber-500/20 border-amber-500',
    tabInactive: 'bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 border-amber-200',
    rowBg: 'bg-amber-50/50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    focusBorder: 'focus:border-amber-400',
    focusRing: 'focus:ring-amber-500/20'
  },
  {
    name: 'emerald',
    tabActive: 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 border-emerald-500',
    tabInactive: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border-emerald-200',
    rowBg: 'bg-emerald-50/50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    focusBorder: 'focus:border-emerald-400',
    focusRing: 'focus:ring-emerald-500/20'
  },
  {
    name: 'cyan',
    tabActive: 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20 border-cyan-500',
    tabInactive: 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100 hover:text-cyan-800 border-cyan-200',
    rowBg: 'bg-cyan-50/50',
    text: 'text-cyan-700',
    border: 'border-cyan-200',
    focusBorder: 'focus:border-cyan-400',
    focusRing: 'focus:ring-cyan-500/20'
  },
  {
    name: 'indigo',
    tabActive: 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 border-indigo-500',
    tabInactive: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 border-indigo-200',
    rowBg: 'bg-indigo-50/50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    focusBorder: 'focus:border-indigo-400',
    focusRing: 'focus:ring-indigo-500/20'
  }
];

// ── Blank sub-item factory ────────────────────────────────────────────────────
function makeBlankSub(base = {}) {
  return {
    number: 1,
    price: base.price || '',
    meter: base.meter || '',
    source: base.source || 'SHOP',
    sourcePrice: base.sourcePrice || '',
    description: base.description || '',
    liningSource: base.liningSource || 'SHOP',
    liningMeter: base.liningMeter || '',
    liningPrice: base.liningPrice || '',
    // blouse mode toggle: 'measurement' | 'sample'
    blouseMode: base.blouseMode || 'measurement',
    sampleBlouseImageUrl: null,
    measurementBlouseImageUrl: null,
    sampleBlouseDescription: '',
    // measurements
    measurement_SL: '', measurement_SA: '', measurement_ARM: '',
    measurement_BACK_L: '', measurement_HIP: '', measurement_PAKKA: '',
    measurement_SHOULDER: '', measurement_BACKNECK: '', measurement_CHEST: '',
    measurement_FRONT_NECK: '', measurement_FRONT_LEN: '',
    // design
    frontDesignNotes: '', backDesignNotes: '', sleeveDesignNotes: '',
    frontCanvasJSON: null, backCanvasJSON: null, sleeveCanvasJSON: null,
    frontCanvasImageUrl: null, backCanvasImageUrl: null, sleeveCanvasImageUrl: null,
    frontCanvasDataUrl: null, backCanvasDataUrl: null, sleeveCanvasDataUrl: null,
    // saree
    numberOfSarees: '', numberOfFalls: '', sareeColour: '', fallsSource: 'SHOP',
    // arya
    aryaWorkNotes: '', aryaWorkPrice: '',
    frontDesignImageUrl: null, backDesignImageUrl: null, sleeveDesignImageUrl: null,
    editReason: '',
  };
}

// ── Single item card ──────────────────────────────────────────────────────────
const ItemCard = React.memo(function ItemCard({ item, rowIndex, theme, onUpdate, onDelete, onOpenDesignModal, onImageUpload, orderId, measOrder, setMeasOrder }) {
  let meta = getItemMeta(item.itemType);
  if (item.customConfig) {
    meta = { ...meta, ...item.customConfig };
  }
  
  const [activeSub, setActiveSub] = useState(0);
  const [expanded, setExpanded] = useState(true);

  const subItems = item.subItems?.length ? item.subItems : [makeBlankSub()];
  const [localSub, setLocalSub] = useState(subItems[activeSub] || makeBlankSub());
  const lastSentSub = useRef(subItems[activeSub] || makeBlankSub());

  // Sync local state when parent props change from an external source (like API load)
  useEffect(() => {
    const parentSub = item.subItems?.[activeSub] || makeBlankSub();
    if (JSON.stringify(parentSub) !== JSON.stringify(lastSentSub.current)) {
      setLocalSub(parentSub);
      lastSentSub.current = parentSub;
    }
  }, [item.subItems, activeSub]);

  // Debounce updates to parent
  useEffect(() => {
    const timer = setTimeout(() => {
      const parentSub = item.subItems?.[activeSub] || makeBlankSub();
      if (JSON.stringify(parentSub) !== JSON.stringify(localSub)) {
        const newSubs = subItems.map((s, i) => i === activeSub ? localSub : s);
        lastSentSub.current = localSub;
        onUpdate({ ...item, subItems: newSubs });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSub, activeSub]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const updateSub = (field, val) => {
    setLocalSub(prev => ({ ...prev, [field]: val }));
  };

  const updateQty = (val) => {
    const q = Math.max(1, parseInt(val) || 1);
    let subs = [...subItems];
    while (subs.length < q) subs.push({ ...makeBlankSub(), number: subs.length + 1 });
    subs = subs.slice(0, q).map((s, i) => ({ ...s, number: i + 1 }));
    if (activeSub >= q) setActiveSub(q - 1);
    onUpdate({ ...item, quantity: q, subItems: subs });
  };

  const toggleCustomField = (field) => {
    const config = item.customConfig || {
      hasMeter: false, hasSource: false, hasDesign: false, hasLining: false, hasMeasurements: false, hasNotes: true, hasReferenceImage: false
    };
    onUpdate({ ...item, customConfig: { ...config, [field]: !config[field] } });
  };

  const handleImageUpload = async (field, file) => {
    if (!orderId || !item.id) { toast.error('Save the order first.'); return; }
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('subItemNumber', String(activeSub + 1));
      fd.append('field', field);
      await onImageUpload(item.id, fd);
    } catch { toast.error('Image upload failed.'); }
  };

  const handleDeleteSubItem = () => {
    if (subItems.length <= 1) {
      onDelete(item.id);
      return;
    }
    const newSubs = subItems.filter((_, i) => i !== activeSub);
    const renumbered = newSubs.map((s, i) => ({ ...s, number: i + 1 }));
    const newActive = activeSub >= renumbered.length ? renumbered.length - 1 : activeSub;
    setActiveSub(newActive);
    onUpdate({ ...item, quantity: renumbered.length, subItems: renumbered });
  };

  const handleCopyFrom = (fromIndex) => {
    const source = subItems[fromIndex];
    if (!source) return;
    
    // Clone the source object
    const copied = JSON.parse(JSON.stringify(source));
    copied.number = activeSub + 1; // Preserve current item number
    
    setLocalSub(copied);
    lastSentSub.current = copied;
    
    // Update parent immediately
    const newSubs = subItems.map((s, i) => i === activeSub ? copied : s);
    onUpdate({ ...item, subItems: newSubs });
    toast.success(`Copied details from Item ${fromIndex + 1}`);
  };

  const inp = `w-full bg-white border rounded-lg px-3 py-2 text-base text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors ${theme.border} ${theme.focusBorder} ${theme.focusRing}`;

  return (
    <div className={`rounded-2xl border-2 ${theme.border} shadow-sm overflow-hidden`}>
      {/* ── Card header ── */}
      <div className={`flex items-center justify-between px-4 py-3 ${theme.rowBg} border-b ${theme.border}`}>
        <div className="flex items-center gap-3">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br ${
            theme.name === 'pink' ? 'from-pink-500 to-rose-600' :
            theme.name === 'amber' ? 'from-amber-500 to-orange-600' :
            theme.name === 'emerald' ? 'from-emerald-500 to-teal-600' :
            theme.name === 'cyan' ? 'from-cyan-500 to-blue-600' :
            'from-indigo-500 to-purple-600'
          }`}>{rowIndex + 1}</span>
          {meta.isCustom ? (
            <input
              type="text"
              placeholder="Enter custom item name..."
              className={`font-bold text-base bg-transparent border-b border-dashed focus:outline-none focus:border-brand-500 w-40 sm:w-56 ${theme.text}`}
              value={item.customName || ''}
              onChange={(e) => onUpdate({ ...item, customName: e.target.value })}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className={`font-bold text-base ${theme.text}`}>
              {item.customName || meta.label}
            </span>
          )}
        </div>

        {/* Qty */}
        <div className="flex items-center gap-1.5 ml-2">
          <span className="text-xs text-gray-500">Qty:</span>
          <input type="number" min="1" max="20"
            className={`w-16 text-center text-base border rounded-lg px-2 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-2 ${theme.border} ${theme.focusBorder} ${theme.focusRing}`}
            value={item.quantity || 1}
            onChange={e => updateQty(e.target.value)} />
        </div>

        <button onClick={() => setExpanded(e => !e)} className={`ml-auto p-1 rounded-lg ${theme.text} hover:bg-white/60 transition-colors`}>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <button onClick={() => onDelete(item.id)} className="p-1 rounded-lg text-rose-400 hover:bg-rose-50 transition-colors" title="Remove">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {expanded && (
        <div className="bg-white">
          {/* Customizer Toolbar */}
          {meta.isCustom && (
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-2 items-center">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-2">Customize:</span>
              <button onClick={() => toggleCustomField('hasNotes')} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${meta.hasNotes ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}><Text className="w-3.5 h-3.5" /> Notes</button>
              <button onClick={() => toggleCustomField('hasMeasurements')} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${meta.hasMeasurements ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}><Ruler className="w-3.5 h-3.5" /> Meas.</button>
              <button onClick={() => toggleCustomField('hasDesign')} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${meta.hasDesign ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}><Palette className="w-3.5 h-3.5" /> Canvas</button>
              <button onClick={() => toggleCustomField('hasReferenceImage')} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${meta.hasReferenceImage ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}><ImageIcon className="w-3.5 h-3.5" /> Ref Image</button>
              <button onClick={() => toggleCustomField('hasLining')} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${meta.hasLining ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}><Layers className="w-3.5 h-3.5" /> Lining</button>
              <button onClick={() => { toggleCustomField('hasMeter'); toggleCustomField('hasSource'); }} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${meta.hasMeter ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}><Scissors className="w-3.5 h-3.5" /> Meter</button>
            </div>
          )}

          {/* ── Sub-item tabs (if qty > 1) ── */}
          {item.quantity > 1 && (
            <div className={`flex gap-1.5 px-4 pt-3 flex-wrap border-b ${theme.border} pb-3 relative`}>
              {subItems.map((sub, i) => (
                <button key={i} onClick={() => setActiveSub(i)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${i === activeSub ? `bg-gradient-to-r ${theme.tabActive} shadow-sm border border-transparent` : `bg-surface-elevated text-gray-500 border border-surface-border hover:bg-gray-100`}`}>
                  Item {i + 1}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-3">
                {subItems.length > 1 && (
                  <select 
                    className={`text-xs bg-white border ${theme.border} rounded-md px-2 py-1 font-semibold text-gray-600 focus:outline-none ${theme.focusBorder}`}
                    value=""
                    onChange={(e) => {
                      if (e.target.value) handleCopyFrom(parseInt(e.target.value));
                    }}
                  >
                    <option value="" disabled>Copy from...</option>
                    {subItems.map((_, i) => i !== activeSub && (
                      <option key={i} value={i}>Item {i + 1}</option>
                    ))}
                  </select>
                )}
                <button onClick={handleDeleteSubItem} className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600 font-semibold px-2 py-1 rounded hover:bg-rose-50 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> Delete Item {activeSub + 1}
                </button>
              </div>
            </div>
          )}

          {/* ── Main Content Area (Fields + Ref Image) ── */}
          <div className="flex flex-col lg:flex-row gap-4 px-4 pt-3 pb-4">
            
            {/* Left Column: Fields & Lining */}
            <div className="flex-1 space-y-4">
              
              {/* ── Fields grid ── */}
              <div className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

            {/* Stitching Price */}
            <div>
              <label className={`block text-sm font-semibold mb-1 ${theme.text}`}>Stitching ₹</label>
              <input type="number" min="0" className={inp} placeholder="₹ 0"
                value={localSub.price || ''} onChange={e => updateSub('price', e.target.value)} />
            </div>

            {/* Meter */}
            {meta.hasMeter && (
              <div>
                <label className={`block text-sm font-semibold mb-1 ${theme.text}`}>Meter</label>
                <input type="text" className={inp} placeholder="1.5"
                  value={localSub.meter || ''} onChange={e => updateSub('meter', e.target.value)} />
              </div>
            )}

            {/* Source */}
            {meta.hasSource && (
              <div>
                <label className={`block text-sm font-semibold mb-1 ${theme.text}`}>Source</label>
                <select className={inp}
                  value={localSub.source || 'SHOP'} onChange={e => updateSub('source', e.target.value)}>
                  <option value="SHOP">Shop (Inside)</option>
                  <option value="CUSTOMER">Customer (Out)</option>
                </select>
              </div>
            )}

            {/* Source Price */}
            {meta.hasSource && localSub.source !== 'CUSTOMER' && (
              <div>
                <label className={`block text-sm font-semibold mb-1 ${theme.text}`}>Material ₹</label>
                <input type="number" min="0" className={inp} placeholder="₹ 0"
                  value={localSub.sourcePrice || ''} onChange={e => updateSub('sourcePrice', e.target.value)} />
              </div>
            )}

            {/* Notes */}
            {meta.hasNotes !== false && (
              <div className="col-span-2 sm:col-span-3 lg:col-span-2">
                <label className={`block text-sm font-semibold mb-1 ${theme.text}`}>Notes</label>
                <input type="text" className={inp} placeholder="Quick notes…"
                  value={localSub.description || ''} onChange={e => updateSub('description', e.target.value)} />
              </div>
            )}

            {/* Saree specific */}
            {meta.isSaree && (
              <>
                <div>
                  <label className={`block text-sm font-semibold mb-1 ${theme.text}`}># Sarees</label>
                  <input type="number" min="0" className={inp} placeholder="1"
                    value={localSub.numberOfSarees || ''} onChange={e => updateSub('numberOfSarees', e.target.value)} />
                </div>
                <div>
                  <label className={`block text-sm font-semibold mb-1 ${theme.text}`}># Falls</label>
                  <input type="number" min="0" className={inp} placeholder="1"
                    value={localSub.numberOfFalls || ''} onChange={e => updateSub('numberOfFalls', e.target.value)} />
                </div>
                <div>
                  <label className={`block text-sm font-semibold mb-1 ${theme.text}`}>Colour</label>
                  <input type="text" className={inp} placeholder="e.g. Red"
                    value={localSub.sareeColour || ''} onChange={e => updateSub('sareeColour', e.target.value)} />
                </div>
              </>
            )}

            {/* Aari specific */}
            {meta.isArya && (
              <>
                <div className="col-span-2 sm:col-span-3 lg:col-span-2">
                  <label className={`block text-sm font-semibold mb-1 ${theme.text}`}>Aari Details</label>
                  <textarea className={`${inp} min-h-[50px] resize-none`} placeholder="Aari work details, colors…"
                    value={localSub.aryaWorkNotes || ''} onChange={e => updateSub('aryaWorkNotes', e.target.value)} />
                </div>
                <div>
                  <label className={`block text-sm font-semibold mb-1 ${theme.text}`}>Aari Price ₹</label>
                  <input type="number" min="0" className={inp} placeholder="0"
                    value={localSub.aryaWorkPrice || ''} onChange={e => updateSub('aryaWorkPrice', e.target.value)} />
                </div>
                <div className="col-span-2 sm:col-span-1 flex items-center mt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-5 h-5 rounded text-brand-500 border-gray-300 focus:ring-brand-500"
                      checked={localSub.includeStitching || false}
                      onChange={e => updateSub('includeStitching', e.target.checked)} />
                    <span className={`text-sm font-semibold ${theme.text}`}>Include Stitching</span>
                  </label>
                </div>
              </>
            )}
          </div>

              {/* ── Lining section ── */}
              {(meta.hasLining || (meta.isArya && localSub.includeStitching)) && (
                <div className={`rounded-xl border px-4 py-3 bg-violet-50/60 border-violet-200`}>
              <div className="text-xs md:text-sm text-violet-700 font-bold uppercase tracking-wider mb-3">↳ Lining (Item {activeSub + 1})</div>
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Source</label>
                  <select
                    className="w-full bg-white border border-violet-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:border-violet-400 focus:outline-none transition-colors"
                    value={localSub.liningSource || 'SHOP'}
                    onChange={e => updateSub('liningSource', e.target.value)}>
                    <option value="SHOP">Shop (Inside)</option>
                    <option value="CUSTOMER">Customer (Out)</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[100px]">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Meter</label>
                  <input type="text" placeholder="1.5"
                    className="w-full bg-white border border-violet-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:border-violet-400 focus:outline-none transition-colors"
                    value={localSub.liningMeter || ''}
                    onChange={e => updateSub('liningMeter', e.target.value)} />
                </div>
                {localSub.liningSource !== 'CUSTOMER' && (
                  <div className="flex-1 min-w-[120px]">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Price (₹)</label>
                    <input type="number" min="0" placeholder="0"
                      className="w-full bg-white border border-violet-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:border-violet-400 focus:outline-none transition-colors"
                      value={localSub.liningPrice || ''}
                      onChange={e => updateSub('liningPrice', e.target.value)} />
                  </div>
                )}
              </div>
            </div>
          )}
            </div> {/* End Left Column */}

            {/* ── Reference Image section (Right Column) ── */}
            {meta.hasReferenceImage && (
              <div className="w-full lg:w-48 xl:w-56 shrink-0 rounded-xl border px-4 py-3 bg-gray-50 border-gray-200 h-fit">
                <div className="text-xs md:text-sm text-gray-700 font-bold uppercase tracking-wider mb-3">Reference Image</div>
                <ImageUploadSlot
                  imageUrl={localSub.referenceImageUrl}
                  onUpload={(file) => handleImageUpload('referenceImageUrl', file)}
                  onRemove={() => updateSub('referenceImageUrl', null)}
                  label="Reference Photo"
                  small={false}
                />
              </div>
            )}
          </div> {/* End Main Content Area */}

          {/* ── Blouse Mode Toggle + Measurements/Sample section ── */}
          {meta.hasMeasurements && (() => {
            const blouseMode = localSub.blouseMode || 'measurement';
            const isBlouseItem = ['DESIGN_BLOUSE', 'LINING_BLOUSE', 'ARYA_WORK_BLOUSE'].includes(item.itemType);
            return (
              <div className={`mx-4 mb-4 rounded-xl border overflow-hidden ${theme.border}`}>
                {/* Toggle Header */}
                {isBlouseItem && (
                  <div className={`flex border-b ${theme.border} ${theme.rowBg}`}>
                    <button
                      onClick={() => updateSub('blouseMode', 'measurement')}
                      className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
                        blouseMode === 'measurement'
                          ? `bg-white ${theme.text} border-b-2 ${theme.border.replace('border-', 'border-b-')} shadow-sm`
                          : 'text-gray-400 hover:text-gray-600'
                      }`}>
                      📏 Measurement Blouse
                    </button>
                    <div className={`w-px ${theme.border} bg-current opacity-20`} />
                    <button
                      onClick={() => updateSub('blouseMode', 'sample')}
                      className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
                        blouseMode === 'sample'
                          ? `bg-white ${theme.text} border-b-2 ${theme.border.replace('border-', 'border-b-')} shadow-sm`
                          : 'text-gray-400 hover:text-gray-600'
                      }`}>
                      👗 Sample Blouse
                    </button>
                  </div>
                )}

                {/* Measurement Blouse Mode */}
                {blouseMode === 'measurement' && (
                  <div className={`px-4 py-3 ${theme.rowBg}`}>
                    <div className={`flex items-center justify-between mb-3`}>
                      <div className={`text-xs md:text-sm font-bold uppercase tracking-wider ${theme.text}`}>Measurements (Item {activeSub + 1})</div>
                      <div className="text-[10px] text-gray-400 font-semibold">Drag labels to rearrange</div>
                    </div>
                    {/* Reference photo + measurements row */}
                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                      {/* Reference photo upload */}
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <div className={`text-[10px] font-bold uppercase tracking-wider ${theme.text} mb-0.5`}>Reference Photo</div>
                        <div className="w-24 h-28">
                          <ImageUploadSlot
                            imageUrl={localSub.measurementBlouseImageUrl}
                            onUpload={(file) => handleImageUpload('measurementBlouseImageUrl', file)}
                            onRemove={() => updateSub('measurementBlouseImageUrl', null)}
                            label="Upload Photo"
                            small={false}
                          />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                          {measOrder.map((m, index) => (
                            <div
                              key={m.key}
                              draggable
                              onDragStart={(e) => {
                                if (e.target.tagName === 'INPUT') { e.preventDefault(); return; }
                                e.dataTransfer.setData('text/plain', index.toString());
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                              onDrop={(e) => {
                                e.preventDefault();
                                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                                const toIndex = index;
                                if (fromIndex === toIndex || isNaN(fromIndex)) return;
                                const newOrder = [...measOrder];
                                const [moved] = newOrder.splice(fromIndex, 1);
                                newOrder.splice(toIndex, 0, moved);
                                setMeasOrder(newOrder);
                              }}
                              className="flex flex-col group cursor-move hover:bg-white/50 p-1 -m-1 rounded transition-colors"
                            >
                              <label className={`block text-[10px] sm:text-xs font-semibold mb-1 truncate ${theme.text} flex items-center justify-between`}>
                                {m.label} <span className="opacity-0 group-hover:opacity-100 text-gray-400 cursor-grab">⋮⋮</span>
                              </label>
                              <input type="text" placeholder="—"
                                className="w-full bg-white border border-surface-border rounded-lg px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-brand-400 transition-colors"
                                value={localSub[`measurement_${m.key}`] || ''}
                                onChange={e => updateSub(`measurement_${m.key}`, e.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    {/* Measurement description */}
                    <div className="mt-3">
                      <label className={`block text-xs font-semibold mb-1 ${theme.text}`}>Description / Notes</label>
                      <textarea
                        className="w-full bg-white border border-surface-border rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-brand-400 resize-none min-h-[50px]"
                        placeholder="Any extra measurement notes…"
                        value={localSub.sampleBlouseDescription || ''}
                        onChange={e => updateSub('sampleBlouseDescription', e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Sample Blouse Mode */}
                {blouseMode === 'sample' && (
                  <div className="px-4 py-4 bg-amber-50/60 flex flex-col sm:flex-row gap-5 items-start">
                    {/* Upload slot */}
                    <div className="flex flex-col items-center gap-2 shrink-0">
                      <div className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">Sample Photo</div>
                      <div className="w-32 h-36">
                        <ImageUploadSlot
                          imageUrl={localSub.sampleBlouseImageUrl}
                          onUpload={(file) => handleImageUpload('sampleBlouseImageUrl', file)}
                          onRemove={() => updateSub('sampleBlouseImageUrl', null)}
                          label="Upload Sample"
                          small={false}
                        />
                      </div>
                    </div>
                    <div className="w-px bg-amber-200 self-stretch hidden sm:block" />
                    {/* Description */}
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Description</label>
                      <textarea
                        className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none min-h-[120px]"
                        placeholder="Describe the sample blouse — style, design details, special instructions for the tailor…"
                        value={localSub.sampleBlouseDescription || ''}
                        onChange={e => updateSub('sampleBlouseDescription', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Design canvas buttons ── */}
          {meta.hasDesign && (
            <div className="mx-4 mb-4 flex flex-col sm:flex-row flex-wrap gap-4">
              {['front', 'back', 'sleeve'].map(section => {
                const hasSaved = !!(localSub[`${section}CanvasImageUrl`] || localSub[`${section}CanvasDataUrl`]);
                return (
                  <div key={section} className={`flex items-center gap-3 p-2 pr-4 rounded-xl border bg-gray-50/50 ${theme.border}`}>
                    <button
                      onClick={() => onOpenDesignModal(item, activeSub, section)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                        hasSaved
                          ? `${theme.tabActive} shadow-sm`
                          : `bg-white ${theme.text} ${theme.border} hover:bg-gray-50`
                      }`}>
                      <FileText className="w-3.5 h-3.5" />
                      {section.charAt(0).toUpperCase() + section.slice(1)} Design
                      {hasSaved && <span className="ml-1 text-[10px] opacity-80">✓</span>}
                    </button>
                    
                    <div className="w-px h-8 bg-gray-200"></div>

                    <div className="w-16">
                      <ImageUploadSlot
                        imageUrl={localSub[`${section}DesignImageUrl`]}
                        onUpload={(file) => handleImageUpload(`${section}DesignImageUrl`, file)}
                        onRemove={() => updateSub(`${section}DesignImageUrl`, null)}
                        label={`${section.charAt(0).toUpperCase() + section.slice(1)} Ref`}
                        small={true}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ── Global Measurement Order ────────────────────────────────────────────────
const DEFAULT_MEAS = [
  { key: 'SL', label: 'SL' }, { key: 'SA', label: 'SA' }, { key: 'ARM', label: 'ARM' },
  { key: 'BACK_L', label: 'Back L' }, { key: 'HIP', label: 'HIP' }, { key: 'PAKKA', label: 'Pakka' },
  { key: 'SHOULDER', label: 'Shoulder' }, { key: 'BACKNECK', label: 'Back Neck' }, { key: 'CHEST', label: 'Chest' },
  { key: 'FRONT_NECK', label: 'Front Neck' }, { key: 'FRONT_LEN', label: 'Front Len' },
];

function useMeasurementOrder() {
  const [measOrder, setMeasOrderState] = useState(() => {
    const saved = localStorage.getItem('measurementOrder');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const validKeys = new Set(DEFAULT_MEAS.map(m => m.key));
        const filtered = parsed.filter(m => validKeys.has(m.key));
        const missing = DEFAULT_MEAS.filter(m => !parsed.find(p => p.key === m.key));
        return [...filtered, ...missing];
      } catch (e) { return DEFAULT_MEAS; }
    }
    return DEFAULT_MEAS;
  });

  const setMeasOrder = (newOrder) => {
    setMeasOrderState(newOrder);
    localStorage.setItem('measurementOrder', JSON.stringify(newOrder));
  };

  return [measOrder, setMeasOrder];
}

// ── Main QuickEntryTable ────────────────────────────────────────────────────
export default function QuickEntryTable({ orderId, items = [], onAdd, onUpdate, onDelete, onOpenDesignModal, onImageUpload, adding }) {
  const [measOrder, setMeasOrder] = useMeasurementOrder();

  const handleKeyDown = (e) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const el = e.target;
    const tag = el.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return;

    const isUpDown = e.key === 'ArrowUp' || e.key === 'ArrowDown';
    const isLeftRight = e.key === 'ArrowLeft' || e.key === 'ArrowRight';

    // For textarea: Up/Down should only navigate fields when cursor is at very start/end line
    if (tag === 'TEXTAREA' && isUpDown) {
      const val = el.value || '';
      const pos = el.selectionStart;
      if (e.key === 'ArrowUp' && pos !== 0) return;      // not at top
      if (e.key === 'ArrowDown' && pos !== val.length) return; // not at bottom
    }

    // For Left/Right, only navigate to next field when cursor is at text boundary
    if (isLeftRight) {
      if (e.key === 'ArrowLeft' && el.selectionStart > 0) return;
      if (e.key === 'ArrowRight' && el.selectionEnd < (el.value || '').length) return;
    }

    // Collect ALL focusable inputs/textareas/selects in the whole container (in DOM order)
    const all = Array.from(
      document.querySelectorAll('.quick-entry-container input:not([disabled]):not([type="file"]):not([type="checkbox"]), .quick-entry-container textarea:not([disabled]), .quick-entry-container select:not([disabled])')
    );
    const index = all.indexOf(el);
    if (index === -1) return;

    let nextIndex = index;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIndex = index + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nextIndex = index - 1;

    if (nextIndex !== index && nextIndex >= 0 && nextIndex < all.length) {
      e.preventDefault();
      const nextEl = all[nextIndex];
      nextEl.focus();
      // Select content for inputs so you can type immediately
      if (nextEl.tagName === 'INPUT' || nextEl.tagName === 'TEXTAREA') {
        try { nextEl.select(); } catch (_) {}
      }
    }
  };

  return (
    <div className="space-y-5 quick-entry-container" onKeyDown={handleKeyDown}>
      {/* ── Add item panel (always at top) ── */}
      <div className="card p-4">
        <div className="flex items-center gap-4 mb-3">
          <button 
            onClick={() => onAdd('CUSTOM_ITEM')} 
            disabled={adding}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-50 border border-brand-200 text-brand-700 hover:bg-brand-100 hover:border-brand-300 transition-all font-bold text-sm disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {adding ? 'Adding…' : 'Add Item'}
          </button>
          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Or select preset:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {ITEM_TYPES.filter(t => t.value !== 'CUSTOM_ITEM').map(t => (
            <button key={t.value}
              onClick={() => onAdd(t.value)}
              disabled={adding}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface-elevated border border-surface-border text-gray-700 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700 transition-all disabled:opacity-50">
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Item cards ── */}
      {items.length === 0 && (
        <div className="card p-8 text-center text-gray-400">
          <p className="text-sm">No items added yet. Click an item type above to start.</p>
        </div>
      )}
      {items.map((item, idx) => {
        const theme = THEMES[idx % THEMES.length];
        return (
          <ItemCard
            key={item.id}
            item={item}
            rowIndex={idx + 1}
            theme={theme}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onOpenDesignModal={onOpenDesignModal}
            onImageUpload={onImageUpload}
            orderId={orderId}
            measOrder={measOrder}
            setMeasOrder={setMeasOrder}
          />
        );
      })}
    </div>
  );
}