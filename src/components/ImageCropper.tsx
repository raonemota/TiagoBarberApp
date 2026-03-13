import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check } from 'lucide-react';
import getCroppedImg from '../utils/cropImage';

interface ImageCropperProps {
  image: string;
  onCropComplete: (croppedImage: Blob) => void;
  onCancel: () => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({ image, onCropComplete, onCancel }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const onCropChange = (crop: { x: number; y: number }) => {
    setCrop(crop);
  };

  const onZoomChange = (zoom: number) => {
    setZoom(zoom);
  };

  const onCropCompleteInternal = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCrop = async () => {
    try {
      const croppedImage = await getCroppedImg(image, croppedAreaPixels);
      if (croppedImage) {
        onCropComplete(croppedImage);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="bg-[#1a1a1a] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl ring-1 ring-[#262626]">
        <div className="p-6 border-b border-[#262626] flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Ajustar Imagem</h3>
          <button onClick={onCancel} className="p-2 text-zinc-500 hover:text-white hover:bg-[#262626] rounded-full transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="relative h-96 w-full bg-black">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={onCropChange}
            onCropComplete={onCropCompleteInternal}
            onZoomChange={onZoomChange}
          />
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-zinc-500">
              <span>Zoom</span>
              <span>{Math.round(zoom * 100)}%</span>
            </div>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => onZoomChange(Number(e.target.value))}
              className="w-full h-2 bg-[#262626] rounded-lg appearance-none cursor-pointer accent-[#8162ff]"
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={onCancel}
              className="flex-1 py-4 bg-[#262626] text-white rounded-2xl font-bold hover:bg-[#333] transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleCrop}
              className="flex-1 py-4 bg-[#8162ff] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#6e4ff0] shadow-lg shadow-[#8162ff]/20 transition-all"
            >
              <Check className="h-5 w-5" />
              Confirmar Corte
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;
