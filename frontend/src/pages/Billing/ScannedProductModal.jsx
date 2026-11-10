import { Tag, Calendar, IndianRupee, Layers, FileText, Printer, QrCode } from 'lucide-react';
import Modal from '../../components/UI/Modal';
import QrCodeView from './QrCodeView';
import { getProductStickerUrl } from './billUtils';
import { format } from 'date-fns';

export default function ScannedProductModal({ product, onClose, onPrint, onAddToBill }) {
  if (!product) return null;

  const stickerUrl = getProductStickerUrl(product);

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
              Item Code: {product.barcode}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-pink-100">Price</div>
            <div className="text-2xl font-extrabold mt-0.5">
              ₹ {Number(product.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* QR Code Sticker Preview Box */}
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-center">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 flex items-center justify-center gap-1.5">
            <QrCode className="w-4 h-4 text-brand-600" /> Scanned QR Code
          </div>
          <div className="bg-white p-3 rounded-xl inline-block border border-gray-200 shadow-sm">
            <QrCodeView value={stickerUrl} size={130} margin={4} />
            <div className="font-mono text-xs font-bold text-gray-700 mt-2">
              {product.barcode}
            </div>
            <div className="text-[10px] text-brand-600 mt-0.5">
              Scan to view bill
            </div>
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
        <div className="flex items-center justify-between pt-4 border-t border-surface-border gap-2 flex-wrap">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onAddToBill) onAddToBill(product);
              }}
              className="btn bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 shadow-sm"
            >
              <FileText className="w-4 h-4" /> Add to Bill
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                if (onPrint) onPrint(product);
              }}
              className="btn-primary flex items-center gap-2"
            >
              <Printer className="w-4 h-4" /> Print QR Code Label
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
