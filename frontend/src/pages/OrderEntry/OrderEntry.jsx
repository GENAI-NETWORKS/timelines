import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronDown, ChevronUp, Save, Printer, ArrowLeft, Loader,
  User, FileText, List, Palette, Ruler, CheckSquare, AlertCircle, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

import { getFullOrder, createFullOrder, updateFullOrder } from '../../api/designOrders';
import { getGarmentTemplates } from '../../api/garmentTemplates';
import { getTailors } from '../../api/employees';

import CustomerPicker from './components/CustomerPicker';
import ParticularsTable, { DEFAULT_ITEMS } from './components/ParticularsTable';
import DesignSection from './components/DesignSection';
import MeasurementGrid from './components/MeasurementGrid';

// ─── Section IDs for accordion ────────────────────────────────────────────
const SECTIONS = [
  { id: 'customer',     label: 'Customer',       icon: User,       color: 'text-blue-400'   },
  { id: 'header',       label: 'Order Header',   icon: FileText,   color: 'text-brand-400'  },
  { id: 'particulars',  label: 'Particulars',    icon: List,       color: 'text-emerald-400'},
  { id: 'design',       label: 'Design Details', icon: Palette,    color: 'text-pink-400'   },
  { id: 'measurements', label: 'Measurements',   icon: Ruler,      color: 'text-amber-400'  },
];

const GARMENT_TYPES_ORDER = ['Blouse', 'Chudi', 'Frock', 'Pavadai Sattai'];
const STATUSES = ['Pending', 'In Progress', 'Ready', 'Delivered'];
const DESIGN_SECTION_TYPES = ['back_neck', 'sleeve', 'front_neck'];
const AUTOSAVE_KEY = 'order_entry_draft';

function emptyForm() {
  return {
    customer: { customerId: '', name: '', phone: '', email: '', address: '', isNew: false },
    garmentType: '',
    assignedTailorId: '',
    status: 'Pending',
    orderDate: new Date().toISOString().slice(0, 10),
    deliveryDate: '',
    bagRef: '',
    isSample: false,
    baseDescription: '',
    fabricNotes: '',
    specialInstructions: '',
    particulars: DEFAULT_ITEMS.map(p => ({ ...p })),
    threadColors: '',
    buttonsNeeded: '',
    designSections: DESIGN_SECTION_TYPES.map(t => ({ sectionType: t, notes: '', sketchImageUrl: null, sketchJSON: null })),
    measurements: {},
    customerConfirmedAt: null,
  };
}

// ─── Accordion section wrapper ────────────────────────────────────────────
function Section({ id, label, icon: Icon, color, open, onToggle, children, badge }) {
  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-elevated/30 ${open ? 'border-b border-surface-border' : ''}`}
      >
        <div className={`w-8 h-8 rounded-lg bg-surface-elevated border border-surface-border flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <span className="font-semibold text-white flex-1 text-sm">{label}</span>
        {badge && <span className="badge badge-ready text-xs">{badge}</span>}
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="p-5 animate-fade-in">{children}</div>}
    </div>
  );
}

