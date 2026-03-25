import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { Save, Upload, Building, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function InstitutionManager() {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState({ type: null, message: "" });
    const [details, setDetails] = useState({
        name: "",
        address: "",
        phone: "",
        email: "",
        logoUrl: "",
        signatureUrl: ""
    });
    const [newLogo, setNewLogo] = useState(null);
    const [newSignature, setNewSignature] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [signaturePreviewUrl, setSignaturePreviewUrl] = useState(null);
    const [logoError, setLogoError] = useState(false);
    const [signatureError, setSignatureError] = useState(false);

    useEffect(() => {
        const fetchInstitution = async () => {
            try {
                const docRef = doc(db, "schools", "main");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setDetails(prev => ({ ...prev, ...data }));
                    setLogoError(false);
                    setSignatureError(false);
                }
            } catch (error) {
                console.error("Error fetching institution:", error);
            }
        };
        fetchInstitution();
    }, []);

    const handleFileChange = (e, type) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                setStatus({ type: 'error', message: "File too large. Max 2MB." });
                return;
            }
            const url = URL.createObjectURL(file);
            if (type === 'logo') {
                setNewLogo(file);
                setPreviewUrl(url);
                setLogoError(false);
            } else {
                setNewSignature(file);
                setSignaturePreviewUrl(url);
                setSignatureError(false);
            }
            setStatus({ type: null, message: "" });
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: 'info', message: "Starting update..." });

        try {
            let logoUrl = details.logoUrl || "";
            let signatureUrl = details.signatureUrl || "";

            // 1. Upload Logo if new one selected
            if (newLogo) {
                setStatus({ type: 'info', message: "Uploading logo to local 'uploads' folder..." });
                const formData = new FormData();
                formData.append('file', newLogo);

                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) throw new Error("Logo upload failed.");
                const data = await response.json();
                logoUrl = data.url;
            }

            // 2. Upload Signature if new one selected
            if (newSignature) {
                setStatus({ type: 'info', message: "Uploading signature to local 'uploads' folder..." });
                const formData = new FormData();
                formData.append('file', newSignature);

                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) throw new Error("Signature upload failed.");
                const data = await response.json();
                signatureUrl = data.url;
            }

            // 2. Save to Firestore
            setStatus({ type: 'info', message: "Saving to database..." });
            const institutionData = {
                name: details.name.trim(),
                address: details.address.trim(),
                phone: (details.phone || "").trim(),
                email: (details.email || "").trim(),
                logoUrl: logoUrl,
                signatureUrl: signatureUrl,
                updatedAt: new Date(),
                updatedBy: currentUser?.uid || 'unknown'
            };

            await setDoc(doc(db, "schools", "main"), institutionData, { merge: true });

            setDetails(prev => ({ ...prev, ...institutionData }));
            setNewLogo(null);
            setNewSignature(null);
            setPreviewUrl(null);
            setSignaturePreviewUrl(null);
            setStatus({ type: 'success', message: "Saved to local folder & database!" });
            setTimeout(() => setStatus({ type: null, message: "" }), 5000);

        } catch (error) {
            console.error("Update error:", error);
            setStatus({ type: 'error', message: error.message });
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="max-w-3xl">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center bg-gray-50">
                    <Building className="w-5 h-5 text-gray-500 mr-2" />
                    <h3 className="text-lg font-bold text-gray-900">Institution Profile</h3>
                </div>

                <form onSubmit={handleUpdate} className="p-6 space-y-6">
                    {status.message && (
                        <div className={`p-4 rounded-lg flex items-start ${status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' :
                            status.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' :
                                'bg-blue-50 text-blue-700 border border-blue-100'
                            }`}>
                            {status.type === 'success' ? <CheckCircle2 className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" /> :
                                status.type === 'error' ? <AlertCircle className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" /> :
                                    <Loader2 className="w-5 h-5 mr-3 mt-0.5 animate-spin flex-shrink-0" />}
                            <div className="text-sm">
                                <p className="font-bold">{status.type === 'error' ? 'Error' : 'Local Storage Active'}</p>
                                <p className="mt-1">{status.message}</p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-8">
                        {/* Main Details Form */}
                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Institution Name</label>
                                <input
                                    type="text"
                                    value={details.name}
                                    onChange={(e) => setDetails({ ...details, name: e.target.value })}
                                    required
                                    className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="Enter institution name"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                                    <input
                                        type="tel"
                                        value={details.phone}
                                        onChange={(e) => setDetails({ ...details, phone: e.target.value })}
                                        className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                                        placeholder="+91..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={details.email}
                                        onChange={(e) => setDetails({ ...details, email: e.target.value })}
                                        className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="institution@example.com"
                                    />
                                    <p className="mt-1.5 text-[11px] font-medium text-amber-600 flex items-center">
                                        <AlertCircle className="w-3 h-3 mr-1" />
                                        Note: Changing this email must match your license.json
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
                                <textarea
                                    value={details.address}
                                    onChange={(e) => setDetails({ ...details, address: e.target.value })}
                                    rows="3"
                                    className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="Institution address..."
                                />
                            </div>
                        </div>

                        {/* Uploads Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-gray-100">
                            <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Institution Logo</span>
                                <div className="h-32 w-32 rounded-xl bg-white shadow-sm flex items-center justify-center overflow-hidden border border-gray-200 mb-4">
                                    {(previewUrl || details.logoUrl) && !logoError ? (
                                        <img 
                                            src={previewUrl || details.logoUrl} 
                                            alt="Logo" 
                                            className="h-full w-full object-contain p-2" 
                                            onError={() => setLogoError(true)}
                                        />
                                    ) : (
                                        <Building className="h-12 w-12 text-gray-300" />
                                    )}
                                </div>

                                <label className="cursor-pointer bg-white px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm inline-flex items-center">
                                    <Upload className="w-4 h-4 mr-2" />
                                    Select Logo
                                    <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'logo')} className="hidden" />
                                </label>
                            </div>

                            <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Authorized Signature</span>
                                <div className="h-32 w-32 rounded-xl bg-white shadow-sm flex items-center justify-center overflow-hidden border border-gray-200 mb-4">
                                    {(signaturePreviewUrl || details.signatureUrl) && !signatureError ? (
                                        <img 
                                            src={signaturePreviewUrl || details.signatureUrl} 
                                            alt="Signature" 
                                            className="h-full w-full object-contain p-2" 
                                            onError={() => setSignatureError(true)}
                                        />
                                    ) : (
                                        <div className="text-[10px] text-gray-400 font-bold text-center px-4">PRINCIPAL SIGNATURE</div>
                                    )}
                                </div>

                                <label className="cursor-pointer bg-white px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm inline-flex items-center">
                                    <Upload className="w-4 h-4 mr-2" />
                                    Select Signature
                                    <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'signature')} className="hidden" />
                                </label>
                                <p className="text-[10px] text-gray-400 mt-2 uppercase font-bold text-center">Transparent PNG Recommended</p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-gray-100 flex justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-indigo-600 text-white px-10 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center"
                        >
                            {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                            {loading ? "Saving..." : "Save"}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
