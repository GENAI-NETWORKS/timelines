import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({ title, onClose, children, size = 'max-w-2xl' }) {
  // Lock background scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Use createPortal to mount directly on document.body
  // This guarantees the backdrop and modal sit above all headers, sidebars, and layouts without clipping
  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* Blurred, full-screen static backdrop covering entire screen evenly */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Centering wrapper */}
      <div className="flex min-h-full items-center justify-center p-3 sm:p-5 text-center">
        <div
          className={`relative w-full ${size} transform rounded-2xl bg-white text-left shadow-2xl transition-all border border-gray-200 my-6 flex flex-col max-h-[92vh] overflow-hidden`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - always pinned at the top */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-surface-border bg-white flex-shrink-0">
            <h3 className="font-display font-bold text-xl text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal scrollable content */}
          <div className="px-6 py-5 overflow-y-auto flex-1">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
