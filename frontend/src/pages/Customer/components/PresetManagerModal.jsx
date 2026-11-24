import React, { useState, useEffect } from 'react';
import {
  X, Plus, Edit2, Trash2, Check, Bookmark, Scissors,
  Layers, Ruler, Palette, Image as ImageIcon, Text, Sparkles, AlertCircle
} from 'lucide-react';
import {
  getOrderItemPresets,
  createOrderItemPreset,
  updateOrderItemPreset,
  deleteOrderItemPreset
} from '../../../api/orderItemPresets';
import toast from 'react-hot-toast';

export default function PresetManagerModal({
  isOpen,
  onClose,
  initialSaveData = null, // If opening to save a specific custom item { name, config, price }
  onPresetsChanged,
}) {
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State for creating/editing
  const [editingPreset, setEditingPreset] = useState(null); // null = new or list mode
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formConfig, setFormConfig] = useState({
    hasNotes: true,
    hasMeasurements: false,
    hasDesign: false,
    hasReferenceImage: false,
    hasLining: false,
    hasMeter: false,
    hasSource: false,
  });
  const [saving, setSaving] = useState(false);

  // Load presets
  const loadPresets = async () => {
    setLoading(true);
    try {
      const res = await getOrderItemPresets();
      setPresets(res.data || []);
      onPresetsChanged?.(res.data || []);
    } catch (err) {
      toast.error('Failed to load presets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPresets();
      if (initialSaveData) {
        // Pre-fill form from the item user clicked "Save as Preset" on
        setEditingPreset('NEW');
        setFormName(initialSaveData.name || '');
        setFormPrice(initialSaveData.price || '');
        setFormConfig({
          hasNotes: initialSaveData.config?.hasNotes ?? true,
          hasMeasurements: initialSaveData.config?.hasMeasurements ?? false,
          hasDesign: initialSaveData.config?.hasDesign ?? false,
          hasReferenceImage: initialSaveData.config?.hasReferenceImage ?? false,
          hasLining: initialSaveData.config?.hasLining ?? false,
          hasMeter: initialSaveData.config?.hasMeter ?? false,
          hasSource: initialSaveData.config?.hasSource ?? false,
        });
      } else {
        setEditingPreset(null);
      }
    }
  }, [isOpen, initialSaveData]);

  const handleStartCreate = () => {
    setEditingPreset('NEW');
    setFormName('');
    setFormPrice('');
    setFormConfig({
      hasNotes: true,
      hasMeasurements: false,
      hasDesign: false,
      hasReferenceImage: false,
      hasLining: false,
      hasMeter: false,
      hasSource: false,
    });
  };

  const handleStartEdit = (p) => {
    setEditingPreset(p);
    setFormName(p.name || '');
    setFormPrice(p.defaultPrice || '');
    setFormConfig({
      hasNotes: p.config?.hasNotes ?? true,
      hasMeasurements: p.config?.hasMeasurements ?? false,
      hasDesign: p.config?.hasDesign ?? false,
      hasReferenceImage: p.config?.hasReferenceImage ?? false,
      hasLining: p.config?.hasLining ?? false,
      hasMeter: p.config?.hasMeter ?? false,
      hasSource: p.config?.hasSource ?? false,
    });
  };

  const handleToggleField = (field) => {
    if (field === 'hasMeter') {
      setFormConfig(prev => {
        const nextVal = !prev.hasMeter;
        return { ...prev, hasMeter: nextVal, hasSource: nextVal };
      });
    } else {
      setFormConfig(prev => ({ ...prev, [field]: !prev[field] }));
    }
  };

  const handleSaveForm = async (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Preset name is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        config: formConfig,
        defaultPrice: Number(formPrice) || 0,
      };

      if (editingPreset && editingPreset.id) {
        await updateOrderItemPreset(editingPreset.id, payload);
        toast.success(`Preset "${formName.trim()}" updated!`);
      } else {
        await createOrderItemPreset(payload);
        toast.success(`Preset "${formName.trim()}" created!`);
      }

      setEditingPreset(null);
      await loadPresets();
      if (initialSaveData) {
        onClose();
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save preset');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (preset) => {
    if (!window.confirm(`Delete preset "${preset.name}"?`)) return;
    try {
      await deleteOrderItemPreset(preset.id);
      toast.success(`Preset "${preset.name}" deleted.`);
      loadPresets();
    } catch (err) {
      toast.error('Failed to delete preset');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-purple-100 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-700 via-purple-800 to-indigo-800 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
              <Bookmark className="w-5 h-5 text-purple-200" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {initialSaveData ? 'Save Custom Item as Preset' : 'Order Item Presets Manager'}
              </h2>
              <p className="text-xs text-purple-200">
                {initialSaveData
                  ? 'Save this item format to reuse anytime as a one-click preset.'
                  : 'Create, update or delete custom item presets to reuse across orders.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {editingPreset ? (
            /* ── Create / Edit Form ── */
            <form onSubmit={handleSaveForm} className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  {editingPreset === 'NEW' ? 'Create New Preset' : `Edit Preset: ${editingPreset.name}`}
                </h3>
                {!initialSaveData && (
                  <button
                    type="button"
                    onClick={() => setEditingPreset(null)}
                    className="text-xs text-gray-500 hover:text-gray-800 font-semibold"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Preset Item Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  className="input text-sm w-full font-semibold text-purple-950 placeholder:font-normal"
                  placeholder="e.g. Salwar Kameez, Lehenga, Kurti, Frock..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Default Stitching Price (₹) <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="number"
                  className="input text-sm w-full font-mono"
                  placeholder="e.g. 500"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">
                  Enabled Sections & Features:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { key: 'hasNotes', label: 'Notes', icon: Text },
                    { key: 'hasMeasurements', label: 'Measurements', icon: Ruler },
                    { key: 'hasDesign', label: 'Canvas / Design', icon: Palette },
                    { key: 'hasReferenceImage', label: 'Ref Image Upload', icon: ImageIcon },
                    { key: 'hasLining', label: 'Lining Sub-row', icon: Layers },
                    { key: 'hasMeter', label: 'Meter & Fabric Source', icon: Scissors },
                  ].map(({ key, label, icon: Icon }) => {
                    const active = formConfig[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleToggleField(key)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all text-left ${
                          active
                            ? 'bg-purple-50 border-purple-300 text-purple-800 shadow-sm'
                            : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-md flex items-center justify-center flex-shrink-0 ${
                            active ? 'bg-purple-600 text-white' : 'border border-gray-300 bg-white'
                          }`}
                        >
                          {active && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-2">
                {!initialSaveData && (
                  <button
                    type="button"
                    onClick={() => setEditingPreset(null)}
                    className="btn btn-secondary text-xs px-4"
                  >
                    Back to List
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving || !formName.trim()}
                  className="btn bg-purple-600 hover:bg-purple-700 text-white text-xs px-5 shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" /> Save Preset
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* ── Presets List Mode ── */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-800">Custom Item Presets</h3>
                  <p className="text-xs text-gray-400">These presets appear at the top of the order entry screen.</p>
                </div>
                <button
                  onClick={handleStartCreate}
                  className="btn bg-purple-600 hover:bg-purple-700 text-white text-xs flex items-center gap-1.5 px-3 py-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> + New Preset
                </button>
              </div>

              {loading ? (
                <div className="py-12 text-center text-xs text-gray-400">
                  <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Loading presets...
                </div>
              ) : presets.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-2xl p-6">
                  <Bookmark className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-gray-600">No custom presets saved yet</p>
                  <p className="text-[11px] text-gray-400 max-w-xs mx-auto mt-1">
                    Click "+ New Preset" or customize any item in your order and click "Save as Preset".
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-2xl overflow-hidden bg-white">
                  {presets.map((preset) => {
                    const cfg = preset.config || {};
                    const activePills = [];
                    if (cfg.hasNotes) activePills.push('Notes');
                    if (cfg.hasMeasurements) activePills.push('Meas');
                    if (cfg.hasDesign) activePills.push('Canvas');
                    if (cfg.hasReferenceImage) activePills.push('Image');
                    if (cfg.hasLining) activePills.push('Lining');
                    if (cfg.hasMeter) activePills.push('Meter');

                    return (
                      <div
                        key={preset.id}
                        className="p-3.5 flex items-center justify-between gap-3 hover:bg-purple-50/40 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 text-sm truncate">
                              {preset.name}
                            </span>
                            {Number(preset.defaultPrice) > 0 && (
                              <span className="text-[11px] font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                ₹{preset.defaultPrice}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {activePills.map((pill) => (
                              <span
                                key={pill}
                                className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200"
                              >
                                {pill}
                              </span>
                            ))}
                            {activePills.length === 0 && (
                              <span className="text-[10px] text-gray-400 italic">Basic item</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleStartEdit(preset)}
                            className="btn-icon text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                            title="Edit Preset"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(preset)}
                            className="btn-icon text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                            title="Delete Preset"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between flex-shrink-0 text-xs text-gray-400">
          <span>Saved presets are shared across all orders</span>
          <button
            onClick={onClose}
            className="btn btn-secondary text-xs px-4 py-1.5"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
