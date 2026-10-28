import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Barcode, Printer, Tag, Package, Calendar, IndianRupee, Layers } from 'lucide-react';
import Modal from '../../components/UI/Modal';
import { format } from 'date-fns';

export default function ScannedProductModal({ product, onClose, onPrint }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (svgRef.current && product?.barcode) {
      try {
        JsBarcode(svgRef.current, product.barcode, {
          format: 'CODE128',
          lineColor: '#111827',
          width: 1.6,
          height: 48,
          displayValue: true,
          fontSize: 12,
          font: 'monospace',
          textMargin: 3,
          margin: 6,
        });
      } catch (e) {}
    }
  }, [product]);

  if (!product) return null;

  return (
    <Modal title="Scanned Product Details" onClose={onClose} size="max-w-lg">
      <div className="space-y-6">
        {/* Top Highlight Banner */}
        <div className="p-4 rounded-2xl bg-gradient-brand text-white shadow-brand flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-pink-100 font-semibold">
              Product Found
            </div>
            <h2 className="text-xl font-bold mt-0.5">{product.name}</h2>
            <div className="text-xs text-pink-100 mt-1 font-mono">
              Barcode: {product.barcode}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-pink-100">Price</div>
            <div className="text-2xl font-extrabold mt-0.5">
              ₹ {Number(product.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Barcode Sticker Preview Box */}
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-center">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Scanned Barcode
          </div>
          <div className="bg-white p-2 rounded-lg inline-block border border-gray-200 shadow-sm">
            <svg ref={svgRef}></svg>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 bg-surface-elevated border border-surface-border rounded-xl">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Layers className="w-3.5 h-3.5 text-brand-500" /> Quantity Available
            </div>
            <div className="text-lg font-bold text-gray-900">
              {product.quantity}
            </div>
          </div>

          <div className="p-3.5 bg-surface-elevated border border-surface-border rounded-xl">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Tag className="w-3.5 h-3.5 text-brand-500" /> Category
            </div>
            <div className="text-lg font-bold text-gray-900 truncate">
              {product.category || '—'}
            </div>
          </div>

          <div className="p-3.5 bg-surface-elevated border border-surface-border rounded-xl">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <IndianRupee className="w-3.5 h-3.5 text-brand-500" /> Total Stock Value
            </div>
            <div className="text-lg font-bold text-gray-900">
              ₹ {(Number(product.price) * Number(product.quantity)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-3.5 bg-surface-elevated border border-surface-border rounded-xl">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Calendar className="w-3.5 h-3.5 text-brand-500" /> Added Date
            </div>
            <div className="text-sm font-semibold text-gray-700 mt-1">
              {product.createdAt ? format(new Date(product.createdAt), 'dd MMM yyyy') : '—'}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-surface-border">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            Close
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              if (onPrint) onPrint(product);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Printer className="w-4 h-4" /> Print Barcode Label
          </button>
        </div>
      </div>
    </Modal>
  );
}
