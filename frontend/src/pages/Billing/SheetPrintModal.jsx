import { useState, useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer, Plus, Minus, Check, CheckSquare, Square, X, Trash2, SlidersHorizontal } from 'lucide-react';
import Modal from '../../components/UI/Modal';

// Mini barcode canvas for individual sticker preview
function LabelBarcodeSvg({ barcode }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (svgRef.current && barcode) {
      try {
        JsBarcode(svgRef.current, barcode, {
          format: 'CODE128',
          lineColor: '#000000',
          width: 1.2,
          height: 32,
          displayValue: true,
          fontSize: 10,
          font: 'monospace',
          textMargin: 2,
          margin: 4,
        });
      } catch (e) {
        console.error('Barcode render error:', e);
      }
    }
  }, [barcode]);

  return <svg ref={svgRef} className="max-w-full h-auto mx-auto" />;
}

export default function SheetPrintModal({ products, initialSelected = [], onClose }) {
  // Map of productId -> { count: number, selected: boolean }
  const [selections, setSelections] = useState(() => {
    const init = {};
    products.forEach((p) => {
      const isInit = initialSelected.length === 0 || initialSelected.includes(p.id);
      init[p.id] = {
        selected: isInit,
        count: isInit ? 1 : 1, // default 1 sticker copy
      };
    });
    return init;
  });

  const [shopName, setShopName] = useState('TIMELINES COSTUME DESIGNERS');
  const [includePrice, setIncludePrice] = useState(true);

  // Build the list of stickers to be printed
  const stickerList = [];
  products.forEach((p) => {
    const sel = selections[p.id];
    if (sel && sel.selected && sel.count > 0) {
      for (let i = 0; i < sel.count; i++) {
        stickerList.push(p);
      }
    }
  });

  const totalStickers = stickerList.length;
  const sheetCapacity = 20; // 4 columns x 5 rows
  const numSheets = Math.ceil(totalStickers / sheetCapacity) || 1;

  // Toggle selection for a product
  const toggleSelect = (id) => {
    setSelections((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        selected: !prev[id]?.selected,
      },
    }));
  };

  // Adjust print copy count
  const changeCount = (id, delta) => {
    setSelections((prev) => {
      const current = prev[id]?.count || 1;
      const nextCount = Math.max(1, current + delta);
      return {
        ...prev,
        [id]: {
          ...prev[id],
          count: nextCount,
          selected: true, // auto select if incrementing
        },
      };
    });
  };

  // Select all / Deselect all
  const selectAll = () => {
    setSelections((prev) => {
      const updated = {};
      Object.keys(prev).forEach((id) => {
        updated[id] = { ...prev[id], selected: true };
      });
      return updated;
    });
  };

  const deselectAll = () => {
    setSelections((prev) => {
      const updated = {};
      Object.keys(prev).forEach((id) => {
        updated[id] = { ...prev[id], selected: false };
      });
      return updated;
    });
  };

  // Native Print Handler generating clean 4x5 A4 grid
  const handlePrint = () => {
    if (stickerList.length === 0) return;

    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (!printWindow) return;

    // Helper to render SVGs into strings using JsBarcode in temporary elements
    const renderBarcodesHtml = () => {
      return stickerList.map((product) => {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        try {
          JsBarcode(tempSvg, product.barcode, {
            format: 'CODE128',
            lineColor: '#000000',
            width: 1.4,
            height: 38,
            displayValue: true,
            fontSize: 10,
            font: 'monospace',
            textMargin: 2,
            margin: 4,
          });
        } catch (e) {}

        return `
          <div class="sticker-cell">
            <div class="shop-name">${shopName}</div>
            <div class="product-title">${product.name}</div>
            <div class="barcode-wrapper">${tempSvg.outerHTML}</div>
            ${includePrice ? `<div class="product-price">₹ ${Number(product.price).toFixed(2)}</div>` : ''}
          </div>
        `;
      }).join('');
    };

    const stickersHtml = renderBarcodesHtml();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Barcode Sheet (4x5 Grid)</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm 6mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              margin: 0;
              padding: 0;
              background: #fff;
              color: #000;
            }
            /* 4 Columns x 5 Rows Grid = 20 stickers per page */
            .sheet-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 4mm 4mm;
              width: 100%;
            }
            .sticker-cell {
              border: 1px dashed #777;
              border-radius: 4px;
              padding: 4px 6px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              height: 52mm; /* ~5 rows on A4 (297mm height) */
              overflow: hidden;
              page-break-inside: avoid;
            }
            .shop-name {
              font-size: 8px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #333;
              margin-bottom: 2px;
            }
            .product-title {
              font-size: 11px;
              font-weight: 700;
              line-height: 1.2;
              max-height: 2.4em;
              overflow: hidden;
              text-overflow: ellipsis;
              word-break: break-word;
              margin-bottom: 2px;
            }
            .barcode-wrapper svg {
              max-width: 95%;
              height: auto;
              margin: 0 auto;
              display: block;
            }
            .product-price {
              font-size: 12px;
              font-weight: 800;
              color: #000;
              margin-top: 2px;
            }
          </style>
        </head>
        <body>
          <div class="sheet-grid">
            ${stickersHtml}
          </div>
          <script>
            window.onload = function() {
              window.focus();
              window.print();
              setTimeout(() => { window.close(); }, 600);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Modal title="Barcode Sheet Print (4 Columns × 5 Rows)" onClose={onClose} size="max-w-4xl">
      <div className="space-y-6">

        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-surface-elevated border border-surface-border">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-900">
              Total Stickers: <span className="text-brand-600 font-bold text-base">{totalStickers}</span>
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 font-medium border border-brand-200">
              {numSheets} A4 {numSheets === 1 ? 'Sheet' : 'Sheets'} (4×5 Grid = 20 / sheet)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="btn btn-secondary text-xs"
            >
              <CheckSquare className="w-3.5 h-3.5" /> Select All
            </button>
            <button
              type="button"
              onClick={deselectAll}
              className="btn btn-secondary text-xs"
            >
              <Square className="w-3.5 h-3.5" /> Deselect All
            </button>
          </div>
        </div>

        {/* Product selection list */}
        <div className="border border-surface-border rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-4 py-2.5 border-b border-surface-border flex items-center justify-between text-xs font-semibold text-gray-600 uppercase tracking-wider">
            <span>Include in Print Sheet</span>
            <span>Copies / Stickers</span>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-surface-border">
            {products.map((p) => {
              const isSelected = selections[p.id]?.selected;
              const count = selections[p.id]?.count || 1;

              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-4 py-3 transition-colors ${
                    isSelected ? 'bg-white' : 'bg-gray-50/70 opacity-60'
                  }`}
                >
                  {/* Left: Checkbox + info */}
                  <div
                    onClick={() => toggleSelect(p.id)}
                    className="flex items-center gap-3 cursor-pointer flex-1 min-w-0 mr-4"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(isSelected)}
                      onChange={() => {}}
                      className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-gray-900 truncate">
                        {p.name}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <span className="font-mono text-brand-600">{p.barcode}</span>
                        <span>·</span>
                        <span className="font-medium text-gray-700">₹ {Number(p.price).toFixed(2)}</span>
                        <span>·</span>
                        <span>Quantity: {p.quantity}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Copy quantity adjuster */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-500 mr-1">Copies:</span>
                    <button
                      type="button"
                      onClick={() => changeCount(p.id, -1)}
                      className="w-7 h-7 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 flex items-center justify-center text-gray-700 disabled:opacity-40"
                      disabled={count <= 1}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center font-bold text-sm text-gray-900">
                      {count}
                    </span>
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

        {/* Live A4 4x5 Sheet Preview */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Sheet Layout Preview (4 Columns × 5 Rows per A4)
            </h4>
            <span className="text-xs text-gray-500">
              {totalStickers === 0 ? 'No barcodes selected' : `Showing first 20 stickers of sheet 1`}
            </span>
          </div>

          <div className="bg-gray-100 p-4 rounded-xl border border-dashed border-gray-300">
            {totalStickers === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">
                Please select at least one product above to generate stickers.
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                {stickerList.slice(0, 20).map((product, idx) => (
                  <div
                    key={`${product.id}-${idx}`}
                    className="border border-dashed border-gray-400 rounded p-2 text-center flex flex-col justify-between h-32 bg-gray-50/50"
                  >
                    <div>
                      <div className="text-[7px] font-bold text-gray-500 uppercase tracking-tight truncate">
                        {shopName}
                      </div>
                      <div className="text-[10px] font-bold text-gray-900 leading-tight truncate mt-0.5">
                        {product.name}
                      </div>
                    </div>

                    <div className="my-0.5">
                      <LabelBarcodeSvg barcode={product.barcode} />
                    </div>

                    {includePrice && (
                      <div className="text-[11px] font-extrabold text-gray-900">
                        ₹ {Number(product.price).toFixed(2)}
                      </div>
                    )}
                  </div>
                ))}

                {/* Show empty placeholder cells to visually highlight 4x5 grid */}
                {Array.from({ length: Math.max(0, 20 - stickerList.slice(0, 20).length) }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="border border-dashed border-gray-200 rounded p-2 text-center flex items-center justify-center h-32 text-[10px] text-gray-300 italic"
                  >
                    Empty Slot {stickerList.slice(0, 20).length + i + 1}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-surface-border">
          <div className="text-xs text-gray-500">
            Tip: Fits 20 sticker labels per standard A4 sheet without paper waste.
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Close
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={totalStickers === 0}
              className="btn-primary"
            >
              <Printer className="w-4 h-4" /> Print {totalStickers} Barcode Stickers ({numSheets} A4 {numSheets === 1 ? 'Sheet' : 'Sheets'})
            </button>
          </div>
        </div>

      </div>
    </Modal>
  );
}
