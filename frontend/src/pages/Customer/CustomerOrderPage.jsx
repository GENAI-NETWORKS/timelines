/**
 * CustomerOrderPage.jsx
 *
 * The unified Customer → Order workflow:
 *  Step 1: Fill Customer Name, Phone, Order Date, Delivery Date → Create Order
 *  Step 2: Add particulars (product items) → edit per-sub-item details
 *  Step 3: Submit Order → Print tailor worksheet
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Printer, CheckCircle2, Loader, ArrowLeft, Search, UserPlus, X, ChevronDown, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

import {
  createTailoringOrder, getTailoringOrder,
  updateTailoringOrder, submitTailoringOrder,
  addOrderItem, updateOrderItem, deleteOrderItem, saveItemCanvas,
} from '../../api/tailoringOrders';
import { searchCustomers } from '../../api/customers';

import ParticularRow, { ITEM_TYPES } from './components/ParticularRow';
import TailorPrintout from './components/TailorPrintout';

// ─── Customer step ────────────────────────────────────────────────────────
function CustomerStep({ onOrderCreated }) {
  const [mode, setMode]         = useState('search'); // 'search' | 'new'
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [newForm, setNewForm]   = useState({ name: '', phone: '', orderDate: new Date().toISOString().slice(0, 10), deliveryDate: '' });
  const [creating, setCreating] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef  = useRef(null);

  const doSearch = useCallback((q) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!q.trim()) { setResults([]); return; }
      setSearching(true);
      try { const r = await searchCustomers(q); setResults(r.data || []); }
      catch { setResults([]); }
      finally { setSearching(false); }
    }, 280);
  }, []);

  useEffect(() => { doSearch(query); }, [query, doSearch]);

  useEffect(() => {
    const h = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setResults([]); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleCreate = async () => {
    const name  = mode === 'new' ? newForm.name.trim()  : selected?.name;
    const phone = mode === 'new' ? newForm.phone.trim() : selected?.phone;
    const od    = mode === 'new' ? newForm.orderDate    : newForm.orderDate;
    const dd    = newForm.deliveryDate;

    if (!name)  { toast.error('Customer name is required.'); return; }
    if (!phone && mode === 'new') { toast.error('Phone number is required.'); return; }
    if (!od)    { toast.error('Order date is required.'); return; }
    if (!dd)    { toast.error('Expected delivery date is required.'); return; }

    setCreating(true);
    try {
      const payload = {
        orderDate:    od,
        deliveryDate: dd,
        ...(mode === 'search' && selected ? { customerId: selected.customerId } : { customerName: name, customerPhone: phone }),
      };
      const res = await createTailoringOrder(payload);
      onOrderCreated(res.data);
      toast.success('Order created!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create order.');
    } finally { setCreating(false); }
  };

  const orderFields = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-surface-border">
      <div>
        <label className="label">Order Date *</label>
        <input id="order-date" className="input" type="date" value={newForm.orderDate}
          onChange={e => setNewForm(f => ({ ...f, orderDate: e.target.value }))} />
      </div>
      <div>
        <label className="label">Expected Stitching / Delivery Date *</label>
        <input id="delivery-date" className="input" type="date" value={newForm.deliveryDate}
          onChange={e => setNewForm(f => ({ ...f, deliveryDate: e.target.value }))} />
      </div>
    </div>
  );

  return (
    <div className="card p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center"><UserPlus className="w-5 h-5 text-white" /></div>
        <div>
          <h2 className="font-display font-bold text-xl text-white">Customer Details</h2>
          <p className="text-sm text-gray-500">Step 1 - Find existing or create new customer</p>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button onClick={() => { setMode('search'); setSelected(null); }} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${mode === 'search' ? 'bg-gradient-brand text-white' : 'bg-surface-elevated text-gray-400 hover:text-white'}`}>
          Search Existing
        </button>
        <button onClick={() => { setMode('new'); setSelected(null); setResults([]); }} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${mode === 'new' ? 'bg-gradient-brand text-white' : 'bg-surface-elevated text-gray-400 hover:text-white'}`}>
          + New Customer
        </button>
      </div>

      {mode === 'search' ? (
        <div className="space-y-4">
          {selected ? (
            <div className="flex items-center gap-3 p-3 bg-green-900/20 border border-green-700/40 rounded-xl">
              <div className="w-9 h-9 rounded-full bg-gradient-brand flex items-center justify-center text-white font-bold">{selected.name?.[0]}</div>
              <div className="flex-1">
                <p className="font-semibold text-white">{selected.name}</p>
                <p className="text-xs text-gray-400">{selected.customerId} · {selected.phone}</p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <button onClick={() => setSelected(null)} className="btn-icon text-gray-500"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <div ref={wrapperRef} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              {searching && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />}
              <input id="customer-search" className="input pl-9" placeholder="Search by name or phone…" value={query}
                onChange={e => setQuery(e.target.value)} autoComplete="off" />
              {results.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-surface-card border border-surface-border rounded-xl shadow-2xl overflow-hidden">
                  {results.map(c => (
                    <button key={c.customerId} onClick={() => { setSelected(c); setQuery(''); setResults([]); }}
                      className="w-full text-left px-4 py-3 hover:bg-surface-elevated transition-colors flex items-center gap-3 border-b border-surface-border/40 last:border-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center text-white text-xs font-bold">{c.name?.[0]}</div>
                      <div><p className="text-sm font-medium text-white">{c.name}</p><p className="text-xs text-gray-400">{c.phone}</p></div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {orderFields}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Customer Name *</label>
              <input id="cust-name" className="input" placeholder="Full name" value={newForm.name}
                onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Phone Number *</label>
              <input id="cust-phone" className="input" type="tel" placeholder="Mobile number" value={newForm.phone}
                onChange={e => setNewForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          {orderFields}
        </div>
      )}

      <button onClick={handleCreate} disabled={creating || (mode === 'search' && !selected)} className="btn-primary w-full justify-center py-3">
        {creating ? <><Loader className="w-4 h-4 animate-spin" /> Creating…</> : <>Create Order →</>}
      </button>
    </div>
  );
}

// ─── Add particular picker (portal dropdown) ──────────────────────────────
function AddParticularPicker({ onAdd, adding }) {
  const [open, setOpen] = useState(false);
  const [pos,  setPos]  = useState({ top: 0, left: 0, width: 220 });
  const btnRef          = useRef(null);

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left, width: Math.max(220, r.width) });
    }
    setOpen(o => !o);
  };

  // Use onMouseDown on items so selection fires BEFORE the backdrop onClick closes the menu
  const handleSelect = async (type) => {
    setOpen(false);
    await onAdd(type);
  };

  return (
    <>
      <button ref={btnRef} onClick={handleOpen} className="btn-primary" disabled={adding}>
        {adding ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Add Particular
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {open && createPortal(
        <>
          {/* Backdrop — closes on click-outside */}
          <div className="fixed inset-0 z-[998]" onMouseDown={() => setOpen(false)} />
          {/* Dropdown — z higher than backdrop so clicks reach it */}
          <div
            className="fixed z-[999] bg-surface-card border border-surface-border rounded-xl shadow-2xl overflow-hidden animate-fade-in"
            style={{ top: pos.top, left: pos.left, minWidth: pos.width }}
          >
            {ITEM_TYPES.map(t => (
              <button
                key={t.value}
                // Use onMouseDown so it fires before backdrop's onMouseDown closes the portal
                onMouseDown={(e) => { e.stopPropagation(); handleSelect(t.value); }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-surface-elevated hover:text-white transition-colors border-b border-surface-border/40 last:border-0"
              >
                {t.label}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  );
}



// ─── Main page ────────────────────────────────────────────────────────────
export default function CustomerOrderPage() {
  const { id: editId } = useParams();
  const navigate = useNavigate();

  const [order,     setOrder]     = useState(null);   // TailoringOrder from server
  const [items,     setItems]     = useState([]);      // local item array
  const [loading,   setLoading]   = useState(Boolean(editId));
  const [adding,    setAdding]    = useState(false);
  const [submitting,setSubmitting]= useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const saveTimers  = useRef({});

  // Load existing order
  useEffect(() => {
    if (!editId) return;
    setLoading(true);
    getTailoringOrder(editId)
      .then(r => { setOrder(r.data); setItems(r.data.items || []); })
      .catch(() => { toast.error('Order not found.'); navigate('/customer'); })
      .finally(() => setLoading(false));
  }, [editId]);

  const handleOrderCreated = (o) => {
    setOrder(o);
    setItems(o.items || []);
    navigate(`/customer/${o.id}`, { replace: true });
  };

  // Add a new particular
  const handleAddItem = async (itemType) => {
    if (!order) return;
    setAdding(true);
    try {
      const res = await addOrderItem(order.id, { itemType, quantity: 1 });
      setItems(prev => [...prev, res.data]);
      toast.success(`${ITEM_TYPES.find(t => t.value === itemType)?.label} added!`);
    } catch { toast.error('Failed to add item.'); }
    finally { setAdding(false); }
  };

  // Update item in local state, debounce-save to server
  const handleUpdateItem = useCallback((updated) => {
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));

    // Debounce server save by 1.5s
    clearTimeout(saveTimers.current[updated.id]);
    saveTimers.current[updated.id] = setTimeout(async () => {
      if (!order || !updated.id) return;
      try {
        const res = await updateOrderItem(order.id, updated.id, {
          quantity: updated.quantity,
          details:  updated.details,
          subItems: updated.subItems,
        });
        // Refresh with server response
        setItems(prev => prev.map(i => i.id === res.data.id ? res.data : i));
      } catch {}
    }, 1500);
  }, [order]);

  // Delete an item
  const handleDeleteItem = async (itemId) => {
    if (!order) return;
    try {
      await deleteOrderItem(order.id, itemId);
      setItems(prev => prev.filter(i => i.id !== itemId));
      toast.success('Item removed.');
    } catch { toast.error('Failed to delete.'); }
  };

  // Submit order
  const handleSubmit = async () => {
    if (!order) return;
    setSubmitting(true);
    try {
      const res = await submitTailoringOrder(order.id);
      setOrder(res.data);
      toast.success('Order submitted!');
    } catch { toast.error('Submit failed.'); }
    finally { setSubmitting(false); }
  };

  // ── Save ALL: flush debounces + upload all unsaved canvases ──────────────
  const handleSaveAll = async () => {
    if (!order) return;
    setSavingAll(true);
    const toastId = toast.loading('Saving all changes…');
    try {
      // Cancel any pending debounce timers first
      Object.values(saveTimers.current).forEach(t => clearTimeout(t));
      saveTimers.current = {};

      // Get latest items from state ref (capture once)
      const currentItems = items;

      await Promise.all(currentItems.map(async (item) => {
        // 1) Save text fields / subItems JSON to server
        const savedItem = await updateOrderItem(order.id, item.id, {
          quantity: item.quantity,
          details:  item.details || {},
          subItems: item.subItems || [],
        });

        // 2) Upload any canvas drawings that have a local dataUrl
        const subs = Array.isArray(item.subItems) ? item.subItems : [];
        for (let si = 0; si < subs.length; si++) {
          const sub = subs[si];
          for (const section of ['front', 'back', 'sleeve']) {
            const dataUrl = sub[`${section}CanvasDataUrl`];
            const json    = sub[`${section}CanvasJSON`];
            if (!dataUrl || !json) continue;          // nothing drawn yet
            try {
              const blob = await (await fetch(dataUrl)).blob();
              const file = new File([blob], `${section}-canvas.png`, { type: 'image/png' });
              const fd = new FormData();
              fd.append('canvas', file);
              fd.append('subItemNumber', String(si + 1));
              fd.append('section', section);
              fd.append('canvasJSON', json);
              await saveItemCanvas(order.id, item.id, fd);
            } catch { /* skip failed canvas, continue */ }
          }
        }
      }));

      // Reload fresh server state
      const res = await getTailoringOrder(order.id);
      setOrder(res.data);
      // Preserve local dataUrls (server response won't have them)
      const serverItems = res.data.items || [];
      setItems(serverItems.map(si => {
        const local = currentItems.find(li => li.id === si.id);
        if (!local) return si;
        const mergedSubs = (si.subItems || []).map((ss, idx) => {
          const ls = (local.subItems || [])[idx] || {};
          return {
            ...ss,
            // Keep local dataUrls for immediate print
            frontCanvasDataUrl:  ls.frontCanvasDataUrl  || ss.frontCanvasDataUrl,
            backCanvasDataUrl:   ls.backCanvasDataUrl   || ss.backCanvasDataUrl,
            sleeveCanvasDataUrl: ls.sleeveCanvasDataUrl || ss.sleeveCanvasDataUrl,
          };
        });
        return { ...si, subItems: mergedSubs };
      }));

      toast.success('All changes saved!', { id: toastId });
    } catch (err) {
      toast.error('Save failed. Please try again.', { id: toastId });
    } finally {
      setSavingAll(false);
    }
  };

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader className="w-8 h-8 text-brand-400 animate-spin" />
      </div>
    );
  }

  const isSubmitted = order?.status === 'Submitted';

  return (
    <>
      {/* Tailor printout (hidden on screen) */}
      <TailorPrintout order={order} customer={order?.customer} />

      {/* Screen UI */}
      <div className="space-y-6 animate-fade-in no-print">

        {/* Page header */}
        <div className="flex items-center gap-3">
          {editId && (
            <button onClick={() => navigate('/customer/list')} className="btn-icon">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h1 className="font-display font-bold text-2xl text-white">
              {order ? `Order - ${order.customer?.name || ''}` : 'New Customer Order'}
            </h1>
            <p className="text-sm text-gray-500">
              {order ? (
                <>
                  {format(new Date(order.orderDate), 'dd MMM yyyy')}
                  {order.deliveryDate && ` · Due ${format(new Date(order.deliveryDate), 'dd MMM yyyy')}`}
                  <span className={`ml-2 badge ${order.status === 'Submitted' ? 'badge-ready' : 'badge-pending'}`}>
                    {order.status}
                  </span>
                </>
              ) : 'Fill in the customer details to begin'}
            </p>
          </div>
          {order && (
            <div className="flex gap-2 ml-auto flex-wrap justify-end">
              <button onClick={handlePrint} className="btn-secondary">
                <Printer className="w-4 h-4" /> Print
              </button>
              {!isSubmitted && (
                <button onClick={handleSubmit} disabled={submitting || items.length === 0} className="btn-primary">
                  {submitting ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {submitting ? 'Submitting…' : 'Submit Order'}
                </button>
              )}
            </div>
          )}

        </div>

        {/* Step 1 — Customer form (shown only when no order yet) */}
        {!order && <CustomerStep onOrderCreated={handleOrderCreated} />}

        {/* Step 2 — Particulars */}
        {order && (
          <div className="space-y-4">
            {/* Customer info card */}
            <div className="card p-4 flex flex-wrap items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-brand flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {order.customer?.name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white">{order.customer?.name}</p>
                <p className="text-xs text-gray-500">
                  Order: {format(new Date(order.orderDate), 'dd MMM yyyy')}
                  {order.deliveryDate && ` · Delivery: ${format(new Date(order.deliveryDate), 'dd MMM yyyy')}`}
                </p>
              </div>
              <AddParticularPicker onAdd={handleAddItem} adding={adding} />

            </div>

            {/* Particulars header */}
            {items.length > 0 && (
              <div className="flex items-center gap-2 px-1">
                <h2 className="font-semibold text-white text-base">Particulars</h2>
                <span className="badge badge-progress text-xs">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
              </div>
            )}

            {/* Empty state */}
            {items.length === 0 && (
              <div className="card p-10 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-surface-elevated flex items-center justify-center mx-auto">
                  <Plus className="w-7 h-7 text-gray-500" />
                </div>
                <p className="font-semibold text-gray-300">No particulars yet</p>
                <p className="text-sm text-gray-500">Click "Add Particular" above to add the first product/service.</p>
              </div>
            )}

            {/* Item rows */}
            {items.map((item, idx) => (
              <ParticularRow
                key={item.id}
                item={item}
                rowIndex={idx + 1}
                orderId={order.id}
                isEditing={order.status !== 'Draft'}
                onUpdate={handleUpdateItem}
                onDelete={() => handleDeleteItem(item.id)}
                onSaveToServer={async (updated) => {
                  await updateOrderItem(order.id, updated.id, updated);
                }}
              />
            ))}

            {/* Bottom action bar */}
            {/* ── Bottom action bar — always visible when order exists ── */}
            {items.length > 0 && (
              <div className="card p-4 flex flex-wrap items-center gap-3">

                {/* Submitted status badge */}
                {isSubmitted && (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-sm text-green-300 font-medium">Order Submitted</span>
                  </div>
                )}

                {/* Action buttons — always on the right */}
                <div className="flex gap-2 ml-auto flex-wrap">
                  <button onClick={handleSaveAll} disabled={savingAll} className="btn-secondary">
                    {savingAll ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {savingAll ? 'Saving…' : 'Save Changes'}
                  </button>
                  <button onClick={handlePrint} className="btn-secondary">
                    <Printer className="w-4 h-4" /> Print
                  </button>
                  {!isSubmitted && (
                    <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
                      {submitting ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {submitting ? 'Submitting…' : 'Submit Order'}
                    </button>
                  )}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </>
  );
}
