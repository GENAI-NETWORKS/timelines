import { useEffect, useState } from 'react';

/**
 * MeasurementGrid — renders the measurement fields for the selected garment type.
 * Props:
 *   garmentType: string
 *   fields: Array<{name, label, unit, required, order}>  (from garment template)
 *   values: Record<string, string | number>
 *   onChange: (field: string, value: string) => void
 *   readOnly: boolean
 */
export default function MeasurementGrid({ garmentType, fields = [], values = {}, onChange, readOnly = false }) {
  const [visible, setVisible] = useState(false);

  // Animate swap on garment type change
  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, [garmentType]);

  if (!garmentType || fields.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm border border-dashed border-surface-border rounded-xl">
        {garmentType ? 'No measurement template found for this garment type.' : 'Select a garment type in Section B to see its measurement fields.'}
      </div>
    );
  }

  const sorted = [...fields].sort((a, b) => a.order - b.order);

  return (
    <div
      className="transition-all duration-300"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(8px)' }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-gradient-brand inline-block" />
        <h4 className="text-sm font-semibold text-gray-300">{garmentType} Measurements</h4>
        <span className="text-xs text-gray-500">({sorted.length} fields · inches)</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {sorted.map((field) => {
          const val = values?.[field.name] ?? '';
          return (
            <div key={field.name}>
              <label className="label text-xs" title={field.label}>
                {field.name.replace(/_/g, ' ')}
                {field.required && <span className="text-rose-400 ml-0.5">*</span>}
              </label>
              <p className="text-xs text-gray-600 mb-1 truncate">{field.label}</p>
              <div className="flex">
                <input
                  id={`meas-${field.name}`}
                  className="input rounded-r-none flex-1 text-sm py-2"
                  type="number"
                  step="0.25"
                  min="0"
                  max="200"
                  placeholder="0"
                  value={val}
                  onChange={e => onChange?.(field.name, e.target.value)}
                  required={field.required}
                  disabled={readOnly}
                />
                <span className="px-2 bg-surface-elevated border border-l-0 border-surface-border rounded-r-lg text-xs text-gray-500 flex items-center flex-shrink-0">
                  in
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
