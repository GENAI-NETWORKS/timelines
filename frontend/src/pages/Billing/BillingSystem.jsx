import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Barcode, Plus, Search, Printer, Trash2, Edit2, Loader,
  ShoppingBag, IndianRupee, Layers, CheckCircle2, AlertCircle
} from 'lucide-react';
import {
  getBillingProducts, createBillingProduct,
  updateBillingProduct, deleteBillingProduct
} from '../../api/billingProducts';
import NewProductModal from './NewProductModal';
import BarcodePrintModal from './BarcodePrintModal';
import ConfirmModal from '../../components/UI/ConfirmModal';
import Pagination from '../../components/UI/Pagination';
import toast from 'react-hot-toast';
import JsBarcode from 'jsbarcode';

// Mini barcode canvas component for table row preview
function MiniBarcode({ value }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          lineColor: '#1f2937',
          width: 1.2,
          height: 28,
          displayValue: false,
          margin: 0,
        });
      } catch (e) {}
    }
  }, [value]);

  return <svg ref={svgRef} className="h-7 w-auto" />;
}

export default function BillingSystem() {
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showNewModal, setShowNewModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [printProduct, setPrintProduct] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

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

  const handleCreateProduct = async (formData) => {
    setCreating(true);
    try {
      const res = await createBillingProduct(formData);
      toast.success('Product created with barcode!');
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
            <Barcode className="w-7 h-7 text-brand-500" /> Billing System & Barcode Generator
          </h1>
          <p className="text-sm text-gray-500">
            Create products, generate barcodes, and print stickers to stick on inventory items.
          </p>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto shadow-md"
        >
          <Plus className="w-4 h-4" /> New Product
        </button>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Barcode className="w-6 h-6" />
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
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Stock on Hand</div>
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

      {/* Search Bar */}
      <div className="card p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            className="input pl-9"
            placeholder="Search products by name or barcode number…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="table-wrapper border-0 rounded-none rounded-t-xl">
          <table className="table">
            <thead>
              <tr>
                <th className="w-44">Barcode</th>
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
                    <Barcode className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-medium">No products found</p>
                    <p className="text-xs text-gray-400 mt-1">Click "+ New Product" to add your first billing item.</p>
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-brand-50/30 transition-colors">
                    <td>
                      <div className="flex flex-col gap-1">
                        <MiniBarcode value={p.barcode} />
                        <span className="font-mono text-xs font-semibold text-gray-800 tracking-wider">
                          {p.barcode}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="font-semibold text-gray-900">{p.name}</div>
                    </td>
                    <td>
                      <span className="font-bold text-gray-900">
                        ₹ {Number(p.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${p.quantity > 5 ? 'badge-ready' : p.quantity > 0 ? 'badge-pending' : 'badge-unpaid'}`}>
                        {p.quantity} in stock
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-gray-600">
                        {p.category || '—'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setPrintProduct(p)}
                          className="btn-icon text-brand-600 hover:text-brand-700 hover:bg-brand-50"
                          title="Print Barcode Sticker"
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

      {/* Print Barcode Sticker Modal */}
      {printProduct && (
        <BarcodePrintModal
          product={printProduct}
          onClose={() => setPrintProduct(null)}
        />
      )}

      {/* Confirm Delete Modal */}
      {deleteId && (
        <ConfirmModal
          title="Delete Product?"
          message="Are you sure you want to remove this product and barcode from the billing system?"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
