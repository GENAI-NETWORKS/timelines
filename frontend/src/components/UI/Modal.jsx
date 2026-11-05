import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, onClose, children, size = 'max-w-2xl' }) {
  // Lock background scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <>
      {/* Blurred, static backdrop — high z-index covers topbar & sidebar */}
      <div className="backdrop" onClick={onClose} />

      <div className="modal">
        <div className={`modal-box ${size} w-full`}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-surface-border">
            <h3 className="font-display font-bold text-xl text-gray-900">{title}</h3>
            <button onClick={onClose} className="btn-icon">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="px-6 py-5">{children}</div>
        </div>
      </div>
    </>
  );
}
