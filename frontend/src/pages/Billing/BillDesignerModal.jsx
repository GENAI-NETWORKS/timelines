import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Printer, Plus, Minus, Trash2, Search, QrCode, ShoppingCart,
  Settings2, RefreshCw, Check, IndianRupee, Store, User, FileText,
  Sliders, ArrowRight, Clock, ShieldCheck, Tag, X, ChevronDown, ChevronUp, History
} from 'lucide-react';
import Modal from '../../components/UI/Modal';
import QrCodeView from './QrCodeView';
import { createQrSvgString } from './qrCodeGenerator';
import { numberToWordsIndian, generateBillNumber, formatINR, encodeBillToPayload } from './billUtils';
import { saveBillingRecord } from '../../api/billingRecords';
import toast from 'react-hot-toast';

const HISTORY_KEY = 'timelines_billing_history';

export default function BillDesignerModal({
  availableProducts = [],
  initialProduct = null,
  onClose
}) {
  // Store & Branding Settings
  const [storeInfo, setStoreInfo] = useState(() => ({
    name: 'TIMELINES COSTUME DESIGNERS',
    tagline: 'Boutique & Tailoring Studio',
    address: 'No. 12, Fashion Street, Main Road',
    phone: '+91 98765 43210',
    gstin: '33AAAAA0000A1Z5',
  }));

  // Bill Metadata
  const [billNo, setBillNo] = useState(() => generateBillNumber());
  const [billDate, setBillDate] = useState(() => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [cashier, setCashier] = useState('Admin');
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [cashTendered, setCashTendered] = useState('');
  const [footerNotes, setFooterNotes] = useState('Thank you for shopping with us! Please visit again.');

  // Paper Size: Defaults to A4 (Fit to Paper)
  const [paperSize, setPaperSize] = useState('a4'); // 'a4' (Fit to Paper), 'a5' (Half Sheet), 'thermal' (80mm Roll)
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showStoreHeader, setShowStoreHeader] = useState(true);
  const [showCustomerDetails, setShowCustomerDetails] = useState(true);
  const [showTaxBreakup, setShowTaxBreakup] = useState(true);
  const [showWords, setShowWords] = useState(true);
  const [showQrCode, setShowQrCode] = useState(true);

  // Discount & Tax
  const [discountType, setDiscountType] = useState('flat'); // 'flat' or 'percent'
  const [discountVal, setDiscountVal] = useState(0);
  const [taxRate, setTaxRate] = useState(0); // 0%, 5%, 12%, 18%
  const [roundOff, setRoundOff] = useState(true);

  // Bill Items
  const [items, setItems] = useState(() => {
    if (initialProduct) {
      return [{
        id: 'item_' + Date.now(),
        productId: initialProduct.id,
        barcode: initialProduct.barcode || '',
        name: initialProduct.name,
        quantity: 1,
        price: Number(initialProduct.price) || 0,
      }];
    }
    return [];
  });

  // Product Search & Custom Item states
  const [searchQuery, setSearchQuery] = useState('');
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQty, setCustomQty] = useState(1);
  const [showCustomForm, setShowCustomForm] = useState(false);

  // History bills stored in localStorage
  const [historyList, setHistoryList] = useState(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Filtered products for quick add
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return availableProducts.filter((p) =>
      p.name?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [searchQuery, availableProducts]);

  // Add product from inventory
  const handleAddProduct = (prod) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.productId === prod.id || (i.barcode && i.barcode === prod.barcode));
      if (existingIndex > -1) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + 1,
        };
        return next;
      }
      return [
        ...prev,
        {
          id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          productId: prod.id,
          barcode: prod.barcode || '',
          name: prod.name,
          quantity: 1,
          price: Number(prod.price) || 0,
        },
      ];
    });
    setSearchQuery('');
    toast.success(`Added ${prod.name}`);
  };

  // Add custom unlisted item
  const handleAddCustom = (e) => {
    e?.preventDefault();
    if (!customName.trim()) {
      toast.error('Please enter an item name');
      return;
    }
    const price = parseFloat(customPrice) || 0;
    const qty = parseInt(customQty, 10) || 1;

    setItems((prev) => [
      ...prev,
      {
        id: 'item_' + Date.now(),
        productId: null,
        barcode: '',
        name: customName.trim(),
        quantity: Math.max(1, qty),
        price: Math.max(0, price),
      },
    ]);

    setCustomName('');
    setCustomPrice('');
    setCustomQty(1);
    setShowCustomForm(false);
    toast.success('Custom item added');
  };

  // Update item quantity
  const handleUpdateQty = (id, delta) => {
    setItems((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  // Update item field directly (e.g. price or direct qty input)
  const handleUpdateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  // Remove single item
  const handleRemoveItem = (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Clear entire bill
  const handleClearBill = () => {
    if (items.length > 0 && !window.confirm('Clear all items from this bill?')) return;
    setItems([]);
    setBillNo(generateBillNumber());
    setCashTendered('');
    toast.success('Bill cleared');
  };

  // Financial Calculations
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.price) || 0), 0);
  }, [items]);

  const discountAmount = useMemo(() => {
    const val = Number(discountVal) || 0;
    if (val <= 0) return 0;
    if (discountType === 'percent') {
      return (subtotal * val) / 100;
    }
    return Math.min(subtotal, val);
  }, [subtotal, discountVal, discountType]);

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = (taxableAmount * (Number(taxRate) || 0)) / 100;
  const cgstAmount = taxRate > 0 ? taxAmount / 2 : 0;
  const sgstAmount = taxRate > 0 ? taxAmount / 2 : 0;

  const rawGrandTotal = taxableAmount + taxAmount;
  const grandTotal = roundOff ? Math.round(rawGrandTotal) : rawGrandTotal;
  const roundOffAmount = roundOff ? (grandTotal - rawGrandTotal) : 0;

  const totalQuantity = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const totalItemsCount = items.length;

  const changeDue = useMemo(() => {
    if (paymentMode !== 'CASH' || !cashTendered) return 0;
    const rcvd = parseFloat(cashTendered) || 0;
    return rcvd >= grandTotal ? rcvd - grandTotal : 0;
  }, [paymentMode, cashTendered, grandTotal]);

  const wordsTotal = useMemo(() => {
    return numberToWordsIndian(grandTotal);
  }, [grandTotal]);

  // Formatted date string for display
  const formattedDateTime = useMemo(() => {
    try {
      const d = new Date(billDate);
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return billDate;
    }
  }, [billDate]);

  // Generate public view URL with encoded bill data so scanning QR code immediately shows the bill
  const billQrUrl = useMemo(() => {
    try {
      const encoded = encodeBillToPayload({
        billNo,
        date: billDate,
        customerName,
        customerPhone,
        paymentMode,
        items,
        subtotal,
        discountAmount,
        taxRate,
        grandTotal,
      });
      return `${window.location.origin}/bill/view/${encodeURIComponent(billNo)}?d=${encoded}`;
    } catch {
      return `${window.location.origin}/bill/view/${encodeURIComponent(billNo)}`;
    }
  }, [billNo, billDate, customerName, customerPhone, paymentMode, items, subtotal, discountAmount, taxRate, grandTotal]);

  // Save current bill to history
  const saveToHistory = () => {
    const billRecord = {
      billNo,
      date: billDate,
      items,
      subtotal,
      discountAmount,
      taxRate,
      grandTotal,
      customerName,
      customerPhone,
      paymentMode,
      paperSize,
      storeInfo,
      timestamp: Date.now(),
    };
    try {
      const updated = [billRecord, ...historyList.filter((b) => b.billNo !== billNo)].slice(0, 30);
      setHistoryList(updated);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('History save error', e);
    }
  };

  // Load a bill from history
  const handleLoadBill = (histBill) => {
    setBillNo(histBill.billNo);
    setBillDate(histBill.date || new Date().toISOString().slice(0, 16));
    setItems(histBill.items || []);
    setCustomerName(histBill.customerName || 'Walk-in Customer');
    setCustomerPhone(histBill.customerPhone || '');
    setPaymentMode(histBill.paymentMode || 'CASH');
    if (histBill.taxRate !== undefined) setTaxRate(histBill.taxRate);
    if (histBill.paperSize) setPaperSize(histBill.paperSize);
    else if (histBill.layoutMode) setPaperSize(histBill.layoutMode === 'thermal' ? 'thermal' : 'a4');
    setShowHistory(false);
    toast.success(`Loaded Bill ${histBill.billNo}`);
  };

  // High-Precision Print Engine that fits the paper and includes scannable QR Code
  const handlePrint = () => {
    if (items.length === 0) {
      toast.error('Add at least one item to print the bill');
      return;
    }

    saveToHistory();

    // Auto-save bill to payment records DB
    saveBillingRecord({
      billNo,
      billDate,
      customerName,
      customerPhone,
      paymentMode,
      items,
      subtotal,
      discountAmount,
      taxRate,
      grandTotal,
    }).catch((err) => console.warn('Bill record save failed (non-critical):', err));

    const printWin = window.open('', '_blank', 'width=850,height=950');
    if (!printWin) {
      toast.error('Please allow popups to print the bill');
      return;
    }

    const isThermal = paperSize === 'thermal';
    const isA5 = paperSize === 'a5';
    const isA4 = paperSize === 'a4';

    const qrSize = isA4 ? 140 : isA5 ? 120 : 100;
    const qrSvgHtml = showQrCode ? createQrSvgString(billQrUrl, { size: qrSize, margin: 4, ecLevel: 'L' }) : '';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Bill Receipt - ${billNo}</title>
          <style>
            @page {
              size: ${isThermal ? '80mm auto' : isA5 ? 'A5 portrait' : 'A4 portrait'};
              margin: ${isThermal ? '2mm 3mm' : isA5 ? '8mm 10mm' : '10mm 15mm'};
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: ${isThermal ? `'Courier New', Courier, monospace` : `'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`};
              color: #000;
              background: #fff;
              font-size: ${isA4 ? '14px' : isA5 ? '12.5px' : '11.5px'};
              line-height: ${isThermal ? '1.3' : '1.45'};
              padding: ${isThermal ? '3px' : '0'};
              width: 100%;
            }
            .bill-wrapper {
              width: ${isThermal ? '74mm' : '100%'};
              max-width: ${isThermal ? '74mm' : '100%'};
              margin: 0 auto;
              padding: ${isThermal ? '4px 0' : '8px 0'};
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .text-left { text-align: left; }
            .bold { font-weight: 700; }
            .uppercase { text-transform: uppercase; }

            .store-header {
              text-align: center;
              margin-bottom: ${isA4 ? '10px' : '6px'};
              padding-bottom: 4px;
            }
            .store-name {
              font-size: ${isA4 ? '24px' : isA5 ? '20px' : '16px'};
              font-weight: 800;
              letter-spacing: 0.5px;
            }
            .store-sub {
              font-size: ${isA4 ? '13px' : isA5 ? '11.5px' : '10px'};
              color: #333;
              margin-top: 2px;
            }
            .store-contact {
              font-size: ${isA4 ? '13px' : isA5 ? '11.5px' : '10.5px'};
              margin-top: 2px;
            }

            .divider {
              border: none;
              border-top: ${isThermal ? '1px dashed #000' : '1.5px dashed #000'};
              margin: ${isA4 ? '10px 0' : '6px 0'};
            }

            .bill-title {
              text-align: center;
              font-weight: 800;
              font-size: ${isA4 ? '16px' : isA5 ? '14px' : '12px'};
              letter-spacing: 1.5px;
              margin: 4px 0;
            }

            .meta-grid {
              font-size: ${isA4 ? '13px' : isA5 ? '12px' : '11px'};
              margin: ${isA4 ? '8px 0' : '4px 0'};
            }
            .meta-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: ${isA4 ? '4px' : '2px'};
            }

            table.items-table {
              width: 100%;
              border-collapse: collapse;
              margin: ${isA4 ? '10px 0' : '6px 0'};
              font-size: ${isA4 ? '13.5px' : isA5 ? '12px' : '11px'};
            }
            table.items-table th {
              border-top: ${isThermal ? '1px dashed #000' : '1.5px dashed #000'};
              border-bottom: ${isThermal ? '1px dashed #000' : '1.5px dashed #000'};
              padding: ${isA4 ? '8px 6px' : isA5 ? '6px 4px' : '4px 2px'};
              font-weight: 700;
            }
            table.items-table td {
              padding: ${isA4 ? '7px 6px' : isA5 ? '5px 4px' : '3px 2px'};
              vertical-align: top;
              border-bottom: 1px dashed ${isThermal ? 'transparent' : '#eee'};
            }

            .summary-row {
              display: flex;
              justify-content: space-between;
              font-size: ${isA4 ? '13.5px' : isA5 ? '12px' : '11px'};
              margin-bottom: ${isA4 ? '4px' : '2px'};
            }
            .grand-total-row {
              display: flex;
              justify-content: space-between;
              font-size: ${isA4 ? '19px' : isA5 ? '17px' : '15px'};
              font-weight: 800;
              padding: ${isA4 ? '8px 0' : '5px 0'};
              border-top: ${isThermal ? '1px dashed #000' : '2px dashed #000'};
              border-bottom: ${isThermal ? '1px dashed #000' : '2px dashed #000'};
              margin: ${isA4 ? '8px 0' : '4px 0'};
            }

            .words-block {
              font-size: ${isA4 ? '12.5px' : isA5 ? '11px' : '10px'};
              font-style: italic;
              margin: ${isA4 ? '8px 0' : '4px 0'};
              text-align: center;
              background: #f9fafb;
              border: 1px dashed #ddd;
              padding: ${isA4 ? '6px 10px' : '4px'};
            }

            .qrcode-section {
              text-align: center;
              margin: ${isA4 ? '12px 0 6px' : '8px 0 4px'};
            }
            .qrcode-section svg {
              display: inline-block;
              max-width: ${isA4 ? '130px' : isA5 ? '110px' : '90px'};
              height: auto;
            }

            .footer-notes {
              text-align: center;
              font-size: ${isA4 ? '12px' : isA5 ? '11px' : '10px'};
              color: #444;
              margin-top: ${isA4 ? '10px' : '6px'};
              line-height: 1.4;
            }

            .sign-box {
              margin-top: 35px;
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              font-weight: 600;
            }

            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="bill-wrapper">
            ${showStoreHeader ? `
              <div class="store-header">
                <div class="store-name">${storeInfo.name}</div>
                ${storeInfo.tagline ? `<div class="store-sub">${storeInfo.tagline}</div>` : ''}
                ${storeInfo.address ? `<div class="store-contact">${storeInfo.address}</div>` : ''}
                ${storeInfo.phone ? `<div class="store-contact">Ph: ${storeInfo.phone}</div>` : ''}
                ${storeInfo.gstin ? `<div class="store-contact bold">GSTIN: ${storeInfo.gstin}</div>` : ''}
              </div>
            ` : ''}

            <hr class="divider" />
            <div class="bill-title">RETAIL INVOICE / CASH BILL</div>
            <hr class="divider" />

            <div class="meta-grid">
              <div class="meta-row">
                <span>Bill No: <strong>${billNo}</strong></span>
                <span>Date: ${formattedDateTime}</span>
              </div>
              <div class="meta-row">
                <span>Cashier: ${cashier}</span>
                <span>Mode: <strong>${paymentMode}</strong></span>
              </div>
              ${showCustomerDetails && (customerName || customerPhone) ? `
                <div class="meta-row">
                  <span>Customer: ${customerName || 'Walk-in'}</span>
                  ${customerPhone ? `<span>Ph: ${customerPhone}</span>` : ''}
                </div>
              ` : ''}
            </div>

            <!-- Items Table -->
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 6%;" class="text-left">#</th>
                  <th style="width: 48%;" class="text-left">Item Description</th>
                  <th style="width: 14%;" class="text-center">Qty</th>
                  <th style="width: 16%;" class="text-right">Rate</th>
                  <th style="width: 16%;" class="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${items.map((it, idx) => `
                  <tr>
                    <td class="text-left">${idx + 1}</td>
                    <td class="text-left">
                      <div class="bold">${it.name}</div>
                      ${it.barcode ? `<div style="font-size: 10px; color: #555;">${it.barcode}</div>` : ''}
                    </td>
                    <td class="text-center">${it.quantity}</td>
                    <td class="text-right">${formatINR(it.price)}</td>
                    <td class="text-right bold">${formatINR(it.quantity * it.price)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <hr class="divider" />

            <!-- Summary Totals -->
            <div class="meta-row" style="font-size: ${isA4 ? '13px' : '11px'}; margin-bottom: 4px;">
              <span>Total Items: <strong>${totalItemsCount}</strong></span>
              <span>Total Qty: <strong>${totalQuantity}</strong></span>
            </div>

            <div class="summary-row">
              <span>Subtotal:</span>
              <span>₹ ${formatINR(subtotal)}</span>
            </div>

            ${discountAmount > 0 ? `
              <div class="summary-row">
                <span>Discount (${discountType === 'percent' ? discountVal + '%' : 'Flat'}):</span>
                <span>- ₹ ${formatINR(discountAmount)}</span>
              </div>
            ` : ''}

            ${showTaxBreakup && taxRate > 0 ? `
              <div class="summary-row">
                <span>CGST (${taxRate / 2}%):</span>
                <span>₹ ${formatINR(cgstAmount)}</span>
              </div>
              <div class="summary-row">
                <span>SGST (${taxRate / 2}%):</span>
                <span>₹ ${formatINR(sgstAmount)}</span>
              </div>
            ` : ''}

            ${roundOff && Math.abs(roundOffAmount) > 0.001 ? `
              <div class="summary-row">
                <span>Round Off:</span>
                <span>${roundOffAmount > 0 ? '+' : ''} ₹ ${formatINR(roundOffAmount)}</span>
              </div>
            ` : ''}

            <div class="grand-total-row">
              <span>GRAND TOTAL:</span>
              <span>₹ ${formatINR(grandTotal)}</span>
            </div>

            ${showWords && wordsTotal ? `
              <div class="words-block">
                ${wordsTotal}
              </div>
            ` : ''}

            ${paymentMode === 'CASH' && cashTendered ? `
              <div class="summary-row" style="margin-top: 4px; font-size: ${isA4 ? '13px' : '11px'};">
                <span>Cash Received: ₹ ${formatINR(cashTendered)}</span>
                <span>Change: <strong>₹ ${formatINR(changeDue)}</strong></span>
              </div>
            ` : ''}

            ${showQrCode && qrSvgHtml ? `
              <div class="qrcode-section">
                ${qrSvgHtml}
                <div style="font-family: monospace; font-size: ${isA4 ? '11px' : '9px'}; font-weight: bold; margin-top: 3px;">
                  ${billNo}
                </div>
                <div style="font-size: ${isA4 ? '10px' : '8.5px'}; color: #666; margin-top: 1px;">
                  Scan QR to view digital bill
                </div>
              </div>
            ` : ''}

            <hr class="divider" />
            <div class="footer-notes">
              <p>${footerNotes}</p>
              <p style="font-size: ${isA4 ? '11px' : '9px'}; margin-top: 3px; color: #666;">Goods once sold cannot be returned without bill.</p>
            </div>

            ${!isThermal ? `
              <div class="sign-box">
                <div>Customer Signature</div>
                <div>Authorized Signatory / Timelines</div>
              </div>
            ` : ''}
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
    `;

    printWin.document.write(html);
    printWin.document.close();
  };

  return (
    <Modal
      title="Bill Designer & Printout"
      onClose={onClose}
      size="max-w-7xl"
    >
      <div className="space-y-4">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface-elevated border border-surface-border rounded-xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Paper Size:
            </span>
            <div className="inline-flex p-1 bg-surface-card border border-surface-border rounded-lg">
              <button
                type="button"
                onClick={() => setPaperSize('a4')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  paperSize === 'a4'
                    ? 'bg-gradient-brand text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                A4 (Fit to Paper)
              </button>
              <button
                type="button"
                onClick={() => setPaperSize('a5')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  paperSize === 'a5'
                    ? 'bg-gradient-brand text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                A5 (Half Sheet)
              </button>
              <button
                type="button"
                onClick={() => setPaperSize('thermal')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  paperSize === 'thermal'
                    ? 'bg-gradient-brand text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Thermal (80mm Roll)
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className={`btn-sm ${showSettings ? 'btn-primary' : 'btn-secondary'} flex items-center gap-1.5`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              Store & Bill Settings
              {showSettings ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {historyList.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className={`btn-sm ${showHistory ? 'btn-primary' : 'btn-secondary'} flex items-center gap-1.5`}
              >
                <History className="w-3.5 h-3.5" />
                Recent Bills ({historyList.length})
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearBill}
              className="btn-sm btn-ghost text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Bill
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={items.length === 0}
              className="btn-sm btn-primary shadow-md flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> Print Bill
            </button>
          </div>
        </div>

        {/* Collapsible Store & Invoice Settings Panel */}
        {showSettings && (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-4 animate-fade-in text-xs">
            <div className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
              <Store className="w-4 h-4 text-brand-600" /> Store & Bill Header Configuration
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label">Store / Shop Name</label>
                <input
                  type="text"
                  className="input text-xs"
                  value={storeInfo.name}
                  onChange={(e) => setStoreInfo({ ...storeInfo, name: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Subtitle / Category</label>
                <input
                  type="text"
                  className="input text-xs"
                  value={storeInfo.tagline}
                  onChange={(e) => setStoreInfo({ ...storeInfo, tagline: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Store Phone</label>
                <input
                  type="text"
                  className="input text-xs"
                  value={storeInfo.phone}
                  onChange={(e) => setStoreInfo({ ...storeInfo, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Address / Location</label>
                <input
                  type="text"
                  className="input text-xs"
                  value={storeInfo.address}
                  onChange={(e) => setStoreInfo({ ...storeInfo, address: e.target.value })}
                />
              </div>
              <div>
                <label className="label">GSTIN / Tax ID</label>
                <input
                  type="text"
                  className="input text-xs"
                  value={storeInfo.gstin}
                  onChange={(e) => setStoreInfo({ ...storeInfo, gstin: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Billed By (Cashier)</label>
                <input
                  type="text"
                  className="input text-xs"
                  value={cashier}
                  onChange={(e) => setCashier(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200">
              <div className="text-xs font-semibold text-gray-700 mb-2">Display Elements On Printout:</div>
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showStoreHeader}
                    onChange={(e) => setShowStoreHeader(e.target.checked)}
                    className="rounded text-brand-600"
                  />
                  <span>Show Store Header & Address</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCustomerDetails}
                    onChange={(e) => setShowCustomerDetails(e.target.checked)}
                    className="rounded text-brand-600"
                  />
                  <span>Show Customer Info</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showTaxBreakup}
                    onChange={(e) => setShowTaxBreakup(e.target.checked)}
                    className="rounded text-brand-600"
                  />
                  <span>Show CGST / SGST Breakup</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showWords}
                    onChange={(e) => setShowWords(e.target.checked)}
                    className="rounded text-brand-600"
                  />
                  <span>Show Amount in Words</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showQrCode}
                    onChange={(e) => setShowQrCode(e.target.checked)}
                    className="rounded text-brand-600"
                  />
                  <span>Show QR Code at Bottom (Scannable to View Bill)</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Collapsible Recent Bills History Panel */}
        {showHistory && (
          <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2 animate-fade-in text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-purple-900 text-sm flex items-center gap-1.5">
                <History className="w-4 h-4 text-purple-600" /> Recent Bills History
              </span>
              <button
                onClick={() => setShowHistory(false)}
                className="btn-icon text-gray-500 hover:text-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pt-1">
              {historyList.map((hist) => (
                <div
                  key={hist.billNo}
                  onClick={() => handleLoadBill(hist)}
                  className="p-2.5 bg-white border border-purple-200 rounded-lg hover:border-brand-500 hover:shadow-sm cursor-pointer transition-all flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-gray-900">{hist.billNo}</div>
                    <div className="text-[11px] text-gray-500">{hist.customerName || 'Walk-in'} • {hist.items?.length || 0} items</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-brand-600">₹ {formatINR(hist.grandTotal)}</div>
                    <div className="text-[10px] text-gray-400">{hist.paymentMode}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2-Column Main Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT: Bill Builder (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Bill Meta Row: Bill No, Date, Customer */}
            <div className="card p-3.5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="label flex items-center justify-between">
                    <span>Bill / Invoice No</span>
                    <button
                      type="button"
                      onClick={() => setBillNo(generateBillNumber())}
                      className="text-brand-600 hover:underline flex items-center gap-0.5"
                    >
                      <RefreshCw className="w-3 h-3" /> New
                    </button>
                  </label>
                  <input
                    type="text"
                    className="input font-mono font-bold text-xs"
                    value={billNo}
                    onChange={(e) => setBillNo(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">Date & Time</label>
                  <input
                    type="datetime-local"
                    className="input text-xs"
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">Customer Name</label>
                  <input
                    type="text"
                    className="input text-xs"
                    placeholder="Walk-in Customer"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Product Scanner / Picker & Custom Item Bar */}
            <div className="card p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ShoppingCart className="w-4 h-4 text-brand-600" /> Add Items to Bill
                </span>
                <button
                  type="button"
                  onClick={() => setShowCustomForm(!showCustomForm)}
                  className="text-xs text-brand-600 font-semibold hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> {showCustomForm ? 'Cancel Custom' : 'Add Custom Item'}
                </button>
              </div>

              {/* QR Code / Product Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  className="input pl-9 text-xs"
                  placeholder="Scan QR code with scanner or search product name / item code…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery.trim()) {
                      e.preventDefault();
                      const match = availableProducts.find(
                        (p) =>
                          p.barcode?.toLowerCase() === searchQuery.trim().toLowerCase() ||
                          p.name?.toLowerCase() === searchQuery.trim().toLowerCase()
                      ) || searchResults[0];

                      if (match) {
                        handleAddProduct(match);
                      } else {
                        toast.error(`No catalog product found for "${searchQuery.trim()}"`);
                      }
                    }
                  }}
                />

                {/* Autocomplete Dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 divide-y divide-gray-100 overflow-hidden">
                    {searchResults.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleAddProduct(p)}
                        className="p-2.5 hover:bg-brand-50 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div>
                          <div className="font-semibold text-xs text-gray-900">{p.name}</div>
                          <div className="text-[11px] text-gray-400 font-mono flex items-center gap-1 mt-0.5">
                            <QrCode className="w-3 h-3 text-brand-600" /> Code: {p.barcode} • Available: {p.quantity}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-xs text-brand-600">₹ {formatINR(p.price)}</span>
                          <span className="btn-sm btn-primary py-0.5 px-2 text-[11px]">+ Add</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick-add chips for available products */}
              {availableProducts.length > 0 && !searchQuery && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[11px] text-gray-400 font-medium">Quick Pick:</span>
                  {availableProducts.slice(0, 5).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleAddProduct(p)}
                      className="px-2 py-0.5 bg-gray-100 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 border border-transparent rounded-md text-[11px] font-medium text-gray-700 transition-colors"
                    >
                      + {p.name} (₹{formatINR(p.price)})
                    </button>
                  ))}
                </div>
              )}

              {/* Inline Custom Item Form */}
              {showCustomForm && (
                <form
                  onSubmit={handleAddCustom}
                  className="p-3 bg-brand-50/50 border border-brand-200 rounded-lg space-y-2.5 animate-fade-in text-xs"
                >
                  <div className="font-semibold text-gray-800 text-xs">New Custom Item</div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        className="input text-xs"
                        placeholder="Item description (e.g., Alteration, Lining)"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        min="1"
                        className="input text-xs"
                        placeholder="Qty"
                        value={customQty}
                        onChange={(e) => setCustomQty(e.target.value)}
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input text-xs"
                        placeholder="Unit Price ₹"
                        value={customPrice}
                        onChange={(e) => setCustomPrice(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCustomForm(false)}
                      className="btn-sm btn-secondary"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-sm btn-primary">
                      Add to Bill
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Bill Items Table */}
            <div className="card overflow-hidden">
              <div className="p-3 bg-surface-elevated border-b border-surface-border flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Bill Line Items ({items.length})
                </span>
                <span className="text-xs text-gray-500">
                  Total Qty: <strong className="text-gray-900">{totalQuantity}</strong>
                </span>
              </div>

              <div className="table-wrapper border-0 rounded-none max-h-72 overflow-y-auto">
                <table className="table text-xs">
                  <thead>
                    <tr>
                      <th className="w-8">#</th>
                      <th>Product Name</th>
                      <th className="w-28 text-center">Qty</th>
                      <th className="w-28 text-right">Unit Price (₹)</th>
                      <th className="w-28 text-right">Total Price (₹)</th>
                      <th className="w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-400">
                          <ShoppingCart className="w-8 h-8 mx-auto mb-1 opacity-30" />
                          <p className="font-medium text-xs">No items added to the bill yet.</p>
                          <p className="text-[11px] text-gray-400">Scan QR code, search product, or click quick pick above.</p>
                        </td>
                      </tr>
                    ) : (
                      items.map((it, idx) => (
                        <tr key={it.id} className="hover:bg-brand-50/20">
                          <td className="font-mono text-gray-500">{idx + 1}</td>
                          <td>
                            <input
                              type="text"
                              className="w-full bg-transparent font-medium text-gray-900 focus:outline-none focus:border-b border-brand-500"
                              value={it.name}
                              onChange={(e) => handleUpdateItem(it.id, 'name', e.target.value)}
                            />
                            {it.barcode && (
                              <span className="font-mono text-[10px] text-gray-400 block">
                                Code: {it.barcode}
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(it.id, -1)}
                                className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                className="w-12 text-center font-bold text-xs bg-gray-50 border border-gray-200 rounded py-0.5"
                                value={it.quantity}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  handleUpdateItem(it.id, 'quantity', isNaN(val) ? 1 : Math.max(1, val));
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(it.id, 1)}
                                className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td className="text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-20 text-right font-medium text-xs bg-gray-50 border border-gray-200 rounded py-0.5 px-1.5"
                              value={it.price}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                handleUpdateItem(it.id, 'price', isNaN(val) ? 0 : Math.max(0, val));
                              }}
                            />
                          </td>
                          <td className="text-right font-bold text-gray-900 font-mono">
                            ₹ {formatINR((Number(it.quantity) || 0) * (Number(it.price) || 0))}
                          </td>
                          <td className="text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(it.id)}
                              className="text-rose-400 hover:text-rose-600 p-1"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Calculations: Discounts, Tax, Payment */}
            <div className="card p-3.5 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Discount */}
                <div>
                  <label className="label flex items-center justify-between">
                    <span>Discount</span>
                    <span className="space-x-1">
                      <button
                        type="button"
                        onClick={() => setDiscountType('flat')}
                        className={`text-[10px] px-1 rounded ${discountType === 'flat' ? 'bg-brand-600 text-white' : 'text-gray-500'}`}
                      >
                        ₹ Flat
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType('percent')}
                        className={`text-[10px] px-1 rounded ${discountType === 'percent' ? 'bg-brand-600 text-white' : 'text-gray-500'}`}
                      >
                        %
                      </button>
                    </span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    className="input text-xs"
                    placeholder="0"
                    value={discountVal || ''}
                    onChange={(e) => setDiscountVal(parseFloat(e.target.value) || 0)}
                  />
                </div>

                {/* Tax / GST */}
                <div>
                  <label className="label">Tax / GST</label>
                  <select
                    className="select text-xs"
                    value={taxRate}
                    onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  >
                    <option value={0}>0% (No Tax)</option>
                    <option value={5}>5% (CGST 2.5% + SGST 2.5%)</option>
                    <option value={12}>12% (CGST 6% + SGST 6%)</option>
                    <option value={18}>18% (CGST 9% + SGST 9%)</option>
                  </select>
                </div>

                {/* Payment Mode */}
                <div>
                  <label className="label">Payment Mode</label>
                  <select
                    className="select text-xs"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                  >
                    <option value="CASH">CASH</option>
                    <option value="UPI / GPAY">UPI / GPAY / PHONEPE</option>
                    <option value="CARD">DEBIT / CREDIT CARD</option>
                    <option value="DUE">CREDIT / DUE</option>
                  </select>
                </div>
              </div>

              {/* Cash Received & Change */}
              {paymentMode === 'CASH' && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-emerald-900">Cash Received ₹:</label>
                    <input
                      type="number"
                      step="1"
                      className="w-28 input py-1 text-xs font-bold"
                      placeholder={grandTotal.toString()}
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                    />
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-emerald-800">Change Due: </span>
                    <strong className="text-sm font-bold text-emerald-900 font-mono">
                      ₹ {formatINR(changeDue)}
                    </strong>
                  </div>
                </div>
              )}

              {/* Round Off Toggle & Footer note */}
              <div className="flex items-center justify-between gap-4 pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={roundOff}
                    onChange={(e) => setRoundOff(e.target.checked)}
                    className="rounded text-brand-600"
                  />
                  <span>Auto Round Off to nearest Rupee</span>
                </label>

                <div className="flex-1 max-w-xs">
                  <input
                    type="text"
                    className="input py-1 text-xs"
                    placeholder="Footer note on receipt…"
                    value={footerNotes}
                    onChange={(e) => setFooterNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Live Bill Preview (5 Cols) */}
          <div className="lg:col-span-5 space-y-3 sticky top-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-brand-600" /> Live Receipt Preview
              </span>
              <span className="badge badge-admin text-[11px]">
                {paperSize === 'a4' ? 'A4 (Fit to Paper)' : paperSize === 'a5' ? 'A5 (Half Sheet)' : 'Thermal (80mm POS)'}
              </span>
            </div>

            {/* Simulated Receipt Paper Box */}
            <div className="bg-amber-50/40 p-4 border border-amber-200/60 rounded-xl shadow-inner max-h-[620px] overflow-y-auto">
              <div
                className={`bg-white border border-gray-300 shadow-md mx-auto p-4 transition-all ${
                  paperSize === 'thermal'
                    ? 'max-w-[340px] font-mono text-[11px] leading-tight text-gray-900'
                    : paperSize === 'a5'
                    ? 'max-w-[440px] text-xs text-gray-900'
                    : 'w-full text-xs text-gray-900'
                }`}
                style={{
                  fontFamily: paperSize === 'thermal' ? "'Courier New', Courier, monospace" : 'inherit',
                }}
              >
                {/* Store Header */}
                {showStoreHeader && (
                  <div className="text-center space-y-0.5 pb-2">
                    <div className="font-extrabold text-sm tracking-wide text-gray-900 uppercase">
                      {storeInfo.name}
                    </div>
                    {storeInfo.tagline && <div className="text-[10px] text-gray-600">{storeInfo.tagline}</div>}
                    {storeInfo.address && <div className="text-[10px] text-gray-600">{storeInfo.address}</div>}
                    {storeInfo.phone && <div className="text-[10px] text-gray-600">Ph: {storeInfo.phone}</div>}
                    {storeInfo.gstin && (
                      <div className="text-[10px] font-bold text-gray-800">GSTIN: {storeInfo.gstin}</div>
                    )}
                  </div>
                )}

                <div className="border-t border-dashed border-gray-400 my-1.5" />
                <div className="text-center font-bold text-xs uppercase tracking-wider">
                  RETAIL CASH MEMO / BILL
                </div>
                <div className="border-t border-dashed border-gray-400 my-1.5" />

                {/* Metadata */}
                <div className="space-y-0.5 text-[10.5px]">
                  <div className="flex justify-between">
                    <span>Bill No: <strong>{billNo}</strong></span>
                    <span>Date: {formattedDateTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cashier: {cashier}</span>
                    <span>Mode: <strong>{paymentMode}</strong></span>
                  </div>
                  {showCustomerDetails && (customerName || customerPhone) && (
                    <div className="flex justify-between">
                      <span>Customer: {customerName}</span>
                      {customerPhone && <span>Ph: {customerPhone}</span>}
                    </div>
                  )}
                </div>

                <div className="border-t border-dashed border-gray-400 my-1.5" />

                {/* Items List */}
                <table className="w-full text-[10.5px]">
                  <thead>
                    <tr className="border-b border-dashed border-gray-400 text-gray-700">
                      <th className="text-left py-1 w-5">#</th>
                      <th className="text-left py-1">Item</th>
                      <th className="text-center py-1 w-8">Qty</th>
                      <th className="text-right py-1 w-12">Rate</th>
                      <th className="text-right py-1 w-14">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-4 text-gray-400 italic">
                          (Items will appear here)
                        </td>
                      </tr>
                    ) : (
                      items.map((it, idx) => (
                        <tr key={it.id} className="py-0.5">
                          <td className="text-left align-top">{idx + 1}</td>
                          <td className="text-left align-top font-semibold">
                            {it.name}
                            {it.barcode && (
                              <div className="text-[9px] text-gray-400 font-normal">Code: {it.barcode}</div>
                            )}
                          </td>
                          <td className="text-center align-top">{it.quantity}</td>
                          <td className="text-right align-top">{formatINR(it.price)}</td>
                          <td className="text-right align-top font-bold">
                            {formatINR(it.quantity * it.price)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                <div className="border-t border-dashed border-gray-400 my-1.5" />

                {/* Subtotals & Calculations */}
                <div className="space-y-0.5 text-[10.5px]">
                  <div className="flex justify-between text-gray-500">
                    <span>Total Items: {totalItemsCount}</span>
                    <span>Total Qty: {totalQuantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>₹ {formatINR(subtotal)}</span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Discount:</span>
                      <span>- ₹ {formatINR(discountAmount)}</span>
                    </div>
                  )}

                  {showTaxBreakup && taxRate > 0 && (
                    <>
                      <div className="flex justify-between text-gray-600">
                        <span>CGST ({taxRate / 2}%):</span>
                        <span>₹ {formatINR(cgstAmount)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>SGST ({taxRate / 2}%):</span>
                        <span>₹ {formatINR(sgstAmount)}</span>
                      </div>
                    </>
                  )}

                  {roundOff && Math.abs(roundOffAmount) > 0.001 && (
                    <div className="flex justify-between text-gray-500">
                      <span>Round Off:</span>
                      <span>{roundOffAmount > 0 ? '+' : ''} ₹ {formatINR(roundOffAmount)}</span>
                    </div>
                  )}
                </div>

                <div className="border-t-2 border-b-2 border-dashed border-gray-900 my-1.5 py-1 flex justify-between text-sm font-extrabold text-gray-900">
                  <span>NET PAYABLE:</span>
                  <span>₹ {formatINR(grandTotal)}</span>
                </div>

                {/* Amount in words */}
                {showWords && wordsTotal && (
                  <div className="text-[9.5px] italic text-center py-1 bg-gray-50 rounded my-1 text-gray-700">
                    {wordsTotal}
                  </div>
                )}

                {/* Cash payment details */}
                {paymentMode === 'CASH' && cashTendered && (
                  <div className="flex justify-between text-[10px] text-gray-600 pt-0.5">
                    <span>Rcvd: ₹{formatINR(cashTendered)}</span>
                    <span className="font-bold text-gray-900">Change: ₹{formatINR(changeDue)}</span>
                  </div>
                )}

                {/* QR Code preview */}
                {showQrCode && (
                  <div className="text-center pt-3 flex flex-col items-center">
                    <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col items-center">
                      <QrCodeView value={billQrUrl} size={150} margin={4} />
                      <div className="font-mono text-xs font-bold text-gray-800 tracking-wider mt-2">{billNo}</div>
                      <div className="text-[10px] font-medium text-brand-600 mt-0.5">Scan QR Code to view digital bill</div>
                    </div>
                  </div>
                )}

                <div className="border-t border-dashed border-gray-400 my-2" />

                {/* Footer notes */}
                <div className="text-center text-[9.5px] text-gray-500 space-y-0.5">
                  <p>{footerNotes}</p>
                  <p>*** Have a Wonderful Day ***</p>
                </div>
              </div>
            </div>

            {/* Print Action in Preview Column */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={items.length === 0}
              className="w-full btn-primary py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-lg"
            >
              <Printer className="w-5 h-5" /> Print Bill
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
