import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  Receipt, Printer, CheckCircle2, ArrowLeft, Store, Calendar,
  CreditCard, User, IndianRupee, ShieldCheck
} from 'lucide-react';
import QrCodeView from './QrCodeView';
import { formatINR, numberToWordsIndian, decodeBillFromPayload } from './billUtils';

const HISTORY_KEY = 'timelines_billing_history';

export default function PublicBillView() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const encodedData = searchParams.get('d');

  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Try decoding from query param 'd'
    if (encodedData) {
      const decoded = decodeBillFromPayload(encodedData);
      if (decoded) {
        setBill(decoded);
        setLoading(false);
        return;
      }
    }

    // 2. Try looking up in localStorage history
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) {
        const historyList = JSON.parse(saved);
        const found = historyList.find((b) => b.billNo === id || b.billNo === decodeURIComponent(id || ''));
        if (found) {
          setBill(found);
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.error('History lookup error', e);
    }

    setLoading(false);
  }, [id, encodedData]);

  const items = bill?.items || [];
  const wordsTotal = useMemo(() => {
    return bill?.grandTotal ? numberToWordsIndian(bill.grandTotal) : '';
  }, [bill?.grandTotal]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading Bill Details…</p>
        </div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto">
            <Receipt className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Bill Not Found</h2>
          <p className="text-sm text-gray-500">
            Could not find bill details for Bill No: <span className="font-mono font-semibold">{id}</span>.
          </p>
          <div className="pt-2">
            <Link to="/billing" className="btn-primary inline-flex items-center gap-2 text-sm">
              <ArrowLeft className="w-4 h-4" /> Go to Billing System
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const billNo = bill.billNo || id;
  const store = bill.storeInfo || {
    name: 'TIMELINES COSTUME DESIGNERS',
    tagline: 'Boutique & Tailoring Studio',
    address: 'No. 12, Fashion Street, Main Road',
    phone: '+91 98765 43210',
    gstin: '33AAAAA0000A1Z5',
  };

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Top Floating Action Bar */}
        <div className="no-print flex items-center justify-between bg-white px-5 py-3 rounded-xl shadow-sm border border-gray-200">
          <Link
            to="/billing"
            className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1.5 font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" /> Verified Bill
            </span>
            <button
              onClick={handlePrint}
              className="btn-primary btn-sm flex items-center gap-1.5 shadow-sm"
            >
              <Printer className="w-4 h-4" /> Print Bill
            </button>
          </div>
        </div>

        {/* Printable Bill Document */}
        <div
          id="digital-bill"
          className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8 space-y-6 print:shadow-none print:border-none print:p-0"
        >
          {/* Store Header */}
          <div className="text-center pb-4 border-b border-gray-200">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-50 text-brand-600 mb-2">
              <Store className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">
              {store.name}
            </h1>
            {store.tagline && <p className="text-xs text-gray-500 font-medium">{store.tagline}</p>}
            {store.address && <p className="text-xs text-gray-500 mt-1">{store.address}</p>}
            <div className="flex items-center justify-center gap-4 text-xs text-gray-500 mt-1">
              {store.phone && <span>Ph: {store.phone}</span>}
              {store.gstin && <span className="font-semibold text-gray-700">GSTIN: {store.gstin}</span>}
            </div>
          </div>

          {/* Title & Metadata Card */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <div className="text-gray-400 font-medium uppercase tracking-wider text-[10px]">Bill No</div>
              <div className="font-mono font-bold text-gray-900 text-sm mt-0.5">{billNo}</div>
            </div>
            <div>
              <div className="text-gray-400 font-medium uppercase tracking-wider text-[10px]">Date & Time</div>
              <div className="font-medium text-gray-800 mt-0.5">
                {bill.date ? new Date(bill.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
              </div>
            </div>
            <div>
              <div className="text-gray-400 font-medium uppercase tracking-wider text-[10px]">Customer</div>
              <div className="font-semibold text-gray-900 mt-0.5">
                {bill.customerName || 'Walk-in Customer'}
              </div>
            </div>
            <div>
              <div className="text-gray-400 font-medium uppercase tracking-wider text-[10px]">Payment Mode</div>
              <div className="font-bold text-emerald-700 mt-0.5">
                {bill.paymentMode || 'CASH'}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-900 text-gray-700 text-xs uppercase tracking-wider">
                  <th className="py-2.5 text-left w-8">#</th>
                  <th className="py-2.5 text-left">Item Description</th>
                  <th className="py-2.5 text-center w-16">Qty</th>
                  <th className="py-2.5 text-right w-24">Rate</th>
                  <th className="py-2.5 text-right w-28">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((it, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="py-3 text-gray-400 font-mono text-xs">{idx + 1}</td>
                    <td className="py-3 font-medium text-gray-900">
                      <div>{it.name}</div>
                      {it.barcode && (
                        <span className="text-[10px] text-gray-400 font-mono">Code: {it.barcode}</span>
                      )}
                    </td>
                    <td className="py-3 text-center text-gray-800 font-semibold">{it.quantity}</td>
                    <td className="py-3 text-right text-gray-600 font-mono">₹ {formatINR(it.price)}</td>
                    <td className="py-3 text-right font-bold text-gray-900 font-mono">
                      ₹ {formatINR((Number(it.quantity) || 0) * (Number(it.price) || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className="border-t-2 border-gray-900 pt-4 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600 text-xs">
              <span>Total Items: {items.length} (Units: {items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0)})</span>
              <span>Subtotal: <strong className="text-gray-900 font-mono">₹ {formatINR(bill.subtotal)}</strong></span>
            </div>

            {bill.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700 text-xs font-medium">
                <span>Discount:</span>
                <span className="font-mono">- ₹ {formatINR(bill.discountAmount)}</span>
              </div>
            )}

            {bill.taxRate > 0 && (
              <>
                <div className="flex justify-between text-gray-600 text-xs">
                  <span>CGST ({bill.taxRate / 2}%):</span>
                  <span className="font-mono">₹ {formatINR(((bill.subtotal - (bill.discountAmount || 0)) * (bill.taxRate / 2)) / 100)}</span>
                </div>
                <div className="flex justify-between text-gray-600 text-xs">
                  <span>SGST ({bill.taxRate / 2}%):</span>
                  <span className="font-mono">₹ {formatINR(((bill.subtotal - (bill.discountAmount || 0)) * (bill.taxRate / 2)) / 100)}</span>
                </div>
              </>
            )}

            <div className="border-t-2 border-b-2 border-gray-900 py-2.5 flex justify-between items-center text-lg font-black text-gray-900">
              <span>GRAND TOTAL:</span>
              <span className="text-xl font-mono">₹ {formatINR(bill.grandTotal)}</span>
            </div>

            {wordsTotal && (
              <div className="text-xs italic text-center py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                {wordsTotal}
              </div>
            )}
          </div>

          {/* QR Code & Footer */}
          <div className="pt-4 border-t border-dashed border-gray-300 text-center space-y-3">
            <div className="inline-block p-2 bg-white border border-gray-200 rounded-xl shadow-sm">
              <QrCodeView value={window.location.href} size={110} />
            </div>
            <div className="text-[11px] font-mono font-semibold text-gray-600">
              Scan QR to view digital receipt
            </div>
            <div className="text-xs text-gray-500 space-y-0.5">
              <p>Thank you for shopping with us! Please visit again.</p>
              <p className="text-[10px] text-gray-400">Goods once sold cannot be returned without bill.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

