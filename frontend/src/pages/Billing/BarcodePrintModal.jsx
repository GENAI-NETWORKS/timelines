import { Printer, QrCode } from 'lucide-react';
import Modal from '../../components/UI/Modal';
import QrCodeView from './QrCodeView';
import { createQrSvgString } from './qrCodeGenerator';

export default function BarcodePrintModal({ product, onClose }) {
  if (!product) return null;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=500,height=500');
    if (!printWindow) return;

    const qrSvgContent = createQrSvgString(product.barcode, { size: 130, margin: 1 });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print QR Code - ${product.name}</title>
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
              padding: 14px 18px;
              text-align: center;
              width: 240px;
              border-radius: 8px;
            }
            .shop-title {
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
            }
            .product-name {
              font-size: 14px;
              font-weight: 600;
              margin-bottom: 6px;
              word-break: break-word;
            }
            .qr-wrapper {
              margin: 6px auto;
              display: flex;
              justify-content: center;
            }
            .product-code {
              font-family: monospace;
              font-size: 12px;
              font-weight: 700;
              color: #333;
              margin-top: 4px;
            }
            .price-tag {
              font-size: 16px;
              font-weight: 800;
              margin-top: 6px;
            }
          </style>
        </head>
        <body>
          <div class="label-card">
            <div class="shop-title">Timelines Costume Designers</div>
            <div class="product-name">${product.name}</div>
            <div class="qr-wrapper">${qrSvgContent}</div>
            <div class="product-code">${product.barcode}</div>
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
    <Modal title="Product QR Code Label" onClose={onClose} size="max-w-md">
      <div className="space-y-6">
        {/* Visual Sticker Preview */}
        <div className="flex flex-col items-center justify-center p-6 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl text-center">
          <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-1">
            Timelines Costume Designers
          </div>
          <div className="text-base font-bold text-gray-900 mb-2">
            {product.name}
          </div>

          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200">
            <QrCodeView value={product.barcode} size={120} margin={1} />
          </div>

          <div className="font-mono text-xs font-bold text-gray-700 mt-2">
            {product.barcode}
          </div>

          <div className="text-xl font-extrabold text-brand-500 mt-2">
            ₹ {Number(product.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Quantity: <span className="font-semibold text-gray-800">{product.quantity}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">
            Close
          </button>
          <button type="button" onClick={handlePrint} className="btn-primary">
            <Printer className="w-4 h-4" /> Print QR Sticker
          </button>
        </div>
      </div>
    </Modal>
  );
}
