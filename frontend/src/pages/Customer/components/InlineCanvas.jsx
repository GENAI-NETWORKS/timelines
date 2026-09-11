import { useEffect, useRef, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import { Pen, Eraser, Square, Circle, Type, Trash2, Download, Save, RotateCcw, Minus, MoveRight, Loader, ZoomIn, ZoomOut, Maximize, Camera, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import DesignLibraryPicker from './DesignLibraryPicker';
import CameraCapture from './CameraCapture';

const COLORS = ['#be4bf4', '#f43f5e', '#60a5fa', '#34d399', '#fbbf24', '#fb923c', '#ffffff', '#94a3b8', '#1e1e2e'];
const SIZES = [1, 2, 4, 7, 12];

const TOOLS = [
  { id: 'select', label: 'Select', icon: '↖' },
  { id: 'pen', label: 'Pen', icon: Pen },
  { id: 'line', label: 'Line', icon: Minus },
  { id: 'arrow', label: 'Arrow', icon: MoveRight },
  { id: 'rect', label: 'Rect', icon: Square },
  { id: 'circle', label: 'Circle', icon: Circle },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'eraser', label: 'Eraser', icon: Eraser },
];

/**
 * InlineCanvas — compact drawing canvas embedded inside a particular row.
 * Props:
 *   width, height  – canvas dimensions (default 460 × 280)
 *   initialJSON    – previously saved fabric JSON
 *   onSave(pngDataURL, jsonString) – called when user hits Save
 *   savedImageUrl  – thumbnail URL of last saved image (shown as badge)
 *   label          – e.g. "Front Design"
 */
export default function InlineCanvas({ width = 460, height = 280, initialJSON, onSave, savedImageUrl, label = 'Canvas', saving = false, backgroundImageUrl = null, itemType = 'default', section = 'front', subItem = null }) {
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const isDrawing = useRef(false);
  const startPt = useRef(null);
  const activeObj = useRef(null);

  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#be4bf4');
  const [size, setSize] = useState(2);
  const [ready, setReady] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  
  const [showLibrary, setShowLibrary] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const handleDropImage = (url) => {
    const cvs = fabricRef.current;
    if (!cvs) return;
    
    const fullUrl = url.startsWith('/') 
      ? `${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}${url}` 
      : url;

    fabric.FabricImage.fromURL(fullUrl, { crossOrigin: 'anonymous' }).then(img => {
      if (img.width > width * 0.8) img.scaleToWidth(width * 0.8);
      if (img.getScaledHeight() > height * 0.8) img.scaleToHeight(height * 0.8);
      img.set({
        left: width / 2 - img.getScaledWidth() / 2,
        top: height / 2 - img.getScaledHeight() / 2,
        cornerColor: '#be4bf4',
        cornerStyle: 'circle',
        selectable: true,
        hasControls: true,
        hasBorders: true,
      });
      cvs.add(img);
      cvs.setActiveObject(img);
      cvs.renderAll();
      setHasContent(true);
      // Auto-switch to select so the image can be moved immediately
      setTool('select');
    }).catch(() => toast.error('Could not load image onto canvas'));
  };

  // Init
  useEffect(() => {
    if (!canvasRef.current) return;
    const cvs = new fabric.Canvas(canvasRef.current, { width, height, selection: false });
    cvs.backgroundColor = '#0f0a1a';
    cvs.renderAll();
    cvs.freeDrawingBrush = new fabric.PencilBrush(cvs);
    cvs.freeDrawingBrush.color = color;
    cvs.freeDrawingBrush.width = size;

    cvs.on('mouse:wheel', opt => {
      let z = cvs.getZoom() * (0.999 ** opt.e.deltaY);
      z = Math.min(10, Math.max(0.2, z));
      cvs.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, z);
      opt.e.preventDefault(); opt.e.stopPropagation();
    });
    cvs.on('object:added', () => setHasContent(true));

    // Double-click on an object → instantly switch to Select mode and select it
    cvs.on('mouse:dblclick', (opt) => {
      const target = opt.target;
      if (target) {
        setTool('select');
        cvs.selection = true;
        cvs.getObjects().forEach(o => {
          o.selectable = true; o.hasControls = true; o.hasBorders = true; o.evented = true;
        });
        cvs.setActiveObject(target);
        cvs.renderAll();
      }
    });

    fabricRef.current = cvs;
    setReady(true);
    return () => { try { cvs.dispose(); } catch { } fabricRef.current = null; };
  }, [width, height]);

  // Load saved JSON and background image in correct order
  useEffect(() => {
    const cvs = fabricRef.current;
    if (!cvs || !ready) return;

    const setupCanvas = async () => {
      try {
        if (initialJSON) {
          const json = typeof initialJSON === 'string' ? JSON.parse(initialJSON) : initialJSON;
          await cvs.loadFromJSON(json);
          cvs.backgroundColor = '#0f0a1a'; // Ensure background remains dark after load
          setHasContent(true);
        }
      } catch (err) {
        console.error('Error loading JSON:', err);
      }

      if (backgroundImageUrl) {
        try {
          // Check if library background already exists from JSON
          const prev = cvs.getObjects().find(o => o.data?.isLibraryBg);
          if (!prev) {
            const img = await fabric.FabricImage.fromURL(backgroundImageUrl, { crossOrigin: 'anonymous' });
            img.scaleToWidth(width);
            if (img.getScaledHeight() < height) img.scaleToHeight(height);
            img.set({
              left: 0, top: 0,
              selectable: false, evented: false,
              lockMovementX: true, lockMovementY: true,
              hoverCursor: 'default',
              data: { isLibraryBg: true }
            });
            cvs.insertAt(0, img);
          }
        } catch (err) {
          toast.error('Could not load library image');
        }
      }
      cvs.renderAll();
    };

    setupCanvas();
  }, [ready, initialJSON, backgroundImageUrl, width, height]);

  // Apply tool — mutually exclusive modes
  useEffect(() => {
    const cvs = fabricRef.current;
    if (!cvs || !ready) return;
    cvs.isDrawingMode = false;
    cvs.off('mouse:down'); cvs.off('mouse:move'); cvs.off('mouse:up');

    if (tool === 'select') {
      // SELECT MODE: objects are movable, no drawing
      cvs.selection = true;
      cvs.defaultCursor = 'default';
      cvs.hoverCursor = 'move';
      cvs.getObjects().forEach(o => {
        o.selectable = true;
        o.hasControls = true;
        o.hasBorders = true;
        o.evented = true;
      });
      cvs.renderAll();
      return;
    }

    // DRAWING MODES: lock all objects so clicks only draw, not move
    cvs.selection = false;
    cvs.getObjects().forEach(o => {
      o.selectable = false;
      o.evented = false;
    });
    cvs.renderAll();
    if (tool === 'pen') {
      cvs.isDrawingMode = true;
      cvs.freeDrawingBrush.color = color;
      cvs.freeDrawingBrush.width = size;
      return;
    }
    if (tool === 'eraser') {
      cvs.isDrawingMode = true;
      cvs.freeDrawingBrush.color = '#0f0a1a';
      cvs.freeDrawingBrush.width = size * 4;
      return;
    }
    if (tool === 'text') {
      cvs.on('mouse:down', opt => {
        const p = cvs.getScenePoint(opt.e);
        const t = new fabric.Textbox('Text', { 
          left: p.x, 
          top: p.y, 
          fill: color, 
          fontSize: 18, 
          fontFamily: 'Inter, sans-serif',
          width: 150,
          splitByGrapheme: true
        });
        cvs.add(t); cvs.setActiveObject(t); t.enterEditing(); t.selectAll(); cvs.renderAll();
        setTool('select');
      });
      return;
    }
    // Shape tools
    cvs.on('mouse:down', opt => {
      isDrawing.current = true;
      startPt.current = cvs.getScenePoint(opt.e);
      // Ensure newly drawn objects are not selectable while in drawing mode
      const base = { stroke: color, strokeWidth: size, fill: 'transparent', selectable: false, evented: false };
      let shape;
      if (tool === 'rect') shape = new fabric.Rect({ ...base, left: startPt.current.x, top: startPt.current.y, width: 1, height: 1 });
      else if (tool === 'circle') shape = new fabric.Circle({ ...base, left: startPt.current.x, top: startPt.current.y, radius: 1 });
      else if (tool === 'arrow') {
        const p = startPt.current;
        shape = new fabric.Path([['M', p.x, p.y], ['L', p.x, p.y]], { ...base, fill: '', strokeLineCap: 'round', strokeLineJoin: 'round' });
      }
      else shape = new fabric.Line([startPt.current.x, startPt.current.y, startPt.current.x, startPt.current.y], { ...base, fill: '' });
      cvs.add(shape); activeObj.current = shape;
    });
    cvs.on('mouse:move', opt => {
      if (!isDrawing.current || !activeObj.current) return;
      const p = cvs.getScenePoint(opt.e), s = startPt.current;
      if (tool === 'rect') activeObj.current.set({ left: Math.min(p.x, s.x), top: Math.min(p.y, s.y), width: Math.abs(p.x - s.x), height: Math.abs(p.y - s.y) });
      else if (tool === 'circle') { const r = Math.hypot(p.x - s.x, p.y - s.y) / 2; activeObj.current.set({ radius: r, left: Math.min(p.x, s.x), top: Math.min(p.y, s.y) }); }
      else if (tool === 'arrow') {
        // Path objects cannot just be updated via path string because their bounding box and pathOffset won't recalculate.
        // We recreate the path on the fly to render the arrowhead correctly.
        cvs.remove(activeObj.current);
        const dx = p.x - s.x, dy = p.y - s.y;
        const angle = Math.atan2(dy, dx);
        const headlen = 15;
        const path = [
          ['M', s.x, s.y],
          ['L', p.x, p.y],
          ['M', p.x, p.y],
          ['L', p.x - headlen * Math.cos(angle - Math.PI / 6), p.y - headlen * Math.sin(angle - Math.PI / 6)],
          ['M', p.x, p.y],
          ['L', p.x - headlen * Math.cos(angle + Math.PI / 6), p.y - headlen * Math.sin(angle + Math.PI / 6)]
        ];
        activeObj.current = new fabric.Path(path, { stroke: color, strokeWidth: size, fill: '', strokeLineCap: 'round', strokeLineJoin: 'round', selectable: false, evented: false });
        cvs.add(activeObj.current);
      }
      else activeObj.current.set({ x2: p.x, y2: p.y });
      cvs.renderAll();
    });
    cvs.on('mouse:up', () => { 
      isDrawing.current = false; 
      activeObj.current = null; 
      setTool('select'); 
    });
  }, [tool, color, size, ready]);

  const undo = () => { const cvs = fabricRef.current; if (!cvs) return; const o = cvs.getObjects(); if (o.length) { cvs.remove(o[o.length - 1]); cvs.renderAll(); } };
  const clear = () => { const cvs = fabricRef.current; if (!cvs) return; cvs.clear(); cvs.backgroundColor = '#0f0a1a'; cvs.renderAll(); setHasContent(false); };
  const zoom = (d) => { const cvs = fabricRef.current; if (!cvs) return; const z = Math.min(10, Math.max(0.2, cvs.getZoom() * d)); cvs.zoomToPoint({ x: width / 2, y: height / 2 }, z); };
  const reset = () => { const cvs = fabricRef.current; if (!cvs) return; cvs.setZoom(1); cvs.viewportTransform[4] = 0; cvs.viewportTransform[5] = 0; cvs.requestRenderAll(); };

  const handleSave = useCallback(() => {
    const cvs = fabricRef.current;
    if (!cvs) return;
    // Export as highly compressed JPEG to prevent massive 3MB+ strings dragging down performance
    const png = cvs.toDataURL({ format: 'jpeg', quality: 0.5 });
    // Keep the full state for editing
    const json = JSON.stringify(cvs.toJSON(['isLibraryBg', 'id', 'name']));
    onSave?.(png, json);
  }, [onSave]);

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1">
        {TOOLS.map(t => {
          const isActive = tool === t.id;
          if (t.id === 'select') return (
            <button key={t.id} onClick={() => setTool(t.id)} title="Select / Move — or Double-click any object">
              <span className={`flex items-center gap-1 px-2 h-7 rounded-md text-xs font-bold transition-all ${isActive ? 'bg-gradient-brand text-white shadow-sm' : 'text-gray-400 border border-dashed border-gray-500 hover:border-brand-400 hover:text-brand-300'}`}>
                ↖ Select
              </span>
            </button>
          );
          return (
            <button key={t.id} onClick={() => setTool(t.id)} title={t.label}
              className={`w-7 h-7 rounded-md flex items-center justify-center text-xs transition-all ${isActive ? 'bg-gradient-brand text-white' : 'text-gray-400 hover:bg-surface-elevated hover:text-white'}`}>
              {typeof t.icon === 'string' ? t.icon : <t.icon className="w-3 h-3" />}
            </button>
          );
        })}
        <div className="w-px h-5 bg-surface-border mx-0.5" />
        <button onClick={undo} className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-surface-elevated" title="Undo"><RotateCcw className="w-3 h-3" /></button>
        <button onClick={clear} className="w-7 h-7 rounded-md flex items-center justify-center text-rose-400 hover:bg-surface-elevated" title="Clear"><Trash2 className="w-3 h-3" /></button>
        <div className="w-px h-5 bg-surface-border mx-0.5" />
        {COLORS.map(c => (
          <button key={c} onClick={() => setColor(c)}
            className={`w-4 h-4 rounded-full border-2 transition-transform ${color === c ? 'border-white scale-125' : 'border-transparent'}`}
            style={{ backgroundColor: c }} />
        ))}
        <div className="w-px h-5 bg-surface-border mx-0.5" />
        {SIZES.map(s => (
          <button key={s} onClick={() => setSize(s)}
            className={`w-6 h-7 rounded-md text-xs font-bold transition-all ${size === s ? 'bg-gradient-brand text-white' : 'text-gray-400 hover:bg-surface-elevated hover:text-white'}`}>
            {s}
          </button>
        ))}
        <div className="w-px h-5 bg-surface-border mx-1.5" />
        <button onClick={() => setShowLibrary(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-brand-50 text-brand-700 hover:bg-brand-100 hover:text-brand-800 transition-colors border border-brand-200 shadow-sm">
          <ImageIcon className="w-3.5 h-3.5" /> Library
        </button>
        <button onClick={() => setShowCamera(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 transition-colors border border-emerald-200 shadow-sm">
          <Camera className="w-3.5 h-3.5" /> Camera
        </button>
        <div className="flex gap-0.5 ml-auto">
          <button onClick={() => zoom(1.3)} className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-surface-elevated" title="Zoom In"><ZoomIn className="w-3 h-3" /></button>
          <button onClick={reset} className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-surface-elevated" title="Reset"><Maximize className="w-3 h-3" /></button>
          <button onClick={() => zoom(0.7)} className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-surface-elevated" title="Zoom Out"><ZoomOut className="w-3 h-3" /></button>
          <button onClick={() => { const cvs = fabricRef.current; if (!cvs) return; const link = document.createElement('a'); link.download = `${label}.png`; link.href = cvs.toDataURL({ format: 'png' }); link.click(); }}
            className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-surface-elevated" title="Export PNG"><Download className="w-3 h-3" /></button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1 px-2 h-7 rounded-md bg-gradient-brand text-white text-xs font-semibold disabled:opacity-60">
            {saving ? <Loader className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save
          </button>
        </div>
      </div>

      {/* Reference Images Strip */}
      {subItem && (() => {
        const BACKEND = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '');
        const refs = [
          { key: 'referenceImageUrl', label: 'Ref' },
          { key: 'frontDesignImageUrl', label: 'Front' },
          { key: 'backDesignImageUrl', label: 'Back' },
          { key: 'sleeveDesignImageUrl', label: 'Sleeve' },
        ].filter(r => subItem[r.key]);
        if (!refs.length) return null;
        return (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Add to Canvas →</span>
            {refs.map(r => {
              const url = subItem[r.key].startsWith('/') ? `${BACKEND}${subItem[r.key]}` : subItem[r.key];
              return (
                <button key={r.key} title={`Add ${r.label} image to canvas`}
                  onClick={() => handleDropImage(subItem[r.key])}
                  className="group relative w-12 h-12 rounded-lg overflow-hidden border-2 border-dashed border-brand-300 hover:border-brand-500 transition-all shadow-sm hover:shadow-md">
                  <img src={url} alt={r.label} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-[9px] font-bold">+ ADD</span>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] text-center font-semibold py-0.5">{r.label}</div>
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* Canvas */}
      <div
        className="relative rounded-lg overflow-hidden border border-surface-border"
        style={{ width, height: height + 2 }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
        onDrop={(e) => {
          e.preventDefault();
          const url = e.dataTransfer.getData('text/plain');
          if (!url) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const dropX = e.clientX - rect.left;
          const dropY = e.clientY - rect.top;
          const cvs = fabricRef.current;
          if (!cvs) return;
          const fullUrl = url.startsWith('/')
            ? `${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}${url}`
            : url;
          fabric.FabricImage.fromURL(fullUrl, { crossOrigin: 'anonymous' }).then(img => {
            if (img.width > width * 0.6) img.scaleToWidth(width * 0.6);
            if (img.getScaledHeight() > height * 0.6) img.scaleToHeight(height * 0.6);
            img.set({
              left: dropX - img.getScaledWidth() / 2,
              top: dropY - img.getScaledHeight() / 2,
              cornerColor: '#be4bf4',
              cornerStyle: 'circle',
            });
            cvs.add(img);
            cvs.setActiveObject(img);
            cvs.renderAll();
            setHasContent(true);
          }).catch(() => toast.error('Could not drop image onto canvas'));
        }}
      >
        <canvas ref={canvasRef} className="block" />
        {savedImageUrl && !hasContent && (
          <div className="absolute top-1 right-1 badge badge-ready text-xs">Saved</div>
        )}
      </div>

      {/* Modals */}
      {showLibrary && (
        <DesignLibraryPicker
          itemType={itemType}
          section={section}
          onClose={() => setShowLibrary(false)}
          onSelect={(imgObj) => {
            handleDropImage(imgObj.url);
            setShowLibrary(false);
          }}
        />
      )}

      {showCamera && (
        <CameraCapture
          onClose={() => setShowCamera(false)}
          onCapture={(dataUrl) => handleDropImage(dataUrl)}
        />
      )}
    </div>
  );
}
