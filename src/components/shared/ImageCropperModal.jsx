import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../../utils/cropImage';
import { X, Check } from 'lucide-react';

export default function ImageCropperModal({ imageSrc, onCropComplete, onCancel }) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const onCropCompleteCallback = useCallback((croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleSave = async () => {
        if (!imageSrc || !croppedAreaPixels) return;

        try {
            setIsSaving(true);
            const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels, 0);
            
            // Convert blob to File object to match existing upload flow
            const croppedFile = new File([croppedBlob], `photo_crop_${Date.now()}.jpg`, { type: 'image/jpeg' });
            
            onCropComplete(croppedFile);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl overflow-hidden w-full max-w-lg shadow-2xl flex flex-col">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                    <h3 className="font-bold text-gray-900 tracking-tight">Crop Photo</h3>
                    <button onClick={onCancel} className="p-2 -mr-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="relative w-full h-[400px] bg-gray-900 shrink-0">
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={3 / 4} // Standard ID photo ratio
                        onCropChange={setCrop}
                        onCropComplete={onCropCompleteCallback}
                        onZoomChange={setZoom}
                        showGrid={true}
                        cropShape="rect"
                    />
                </div>
                
                <div className="p-6 bg-white shrink-0 space-y-4">
                    <div className="flex items-center gap-4">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest shrink-0">Zoom</label>
                        <input
                            type="range"
                            value={zoom}
                            min={1}
                            max={3}
                            step={0.1}
                            aria-labelledby="Zoom"
                            onChange={(e) => setZoom(e.target.value)}
                            className="flex-1 w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                        <span className="text-xs font-bold text-gray-600 shrink-0 w-8 text-right">{Math.round(zoom * 100)}%</span>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 shrink-0 flex gap-3">
                    <button 
                        onClick={onCancel}
                        className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-all shadow-sm active:scale-95"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 inline-flex justify-center items-center py-3 bg-indigo-600 border border-transparent text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                    >
                        {isSaving ? "Cutting..." : <><Check className="w-5 h-5 mr-2" /> Save Crop</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
