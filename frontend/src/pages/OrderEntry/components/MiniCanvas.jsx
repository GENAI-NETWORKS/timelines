import { useEffect, useRef, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import {
  Pen, Eraser, Square, Circle, Type, Trash2, Download, Save,
  RotateCcw, Minus, Loader, MoveUpRight, ZoomIn, ZoomOut, Maximize,
  GripHorizontal, AlignCenterHorizontal, Image as ImageIcon, Lock
} from 'lucide-react';
import { uploadSectionSketch } from '../../../api/designOrders';
import toast from 'react-hot-toast';

const TOOLS = [
  { id: 'select', label: 'Select', icon: '↖' },
  { id: 'pen',    label: 'Pen',    icon: Pen },
  { id: 'line',   label: 'Line',   icon: Minus },
  { id: 'arrow',  label: 'Arrow',  icon: MoveUpRight },
  { id: 'rect',   label: 'Rect',   icon: Square },
  { id: 'circle', label: 'Circle', icon: Circle },
  { id: 'text',   label: 'Text',   icon: Type },
  { id: 'eraser', label: 'Eraser', icon: Eraser },
];

const COLORS = ['#be4bf4', '#f43f5e', '#60a5fa', '#34d399', '#fbbf24', '#fb923c', '#ffffff', '#94a3b8', '#000000'];
const STROKE_SIZES = [1, 2, 4, 6, 10];

/**
 * MiniCanvas — scoped design canvas for one order design section.
 * Props:
 *   sectionType: 'back_neck' | 'sleeve' | 'front_neck'
 *   orderId: string | null  (null = new order, sketch saved later)
 *   initialSketchJSON: string | null
 *   initialSketchUrl: string | null
 *   onSave: (url: string, json: string) => void
 *   readOnly: boolean
 */
export default function MiniCanvas({ sectionType, orderId, initialSketchJSON, initialSketchUrl, onSave, readOnly = false }) {
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const isDrawing = useRef(false);
  const startPt = useRef(null);
  const activeShape = useRef(null);

  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#be4bf4');
  const [strokeSize, setStrokeSize] = useState(2);
  const [lineStyle, setLineStyle] = useState('solid');
  const [saving, setSaving] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // ── Init Fabric canvas ──────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;
    const cvs = new fabric.Canvas(canvasRef.current, {
      width: 520,
      height: 340,
      selection: !readOnly,
    });
    cvs.backgroundColor = '#0f0a1a';
    cvs.renderAll();
    cvs.freeDrawingBrush = new fabric.PencilBrush(cvs);
    cvs.freeDrawingBrush.color = '#be4bf4';
    cvs.freeDrawingBrush.width = 2;

    // Zoom via mouse wheel
    cvs.on('mouse:wheel', (opt) => {
      let delta = opt.e.deltaY;
      let zoom = cvs.getZoom();
      zoom *= 0.999 ** delta;
      if (zoom > 10) zoom = 10;
      if (zoom < 0.2) zoom = 0.2;
      cvs.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    cvs.on('object:added', () => setHasDrawn(true));

    fabricRef.current = cvs;
    setCanvasReady(true);

    return () => {
      try { cvs.dispose(); } catch {}
      fabricRef.current = null;
    };
  }, [readOnly]);

  // ── Load initial sketch JSON ────────────────────────────────────────────
  useEffect(() => {
    const cvs = fabricRef.current;
    if (!cvs || !canvasReady || !initialSketchJSON) return;
    try {
      const json = typeof initialSketchJSON === 'string' ? JSON.parse(initialSketchJSON) : initialSketchJSON;
      cvs.loadFromJSON(json, () => { cvs.renderAll(); });
    } catch {}
  }, [canvasReady, initialSketchJSON]);

  // ── Apply tool ──────────────────────────────────────────────────────────
  useEffect(() => {
    const cvs = fabricRef.current;
    if (!cvs || !canvasReady || readOnly) return;

    cvs.isDrawingMode = false;
    cvs.selection = tool === 'select';
    cvs.off('mouse:down');
    cvs.off('mouse:move');
    cvs.off('mouse:up');
    cvs.getObjects().forEach(o => { o.selectable = tool === 'select'; });
    cvs.renderAll();

    // Alt+drag to pan
    cvs.on('mouse:down', function (opt) {
      if (opt.e.altKey) {
        this.isDragging = true; this.selection = false;
        this.lastPosX = opt.e.clientX; this.lastPosY = opt.e.clientY;
      }
    });
    cvs.on('mouse:move', function (opt) {
      if (this.isDragging) {
        let vpt = this.viewportTransform;
        vpt[4] += opt.e.clientX - this.lastPosX;
        vpt[5] += opt.e.clientY - this.lastPosY;
        this.requestRenderAll();
        this.lastPosX = opt.e.clientX; this.lastPosY = opt.e.clientY;
      }
    });
    cvs.on('mouse:up', function () {
      if (this.isDragging) {
        this.setViewportTransform(this.viewportTransform);
        this.isDragging = false;
        this.selection = tool === 'select';
      }
    });

    let dashArray = null;
    if (lineStyle === 'dashed') dashArray = [strokeSize * 4, strokeSize * 4];
    if (lineStyle === 'dotted') dashArray = [strokeSize, strokeSize * 2];

    if (tool === 'pen') {
      cvs.isDrawingMode = true;
      cvs.freeDrawingBrush.color = color;
      cvs.freeDrawingBrush.width = strokeSize;
      cvs.freeDrawingBrush.strokeDashArray = dashArray;
      return;
    }
    if (tool === 'eraser') {
      cvs.isDrawingMode = true;
      cvs.freeDrawingBrush.color = '#0f0a1a';
      cvs.freeDrawingBrush.width = 20;
      return;
    }
    if (tool === 'text') {
      cvs.on('mouse:down', opt => {
        const ptr = cvs.getScenePoint(opt.e);
        const txt = new fabric.IText('Type…', { left: ptr.x, top: ptr.y, fill: color, fontSize: 14, fontFamily: 'Inter, sans-serif' });
        cvs.add(txt); cvs.setActiveObject(txt); txt.enterEditing(); txt.selectAll(); cvs.renderAll();
        setTool('select');
      });
      return;
    }
    if (['rect', 'circle', 'line', 'arrow'].includes(tool)) {
      cvs.on('mouse:down', opt => {
        isDrawing.current = true;
        startPt.current = cvs.getScenePoint(opt.e);
        const base = { stroke: color, strokeWidth: strokeSize, fill: 'transparent', selectable: true, strokeDashArray: dashArray };
        let shape;
        if (tool === 'rect') shape = new fabric.Rect({ ...base, left: startPt.current.x, top: startPt.current.y, width: 1, height: 1 });
        else if (tool === 'circle') shape = new fabric.Circle({ ...base, left: startPt.current.x, top: startPt.current.y, radius: 1 });
        else shape = new fabric.Line([startPt.current.x, startPt.current.y, startPt.current.x, startPt.current.y], { ...base, fill: undefined });
        cvs.add(shape);
        activeShape.current = shape;
      });
      cvs.on('mouse:move', opt => {
        if (!isDrawing.current || !activeShape.current) return;
        const ptr = cvs.getScenePoint(opt.e);
        const s = startPt.current;
        if (tool === 'rect') activeShape.current.set({ left: Math.min(ptr.x, s.x), top: Math.min(ptr.y, s.y), width: Math.abs(ptr.x - s.x), height: Math.abs(ptr.y - s.y) });
        else if (tool === 'circle') { const r = Math.hypot(ptr.x - s.x, ptr.y - s.y) / 2; activeShape.current.set({ left: Math.min(ptr.x, s.x), top: Math.min(ptr.y, s.y), radius: r }); }
        else activeShape.current.set({ x2: ptr.x, y2: ptr.y });
        cvs.renderAll();
      });
      cvs.on('mouse:up', () => {
        if (!isDrawing.current) return;
        isDrawing.current = false;
        if (tool === 'arrow' && activeShape.current) {
          const line = activeShape.current;
          const dx = line.x2 - line.x1, dy = line.y2 - line.y1;
          const angle = Math.atan2(dy, dx) * 180 / Math.PI;
          const h1 = new fabric.Triangle({ left: line.x1, top: line.y1, width: strokeSize * 4, height: strokeSize * 4, fill: color, originX: 'center', originY: 'center', selectable: false, angle: angle - 90 });
          const h2 = new fabric.Triangle({ left: line.x2, top: line.y2, width: strokeSize * 4, height: strokeSize * 4, fill: color, originX: 'center', originY: 'center', selectable: false, angle: angle + 90 });
          const grp = new fabric.Group([line, h1, h2], { selectable: true });
          cvs.remove(line); cvs.add(grp); cvs.setActiveObject(grp); cvs.renderAll();
        }
        activeShape.current = null;
        setTool('select');
      });
    }
  }, [tool, color, strokeSize, lineStyle, canvasReady, readOnly]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const ImageClass = fabric.FabricImage || fabric.Image;
      const fImg = new ImageClass(img, { left: 20, top: 20, selectable: true });
      if (fImg.width > 150) fImg.scaleToWidth(150);
      fabricRef.current?.add(fImg);
      fabricRef.current?.renderAll();
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
    e.target.value = '';
  };

  const handleUndo = () => {
    const cvs = fabricRef.current;
    if (!cvs) return;
    const objs = cvs.getObjects();
    if (objs.length > 0) { cvs.remove(objs[objs.length - 1]); cvs.renderAll(); }
  };

  const handleClear = () => {
    const cvs = fabricRef.current;
    if (!cvs) return;
    cvs.clear(); cvs.backgroundColor = '#0f0a1a'; cvs.renderAll();
    setHasDrawn(false);
  };

  const handleExport = () => {
    const cvs = fabricRef.current;
    if (!cvs) return;
    const link = document.createElement('a');
    link.download = `${sectionType}-sketch.png`;
    link.href = cvs.toDataURL({ format: 'png', quality: 1 });
    link.click();
  };

  const handleSave = useCallback(async () => {
    if (!orderId) { toast.error('Save the order first, then save sketches.'); return; }
    const cvs = fabricRef.current;
    if (!cvs) return;
    setSaving(true);
    try {
      const dataURL = cvs.toDataURL({ format: 'png', quality: 0.9 });
      const blob = await (await fetch(dataURL)).blob();
      const file = new File([blob], `${sectionType}-sketch.png`, { type: 'image/png' });
      const fd = new FormData();
      fd.append('sketch', file);
      fd.append('sectionType', sectionType);
      fd.append('sketchJSON', JSON.stringify(cvs.toJSON()));
      const res = await uploadSectionSketch(orderId, sectionType, fd);
      onSave?.(res.data.sketchImageUrl, JSON.stringify(cvs.toJSON()));
      toast.success('Sketch saved!');
    } catch {
      toast.error('Failed to save sketch.');
    } finally {
      setSaving(false);
    }
  }, [orderId, sectionType, onSave]);

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar row */}
      {!readOnly && (
        <div className="flex flex-wrap gap-1 items-center">
          {TOOLS.map(t => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              title={t.label}
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs transition-all ${
                tool === t.id ? 'bg-gradient-brand text-white shadow' : 'text-gray-400 hover:bg-surface-elevated hover:text-white'
              }`}
            >
              {typeof t.icon === 'string' ? t.icon : <t.icon className="w-3.5 h-3.5" />}
            </button>
          ))}
          <div className="w-px h-6 bg-surface-border mx-1" />
          <button onClick={handleUndo} title="Undo" className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-surface-elevated hover:text-white transition-all"><RotateCcw className="w-3.5 h-3.5" /></button>
          <button onClick={handleClear} title="Clear" className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-400 hover:bg-surface-elevated transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
          <label className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer text-gray-400 hover:bg-surface-elevated hover:text-white transition-all" title="Upload image">
            <ImageIcon className="w-3.5 h-3.5" />
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
          <div className="w-px h-6 bg-surface-border mx-1" />
          {/* Colors */}
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-5 h-5 rounded-full border-2 transition-all ${color === c ? 'border-white scale-125' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
          {/* Line styles */}
          <div className="w-px h-6 bg-surface-border mx-1" />
          {[['solid','─'], ['dashed','- -'], ['dotted','···']].map(([s, lbl]) => (
            <button
              key={s}
              onClick={() => setLineStyle(s)}
              title={s}
              className={`px-2 h-8 rounded-lg text-xs transition-all ${lineStyle === s ? 'bg-gradient-brand text-white' : 'text-gray-400 hover:bg-surface-elevated hover:text-white'}`}
            >{lbl}</button>
          ))}
          {/* Stroke sizes */}
          <div className="w-px h-6 bg-surface-border mx-1" />
          {STROKE_SIZES.map(s => (
            <button
              key={s}
              onClick={() => setStrokeSize(s)}
              className={`w-7 h-8 rounded-lg text-xs font-bold transition-all ${strokeSize === s ? 'bg-gradient-brand text-white' : 'text-gray-400 hover:bg-surface-elevated hover:text-white'}`}
            >{s}</button>
          ))}
          <div className="ml-auto flex gap-1">
            <button onClick={handleExport} className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1"><Download className="w-3 h-3" /> PNG</button>
            <button onClick={handleSave} disabled={saving || !orderId} className="btn-primary text-xs py-1 px-2.5 flex items-center gap-1">
              {saving ? <Loader className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="relative rounded-xl overflow-hidden border border-surface-border bg-[#0f0a1a]">
        <canvas ref={canvasRef} className="block" />
        {initialSketchUrl && !hasDrawn && (
          <div className="absolute top-2 right-2 badge badge-ready text-xs">Saved sketch</div>
        )}
        {/* Zoom controls */}
        <div className="absolute bottom-2 right-2 flex bg-surface-elevated rounded-lg overflow-hidden border border-surface-border">
          <button onClick={() => fabricRef.current?.zoomToPoint({ x: 260, y: 170 }, fabricRef.current.getZoom() * 1.2)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors" title="Zoom In"><ZoomIn className="w-3.5 h-3.5" /></button>
          <button onClick={() => { if (fabricRef.current) { fabricRef.current.setZoom(1); fabricRef.current.viewportTransform[4] = 0; fabricRef.current.viewportTransform[5] = 0; fabricRef.current.requestRenderAll(); } }} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors border-x border-surface-border" title="Reset"><Maximize className="w-3.5 h-3.5" /></button>
          <button onClick={() => fabricRef.current?.zoomToPoint({ x: 260, y: 170 }, fabricRef.current.getZoom() / 1.2)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors" title="Zoom Out"><ZoomOut className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {!orderId && (
        <p className="text-xs text-amber-400 flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
          Save the order first to enable sketch upload
        </p>
      )}
    </div>
  );
}
