import { useRef } from 'react';
import { Upload, X, Eye } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * ImageUploadSlot — click-to-upload image slot with thumbnail preview.
 * Props:
 *   imageUrl    – current saved URL
 *   onUpload(file) – called with selected File
 *   onRemove()     – called when user removes the image
 *   label       – e.g. "Reference Image"
 *   small       – smaller compact variant
 */
export default function ImageUploadSlot({ imageUrl, onUpload, onRemove, label = 'Image', small = false }) {
  const inputRef = useRef(null);

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onUpload?.(file);
    e.target.value = '';
  };

  if (imageUrl) {
    return (
      <div className={`relative ${small ? 'w-14 h-14' : 'w-20 h-20'} rounded-lg overflow-hidden border border-surface-border group`}>
        <img
          src={`${API_BASE}${imageUrl}`}
          alt={label}
          className="w-full h-full object-cover"
        />
        {/* Overlay actions */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
          <button
            onClick={() => window.open(`${API_BASE}${imageUrl}`, '_blank')}
            className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/40"
            title="View"
          >
            <Eye className="w-3 h-3" />
          </button>
          <button
            onClick={onRemove}
            className="w-6 h-6 rounded-full bg-rose-500/60 flex items-center justify-center text-white hover:bg-rose-500"
            title="Remove"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className={`${small ? 'w-14 h-14' : 'w-20 h-20'} rounded-lg border-2 border-dashed border-surface-border hover:border-brand-500 transition-colors flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-brand-400 bg-surface-elevated/30`}
      title={`Upload ${label}`}
    >
      <Upload className={small ? 'w-3 h-3' : 'w-4 h-4'} />
      {!small && <span className="text-xs text-center leading-tight">{label}</span>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </button>
  );
}
