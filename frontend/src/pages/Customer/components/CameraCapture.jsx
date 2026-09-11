import { useRef, useState, useEffect } from 'react';
import { Camera, X, Check, RefreshCcw } from 'lucide-react';
import Modal from '../../../components/UI/Modal';
import toast from 'react-hot-toast';

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [photo, setPhoto] = useState(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      toast.error('Could not access camera. Please allow permissions.');
      onClose();
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    setPhoto(dataUrl);
    stopCamera();
  };

  const retakePhoto = () => {
    setPhoto(null);
    startCamera();
  };

  const confirmPhoto = () => {
    onCapture(photo);
    onClose();
  };

  return (
    <Modal title="Take Photo" onClose={onClose} size="max-w-2xl">
      <div className="flex flex-col gap-4 items-center">
        {!photo ? (
          <div className="relative rounded-lg overflow-hidden bg-black w-full aspect-video flex items-center justify-center">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className="relative rounded-lg overflow-hidden bg-black w-full aspect-video flex items-center justify-center">
            <img src={photo} alt="Captured" className="w-full h-full object-contain" />
          </div>
        )}
        
        {/* Hidden canvas for taking snapshot */}
        <canvas ref={canvasRef} className="hidden" />

        <div className="flex justify-center gap-4 mt-2">
          {!photo ? (
            <button onClick={takePhoto} className="btn btn-primary flex items-center gap-2">
              <Camera className="w-5 h-5" /> Capture
            </button>
          ) : (
            <>
              <button onClick={retakePhoto} className="btn btn-secondary flex items-center gap-2">
                <RefreshCcw className="w-4 h-4" /> Retake
              </button>
              <button onClick={confirmPhoto} className="btn btn-primary flex items-center gap-2">
                <Check className="w-4 h-4" /> Use Photo
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
