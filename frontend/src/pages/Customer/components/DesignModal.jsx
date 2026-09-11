import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import InlineCanvas from './InlineCanvas';
import toast from 'react-hot-toast';

export default function DesignModal({ orderId, item, activeSub, section, onUpdate, onClose }) {
  const subItems = item.subItems || [];
  const subItem = subItems[activeSub] || {};
  const containerRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 700, height: 380 });

  // Measure container and fit canvas exactly — no fixed pixel sizes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setCanvasSize({
        width: Math.floor(rect.width) - 2,
        height: Math.floor(rect.height) - 2,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleSaveCanvas = (dataUrl, json) => {
    const newSubs = [...subItems];
    newSubs[activeSub] = {
      ...newSubs[activeSub],
      [`${section}CanvasDataUrl`]: dataUrl,
      [`${section}CanvasJSON`]: json,
    };
    onUpdate({ ...item, subItems: newSubs });
    toast.success(`${section} design saved locally. Press "Save Changes" to upload.`);
    onClose();
  };

  const title = `Draw ${section.charAt(0).toUpperCase() + section.slice(1)} - Item ${activeSub + 1}`;

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[1500] bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal — fills viewport, canvas expands to fill */}
      <div className="fixed inset-0 z-[1501] flex items-center justify-center p-3 sm:p-5 pointer-events-none">
        <div
          className="pointer-events-auto w-full bg-white rounded-2xl shadow-2xl border border-surface-border flex flex-col overflow-hidden"
          style={{ maxWidth: '920px', height: 'calc(100vh - 48px)', maxHeight: '800px' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-surface-border flex-shrink-0">
            <h3 className="font-display font-bold text-lg text-gray-900">{title}</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Canvas area — grows to fill ALL remaining height, no scroll */}
          <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden p-3">
            {canvasSize.width > 100 && (
              <InlineCanvas
                width={canvasSize.width}
                height={canvasSize.height}
                initialJSON={subItem[`${section}CanvasJSON`]}
                savedImageUrl={subItem[`${section}CanvasDataUrl`]}
                onSave={handleSaveCanvas}
                label={`${section}-canvas`}
                itemType={item.itemType}
                section={section}
                subItem={subItem}
              />
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
