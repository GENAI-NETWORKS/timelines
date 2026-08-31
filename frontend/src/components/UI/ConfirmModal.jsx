import { X, AlertTriangle } from 'lucide-react';

export default function ConfirmModal({ title, message, onConfirm, onCancel, confirmLabel = 'Delete', danger = true }) {
  return (
    <>
      <div className="backdrop" onClick={onCancel} />
      <div className="modal">
        <div className="modal-box max-w-md">
          <div className="p-6 text-center">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${danger ? 'bg-rose-900/40' : 'bg-brand-900/40'}`}>
              <AlertTriangle className={`w-7 h-7 ${danger ? 'text-rose-400' : 'text-brand-400'}`} />
            </div>
            <h3 className="font-display font-bold text-xl text-white mb-2">{title}</h3>
            <p className="text-gray-400 text-sm mb-6">{message}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={onCancel} className="btn-secondary min-w-[100px]">Cancel</button>
              <button onClick={onConfirm} className={danger ? 'btn-danger min-w-[100px]' : 'btn-primary min-w-[100px]'}>
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
