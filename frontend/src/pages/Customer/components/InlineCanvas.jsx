import { useEffect, useRef, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import { Pen, Eraser, Square, Circle, Type, Trash2, Download, Save, RotateCcw, Minus, Loader, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import toast from 'react-hot-toast';

const COLORS = ['#be4bf4', '#f43f5e', '#60a5fa', '#34d399', '#fbbf24', '#fb923c', '#ffffff', '#94a3b8', '#1e1e2e'];
const SIZES = [1, 2, 4, 7, 12];

const TOOLS = [
  { id: 'select', label: 'Select', icon: '↖' },
  { id: 'pen', label: 'Pen', icon: Pen },
  { id: 'line', label: 'Line', icon: Minus },
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
export default function InlineCanvas({ width = 460, height = 280, initialJSON, onSave, savedImageUrl, label = 'Canvas', saving = false }) {
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
    fabricRef.current = cvs;
    setReady(true);
    return () => { try { cvs.dispose(); } catch { } fabricRef.current = null; };
  }, [width, height]);

  // Load saved JSON
  useEffect(() => {
    const cvs = fabricRef.current;
    if (!cvs || !ready || !initialJSON) return;
    try {
      const json = typeof initialJSON === 'string' ? JSON.parse(initialJSON) : initialJSON;
      cvs.loadFromJSON(json, () => cvs.renderAll());
      setHasContent(true);
    } catch { }
  }, [ready, initialJSON]);

  // Apply tool
  useEffect(() => {
    const cvs = fabricRef.current;
    if (!cvs || !ready) return;
    cvs.isDrawingMode = false;
    cvs.selection = false;
    cvs.off('mouse:down'); cvs.off('mouse:move'); cvs.off('mouse:up');
    cvs.getObjects().forEach(o => { o.selectable = tool === 'select'; });

    if (tool === 'select') { cvs.selection = true; return; }
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
        const t = new fabric.IText('Text', { left: p.x, top: p.y, fill: color, fontSize: 13, fontFamily: 'Inter, sans-serif' });
        cvs.add(t); cvs.setActiveObject(t); t.enterEditing(); t.selectAll(); cvs.renderAll();
        setTool('select');
      });
      return;
    }
    // Shape tools
    cvs.on('mouse:down', opt => {
      isDrawing.current = true;
      startPt.current = cvs.getScenePoint(opt.e);
      const base = { stroke: color, strokeWidth: size, fill: 'transparent', selectable: true };
      let shape;
      if (tool === 'rect') shape = new fabric.Rect({ ...base, left: startPt.current.x, top: startPt.current.y, width: 1, height: 1 });
      else if (tool === 'circle') shape = new fabric.Circle({ ...base, left: startPt.current.x, top: startPt.current.y, radius: 1 });
      else shape = new fabric.Line([startPt.current.x, startPt.current.y, startPt.current.x, startPt.current.y], { ...base, fill: undefined });
      cvs.add(shape); activeObj.current = shape;
    });
    cvs.on('mouse:move', opt => {
      if (!isDrawing.current || !activeObj.current) return;
      const p = cvs.getScenePoint(opt.e), s = startPt.current;
      if (tool === 'rect') activeObj.current.set({ left: Math.min(p.x, s.x), top: Math.min(p.y, s.y), width: Math.abs(p.x - s.x), height: Math.abs(p.y - s.y) });
      else if (tool === 'circle') { const r = Math.hypot(p.x - s.x, p.y - s.y) / 2; activeObj.current.set({ radius: r, left: Math.min(p.x, s.x), top: Math.min(p.y, s.y) }); }
      else activeObj.current.set({ x2: p.x, y2: p.y });
      cvs.renderAll();
    });
    cvs.on('mouse:up', () => { isDrawing.current = false; activeObj.current = null; });
  }, [tool, color, size, ready]);

  const undo = () => { const cvs = fabricRef.current; if (!cvs) return; const o = cvs.getObjects(); if (o.length) { cvs.remove(o[o.length - 1]); cvs.renderAll(); } };
  const clear = () => { const cvs = fabricRef.current; if (!cvs) return; cvs.clear(); cvs.backgroundColor = '#0f0a1a'; cvs.renderAll(); setHasContent(false); };
  const zoom = (d) => { const cvs = fabricRef.current; if (!cvs) return; const z = Math.min(10, Math.max(0.2, cvs.getZoom() * d)); cvs.zoomToPoint({ x: width / 2, y: height / 2 }, z); };
  const reset = () => { const cvs = fabricRef.current; if (!cvs) return; cvs.setZoom(1); cvs.viewportTransform[4] = 0; cvs.viewportTransform[5] = 0; cvs.requestRenderAll(); };

  const handleSave = useCallback(() => {
    const cvs = fabricRef.current;
    if (!cvs) return;
    const png = cvs.toDataURL({ format: 'png', quality: 0.9 });
    const json = JSON.stringify(cvs.toJSON());
    onSave?.(png, json);
  }, [onSave]);

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1">
        {TOOLS.map(t => (
          <button key={t.id} onClick={() => setTool(t.id)} title={t.label}
            className={`w-7 h-7 rounded-md flex items-center justify-center text-xs transition-all ${tool === t.id ? 'bg-gradient-brand text-white' : 'text-gray-400 hover:bg-surface-elevated hover:text-white'}`}>
            {typeof t.icon === 'string' ? t.icon : <t.icon className="w-3 h-3" />}
          </button>
        ))}
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

      {/* Canvas */}
      <div className="relative rounded-lg overflow-hidden border border-surface-border" style={{ width, height: height + 2 }}>
        <canvas ref={canvasRef} className="block" />
        {savedImageUrl && !hasContent && (
          <div className="absolute top-1 right-1 badge badge-ready text-xs">Saved</div>
        )}
      </div>
    </div>
  );
}
