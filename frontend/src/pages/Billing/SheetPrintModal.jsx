import { useState } from 'react';
import { Printer, Plus, Minus, QrCode, Type } from 'lucide-react';
import Modal from '../../components/UI/Modal';
import QrCodeView from './QrCodeView';
import { createQrSvgString } from './qrCodeGenerator';
import { getProductStickerUrl } from './billUtils';

// Grid presets
const GRID_PRESETS = [
  { label: '1 × 1  (Full Page)', cols: 1, rows: 1 },
  { label: '2 × 2  (Large)',     cols: 2, rows: 2 },
  { label: '2 × 4  (Medium)',    cols: 2, rows: 4 },
  { label: '3 × 4  (Standard)', cols: 3, rows: 4 },
  { label: '4 × 5  (Small)',     cols: 4, rows: 5 },
  { label: '5 × 8  (Mini)',      cols: 5, rows: 8 },
];

// Font size presets — multiplier applied to base font sizes
const FONT_PRESETS = [
  { label: 'Tiny',   scale: 0.70 },
  { label: 'Small',  scale: 0.85 },
  { label: 'Normal', scale: 1.00 },
  { label: 'Large',  scale: 1.25 },
  { label: 'XL',     scale: 1.55 },
];

// Base font sizes (px) at scale=1
const BASE_FONTS = { shop: 8, title: 11, code: 9, price: 12 };

function scaledFonts(scale) {
  return {
    shop:  Math.round(BASE_FONTS.shop  * scale),
    title: Math.round(BASE_FONTS.title * scale),
    code:  Math.round(BASE_FONTS.code  * scale),
    price: Math.round(BASE_FONTS.price * scale),
  };
}

// QR size in px for the print window scales with cell area
function qrPrintPx(cols, rows) {
  const cellW = Math.floor((198 - (cols - 1) * 4) / cols);
  const cellH = Math.floor((281 - (rows - 1) * 4) / rows);
  const cellMin = Math.min(cellW, cellH);
  const qrMm = Math.floor(cellMin * 0.58);
  return Math.max(40, Math.min(qrMm * 3.78, 300));
}

// Preview QR size (px) scales for the on-screen grid
function qrPreviewPx(cols) {
  if (cols === 1) return 110;
  if (cols === 2) return 80;
  if (cols === 3) return 60;
  if (cols === 4) return 48;
  return 36;
}

// Preview cell height (px) scales with grid
function cellPreviewH(cols, rows) {
  if (cols === 1 && rows === 1) return 240;
  if (cols <= 2) return 180;
  if (cols <= 3) return 150;
  return 136;
}

