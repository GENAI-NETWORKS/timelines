import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmModal({ title, message, onConfirm, onCancel, confirmLabel = 'Delete', danger = true }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div className="flex min-h-full items-center justify-center p-4 text-center">
        <div
          className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-center shadow-2xl transition-all border border-gray-200 my-8"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${danger ? 'bg-rose-100' : 'bg-brand-100'}`}>
            <AlertTriangle className={`w-7 h-7 ${danger ? 'text-rose-600' : 'text-brand-600'}`} />
          </div>
          <h3 className="font-display font-bold text-xl text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-600 text-sm mb-6">{message}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={onCancel} className="btn-secondary min-w-[100px]">Cancel</button>
            <button onClick={onConfirm} className={danger ? 'btn-danger min-w-[100px]' : 'btn-primary min-w-[100px]'}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
