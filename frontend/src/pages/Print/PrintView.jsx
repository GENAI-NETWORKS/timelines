import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, Loader, Search } from 'lucide-react';
import { getDesignOrders, getDesignOrder } from '../../api/designOrders';
import { format } from 'date-fns';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function PrintView() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(orderId || '');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getDesignOrders({ limit: 200 }).then(r => setOrders(r.data.orders)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) { setOrder(null); return; }
    setLoading(true);
    getDesignOrder(selected).then(r => setOrder(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [selected]);

  const measurements = order?.measurements || {};

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Controls - hidden on print */}
      <div className="no-print flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Print Design Sheet</h1>
          <p className="text-sm text-gray-500">No personal information will appear on the printout.</p>
        </div>
        <div className="sm:ml-auto flex gap-3 items-center">
          <select className="select w-auto min-w-[250px]" value={selected} onChange={e => setSelected(e.target.value)}>
            <option value="">Select order to print…</option>
            {orders.map(o => <option key={o.orderId} value={o.orderId}>{o.orderId} - {o.customer?.name || o.customerId} - {o.garmentType}</option>)}
          </select>
          <button
            onClick={() => window.print()}
            disabled={!order}
            className="btn-primary disabled:opacity-50"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      {loading && <div className="text-center py-20"><Loader className="w-8 h-8 text-brand-400 animate-spin mx-auto" /></div>}

      {!loading && !order && (
        <div className="card p-12 text-center text-gray-500">
          <Printer className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Select an order above to preview the print sheet.</p>
        </div>
      )}

      {/* Print-ready design sheet */}
      {order && (
        <div
          id="print-sheet"
          className="card p-8 max-w-3xl mx-auto print:shadow-none print:border-gray-300 print:bg-white print:text-black"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-6 pb-5 border-b border-surface-border print:border-gray-300">
            <div>
              <h2 className="font-display font-bold text-2xl text-white print:text-black">Timelines Costume Designers</h2>
              <p className="text-gray-400 text-sm print:text-gray-600">Design Work Sheet</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 print:text-gray-500">Printed: {format(new Date(), 'dd MMM yyyy')}</p>
            </div>
          </div>

          {/* Order info - NO customer name/phone/address */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="card-glass print:bg-gray-50 print:border-gray-200 p-4 rounded-xl">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Customer ID</p>
              <p className="font-mono font-bold text-brand-400 text-lg print:text-purple-700">{order.customerId}</p>
            </div>
            <div className="card-glass print:bg-gray-50 print:border-gray-200 p-4 rounded-xl">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Order ID</p>
              <p className="font-mono font-bold text-white text-lg print:text-black">{order.orderId}</p>
            </div>
            <div className="card-glass print:bg-gray-50 print:border-gray-200 p-4 rounded-xl">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Garment Type</p>
              <p className="font-bold text-white print:text-black">{order.garmentType}</p>
            </div>
            <div className="card-glass print:bg-gray-50 print:border-gray-200 p-4 rounded-xl">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Delivery Date</p>
              <p className="font-bold text-white print:text-black">
                {order.deliveryDate ? format(new Date(order.deliveryDate), 'dd MMMM yyyy') : '-'}
              </p>
            </div>
            <div className="card-glass print:bg-gray-50 print:border-gray-200 p-4 rounded-xl">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Order Date</p>
              <p className="text-white print:text-black">{order.orderDate ? format(new Date(order.orderDate), 'dd MMMM yyyy') : '-'}</p>
            </div>
            <div className="card-glass print:bg-gray-50 print:border-gray-200 p-4 rounded-xl">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Assigned Tailor</p>
              <p className="text-white print:text-black">{order.tailor?.name || order.assignedTailorId?.name || '-'}</p>
            </div>
          </div>

          {/* Measurements table */}
          {Object.keys(measurements).length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-white print:text-black mb-3 text-base">Measurements</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(measurements).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between bg-surface-elevated print:bg-gray-50 rounded-lg px-3 py-2 text-sm">
                    <span className="text-gray-400 print:text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className="font-semibold text-white print:text-black">{val}"</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Design Sketch */}
          {order.designSketchUrl && (
            <div className="mb-6">
              <h3 className="font-semibold text-white print:text-black mb-3 text-base">Design Sketch</h3>
              <div className="border border-surface-border print:border-gray-300 rounded-xl overflow-hidden">
                <img src={order.designSketchUrl} alt="Design sketch" className="w-full max-h-80 object-contain bg-surface print:bg-white" />
              </div>
            </div>
          )}

          {/* Fabric Notes */}
          {order.fabricNotes && (
            <div className="mb-4">
              <h3 className="font-semibold text-white print:text-black mb-2 text-base">Fabric Notes</h3>
              <div className="bg-surface-elevated print:bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-200 print:text-gray-700">
                {order.fabricNotes}
              </div>
            </div>
          )}

          {/* Special Instructions */}
          {order.specialInstructions && (
            <div className="mb-4">
              <h3 className="font-semibold text-white print:text-black mb-2 text-base">Special Instructions</h3>
              <div className="bg-amber-900/20 border border-amber-700/30 print:bg-amber-50 print:border-amber-300 rounded-xl px-4 py-3 text-sm text-amber-200 print:text-amber-900">
                {order.specialInstructions}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-surface-border print:border-gray-300 pt-4 mt-6 text-xs text-gray-500 print:text-gray-500 flex justify-between">
            <span>Timelines Costume Designers</span>
            <span>⚠ Customer ID only - No PII printed</span>
          </div>
        </div>
      )}

      {/* Print style */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-sheet, #print-sheet * {
            visibility: visible;
          }
          #print-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            box-shadow: none;
            border: none;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