// ─── Print-only order layout ──────────────────────────────────────────────
function PrintLayout({ form, orderId, templates }) {
  const tpl = templates.find(t => t.garmentType === form.garmentType);
  const fields = tpl?.fields ? [...tpl.fields].sort((a, b) => a.order - b.order) : [];
  return (
    <div className="print-only print-order-layout">
      {/* Header */}
      <div className="print-header">
        <h1>TIMELINES COSTUME DESIGNERS — ORDER FORM</h1>
        <div className="print-header-grid">
          <div><b>Order ID:</b> {orderId || '—'}</div>
          <div><b>Date:</b> {form.orderDate}</div>
          <div><b>Due Date:</b> {form.deliveryDate || '—'}</div>
          <div><b>Customer:</b> {form.customer.name}</div>
          <div><b>Phone:</b> {form.customer.phone}</div>
          <div><b>Address:</b> {form.customer.address || '—'}</div>
          <div><b>Bag/Ref:</b> {form.bagRef || '—'}</div>
          <div><b>Sample:</b> {form.isSample ? 'YES' : 'NO'}</div>
          <div><b>Garment:</b> {form.garmentType}</div>
          <div className="span-3"><b>Description:</b> {form.baseDescription || form.fabricNotes || '—'}</div>
        </div>
      </div>

      {/* Particulars */}
      <div className="print-section">
        <h2>PARTICULARS</h2>
        <table>
          <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Notes</th></tr></thead>
          <tbody>
            {form.particulars.map((p, i) => (
              <tr key={i}><td>{i + 1}</td><td>{p.itemName}</td><td>{p.qty}</td><td>{p.notes}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="print-row">
          <b>Thread Colors:</b> {form.threadColors || '—'}
          &nbsp;&nbsp;&nbsp;<b>Buttons:</b> {form.buttonsNeeded || '—'}
        </div>
      </div>

      {/* Design sections */}
      <div className="print-section">
        <h2>DESIGN NOTES</h2>
        {DESIGN_SECTION_TYPES.map((st) => {
          const sec = form.designSections.find(s => s.sectionType === st) || {};
          const label = { back_neck: 'Back Neck', sleeve: 'Sleeve', front_neck: 'Front Neck' }[st];
          return (
            <div key={st} className="print-design-block">
              <div className="print-design-label">{label}</div>
              <div className="print-design-notes">{sec.notes || '—'}</div>
              {sec.sketchImageUrl && (
                <img
                  src={`${import.meta.env.VITE_API_URL || ''}${sec.sketchImageUrl}`}
                  alt={label}
                  className="print-sketch"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Measurements */}
      <div className="print-section">
        <h2>MEASUREMENTS — {form.garmentType}</h2>
        <div className="print-measurements">
          {fields.map(f => (
            <div key={f.name} className="print-meas-cell">
              <span className="print-meas-label">{f.name.replace(/_/g, ' ')}</span>
              <span className="print-meas-val">{form.measurements?.[f.name] || '____'} in</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="print-footer">
        <div><b>Customer Confirmed:</b> {form.customerConfirmedAt ? format(new Date(form.customerConfirmedAt), 'dd MMM yyyy HH:mm') : '________________________'}</div>
        <div><b>Special Instructions:</b> {form.specialInstructions || '—'}</div>
      </div>
    </div>
  );
}

// ─── Main OrderEntry page ─────────────────────────────────────────────────
export default function OrderEntry() {
  const { id: editId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = Boolean(editId);

  const [form, setForm] = useState(emptyForm());
  const [openSections, setOpenSections] = useState({ customer: true, header: true, particulars: false, design: false, measurements: false });
  const [templates, setTemplates] = useState([]);
  const [tailors, setTailors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(isEdit);
  const [autoSavedAt, setAutoSavedAt] = useState(null);
  const [orderId, setOrderId] = useState(editId || null);
  const autosaveRef = useRef(null);

  const toggleSection = (id) => setOpenSections(s => ({ ...s, [id]: !s[id] }));

  // Current garment template
  const currentTemplate = templates.find(t => t.garmentType === form.garmentType);
  const measurementFields = currentTemplate?.fields || [];

  // ── Load templates & tailors ─────────────────────────────────────────────
  useEffect(() => {
    getGarmentTemplates().then(r => setTemplates(r.data)).catch(() => {});
    getTailors().then(r => setTailors(r.data)).catch(() => {});
  }, []);

  // ── Load existing order (edit mode) ─────────────────────────────────────
  useEffect(() => {
    if (!isEdit) {
      // New order — check for draft in localStorage
      const draft = localStorage.getItem(AUTOSAVE_KEY);
      if (draft) {
        try {
          const d = JSON.parse(draft);
          setForm(d);
          toast('Draft restored from autosave', { icon: '💾' });
        } catch {}
      }
      // Check for ?customer_id= query param
      const custId = searchParams.get('customer_id');
      if (custId) {
        // We'll just pass the customer_id; CustomerPicker can show it as pre-selected
        setForm(f => ({ ...f, customer: { ...f.customer, customerId: custId } }));
      }
      return;
    }

    setLoadingOrder(true);
    getFullOrder(editId)
      .then(r => {
        const o = r.data;
        setOrderId(o.orderId);
        setForm({
          customer: {
            customerId: o.customer?.customerId || o.customerId,
            name: o.customer?.name || '',
            phone: o.customer?.phone || '',
            email: o.customer?.email || '',
            address: o.customer?.address || '',
            isNew: false,
          },
          garmentType: o.garmentType || '',
          assignedTailorId: o.assignedTailorId || o.tailor?.employeeId || '',
          status: o.status || 'Pending',
          orderDate: o.orderDate?.slice(0, 10) || '',
          deliveryDate: o.deliveryDate?.slice(0, 10) || '',
          bagRef: o.bagRef || '',
          isSample: Boolean(o.isSample),
          baseDescription: o.baseDescription || '',
          fabricNotes: o.fabricNotes || '',
          specialInstructions: o.specialInstructions || '',
          particulars: o.particulars?.length
            ? o.particulars.map(p => ({ itemName: p.itemName, qty: p.qty, notes: p.notes }))
            : DEFAULT_ITEMS.map(p => ({ ...p })),
          threadColors: o.threadColors || '',
          buttonsNeeded: o.buttonsNeeded || '',
          designSections: DESIGN_SECTION_TYPES.map(st => {
            const s = o.designSections?.find(s => s.sectionType === st);
            return { sectionType: st, notes: s?.notes || '', sketchImageUrl: s?.sketchImageUrl || null, sketchJSON: s?.sketchJSON || null };
          }),
          measurements: o.measurements || {},
          customerConfirmedAt: o.customerConfirmedAt || null,
        });
      })
      .catch(() => { toast.error('Failed to load order.'); navigate('/orders'); })
      .finally(() => setLoadingOrder(false));
  }, [editId, isEdit]);

  // ── Autosave ─────────────────────────────────────────────────────────────
  const doAutosave = useCallback(async () => {
    if (isEdit && orderId) {
      // Backend autosave for existing orders
      try {
        const payload = buildPayload();
        await updateFullOrder(orderId, payload);
        setAutoSavedAt(new Date());
      } catch {}
    } else {
      // localStorage draft for new orders
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(form));
      setAutoSavedAt(new Date());
    }
  }, [form, isEdit, orderId]);

  useEffect(() => {
    clearInterval(autosaveRef.current);
    autosaveRef.current = setInterval(doAutosave, 30000);
    return () => clearInterval(autosaveRef.current);
  }, [doAutosave]);

  // ── Build payload ─────────────────────────────────────────────────────────
  const buildPayload = () => ({
    customerId: form.customer.isNew ? undefined : form.customer.customerId,
    newCustomer: form.customer.isNew ? {
      name: form.customer.name,
      phone: form.customer.phone,
      email: form.customer.email,
      address: form.customer.address,
    } : undefined,
    garmentType: form.garmentType,
    measurements: form.measurements,
    fabricNotes: form.fabricNotes,
    specialInstructions: form.specialInstructions,
    assignedTailorId: form.assignedTailorId || null,
    deliveryDate: form.deliveryDate || null,
    orderDate: form.orderDate,
    status: form.status,
    bagRef: form.bagRef || null,
    isSample: form.isSample,
    baseDescription: form.baseDescription,
    threadColors: form.threadColors,
    buttonsNeeded: form.buttonsNeeded,
    customerConfirmedAt: form.customerConfirmedAt,
    particulars: form.particulars.filter(p => p.itemName.trim()),
    designSections: form.designSections.map(s => ({
      sectionType: s.sectionType,
      notes: s.notes || '',
      sketchImageUrl: s.sketchImageUrl || null,
      sketchJSON: s.sketchJSON || null,
    })),
  });

  // ── Validate ──────────────────────────────────────────────────────────────
  const validate = () => {
    if (!form.customer.customerId && !form.customer.isNew) {
      toast.error('Please select or create a customer.'); setOpenSections(s => ({ ...s, customer: true })); return false;
    }
    if (form.customer.isNew && !form.customer.name?.trim()) {
      toast.error('New customer name is required.'); setOpenSections(s => ({ ...s, customer: true })); return false;
    }
    if (!form.garmentType) {
      toast.error('Please select a garment type.'); setOpenSections(s => ({ ...s, header: true })); return false;
    }
    return true;
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async (andPrint = false) => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isEdit) {
        await updateFullOrder(orderId, payload);
        toast.success('Order updated!');
      } else {
        const res = await createFullOrder(payload);
        setOrderId(res.data.orderId);
        localStorage.removeItem(AUTOSAVE_KEY);
        toast.success(`Order ${res.data.orderId} created!`);
        if (!andPrint) navigate('/orders');
      }
      if (andPrint) window.print();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save order.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = () => {
    setForm(f => ({
      ...f,
      customerConfirmedAt: f.customerConfirmedAt ? null : new Date().toISOString(),
    }));
  };

  const updateDesignSection = (sectionType, field, val) => {
    setForm(f => ({
      ...f,
      designSections: f.designSections.map(s =>
        s.sectionType === sectionType ? { ...s, [field]: val } : s
      ),
    }));
  };

  if (loadingOrder) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-3">
          <Loader className="w-8 h-8 text-brand-400 animate-spin mx-auto" />
          <p className="text-gray-400 text-sm">Loading order…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Print Layout (hidden on screen, visible on print) */}
      <PrintLayout form={form} orderId={orderId} templates={templates} />

      {/* Screen UI */}
      <div className="space-y-4 animate-fade-in no-print">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/orders')} className="btn-icon">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="font-display font-bold text-2xl text-white">
                {isEdit ? `Edit Order — ${orderId}` : 'New Order'}
              </h1>
              <p className="text-sm text-gray-500 flex items-center gap-2">
                {isEdit ? 'Update order details below' : 'Fill all sections and save'}
                {autoSavedAt && (
                  <span className="flex items-center gap-1 text-green-400/80 text-xs">
                    <Clock className="w-3 h-3" />
                    Autosaved {format(autoSavedAt, 'HH:mm:ss')}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2 sm:ml-auto">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="btn-secondary"
            >
              {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="btn-primary"
            >
              <Printer className="w-4 h-4" />
              Save & Print
            </button>
          </div>
        </div>

        {/* ── Section A: Customer ─────────────────────────────────────────── */}
        <Section id="customer" label="A — Customer" icon={User} color="text-blue-400" open={openSections.customer} onToggle={toggleSection}
          badge={form.customer.name || null}
        >
          <CustomerPicker
            value={form.customer}
            onChange={(c) => setForm(f => ({ ...f, customer: c }))}
          />
        </Section>

        {/* ── Section B: Order Header ─────────────────────────────────────── */}
        <Section id="header" label="B — Order Header" icon={FileText} color="text-brand-400" open={openSections.header} onToggle={toggleSection}
          badge={form.garmentType || null}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">Garment Type *</label>
              <select
                id="garment-type-select"
                className="select"
                value={form.garmentType}
                onChange={e => setForm(f => ({ ...f, garmentType: e.target.value, measurements: {} }))}
                required
              >
                <option value="">Select garment…</option>
                {/* Paper-form 4 first */}
                {GARMENT_TYPES_ORDER.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
                {/* Then any other templates not in the list */}
                {templates.filter(t => !GARMENT_TYPES_ORDER.includes(t.garmentType)).map(t => (
                  <option key={t.id} value={t.garmentType}>{t.garmentType}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Assign Tailor</label>
              <select
                id="tailor-select"
                className="select"
                value={form.assignedTailorId}
                onChange={e => setForm(f => ({ ...f, assignedTailorId: e.target.value }))}
              >
                <option value="">Unassigned</option>
                {tailors.map(t => <option key={t.employeeId} value={t.employeeId}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select
                id="status-select"
                className="select"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              >
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Entry Date</label>
              <input
                id="order-date-input"
                className="input"
                type="date"
                value={form.orderDate}
                onChange={e => setForm(f => ({ ...f, orderDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Due / Delivery Date</label>
              <input
                id="delivery-date-input"
                className="input"
                type="date"
                value={form.deliveryDate}
                onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Bag / Ref No</label>
              <input
                id="bag-ref-input"
                className="input"
                placeholder="e.g. BAG-042"
                value={form.bagRef}
                onChange={e => setForm(f => ({ ...f, bagRef: e.target.value }))}
              />
            </div>
            <div className="flex items-end gap-3 pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => setForm(f => ({ ...f, isSample: !f.isSample }))}
                  className={`w-10 h-6 rounded-full transition-colors duration-200 flex items-center px-1 ${form.isSample ? 'bg-gradient-brand' : 'bg-surface-elevated border border-surface-border'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${form.isSample ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <span className="text-sm text-gray-300">Sample Order</span>
              </label>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="label">Base Description / Color Notes</label>
              <textarea
                id="base-description-input"
                className="input min-h-[60px] resize-none"
                placeholder="e.g. Maroon Kanjivaram silk, gold zari border"
                value={form.baseDescription}
                onChange={e => setForm(f => ({ ...f, baseDescription: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="label">Special Instructions</label>
              <textarea
                id="special-instructions-input"
                className="input min-h-[60px] resize-none"
                placeholder="e.g. Puff sleeves, embroidery border, piping at neck"
                value={form.specialInstructions}
                onChange={e => setForm(f => ({ ...f, specialInstructions: e.target.value }))}
              />
            </div>
          </div>
        </Section>

        {/* ── Section C: Particulars ──────────────────────────────────────── */}
        <Section id="particulars" label="C — Particulars" icon={List} color="text-emerald-400" open={openSections.particulars} onToggle={toggleSection}
          badge={form.particulars.filter(p => p.itemName.trim()).length > 0 ? `${form.particulars.filter(p => p.itemName.trim()).length} items` : null}
        >
          <ParticularsTable
            particulars={form.particulars}
            onChange={(p) => setForm(f => ({ ...f, particulars: p }))}
            threadColors={form.threadColors}
            onThreadColors={(v) => setForm(f => ({ ...f, threadColors: v }))}
            buttonsNeeded={form.buttonsNeeded}
            onButtonsNeeded={(v) => setForm(f => ({ ...f, buttonsNeeded: v }))}
          />
        </Section>

        {/* ── Section D: Design Details ───────────────────────────────────── */}
        <Section id="design" label="D — Design Details" icon={Palette} color="text-pink-400" open={openSections.design} onToggle={toggleSection}
          badge={form.designSections.some(s => s.notes?.trim() || s.sketchImageUrl) ? 'Has sketches' : null}
        >
          <div className="space-y-3">
            {DESIGN_SECTION_TYPES.map(st => {
              const sec = form.designSections.find(s => s.sectionType === st) || { sectionType: st, notes: '', sketchImageUrl: null, sketchJSON: null };
              return (
                <DesignSection
                  key={st}
                  sectionType={st}
                  notes={sec.notes}
                  onNotesChange={(v) => updateDesignSection(st, 'notes', v)}
                  sketchImageUrl={sec.sketchImageUrl}
                  sketchJSON={sec.sketchJSON}
                  orderId={orderId}
                  onSketchSave={(url, json) => {
                    updateDesignSection(st, 'sketchImageUrl', url);
                    updateDesignSection(st, 'sketchJSON', json);
                  }}
                />
              );
            })}
          </div>
          {!orderId && (
            <div className="mt-3 flex items-center gap-2 text-xs text-amber-400 bg-amber-900/20 border border-amber-800/40 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Save the order first to enable sketch uploads in design sections.
            </div>
          )}
        </Section>

        {/* ── Section E: Measurements ─────────────────────────────────────── */}
        <Section id="measurements" label="E — Measurements" icon={Ruler} color="text-amber-400" open={openSections.measurements} onToggle={toggleSection}
          badge={Object.keys(form.measurements).filter(k => form.measurements[k]).length > 0
            ? `${Object.keys(form.measurements).filter(k => form.measurements[k]).length} filled`
            : null}
        >
          <MeasurementGrid
            garmentType={form.garmentType}
            fields={measurementFields}
            values={form.measurements}
            onChange={(field, val) => setForm(f => ({ ...f, measurements: { ...f.measurements, [field]: val } }))}
          />
        </Section>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="card p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Customer confirmed */}
          <label className="flex items-center gap-3 cursor-pointer flex-1">
            <div
              onClick={handleConfirm}
              className={`w-10 h-6 rounded-full transition-colors duration-200 flex items-center px-1 ${form.customerConfirmedAt ? 'bg-gradient-brand' : 'bg-surface-elevated border border-surface-border'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${form.customerConfirmedAt ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Customer Confirmed</p>
              {form.customerConfirmedAt ? (
                <p className="text-xs text-green-400 flex items-center gap-1">
                  <CheckSquare className="w-3 h-3" />
                  {format(new Date(form.customerConfirmedAt), 'dd MMM yyyy, HH:mm')}
                </p>
              ) : (
                <p className="text-xs text-gray-500">Toggle to record customer sign-off timestamp</p>
              )}
            </div>
          </label>

          <div className="flex gap-2">
            <button onClick={() => handleSave(false)} disabled={saving} className="btn-secondary">
              {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button onClick={() => handleSave(true)} disabled={saving} className="btn-primary">
              <Printer className="w-4 h-4" />
              Save & Print
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
