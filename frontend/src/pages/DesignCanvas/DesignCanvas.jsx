import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as fabric from 'fabric';
import {
  Pen, Eraser, Square, Circle, Type, Trash2, Download, Save, RotateCcw, Minus, Loader, MoveUpRight, ZoomIn, ZoomOut, Maximize,
  GripHorizontal, AlignCenterHorizontal, Image as ImageIcon, Lock
} from 'lucide-react';
import { getDesignOrders, uploadSketch } from '../../api/designOrders';
import toast from 'react-hot-toast';

// ─── Garment SVG silhouettes ──────────────────────────────────────────────
const SILHOUETTES = {
  Blouse: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="220" viewBox="0 0 200 220" fill="none" stroke="#be4bf4" stroke-width="1.5"><path d="M70 10 L55 40 L20 50 L30 90 L55 85 L55 180 L145 180 L145 85 L170 90 L180 50 L145 40 L130 10 Q115 25 100 25 Q85 25 70 10Z" opacity="0.6"/><ellipse cx="100" cy="18" rx="18" ry="10" opacity="0.8"/></svg>`,
  Frock: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280" viewBox="0 0 200 280" fill="none" stroke="#be4bf4" stroke-width="1.5"><path d="M75 10 L60 40 L25 55 L35 90 L60 83 L55 200 L80 210 L100 195 L120 210 L145 200 L140 83 L165 90 L175 55 L140 40 L125 10 Q110 25 100 25 Q90 25 75 10Z" opacity="0.6"/><ellipse cx="100" cy="18" rx="16" ry="9" opacity="0.8"/></svg>`,
  Chudi: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280" viewBox="0 0 200 280" fill="none" stroke="#be4bf4" stroke-width="1.5"><path d="M72 10 L58 40 L30 55 L38 90 L62 83 L60 200 L85 205 L100 195 L115 205 L140 200 L138 83 L162 90 L170 55 L142 40 L128 10 Q114 25 100 25 Q86 25 72 10Z" opacity="0.6"/><ellipse cx="100" cy="18" rx="17" ry="9" opacity="0.8"/><line x1="60" y1="200" x2="65" y2="270" stroke-width="1.5" opacity="0.6"/><line x1="140" y1="200" x2="135" y2="270" stroke-width="1.5" opacity="0.6"/></svg>`,
  Lehenga: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280" viewBox="0 0 200 280" fill="none" stroke="#be4bf4" stroke-width="1.5"><path d="M75 10 L60 40 L30 52 L38 85 L60 78 L60 110 L140 110 L140 78 L162 85 L170 52 L140 40 L125 10 Q112 24 100 24 Q88 24 75 10Z" opacity="0.6"/><ellipse cx="100" cy="18" rx="16" ry="9" opacity="0.8"/><path d="M55 115 L40 270 L160 270 L145 115 Z" opacity="0.4"/></svg>`,
  Kurta: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="260" viewBox="0 0 200 260" fill="none" stroke="#be4bf4" stroke-width="1.5"><path d="M70 10 L55 40 L20 55 L30 95 L55 88 L55 220 L145 220 L145 88 L170 95 L180 55 L145 40 L130 10 Q115 24 100 24 Q85 24 70 10Z" opacity="0.6"/><ellipse cx="100" cy="18" rx="17" ry="9" opacity="0.8"/><line x1="100" y1="30" x2="100" y2="90" stroke-dasharray="4,3" opacity="0.5"/></svg>`,
  'Saree Fall': `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280" viewBox="0 0 200 280" fill="none" stroke="#be4bf4" stroke-width="1.5"><path d="M65 30 Q100 20 135 30 L145 90 L145 250 L55 250 L55 90 Z" opacity="0.5"/><path d="M65 30 Q100 15 135 30" opacity="0.8"/><ellipse cx="100" cy="90" rx="45" ry="8" opacity="0.6"/></svg>`,
};

const TOOLS = [
  { id: 'select', label: 'Select', icon: '↖' },
  { id: 'pen', label: 'Pen', icon: Pen },
  { id: 'line', label: 'Line', icon: Minus },
  { id: 'arrow', label: 'Measurement Arrow', icon: MoveUpRight },
  { id: 'rect', label: 'Rectangle', icon: Square },
  { id: 'circle', label: 'Circle', icon: Circle },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'eraser', label: 'Eraser', icon: Eraser },
];

