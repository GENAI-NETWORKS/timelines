import { X } from 'lucide-react';

export default function Modal({ title, onClose, children, size = 'max-w-2xl' }) {
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="modal">
        <div className={`modal-box ${size} w-full`}>
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-surface-border">
            <h3 className="font-display font-bold text-xl text-white">{title}</h3>
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
