
import { useState, useEffect } from "react";
import { X, Loader2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { generateCardSide } from "../../utils/cardGenerator";

export default function PreviewModal({ student, template, onClose, students = [], currentIndex = 0, onNavigate }) {
    const [previewUrl, setPreviewUrl] = useState({ front: null, back: null });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let isMounted = true;
        const generate = async () => {
            if (!template || !template.layout) {
                setError("No template design found. Please save a design in the Designer first.");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                let layoutData = template.layout;

                // Handle double-stringified JSON if it exists
                while (typeof layoutData === 'string' && layoutData.startsWith('{')) {
                    try {
                        layoutData = JSON.parse(layoutData);
                    } catch (e) {
                        break;
                    }
                }

                if (typeof layoutData !== 'object' || layoutData === null) {
                    setError("Design format is missing. Try re-saving it in the Designer.");
                    setLoading(false);
                    return;
                }

                // Normalization: layoutData could be:
                // 1. { front: {...}, back: {...}, isDoubleSided: true }
                // 2. { objects: [...] } (Legacy/Single side)
                const sideFront = layoutData.front || (layoutData.objects ? layoutData : null);
                const sideBack = layoutData.isDoubleSided !== false ? layoutData.back : null;

                if (!sideFront || (sideFront.objects && sideFront.objects.length === 0)) {
                    setError("The template is empty. Add some elements in the Designer.");
                    setLoading(false);
                    return;
                }

                const frontUrl = await generateCardSide(student, sideFront);
                const backUrl = sideBack ? await generateCardSide(student, sideBack) : null;

                if (isMounted) {
                    setPreviewUrl({ front: frontUrl, back: backUrl });
                }
            } catch (err) {
                console.error("Preview failed:", err);
                if (isMounted) {
                    setError(`Failed to generate preview: ${err.message || 'Unknown error'}`);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };
        generate();
        return () => { isMounted = false; };
    }, [student, template]);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div className="flex items-center gap-4">
                        {students.length > 1 && onNavigate && (
                            <button
                                onClick={() => onNavigate(currentIndex - 1)}
                                disabled={currentIndex === 0}
                                className="p-2 bg-white hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 rounded-xl shadow-sm border border-gray-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Previous Student"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                        )}
                        <div>
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">ID Card Preview</h3>
                            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-1">
                                Student: {student.name}
                                {students.length > 1 && ` (${currentIndex + 1} of ${students.length})`}
                            </p>
                        </div>
                        {students.length > 1 && onNavigate && (
                            <button
                                onClick={() => onNavigate(currentIndex + 1)}
                                disabled={currentIndex === students.length - 1}
                                className="p-2 bg-white hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 rounded-xl shadow-sm border border-gray-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Next Student"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    <button onClick={onClose} className="p-3 bg-white hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-2xl shadow-sm border border-gray-100 transition-all active:scale-90">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-12 bg-[#F8FAFC] flex flex-wrap justify-center gap-12 max-h-[70vh] overflow-y-auto">
                    {loading ? (
                        <div className="flex flex-col items-center py-12">
                            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                            <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Generating High-Res Preview...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center py-12 text-center">
                            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                            <p className="text-sm font-bold text-gray-900 uppercase tracking-tight">{error}</p>
                            <p className="text-[10px] text-gray-400 font-bold mt-2 uppercase">Make sure the template is not empty</p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-4">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Front Side</p>
                                <div className="w-[280px] aspect-[54/86] bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden relative">
                                    {previewUrl.front ? (
                                        <img src={previewUrl.front} className="w-full h-full object-cover" alt="Front" />
                                    ) : (
                                        <div className="w-full h-full bg-gray-50 flex items-center justify-center">
                                            <p className="text-[10px] font-bold text-gray-300">No Content</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {previewUrl.back && (
                                <div className="space-y-4">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Back Side</p>
                                    <div className="w-[280px] aspect-[54/86] bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden relative">
                                        <img src={previewUrl.back} className="w-full h-full object-cover" alt="Back" />
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="px-8 py-6 bg-white border-t border-gray-100 flex justify-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Standard CR80 Vertical Dimensions (54mm x 86mm)</p>
                </div>
            </div>
        </div>
    );
}
