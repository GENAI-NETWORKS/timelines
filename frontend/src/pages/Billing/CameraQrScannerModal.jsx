import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CameraQrScannerModal({ isOpen, onClose, onScan, title = 'Scan QR Code / Barcode' }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const fileInputRef = useRef(null);

  const [hasPermission, setHasPermission] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectorSupported, setDetectorSupported] = useState(true);
  const [scannedResult, setScannedResult] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    setScannedResult('');
    let isCancelled = false;

    // Check BarcodeDetector support
    const supportsDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
    setDetectorSupported(supportsDetector);

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();
          setHasPermission(true);
          setIsDetecting(true);

          if (supportsDetector) {
            startLiveScan();
          }
        }
      } catch (err) {
        console.warn('Camera error:', err);
        setHasPermission(false);
      }
    }

    startCamera();

    return () => {
      isCancelled = true;
      stopCamera();
    };
  }, [isOpen]);

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsDetecting(false);
  };

  const startLiveScan = async () => {
    if (!('BarcodeDetector' in window)) return;

    try {
      const barcodeDetector = new window.BarcodeDetector({
        formats: ['qr_code', 'code_128', 'ean_13', 'code_39', 'upc_a'],
      });

      const scanLoop = async () => {
        if (!videoRef.current || !streamRef.current) return;

        if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
          try {
            const barcodes = await barcodeDetector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const rawVal = barcodes[0].rawValue;
              if (rawVal) {
                handleCodeDetected(rawVal);
                return;
              }
            }
          } catch (e) {
            // Frame detection error, continue next frame
          }
        }

        animationFrameRef.current = requestAnimationFrame(scanLoop);
      };

      animationFrameRef.current = requestAnimationFrame(scanLoop);
    } catch (err) {
      console.warn('Live scanner initialization failed:', err);
    }
  };

  const handleCodeDetected = (code) => {
    setScannedResult(code);
    try {
      if (navigator.vibrate) navigator.vibrate(100);
    } catch {}

    stopCamera();
    onScan(code);
    onClose();
  };

  // Image upload fallback scanner
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!('BarcodeDetector' in window)) {
      toast.error('Automatic image QR detection is not supported on this browser. Please type or use scanner.');
      return;
    }

    try {
      const bitmap = await createImageBitmap(file);
      const barcodeDetector = new window.BarcodeDetector({
        formats: ['qr_code', 'code_128', 'ean_13'],
      });
      const barcodes = await barcodeDetector.detect(bitmap);

      if (barcodes.length > 0 && barcodes[0].rawValue) {
        handleCodeDetected(barcodes[0].rawValue);
      } else {
        toast.error('No QR code detected in the uploaded photo.');
      }
    } catch (err) {
      toast.error('Could not process the uploaded image.');
    }
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-purple-100 flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-purple-700 to-indigo-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
              <Camera className="w-4 h-4 text-purple-200" />
            </div>
            <div>
              <h3 className="font-bold text-sm">{title}</h3>
              <p className="text-[11px] text-purple-200">Point your camera at any QR code or barcode</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera Viewport */}
        <div className="relative bg-black aspect-square max-h-[360px] flex items-center justify-center overflow-hidden">
          {hasPermission === false ? (
            <div className="p-6 text-center text-white space-y-3">
              <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
              <div className="text-sm font-bold">Camera Access Blocked</div>
              <p className="text-xs text-gray-300 max-w-xs mx-auto">
                Please allow camera access in your browser settings to scan QR codes, or upload a photo of the QR code below.
              </p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted
                playsInline
              />

              {/* Targeting Reticle */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-56 h-56 border-2 border-purple-400/80 rounded-3xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                  {/* Corner accents */}
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-purple-500 rounded-tl-2xl" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-purple-500 rounded-tr-2xl" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-purple-500 rounded-bl-2xl" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-purple-500 rounded-br-2xl" />

                  {/* Scanning Laser Animation */}
                  {isDetecting && (
                    <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-purple-400 via-rose-400 to-purple-400 animate-pulse shadow-[0_0_12px_rgba(168,85,247,0.9)] top-1/2 -translate-y-1/2" />
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-gray-50 flex items-center justify-between gap-3 text-xs">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-secondary text-xs flex items-center gap-1.5 py-1.5"
          >
            <Upload className="w-3.5 h-3.5" /> Upload QR Photo
          </button>

          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="btn btn-secondary text-xs px-4 py-1.5"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
