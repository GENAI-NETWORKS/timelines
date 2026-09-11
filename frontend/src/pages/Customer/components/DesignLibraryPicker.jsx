/**
 * DesignLibraryPicker.jsx
 *
 * A modal that shows admin-uploaded default reference images for a given
 * design section (front / back / sleeve).
 *
 * Features:
 *  - Thumbnail grid (up to 20 images per section)
 *  - Click to select, then "Use as Reference" to pass URL back to canvas
 *  - Admin can upload new images (max 20 per section)
 *  - Admin can delete existing ones (x button on hover)
 *  - Renders via React portal so it sits above the canvas/panels
 */
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Image, Loader, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getDesignLibrary,
  uploadDesignLibraryImage,
  deleteDesignLibraryImage,
} from '../../../api/designLibrary';

const BACKEND = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '');

function thumb(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${BACKEND}${url}`;
}

export default function DesignLibraryPicker({ itemType, section, onSelect, onClose }) {
  const [images,    setImages]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const sectionLabel = section.charAt(0).toUpperCase() + section.slice(1);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await getDesignLibrary(itemType);
        setImages(res.data?.data?.[section] || []);
      } catch {
        toast.error('Failed to load design library');
      } finally {
        setLoading(false);
      }
    })();
  }, [section]);

  // ── Upload ────────────────────────────────────────────────────────────────
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (images.length >= 20) { toast.error('Max 20 images per section'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await uploadDesignLibraryImage(itemType, section, fd);
      setImages(prev => [...prev, res.data.data]);
      toast.success('Image added to library');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (e, imgId) => {
    e.stopPropagation();
    try {
      await deleteDesignLibraryImage(itemType, section, imgId);
      setImages(prev => prev.filter(i => i.id !== imgId));
      toast.success('Image deleted');
    } catch {
      toast.error('Delete failed');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[2000] bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-[2001] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-2xl bg-surface-card border border-surface-border rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
          style={{ animation: 'fadeInScale 0.18s cubic-bezier(0.4,0,0.2,1)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-border flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-brand-900/40 flex items-center justify-center">
              <Image className="w-4 h-4 text-brand-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-bold text-gray-900 text-sm">
                {sectionLabel} Design Library
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {images.length}/20 images · Click to select or <strong>drag</strong> onto canvas
              </p>
            </div>

            <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
              images.length >= 20
                ? 'opacity-40 cursor-not-allowed bg-surface-elevated text-gray-400'
                : 'bg-brand-600 hover:bg-brand-500 text-white'
            }`}>
              {uploading ? <Loader className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              Upload
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                disabled={images.length >= 20 || uploading}
                onChange={handleUpload}
              />
            </label>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-surface-elevated transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader className="w-6 h-6 text-brand-400 animate-spin" />
              </div>
            ) : images.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-surface-elevated flex items-center justify-center mb-4">
                  <Image className="w-8 h-8 text-gray-500" />
                </div>
                <p className="font-semibold text-gray-700 mb-1">No images yet</p>
                <p className="text-sm text-gray-500 mb-4">
                  Upload up to 20 default reference images for {sectionLabel} design
                </p>
                <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium cursor-pointer transition-colors">
                  <Upload className="w-4 h-4" />
                  Upload First Image
                  <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={handleUpload} />
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                {images.map(img => (
                  <div
                    key={img.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', img.url);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    className="relative group rounded-xl overflow-hidden border-2 border-surface-border hover:border-brand-400/50 transition-all aspect-square cursor-grab active:cursor-grabbing"
                  >
                    <img src={thumb(img.url)} alt={`${sectionLabel} ref`} className="w-full h-full object-cover" draggable={false} />
                    <button
                      onClick={(e) => { e.stopPropagation(); onSelect?.(img); onClose(); }}
                      className="absolute inset-0 bg-brand-600/0 group-hover:bg-brand-600/20 transition-colors" title="Click to add to canvas"
                    />
                    <button
                      onClick={(e) => handleDelete(e, img.id)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                      title="Remove from library"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity py-1">
                      <p className="text-[8px] text-white text-center font-semibold">Drag to canvas</p>
                    </div>
                  </div>
                ))}

                {images.length < 20 && (
                  <label className="aspect-square rounded-xl border-2 border-dashed border-surface-border hover:border-brand-500/50 flex items-center justify-center cursor-pointer transition-colors group">
                    <div className="flex flex-col items-center gap-1 text-gray-500 group-hover:text-brand-400 transition-colors">
                      <Upload className="w-5 h-5" />
                      <span className="text-[10px] font-medium">Add</span>
                    </div>
                    <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={handleUpload} />
                  </label>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-surface-border flex items-center justify-between flex-shrink-0">
            <p className="text-xs text-gray-500">
              {images.length > 0 ? `${images.length} images available` : 'No images uploaded'}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg text-sm text-gray-600 hover:text-gray-900 hover:bg-surface-elevated transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onClose}
                disabled={images.length === 0}
                className="px-4 py-1.5 rounded-lg text-sm font-medium bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>,
    document.body
  );
}
