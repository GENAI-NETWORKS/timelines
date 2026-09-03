import { useState } from 'react';
import { ChevronDown, Pencil, Image as ImageIcon } from 'lucide-react';
import MiniCanvas from './MiniCanvas';

const SECTION_META = {
  back_neck:   { label: 'Back Neck Design',  color: 'from-purple-500/20 to-transparent' },
  sleeve:      { label: 'Sleeve Design',     color: 'from-pink-500/20 to-transparent'   },
  front_neck:  { label: 'Front Neck Design', color: 'from-blue-500/20 to-transparent'   },
};

/**
 * DesignSection — collapsible accordion panel with notes textarea + MiniCanvas.
 * Props:
 *   sectionType: 'back_neck' | 'sleeve' | 'front_neck'
 *   notes: string
 *   onNotesChange: (val: string) => void
 *   sketchImageUrl: string | null
 *   sketchJSON: string | null
 *   orderId: string | null
 *   onSketchSave: (url: string, json: string) => void
 *   readOnly: boolean
 */
export default function DesignSection({
  sectionType, notes, onNotesChange, sketchImageUrl, sketchJSON, orderId, onSketchSave, readOnly = false
}) {
  const [open, setOpen] = useState(false);
  const meta = SECTION_META[sectionType] || { label: sectionType, color: '' };
  const hasSketch = Boolean(sketchImageUrl);
  const hasNotes  = Boolean(notes?.trim());

  return (
    <div className="card overflow-hidden">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-elevated/40 ${open ? 'border-b border-surface-border' : ''}`}
      >
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${meta.color} border border-surface-border flex items-center justify-center flex-shrink-0`}>
          <Pencil className="w-4 h-4 text-brand-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm">{meta.label}</p>
          <p className="text-xs text-gray-500 truncate">
            {hasNotes ? notes.slice(0, 60) + (notes.length > 60 ? '…' : '') : 'No notes yet'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasSketch && <span className="badge badge-ready text-xs flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Sketch</span>}
          {hasNotes  && <span className="badge badge-progress text-xs">Notes</span>}
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Collapsible body */}
      {open && (
        <div className="p-5 space-y-4 animate-fade-in">
          {/* Saved sketch thumbnail */}
          {hasSketch && (
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <img
                  src={`${import.meta.env.VITE_API_URL || ''}${sketchImageUrl}`}
                  alt={`${meta.label} sketch`}
                  className="w-28 h-20 object-contain rounded-lg border border-surface-border bg-[#0f0a1a]"
                />
              </div>
              <div className="text-xs text-gray-400">
                <p className="font-medium text-gray-300 mb-1">Current saved sketch</p>
                <p>Draw below to update it.</p>
              </div>
            </div>
          )}

          {/* Notes textarea */}
          <div>
            <label className="label">Design Notes</label>
            <textarea
              className="input min-h-[72px] resize-y"
              placeholder={`Describe the ${meta.label.toLowerCase()} — depth, shape, embroidery details…`}
              value={notes || ''}
              onChange={e => onNotesChange?.(e.target.value)}
              disabled={readOnly}
            />
          </div>

          {/* Mini canvas */}
          {!readOnly && (
            <div>
              <label className="label mb-2">Sketch</label>
              <MiniCanvas
                sectionType={sectionType}
                orderId={orderId}
                initialSketchJSON={sketchJSON}
                initialSketchUrl={sketchImageUrl}
                onSave={onSketchSave}
                readOnly={readOnly}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
