import { useState, useEffect, useCallback, useRef, Component } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  QrCode, Plus, Search, Printer, Trash2, Edit2, Loader,
  ShoppingBag, IndianRupee, Layers, CheckCircle2, AlertCircle, Receipt,
  ClipboardList
} from 'lucide-react';
import {
  getBillingProducts, getProductByBarcode, createBillingProduct,
  updateBillingProduct, deleteBillingProduct
} from '../../api/billingProducts';
import NewProductModal from './NewProductModal';
import BarcodePrintModal from './BarcodePrintModal';
import SheetPrintModal from './SheetPrintModal';
import ScannedProductModal from './ScannedProductModal';
import BillDesignerModal from './BillDesignerModal';
import BillRecordsPanel from './BillRecordsPanel';
import ConfirmModal from '../../components/UI/ConfirmModal';
import Pagination from '../../components/UI/Pagination';
import QrCodeView from './QrCodeView';
import { getProductStickerUrl } from './billUtils';
import toast from 'react-hot-toast';

// Error boundary for QR code cells — prevents one bad row from wiping the whole table
class QrErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) {
      return (
        <span className="font-mono text-xs text-gray-500">{this.props.fallback}</span>
      );
    }
    return this.props.children;
  }
}

// Mini QR Code preview component for table row
function MiniQrCode({ product, value }) {
  if (!value) return <span className="font-mono text-xs text-gray-400">—</span>;
  const qrTarget = product ? getProductStickerUrl(product) : value;
  return (
    <QrErrorBoundary fallback={value}>
      <div className="flex items-center gap-2">
        <QrCodeView
          value={qrTarget}
          size={32}
          margin={2}
          className="rounded border border-gray-200 bg-white p-0.5 shadow-sm flex-shrink-0"
        />
        <span className="font-mono text-xs font-semibold text-gray-800 tracking-wider group-hover:text-brand-600">
          {value}
        </span>
      </div>
    </QrErrorBoundary>
  );
}

