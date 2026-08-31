import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, GripVertical, Loader } from 'lucide-react';
import { getGarmentTemplates, createGarmentTemplate, updateGarmentTemplate, deleteGarmentTemplate } from '../../api/garmentTemplates';
import Modal from '../../components/UI/Modal';
import ConfirmModal from '../../components/UI/ConfirmModal';
import toast from 'react-hot-toast';

const UNITS = ['inches', 'cm'];
const EMPTY_FIELD = { name: '', label: '', unit: 'inches', required: false, order: 0 };
const EMPTY_TPL = { garmentType: '', fields: [], isActive: true };

function FieldRow({ field, onChange, onRemove, index }) {
  return (
    <div className="flex gap-2 items-start bg-surface-elevated rounded-lg p-3">
      <GripVertical className="w-4 h-4 text-gray-600 mt-2 flex-shrink-0" />
      <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <label className="label">Field Name</label>
          <input className="input text-xs" value={field.name} onChange={e => onChange({ ...field, name: e.target.value })} placeholder="e.g. shoulder" required />
        </div>
        <div>
          <label className="label">Label</label>
          <input className="input text-xs" value={field.label} onChange={e => onChange({ ...field, label: e.target.value })} placeholder="e.g. Shoulder Width" required />
        </div>
        <div>
          <label className="label">Unit</label>
          <select className="select text-xs" value={field.unit} onChange={e => onChange({ ...field, unit: e.target.value })}>
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="label">Required</label>
          <label className="flex items-center gap-2 cursor-pointer mt-2">
            <input type="checkbox" checked={field.required} onChange={e => onChange({ ...field, required: e.target.checked })} className="w-4 h-4 rounded accent-brand-500" />
            <span className="text-xs text-gray-400">Required</span>
          </label>
        </div>
      </div>
      <button type="button" onClick={onRemove} className="btn-icon text-rose-400 mt-1 flex-shrink-0">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function TemplateForm({ value, onChange, onSubmit, loading, onCancel, title }) {
  const addField = () => onChange({ ...value, fields: [...value.fields, { ...EMPTY_FIELD, order: value.fields.length }] });
  const updateField = (i, f) => onChange({ ...value, fields: value.fields.map((x, idx) => idx === i ? f : x) });
  const removeField = (i) => onChange({ ...value, fields: value.fields.filter((_, idx) => idx !== i) });

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Garment Type Name *</label>
          <input className="input" value={value.garmentType} onChange={e => onChange({ ...value, garmentType: e.target.value })} required placeholder="e.g. Blouse, Frock…" />
        </div>
        <div className="flex items-end gap-3">
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input type="checkbox" checked={value.isActive} onChange={e => onChange({ ...value, isActive: e.target.checked })} className="w-4 h-4 rounded accent-brand-500" />
            <span className="text-sm text-gray-300">Active</span>
          </label>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-300">Measurement Fields</h4>
          <button type="button" onClick={addField} className="btn-secondary text-xs py-1.5 px-3">
            <Plus className="w-3 h-3" /> Add Field
          </button>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {value.fields.length === 0 && <p className="text-center text-gray-500 text-sm py-4">No fields yet. Click "Add Field" to begin.</p>}
          {value.fields.map((f, i) => (
            <FieldRow key={i} field={f} onChange={fld => updateField(i, fld)} onRemove={() => removeField(i)} index={i} />
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">{loading ? 'Saving…' : title}</button>
      </div>
    </form>
  );
}

export default function GarmentTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [editData, setEditData] = useState(EMPTY_TPL);
  const [editId, setEditId] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const res = await getGarmentTemplates(); setTemplates(res.data); }
    catch { toast.error('Failed to load templates.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault(); setFormLoading(true);
    try { await createGarmentTemplate(editData); toast.success('Template created!'); setModal(null); setEditData(EMPTY_TPL); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    finally { setFormLoading(false); }
  };

  const handleEdit = async (e) => {
    e.preventDefault(); setFormLoading(true);
    try { await updateGarmentTemplate(editId, editData); toast.success('Template updated!'); setModal(null); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async () => {
    try { await deleteGarmentTemplate(deleteId); toast.success('Deleted.'); setDeleteId(null); load(); }
    catch { toast.error('Failed.'); }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Garment Templates</h1>
          <p className="text-sm text-gray-500">Configure measurement fields per garment type</p>
        </div>
        <button onClick={() => { setEditData(EMPTY_TPL); setModal('create'); }} className="btn-primary">
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>

      {loading && <div className="text-center py-10"><Loader className="w-6 h-6 text-brand-400 animate-spin mx-auto" /></div>}

      <div className="space-y-3">
        {templates.map(tpl => (
          <div key={tpl.id} className="card">
            <div
              className="flex items-center justify-between p-5 cursor-pointer hover:bg-surface-elevated/30 transition-colors rounded-xl"
              onClick={() => setExpanded(expanded === tpl.id ? null : tpl.id)}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center text-white font-bold text-sm">
                  {tpl.garmentType.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-display font-semibold text-white">{tpl.garmentType}</h3>
                  <p className="text-xs text-gray-500">{tpl.fields.length} measurement fields · {tpl.isActive ? 'Active' : 'Inactive'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={e => { e.stopPropagation(); setEditId(tpl.id); setEditData({ garmentType: tpl.garmentType, fields: tpl.fields, isActive: tpl.isActive }); setModal('edit'); }} className="btn-icon text-blue-400"><Edit2 className="w-4 h-4" /></button>
                <button onClick={e => { e.stopPropagation(); setDeleteId(tpl.id); }} className="btn-icon text-rose-400"><Trash2 className="w-4 h-4" /></button>
                {expanded === tpl.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </div>
            </div>
            {expanded === tpl.id && (
              <div className="px-5 pb-5 border-t border-surface-border pt-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {[...tpl.fields].sort((a, b) => a.order - b.order).map((f, i) => (
                    <div key={i} className="bg-surface-elevated rounded-lg px-3 py-2 text-xs flex items-center justify-between gap-2">
                      <span className="text-gray-300">{f.label}</span>
                      <div className="flex gap-1">
                        <span className="text-gray-600">{f.unit}</span>
                        {f.required && <span className="text-rose-400">*</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {modal === 'create' && <Modal title="New Garment Template" onClose={() => setModal(null)} size="max-w-3xl"><TemplateForm value={editData} onChange={setEditData} onSubmit={handleCreate} loading={formLoading} onCancel={() => setModal(null)} title="Create Template" /></Modal>}
      {modal === 'edit' && <Modal title="Edit Garment Template" onClose={() => setModal(null)} size="max-w-3xl"><TemplateForm value={editData} onChange={setEditData} onSubmit={handleEdit} loading={formLoading} onCancel={() => setModal(null)} title="Save Changes" /></Modal>}
      {deleteId && <ConfirmModal title="Delete Template?" message="Existing orders using this garment type won't be affected." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />}
    </div>
  );
}
