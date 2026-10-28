import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer } from 'lucide-react';
import Modal from '../../components/UI/Modal';

export default function BarcodePrintModal({ product, onClose }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (svgRef.current && product?.barcode) {
      try {
        JsBarcode(svgRef.current, product.barcode, {
          format: 'CODE128',
          lineColor: '#000000',
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 14,
          font: 'monospace',
          textMargin: 4,
          margin: 10,
        });
      } catch (e) {
        console.error('Barcode generation error:', e);
      }
    }
  }, [product]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=500,height=500');
    if (!printWindow) return;

    const svgContent = svgRef.current ? svgRef.current.outerHTML : '';
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Barcode - ${product.name}</title>
          <style>
            @page {
              size: auto;
              margin: 4mm;
            }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 10px;
              margin: 0;
            }
            .label-card {
              border: 1px dashed #444;
              padding: 12px 16px;
              text-align: center;
              width: 240px;
              border-radius: 6px;
            }
            .shop-title {
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 3px;
            }
            .product-name {
              font-size: 14px;
              font-weight: 600;
              margin-bottom: 2px;
              word-break: break-word;
            }
            .price-tag {
              font-size: 16px;
              font-weight: 800;
              margin-top: 4px;
            }
            svg {
              max-width: 100%;
              height: auto;
            }
          </style>
        </head>
        <body>
          <div class="label-card">
            <div class="shop-title">Timelines Costume Designers</div>
            <div class="product-name">${product.name}</div>
            ${svgContent}
            <div class="price-tag">₹ ${Number(product.price).toFixed(2)}</div>
          </div>
          <script>
            window.onload = function() {
              window.focus();
              window.print();
              setTimeout(() => { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Modal title="Product Barcode Label" onClose={onClose} size="max-w-md">
      <div className="space-y-6">
        {/* Visual Sticker Preview */}
        <div className="flex flex-col items-center justify-center p-6 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl text-center">
          <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-1">
            Timelines Costume Designers
          </div>
          <div className="text-base font-bold text-gray-900 mb-2">
            {product.name}
          </div>

          <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
            <svg ref={svgRef}></svg>
          </div>

          <div className="text-xl font-extrabold text-brand-500 mt-3">
            ₹ {Number(product.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Stock Qty: <span className="font-semibold text-gray-800">{product.quantity}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">
            Close
          </button>
          <button type="button" onClick={handlePrint} className="btn-primary">
            <Printer className="w-4 h-4" /> Print Barcode Sticker
          </button>
        </div>
      </div>
    </Modal>
  );
}