export default function BillingSystem() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showNewModal, setShowNewModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [printProduct, setPrintProduct] = useState(null);
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [sheetInitialSelected, setSheetInitialSelected] = useState([]);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [showBillModal, setShowBillModal] = useState(false);
  const [billInitialProduct, setBillInitialProduct] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [showRecordsPanel, setShowRecordsPanel] = useState(false);
  const barcodeInputRef = useRef(null);

  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBillingProducts({ search, page, limit: LIMIT });
      setProducts(res.data.products);
      setTotal(res.data.total);
    } catch (err) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Direct QR Code / Barcode Lookup handler
  const handleScanCode = async (code) => {
    if (!code || !code.trim()) return;
    const cleanCode = code.trim();

    // 1. If scanned code is a Bill URL (e.g., http://.../bill/view/TL-xxx?d=...) or a Bill No:
    if (cleanCode.includes('/bill/view/')) {
      const billPath = cleanCode.substring(cleanCode.indexOf('/bill/view/'));
      navigate(billPath);
      return;
    }

    // Check if it matches a Bill Number saved in local history
    try {
      const saved = localStorage.getItem('timelines_billing_history');
      if (saved) {
        const historyList = JSON.parse(saved);
        const billMatch = historyList.find((b) => b.billNo?.toLowerCase() === cleanCode.toLowerCase());
        if (billMatch) {
          navigate(`/bill/view/${encodeURIComponent(billMatch.billNo)}`);
          toast.success(`Opening Bill ${billMatch.billNo}`);
          return;
        }
      }
    } catch {}

    // 2. Otherwise look up as Product item code
    try {
      const res = await getProductByBarcode(cleanCode);
      if (res.data) {
        setScannedProduct(res.data);
        toast.success(`Scanned: ${res.data.name}`);
        setSearch('');
      }
    } catch (e) {
      toast.error(`No item found for code "${cleanCode}"`);
    }
  };

  // Hardware Scanner Listener:
  // USB/Bluetooth scanners type characters quickly (<40ms apart) followed by Enter.
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      const isInput = activeTag === 'input' || activeTag === 'textarea';

      const currentTime = Date.now();
      const charDiff = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (buffer.length >= 4) {
          e.preventDefault();
          handleScanCode(buffer);
          buffer = '';
        }
      } else if (e.key.length === 1) {
        if (charDiff > 80 && !isInput) {
          buffer = '';
        }
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCreateProduct = async (formData) => {
    setCreating(true);
    try {
      const res = await createBillingProduct(formData);
      toast.success('Product created with QR code!');
      setShowNewModal(false);
      load();
      // Directly open print modal for convenience!
      setPrintProduct(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create product');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteBillingProduct(deleteId);
      toast.success('Product deleted.');
      setDeleteId(null);
      load();
    } catch (err) {
      toast.error('Failed to delete product.');
    }
  };

  // Quick stats
  const totalStockQty = products.reduce((acc, p) => acc + (p.quantity || 0), 0);
  const totalInventoryVal = products.reduce((acc, p) => acc + ((p.price || 0) * (p.quantity || 0)), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900 flex items-center gap-2">
            <QrCode className="w-7 h-7 text-brand-500" /> Billing System & QR Code Generator
          </h1>
          <p className="text-sm text-gray-500">
            Create products, generate QR codes, and print stickers to stick on inventory items.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowRecordsPanel(true)}
            className="btn btn-secondary flex items-center gap-2 border-purple-300 text-purple-700 hover:bg-purple-50"
          >
            <ClipboardList className="w-4 h-4" /> Payment Records
          </button>

          <button
            onClick={() => {
              setBillInitialProduct(null);
              setShowBillModal(true);
            }}
            className="btn bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 shadow-md transition-all hover:scale-[1.02]"
          >
            <Receipt className="w-4 h-4" /> Design & Print Bill
          </button>

          <button
            onClick={() => {
              setSheetInitialSelected(products.map((p) => p.id));
              setShowSheetModal(true);
            }}
            className="btn btn-secondary flex items-center gap-2"
            disabled={products.length === 0}
          >
            <Printer className="w-4 h-4 text-brand-600" /> Print QR Sheet (4×5 Grid)
          </button>

          <button
            onClick={() => setShowNewModal(true)}
            className="btn-primary flex items-center gap-2 shadow-md"
          >
            <Plus className="w-4 h-4" /> New Product
          </button>
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Products</div>
            <div className="text-2xl font-bold text-gray-900">{total}</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Quantity</div>
            <div className="text-2xl font-bold text-gray-900">{totalStockQty} <span className="text-xs font-normal text-gray-500">units</span></div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <IndianRupee className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Page Value</div>
            <div className="text-2xl font-bold text-gray-900">₹ {totalInventoryVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>

      {/* Search & Scanner Input Bar */}
      <div className="card p-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              ref={barcodeInputRef}
              type="text"
              className="input pl-9"
              placeholder="Scan QR code with scanner or search by name / item code (Press Enter to open)…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && search.trim()) {
                  e.preventDefault();
                  handleScanCode(search.trim());
                }
              }}
            />
          </div>
          {search && (
            <button
              onClick={() => handleScanCode(search.trim())}
              className="btn btn-secondary text-xs flex items-center gap-1.5"
            >
              <QrCode className="w-3.5 h-3.5 text-brand-600" />
              Lookup Code
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="table-wrapper border-0 rounded-none rounded-t-xl">
          <table className="table">
            <thead>
              <tr>
                <th className="w-48">QR Code</th>
                <th>Product Name</th>
                <th>Price</th>
                <th>Quantity</th>
                <th>Category</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <Loader className="w-6 h-6 text-brand-500 animate-spin mx-auto" />
                    <p className="text-xs text-gray-400 mt-2">Loading products…</p>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-500">
                    <QrCode className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-medium">No products found</p>
                    <p className="text-xs text-gray-400 mt-1">Click "+ New Product" to add your first billing item.</p>
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr
                    key={String(p.id)}
                    onClick={() => setScannedProduct(p)}
                    className="hover:bg-brand-50/40 transition-colors cursor-pointer group"
                  >
                    <td>
                      <MiniQrCode product={p} value={p.barcode} />
                    </td>
                    <td>
                      <div className="font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">
                        {p.name}
                      </div>
                    </td>
                    <td>
                      <span className="font-bold text-gray-900">
                        ₹ {Number(p.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${p.quantity > 5 ? 'badge-ready' : p.quantity > 0 ? 'badge-pending' : 'badge-unpaid'}`}>
                        {p.quantity}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-gray-600">
                        {p.category || '—'}
                      </span>
                    </td>
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => {
                            setBillInitialProduct(p);
                            setShowBillModal(true);
                          }}
                          className="btn-icon text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                          title="Add to Bill & Print Receipt"
                        >
                          <Receipt className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSheetInitialSelected([p.id]);
                            setShowSheetModal(true);
                          }}
                          className="btn-icon text-brand-600 hover:text-brand-700 hover:bg-brand-50"
                          title="Print QR Code Sheet (4x5)"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(p.id)}
                          className="btn-icon text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                          title="Delete Product"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {total > LIMIT && (
          <div className="px-5 pb-4">
            <Pagination page={page} total={total} limit={LIMIT} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* New Product Modal */}
      {showNewModal && (
        <NewProductModal
          onClose={() => setShowNewModal(false)}
          onSubmit={handleCreateProduct}
          loading={creating}
        />
      )}

      {/* QR Code Sheet Print Modal (4x5 A4 Grid) */}
      {showSheetModal && (
        <SheetPrintModal
          products={products}
          initialSelected={sheetInitialSelected}
          onClose={() => setShowSheetModal(false)}
        />
      )}

      {/* Scanned QR Code Product Details Modal */}
      {scannedProduct && (
        <ScannedProductModal
          product={scannedProduct}
          onClose={() => setScannedProduct(null)}
          onPrint={(p) => {
            setSheetInitialSelected([p.id]);
            setShowSheetModal(true);
          }}
          onAddToBill={(p) => {
            setBillInitialProduct(p);
            setShowBillModal(true);
          }}
        />
      )}

      {/* Single QR Code Print Modal */}
      {printProduct && (
        <BarcodePrintModal
          product={printProduct}
          onClose={() => setPrintProduct(null)}
        />
      )}

      {/* Bill Designer & Printout Modal */}
      {showBillModal && (
        <BillDesignerModal
          availableProducts={products}
          initialProduct={billInitialProduct}
          onClose={() => {
            setShowBillModal(false);
            setBillInitialProduct(null);
          }}
        />
      )}

      {/* Payment Records Side Panel */}
      <BillRecordsPanel
        open={showRecordsPanel}
        onClose={() => setShowRecordsPanel(false)}
      />

      {/* Confirm Delete Modal */}
      {deleteId && (
        <ConfirmModal
          title="Delete Product?"
          message="Are you sure you want to remove this product and QR code from the billing system?"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
