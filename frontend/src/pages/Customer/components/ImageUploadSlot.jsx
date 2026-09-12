import { useRef, useState, useEffect } from 'react';
import { Upload, X, Eye, Loader2 } from 'lucide-react';

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
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Clear preview if imageUrl is provided and matches the uploaded one, or if cleared.
  // Actually, we can just clear preview when imageUrl changes, assuming it's the server responding.
  useEffect(() => {
    if (imageUrl) {
      setPreviewUrl(null);
      setIsUploading(false);
    }
  }, [imageUrl]);

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Use FileReader for a bulletproof data URL preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewUrl(event.target.result);
        setIsUploading(true);
        
        // Defer upload so React can paint the base64 preview
        setTimeout(async () => {
          try {
            await onUpload?.(file);
          } finally {
            setIsUploading(false);
          }
        }, 50);
      };
      reader.readAsDataURL(file);
    }
    // Clear the input value so the same file can be selected again if needed
    e.target.value = '';
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    onRemove?.();
  };

  const displayUrl = previewUrl || imageUrl;

  if (displayUrl) {
    const src = displayUrl.startsWith('blob:') || displayUrl.startsWith('data:') || displayUrl.startsWith('http')
      ? displayUrl
      : `${API_BASE}${displayUrl}`;

    return (
      <div className={`relative ${small ? 'w-14 h-14' : 'w-20 h-20'} rounded-lg overflow-hidden border border-surface-border group`}>
        <img
          src={src}
          alt={label}
          className={`w-full h-full object-cover ${isUploading ? 'opacity-50 grayscale' : ''}`}
        />
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-white animate-spin drop-shadow-md" />
          </div>
        )}
        {/* Overlay actions */}
        {!isUploading && (
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
            <button
              onClick={() => window.open(src, '_blank')}
              className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-gray-900 hover:bg-white/40"
              title="View"
            >
              <Eye className="w-3 h-3" />
            </button>
            <button
              onClick={handleRemove}
              className="w-6 h-6 rounded-full bg-rose-500/60 flex items-center justify-center text-white hover:bg-rose-500"
              title="Remove"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
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