export default function SheetPrintModal({ products, initialSelected = [], onClose }) {
  // Selections map: productId → { count, selected }
  const [selections, setSelections] = useState(() => {
    const init = {};
    products.forEach((p) => {
      const isInit = initialSelected.length === 0 || initialSelected.includes(p.id);
      init[p.id] = { selected: isInit, count: 1 };
    });
    return init;
  });

  const [shopName, setShopName] = useState('TIMELINES COSTUME DESIGNERS');
  const [includePrice, setIncludePrice] = useState(true);

  // Grid layout state — default 4 × 5
  const [cols, setCols] = useState(4);
  const [rows, setRows] = useState(5);

  // Font size scale — default Normal (1.0)
  const [fontScale, setFontScale] = useState(1.00);

  const sheetCapacity = cols * rows;

  // Build sticker list
  const stickerList = [];
  products.forEach((p) => {
    const sel = selections[p.id];
    if (sel?.selected && sel.count > 0) {
      for (let i = 0; i < sel.count; i++) stickerList.push(p);
    }
  });

  const totalStickers = stickerList.length;
  const numSheets = Math.ceil(totalStickers / sheetCapacity) || 1;
  const previewCount = Math.min(totalStickers, sheetCapacity);

  // --- Helpers ---
  const toggleSelect = (id) =>
    setSelections((prev) => ({ ...prev, [id]: { ...prev[id], selected: !prev[id]?.selected } }));

  const changeCount = (id, delta) =>
    setSelections((prev) => ({
      ...prev,
      [id]: { ...prev[id], count: Math.max(1, (prev[id]?.count || 1) + delta), selected: true },
    }));

  const selectAll = () =>
    setSelections((prev) => {
      const updated = {};
      products.forEach((p) => { updated[p.id] = { count: prev[p.id]?.count || 1, selected: true }; });
      return updated;
    });

  const deselectAll = () =>
    setSelections((prev) => {
      const updated = {};
      Object.keys(prev).forEach((id) => { updated[id] = { ...prev[id], selected: false }; });
      return updated;
    });

  const applyPreset = ({ cols: c, rows: r }) => { setCols(c); setRows(r); };

  const clampCols = (v) => Math.max(1, Math.min(6, v));
  const clampRows = (v) => Math.max(1, Math.min(10, v));

  // --- Print ---
  const handlePrint = () => {
    if (stickerList.length === 0) return;

    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (!printWindow) return;

    const qrPx = qrPrintPx(cols, rows);
    const f = scaledFonts(fontScale);

    const stickersHtml = stickerList.map((product) => {
      const qrSvg = createQrSvgString(getProductStickerUrl(product), { size: Math.round(qrPx), margin: 4, ecLevel: 'L' });
      return `
        <div class="sticker-cell">
          <div class="shop-name">${shopName}</div>
          <div class="product-title">${product.name}</div>
          <div class="qrcode-wrapper">${qrSvg}</div>
          <div class="product-code">${product.barcode || ''}</div>
          ${includePrice ? `<div class="product-price">₹ ${Number(product.price).toFixed(2)}</div>` : ''}
        </div>`;
    }).join('');

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Print QR Code Sheet (${cols}×${rows} Grid)</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 6mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
           margin: 0; padding: 0; background: #fff; color: #000; }
    .sheet-grid {
      display: grid;
      grid-template-columns: repeat(${cols}, 1fr);
      gap: 4mm;
      width: 100%;
    }
    .sticker-cell {
      border: 1px dashed #777;
      border-radius: 5px;
      padding: 5px 4px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .shop-name   { font-size: ${f.shop}px; font-weight: 700; text-transform: uppercase;
                   letter-spacing: 0.4px; color: #444; margin-bottom: 2px; }
    .product-title { font-size: ${f.title}px; font-weight: 700; line-height: 1.2;
                     overflow: hidden; text-overflow: ellipsis; word-break: break-word;
                     max-height: ${f.title * 2.6}px; margin-bottom: 2px; }
    .qrcode-wrapper { display: flex; justify-content: center; margin: 3px 0; }
    .qrcode-wrapper svg { display: block; max-width: 100%; height: auto; }
    .product-code { font-family: monospace; font-size: ${f.code}px; font-weight: 600;
                    color: #333; letter-spacing: 0.5px; }
    .product-price { font-size: ${f.price}px; font-weight: 800; color: #000; margin-top: 1px; }
  </style>
</head>
<body>
  <div class="sheet-grid">${stickersHtml}</div>
  <script>
    window.onload = function() { window.focus(); window.print(); setTimeout(() => { window.close(); }, 600); };
  </script>
</body>
</html>`);
    printWindow.document.close();
  };

  const selectedCount = Object.values(selections).filter((s) => s.selected).length;
  const previewQrPx   = qrPreviewPx(cols);
  const previewCellH  = cellPreviewH(cols, rows);

  // Grid style string for preview
  const previewGridCols = `grid-cols-${Math.min(cols, 6)}`;

  return (
    <Modal title="Print QR Code Stickers" onClose={onClose} size="max-w-4xl">
      <div className="space-y-5">

        {/* ── Top Summary Bar ── */}
        <div className="p-4 bg-brand-50 border border-brand-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-brand-600 uppercase tracking-wider">Sheet Print Summary</div>
            <div className="text-lg font-bold text-gray-900 mt-0.5">
              {totalStickers} <span className="text-sm font-normal text-gray-600">stickers ready</span>
              <span className="mx-2 text-gray-300">|</span>
              {numSheets} <span className="text-sm font-normal text-gray-600">{numSheets === 1 ? 'A4 Sheet' : 'A4 Sheets'}</span>
              <span className="mx-2 text-gray-300">|</span>
              <span className="text-sm font-normal text-gray-600">{sheetCapacity} per sheet</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">{selectedCount} of {products.length} products included</div>
          </div>

          {/* Shop name + Include Price */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div>
              <label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider block mb-1">
                Shop Title on Sticker
              </label>
              <input
                type="text"
                className="input py-1.5 px-3 text-xs w-52"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
              />
            </div>
            <div className="sm:pt-5">
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={includePrice}
                  onChange={(e) => setIncludePrice(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                Include Price
              </label>
            </div>
          </div>
        </div>

        {/* ── Grid Size Controls ── */}
        <div className="p-4 border border-surface-border rounded-xl bg-surface-elevated space-y-3">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-brand-500" />
            <span className="text-sm font-semibold text-gray-800">Sticker Grid Size</span>
            <span className="text-xs text-gray-400 ml-1">— fewer columns = bigger QR code</span>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap gap-2">
            {GRID_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                  cols === p.cols && rows === p.rows
                    ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-brand-400 hover:text-brand-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Manual Columns / Rows */}
          <div className="flex flex-wrap items-center gap-6 pt-1">
            {/* Columns */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600 w-20">Columns (1–6)</span>
              <button type="button" onClick={() => setCols(clampCols(cols - 1))} disabled={cols <= 1}
                className="w-7 h-7 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 flex items-center justify-center disabled:opacity-40">
                <span className="text-lg leading-none font-bold">−</span>
              </button>
              <span className="w-10 text-center font-bold text-base text-gray-900">{cols}</span>
              <button type="button" onClick={() => setCols(clampCols(cols + 1))} disabled={cols >= 6}
                className="w-7 h-7 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 flex items-center justify-center disabled:opacity-40">
                <span className="text-lg leading-none font-bold">+</span>
              </button>
            </div>

            {/* Rows */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600 w-20">Rows (1–10)</span>
              <button type="button" onClick={() => setRows(clampRows(rows - 1))} disabled={rows <= 1}
                className="w-7 h-7 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 flex items-center justify-center disabled:opacity-40">
                <span className="text-lg leading-none font-bold">−</span>
              </button>
              <span className="w-10 text-center font-bold text-base text-gray-900">{rows}</span>
              <button type="button" onClick={() => setRows(clampRows(rows + 1))} disabled={rows >= 10}
                className="w-7 h-7 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 flex items-center justify-center disabled:opacity-40">
                <span className="text-lg leading-none font-bold">+</span>
              </button>
            </div>

            <div className="text-xs text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
              <span className="font-semibold text-gray-700">{cols} × {rows}</span> = {sheetCapacity} stickers / A4
            </div>
          </div>
        </div>

        {/* ── Font Size Controls ── */}
        <div className="p-4 border border-surface-border rounded-xl bg-surface-elevated space-y-3">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-brand-500" />
            <span className="text-sm font-semibold text-gray-800">Text Size on Sticker</span>
            <span className="text-xs text-gray-400 ml-1">— applies to shop name, product title, code &amp; price</span>
          </div>

          {/* Font preset buttons */}
          <div className="flex flex-wrap gap-2 items-center">
            {FONT_PRESETS.map((fp) => (
              <button
                key={fp.label}
                type="button"
                onClick={() => setFontScale(fp.scale)}
                className={`px-4 py-1 rounded-lg text-xs font-semibold border transition-all ${
                  fontScale === fp.scale
                    ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-brand-400 hover:text-brand-700'
                }`}
                style={{ fontSize: `${Math.round(11 * fp.scale)}px` }}
              >
                {fp.label}
              </button>
            ))}
          </div>

          {/* Live font size preview chips */}
          <div className="flex flex-wrap gap-3 text-gray-500 text-[11px]">
            {(() => { const f = scaledFonts(fontScale); return (
              <>
                <span>Shop: <strong className="text-gray-700">{f.shop}px</strong></span>
                <span>·</span>
                <span>Title: <strong className="text-gray-700">{f.title}px</strong></span>
                <span>·</span>
                <span>Code: <strong className="text-gray-700">{f.code}px</strong></span>
                <span>·</span>
                <span>Price: <strong className="text-gray-700">{f.price}px</strong></span>
              </>
            ); })()}
          </div>
        </div>

        {/* ── Product Selection List ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-gray-900">Include In Print Sheet</h3>
            <div className="flex items-center gap-2">
              <button type="button" onClick={selectAll} className="btn-sm btn-ghost text-brand-600 text-xs">Select All</button>
              <button type="button" onClick={deselectAll} className="btn-sm btn-ghost text-gray-500 text-xs">Deselect All</button>
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto space-y-2 pr-1 border border-surface-border rounded-xl p-2 bg-surface-card">
            {products.map((p) => {
              const sel = selections[p.id];
              const isSelected = sel?.selected;
              const count = sel?.count || 1;
              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-lg border transition-all flex items-center justify-between gap-3 ${
                    isSelected ? 'bg-brand-50/40 border-brand-300' : 'bg-white border-gray-200 opacity-60 hover:opacity-100'
                  }`}
                >
                  <div onClick={() => toggleSelect(p.id)} className="flex items-center gap-3 cursor-pointer select-none flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={Boolean(isSelected)}
                      onChange={() => {}}
                      className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-gray-900 truncate">{p.name}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <span className="font-mono text-brand-600">{p.barcode}</span>
                        <span>·</span>
                        <span className="font-medium text-gray-700">₹ {Number(p.price).toFixed(2)}</span>
                        <span>·</span>
                        <span>Qty: {p.quantity}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-500">Copies:</span>
                    <button
                      type="button"
                      onClick={() => changeCount(p.id, -1)}
                      disabled={count <= 1}
                      className="w-7 h-7 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 flex items-center justify-center text-gray-700 disabled:opacity-40"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center font-bold text-sm text-gray-900">{count}</span>
                    <button
                      type="button"
                      onClick={() => changeCount(p.id, 1)}
                      className="w-7 h-7 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 flex items-center justify-center text-gray-700"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Live Preview ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Sheet Layout Preview
              <span className="ml-2 font-normal text-gray-400 normal-case">
                ({cols} col × {rows} row — {sheetCapacity} stickers/sheet)
              </span>
            </h4>
            <span className="text-xs text-gray-500">
              {totalStickers === 0 ? 'No products selected' : `Showing first ${previewCount} of sheet 1`}
            </span>
          </div>

          <div className="bg-gray-100 p-3 rounded-xl border border-dashed border-gray-300">
            {totalStickers === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">
                Select at least one product above to preview stickers.
              </div>
            ) : (
              <div
                className="bg-white p-3 rounded-lg shadow-sm border border-gray-200"
                style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: '8px' }}
              >
                {stickerList.slice(0, sheetCapacity).map((product, idx) => (
                  <div
                    key={`${product.id}-${idx}`}
                    className="border border-dashed border-gray-400 rounded p-1.5 text-center flex flex-col items-center justify-between bg-gray-50/50"
                    style={{ height: `${previewCellH}px` }}
                  >
                    <div className="w-full overflow-hidden">
                      <div className="text-[7px] font-bold text-gray-500 uppercase tracking-tight truncate">{shopName}</div>
                      <div className="text-[9px] font-bold text-gray-900 leading-tight truncate mt-0.5">{product.name}</div>
                    </div>
                    <div className="flex justify-center my-1 flex-shrink-0">
                      <QrCodeView value={getProductStickerUrl(product)} size={previewQrPx} margin={4} />
                    </div>
                    <div className="w-full overflow-hidden">
                      <div className="font-mono text-[8px] font-semibold text-gray-600 truncate">{product.barcode}</div>
                      {includePrice && (
                        <div className="text-[10px] font-extrabold text-gray-900 mt-0.5">
                          ₹ {Number(product.price).toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Empty slots to fill the first sheet */}
                {Array.from({ length: Math.max(0, sheetCapacity - stickerList.slice(0, sheetCapacity).length) }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="border border-dashed border-gray-200 rounded p-2 text-center flex items-center justify-center text-[9px] text-gray-300 italic"
                    style={{ height: `${previewCellH}px` }}
                  >
                    Empty {stickerList.slice(0, sheetCapacity).length + i + 1}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer Actions ── */}
        <div className="flex items-center justify-between pt-3 border-t border-surface-border">
          <div className="text-xs text-gray-500">
            Grid: <strong>{cols} × {rows}</strong> · {sheetCapacity} stickers/sheet · {numSheets} {numSheets === 1 ? 'sheet' : 'sheets'} to print
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Close</button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={totalStickers === 0}
              className="btn-primary"
            >
              <Printer className="w-4 h-4" />
              Print {totalStickers} Sticker{totalStickers !== 1 ? 's' : ''} ({numSheets} A4)
            </button>
          </div>
        </div>

      </div>
    </Modal>
  );
}