const COLORS = ['#be4bf4', '#f43f5e', '#60a5fa', '#34d399', '#fbbf24', '#fb923c', '#ffffff', '#94a3b8', '#000000'];
const STROKE_SIZES = [1, 2, 4, 6, 10, 16];

export default function DesignCanvas() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');

  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const isDrawing = useRef(false);
  const startPt = useRef(null);
  const activeShape = useRef(null);

  const [tool, setTool] = useState('select');
  const [color, setColor] = useState('#be4bf4');
  const [strokeSize, setStrokeSize] = useState(2);
  const [lineStyle, setLineStyle] = useState('solid'); // 'solid', 'dashed', 'dotted'
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(orderId || '');
  const [garmentType, setGarmentType] = useState('');
  const [saving, setSaving] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);

  // ── Init Fabric canvas once ──────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;
    const cvs = new fabric.Canvas(canvasRef.current, {
      width: 680,
      height: 500,
      selection: true,
    });
    cvs.backgroundColor = '#0f0a1a';
    cvs.renderAll();

    // Init PencilBrush explicitly (required in Fabric v6)
    cvs.freeDrawingBrush = new fabric.PencilBrush(cvs);
    cvs.freeDrawingBrush.color = '#be4bf4';
    cvs.freeDrawingBrush.width = 2;

    // Zoom via mouse wheel
    cvs.on('mouse:wheel', function (opt) {
      let delta = opt.e.deltaY;
      let zoom = cvs.getZoom();
      zoom *= 0.999 ** delta;
      if (zoom > 10) zoom = 10;
      if (zoom < 0.2) zoom = 0.2;
      cvs.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    fabricRef.current = cvs;
    setCanvasReady(true);

    return () => {
      try { cvs.dispose(); } catch {}
      fabricRef.current = null;
    };
  }, []);

  // ── Load orders ──────────────────────────────────────────────────────────
  useEffect(() => {
    getDesignOrders({ limit: 100 }).then(r => {
      const list = r.data.orders || [];
      setOrders(list);
      if (orderId) {
        const o = list.find(o => o.orderId === orderId);
        if (o) setGarmentType(o.garmentType || 'Blouse');
      }
    }).catch(() => {});
  }, [orderId]);

  // ── Load garment silhouette ──────────────────────────────────────────────
  useEffect(() => {
    const cvs = fabricRef.current;
    if (!cvs || !canvasReady) return;

    // Remove old silhouettes
    cvs.getObjects().filter(o => o.__silhouette).forEach(o => cvs.remove(o));

    const svgStr = SILHOUETTES[garmentType];
    if (!svgStr) return;

    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const ImageClass = fabric.FabricImage || fabric.Image;
      const fImg = new ImageClass(img, {
        originX: 'center', originY: 'center',
        left: cvs.width / 2, top: cvs.height / 2 + 10,
        opacity: 0.35, selectable: false, evented: false,
        scaleX: 1.5, scaleY: 1.5
      });
      fImg.__silhouette = true;
      cvs.add(fImg);
      cvs.sendObjectToBack(fImg);
      cvs.renderAll();
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }, [garmentType, canvasReady]);

  // ── Apply tool changes ───────────────────────────────────────────────────
  useEffect(() => {
    const cvs = fabricRef.current;
    if (!cvs || !canvasReady) return;

    // Reset state
    cvs.isDrawingMode = false;
    cvs.selection = tool === 'select';
    cvs.off('mouse:down');
    cvs.off('mouse:move');
    cvs.off('mouse:up');
    cvs.getObjects().forEach(o => { if (!o.__silhouette) o.selectable = tool === 'select'; });
    cvs.renderAll();

    cvs.on('mouse:down', function (opt) {
      if (opt.e.altKey) {
        this.isDragging = true;
        this.selection = false;
        this.lastPosX = opt.e.clientX;
        this.lastPosY = opt.e.clientY;
      }
    });
    cvs.on('mouse:move', function (opt) {
      if (this.isDragging) {
        let e = opt.e;
        let vpt = this.viewportTransform;
        vpt[4] += e.clientX - this.lastPosX;
        vpt[5] += e.clientY - this.lastPosY;
        this.requestRenderAll();
        this.lastPosX = e.clientX;
        this.lastPosY = e.clientY;
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
      cvs.freeDrawingBrush.width = 24;
      return;
    }

    if (tool === 'text') {
      cvs.on('mouse:down', opt => {
        const ptr = cvs.getScenePoint(opt.e);
        const txt = new fabric.IText('Type here…', {
          left: ptr.x, top: ptr.y, fill: color,
          fontSize: 16, 
          fontFamily: 'Inter, sans-serif', 
          fontWeight: 'bold',
          backgroundColor: 'transparent'
        });
        cvs.add(txt);
        cvs.setActiveObject(txt);
        txt.enterEditing();
        txt.selectAll();
        cvs.renderAll();
        // Auto-switch to select mode so the user can immediately move/adjust it without drawing more
        setTool('select');
      });
      return;
    }

    if (['rect', 'circle', 'line', 'arrow'].includes(tool)) {
      cvs.on('mouse:down', opt => {
        isDrawing.current = true;
        startPt.current = cvs.getScenePoint(opt.e);
        let shape;
        const base = { stroke: color, strokeWidth: strokeSize, fill: 'transparent', selectable: true, strokeDashArray: dashArray };
        if (tool === 'rect') shape = new fabric.Rect({ ...base, left: startPt.current.x, top: startPt.current.y, width: 1, height: 1 });
        else if (tool === 'circle') shape = new fabric.Circle({ ...base, left: startPt.current.x, top: startPt.current.y, radius: 1 });
        else if (tool === 'arrow') {
          // A line that will represent the arrow body, we can add a triangle head later or just use line for now as measurement tool
          shape = new fabric.Line([startPt.current.x, startPt.current.y, startPt.current.x, startPt.current.y], { ...base, fill: undefined });
        }
        else shape = new fabric.Line([startPt.current.x, startPt.current.y, startPt.current.x, startPt.current.y], { ...base, fill: undefined });
        cvs.add(shape);
        activeShape.current = shape;
      });

      cvs.on('mouse:move', opt => {
        if (!isDrawing.current || !activeShape.current) return;
        const ptr = cvs.getScenePoint(opt.e);
        const s = startPt.current;
        if (tool === 'rect') {
          activeShape.current.set({ left: Math.min(ptr.x, s.x), top: Math.min(ptr.y, s.y), width: Math.abs(ptr.x - s.x), height: Math.abs(ptr.y - s.y) });
        } else if (tool === 'circle') {
          const r = Math.hypot(ptr.x - s.x, ptr.y - s.y) / 2;
          activeShape.current.set({ left: Math.min(ptr.x, s.x), top: Math.min(ptr.y, s.y), radius: r });
        } else {
          activeShape.current.set({ x2: ptr.x, y2: ptr.y });
        }
        cvs.renderAll();
      });

      cvs.on('mouse:up', () => {
        if (!isDrawing.current) return;
        isDrawing.current = false;
        
        // Add arrow heads if arrow tool
        if (tool === 'arrow' && activeShape.current) {
           const line = activeShape.current;
           const dx = line.x2 - line.x1;
           const dy = line.y2 - line.y1;
           const angle = Math.atan2(dy, dx) * 180 / Math.PI;
           const head1 = new fabric.Triangle({
             left: line.x1, top: line.y1, width: strokeSize * 4, height: strokeSize * 4,
             fill: color, originX: 'center', originY: 'center', selectable: false, angle: angle - 90
           });
           const head2 = new fabric.Triangle({
             left: line.x2, top: line.y2, width: strokeSize * 4, height: strokeSize * 4,
             fill: color, originX: 'center', originY: 'center', selectable: false, angle: angle + 90
           });
           const group = new fabric.Group([line, head1, head2], { selectable: true });
           cvs.remove(line);
           cvs.add(group);
           cvs.setActiveObject(group);
           cvs.renderAll();
        } else if (activeShape.current) {
           cvs.setActiveObject(activeShape.current);
           cvs.renderAll();
        }
        
        activeShape.current = null;
        // Auto-switch to select mode so the user can immediately move/adjust the shape
        setTool('select');
      });
    }
  }, [tool, color, strokeSize, lineStyle, canvasReady]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const ImageClass = fabric.FabricImage || fabric.Image;
      const fImg = new ImageClass(img, {
        left: 20, top: 20,
        selectable: true
      });
      // scale down if too large
      if (fImg.width > 200) fImg.scaleToWidth(200);
      fabricRef.current?.add(fImg);
      fabricRef.current?.setActiveObject(fImg);
      fabricRef.current?.renderAll();
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
    e.target.value = ''; // reset input
  };

  // ── Undo ─────────────────────────────────────────────────────────────────
  const handleUndo = () => {
    const cvs = fabricRef.current;
    if (!cvs) return;
    const objects = cvs.getObjects().filter(o => !o.__silhouette);
    if (objects.length > 0) {
      cvs.remove(objects[objects.length - 1]);
      cvs.renderAll();
    }
  };

  // ── Lock/Unlock ──────────────────────────────────────────────────────────
  const toggleLock = () => {
    const cvs = fabricRef.current;
    if (!cvs) return;
    const active = cvs.getActiveObject();
    if (!active) {
      toast.error('Select an element first');
      return;
    }
    const isLocked = active.lockMovementX;
    active.set({
      lockMovementX: !isLocked,
      lockMovementY: !isLocked,
      lockScalingX: !isLocked,
      lockScalingY: !isLocked,
      lockRotation: !isLocked,
      hasControls: isLocked,
      borderColor: !isLocked ? '#ef4444' : '#be4bf4',
      borderDashArray: !isLocked ? [5, 5] : null
    });
    cvs.requestRenderAll();
    toast.success(isLocked ? 'Unlocked element' : 'Element locked (Static)');
  };

  // ── Clear ─────────────────────────────────────────────────────────────────
  const handleClear = () => {
    const cvs = fabricRef.current;
    if (!cvs) return;
    const silhouettes = cvs.getObjects().filter(o => o.__silhouette);
    cvs.clear();
    cvs.backgroundColor = '#0f0a1a';
    silhouettes.forEach(s => cvs.add(s));
    cvs.renderAll();
  };

  // ── Export PNG ────────────────────────────────────────────────────────────
  const handleExportPNG = () => {
    const cvs = fabricRef.current;
    if (!cvs) return;
    const link = document.createElement('a');
    link.download = `design-${selectedOrder || 'sketch'}.png`;
    link.href = cvs.toDataURL({ format: 'png', quality: 1 });
    link.click();
  };

  // ── Save to order ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedOrder) { toast.error('Select an order first.'); return; }
    const cvs = fabricRef.current;
    if (!cvs) return;
    setSaving(true);
    try {
      const dataURL = cvs.toDataURL({ format: 'png', quality: 0.9 });
      const blob = await (await fetch(dataURL)).blob();
      const file = new File([blob], 'design-sketch.png', { type: 'image/png' });
      const formData = new FormData();
      formData.append('sketch', file);
      formData.append('sketchJSON', JSON.stringify(cvs.toJSON(['__silhouette'])));
      await uploadSketch(selectedOrder, formData);
      toast.success('Design saved to order!');
    } catch {
      toast.error('Failed to save sketch.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Design Canvas</h1>
          <p className="text-sm text-gray-500">Draw, annotate and save garment designs</p>
        </div>
        <div className="flex gap-3 sm:ml-auto">
          <button onClick={handleExportPNG} className="btn-secondary">
            <Download className="w-4 h-4" /> Export PNG
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save to Order'}
          </button>
        </div>
      </div>

      {/* Order + garment selectors */}
      <div className="card p-4 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="label">Attach to Order</label>
          <select className="select" value={selectedOrder} onChange={e => setSelectedOrder(e.target.value)}>
            <option value="">Select order…</option>
            {orders.map(o => <option key={o.orderId} value={o.orderId}>{o.orderId} - {o.customer?.name || o.customerId?.name} ({o.garmentType})</option>)}
          </select>
        </div>
        <div className="sm:w-52">
          <label className="label">Garment Silhouette</label>
          <select className="select" value={garmentType} onChange={e => setGarmentType(e.target.value)}>
            <option value="">Blank Canvas</option>
            {Object.keys(SILHOUETTES).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Canvas + Toolbar + Color panel */}
      <div className="flex gap-4 flex-col lg:flex-row">

        {/* Toolbar */}
        <div className="card p-2 flex lg:flex-col gap-1.5 lg:w-14 flex-wrap items-center justify-center">
          {TOOLS.map(t => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              title={t.label}
              className={`w-10 h-10 rounded-lg flex items-center justify-center text-base transition-all ${
                tool === t.id
                  ? 'bg-gradient-brand text-white shadow-lg'
                  : 'text-gray-400 hover:bg-surface-elevated hover:text-white'
              }`}
            >
              {typeof t.icon === 'string' ? t.icon : <t.icon className="w-4 h-4" />}
            </button>
          ))}
          <div className="w-8 h-px bg-surface-border my-1 hidden lg:block" />
          <button onClick={handleUndo} title="Undo last object" className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-400 hover:bg-surface-elevated hover:text-white transition-all">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={handleClear} title="Clear all" className="w-10 h-10 rounded-lg flex items-center justify-center text-rose-400 hover:bg-surface-elevated transition-all">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={toggleLock} title="Lock/Unlock Selected Element" className="w-10 h-10 rounded-lg flex items-center justify-center text-amber-400 hover:bg-surface-elevated hover:text-white transition-all">
            <Lock className="w-4 h-4" />
          </button>
          <label className="btn-icon w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer hover:bg-surface-elevated hover:text-white transition-all" title="Upload Swatch/Image">
            <ImageIcon className="w-4 h-4" />
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
        </div>

        {/* Canvas */}
        <div className="card p-2 flex-1 overflow-hidden min-h-[520px] flex items-start relative">
          <canvas ref={canvasRef} className="rounded-lg" />
          
          {/* Zoom Controls Overlay */}
          <div className="absolute bottom-4 right-4 flex bg-surface-elevated rounded-lg shadow-lg overflow-hidden border border-surface-border">
            <button onClick={() => fabricRef.current?.zoomToPoint({x: 340, y: 250}, fabricRef.current.getZoom() * 1.2)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors" title="Zoom In">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button onClick={() => {
              if (fabricRef.current) {
                 fabricRef.current.setZoom(1);
                 fabricRef.current.viewportTransform[4] = 0;
                 fabricRef.current.viewportTransform[5] = 0;
                 fabricRef.current.requestRenderAll();
              }
            }} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors border-x border-surface-border" title="Reset View">
              <Maximize className="w-4 h-4" />
            </button>
            <button onClick={() => fabricRef.current?.zoomToPoint({x: 340, y: 250}, fabricRef.current.getZoom() / 1.2)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors" title="Zoom Out">
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Color + stroke */}
        <div className="card p-4 lg:w-44 space-y-4">
          <div>
            <label className="label mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              {/* Custom Multi-Color Picker */}
              <div 
                className="relative w-6 h-6 rounded-full border-2 border-transparent hover:scale-110 transition-all cursor-pointer shadow-inner"
                style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}
                title="Custom color"
              >
                <input
                  type="color"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="label mb-2">Stroke Size</label>
            <div className="flex flex-wrap gap-1.5">
              {STROKE_SIZES.map(s => (
                <button
                  key={s}
                  onClick={() => setStrokeSize(s)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${strokeSize === s ? 'bg-gradient-brand text-white' : 'btn-icon'}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-center">
              <div className="rounded-full bg-white transition-all"
                style={{ width: Math.min(strokeSize * 3, 36), height: Math.min(strokeSize * 3, 36) }} />
            </div>
          </div>
          <div>
            <label className="label mb-2">Line Style (Stitches)</label>
            <div className="flex gap-2">
              <button onClick={() => setLineStyle('solid')} className={`flex-1 h-8 rounded-lg flex items-center justify-center transition-all ${lineStyle === 'solid' ? 'bg-gradient-brand text-white' : 'btn-icon'}`} title="Solid Edge">
                <Minus className="w-4 h-4" />
              </button>
              <button onClick={() => setLineStyle('dashed')} className={`flex-1 h-8 rounded-lg flex items-center justify-center transition-all ${lineStyle === 'dashed' ? 'bg-gradient-brand text-white' : 'btn-icon'}`} title="Dashed Stitches">
                <GripHorizontal className="w-4 h-4" />
              </button>
              <button onClick={() => setLineStyle('dotted')} className={`flex-1 h-8 rounded-lg flex items-center justify-center transition-all ${lineStyle === 'dotted' ? 'bg-gradient-brand text-white' : 'btn-icon'}`} title="Hidden Seam (Dotted)">
                <AlignCenterHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-500 space-y-1 pt-1 border-t border-surface-border">
            <p className="font-medium text-gray-400 mb-1">Tips</p>
            <p>• <span className="text-brand-400">Text</span> - click canvas to add a label</p>
            <p>• Purple = silhouette guide (not saved)</p>
            <p>• Use <span className="text-brand-400">Save</span> to attach PNG to order</p>
          </div>
        </div>
      </div>
    </div>
  );
}
