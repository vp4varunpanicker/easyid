import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Mail, Save, Loader2, CheckCircle2, AlertCircle, ShieldCheck, Server, Key, ShieldAlert, ShieldOff } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { logActivity } from "../../services/activityService";

export default function SettingsManager() {
    const { userRole, currentUser, licenseStatus } = useAuth();
    const [activeTab, setActiveTab] = useState('smtp');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testLoading, setTestLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const [smtpSettings, setSmtpSettings] = useState({
        host: '',
        port: '587',
        secure: false,
        user: '',
        pass: '',
        fromEmail: '',
        fromName: ''
    });

    // Licensing State
    const [licenseKey, setLicenseKey] = useState("");
    const [activating, setActivating] = useState(false);
    const [licenseInfo, setLicenseInfo] = useState(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            // Fetch SMTP Settings
            const smtpSnap = await getDoc(doc(db, "settings", "smtp"));
            if (smtpSnap.exists()) {
                setSmtpSettings(smtpSnap.data());
            }

            // Fetch License Info (We use AuthContext for display, this is just for initial checks if needed)
            // No longer strictly needed here as AuthContext handles syncing and providing live state
        } catch (error) {
            console.error("Error fetching settings:", error);
            setMessage({ type: 'error', text: 'Failed to load settings.' });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSmtp = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage({ type: '', text: '' });
        try {
            await setDoc(doc(db, "settings", "smtp"), {
                ...smtpSettings,
                updatedAt: new Date(),
                updatedBy: userRole
            });

            await logActivity('system', `Updated SMTP server configuration`, null, 'Super Admin');
            setMessage({ type: 'success', text: 'SMTP settings saved successfully!' });
        } catch (error) {
            console.error("Error saving settings:", error);
            setMessage({ type: 'error', text: 'Failed to save settings.' });
        } finally {
            setSaving(false);
        }
    };

    const handleActivateLicense = async (e) => {
        e.preventDefault();
        if (!licenseKey.trim()) return;

        setActivating(true);
        setMessage({ type: 'info', text: "Verifying license key..." });

        try {
            // Fetch school email for verification
            const schoolDoc = await getDoc(doc(db, "schools", "main"));
            const schoolEmail = schoolDoc.data()?.email || "";

            if (!schoolEmail) {
                throw new Error("Institution Email not found! Please set your school email in the 'Institution Profile' tab before activating.");
            }

            const response = await fetch('/api/license/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: licenseKey.trim().toLowerCase(),
                    email: schoolEmail
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server responded with ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                const newLicenseInfo = {
                    status: 'active',
                    activatedAt: new Date().toISOString(),
                    expiryDate: result.expiryDate,
                    schoolName: result.schoolName,
                    activatedBy: currentUser?.uid || 'unknown',
                    activatedKey: licenseKey.trim().toLowerCase(),
                    activatedEmail: schoolEmail
                };

                await setDoc(doc(db, "schools", "main"), { licenseInfo: newLicenseInfo }, { merge: true });

                setLicenseInfo(newLicenseInfo);
                setLicenseKey("");
                setMessage({ type: 'success', text: "System Activated Successfully! Valid until " + result.expiryDate });

                // Refresh activity log
                await logActivity('system', `System license activated for ${result.schoolName}`, null, 'Super Admin');
            } else {
                throw new Error(result.error || "Verification failed");
            }
        } catch (error) {
            console.error("Activation error:", error);
            setMessage({ type: 'error', text: error.message });
        } finally {
            setActivating(false);
        }
    };

    const handleTestEmail = async () => {
        setTestLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const response = await fetch('/api/test-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    smtp: smtpSettings,
                    to: smtpSettings.fromEmail
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server responded with ${response.status}`);
            }

            const data = await response.json();
            if (response.ok) {
                setMessage({ type: 'success', text: 'Test email sent successfully! Check your inbox.' });
            } else {
                throw new Error(data.error || 'Failed to send test email');
            }
        } catch (error) {
            console.error("Test email error:", error);
            setMessage({ type: 'error', text: error.message });
        } finally {
            setTestLoading(false);
        }
    };

    if (userRole !== 'super_admin') {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <ShieldCheck className="w-16 h-16 text-red-100 mb-4" />
                <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Access Denied</h2>
                <p className="text-gray-500 mt-2">Only Super Admins can access system settings.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Tab Navigation */}
            <div className="flex items-center gap-2 bg-gray-100/50 p-1.5 rounded-2xl w-fit">
                <button
                    onClick={() => { setActiveTab('smtp'); setMessage({ type: '', text: '' }); }}
                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'smtp' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                        }`}
                >
                    Email Settings
                </button>
                <button
                    onClick={() => { setActiveTab('license'); setMessage({ type: '', text: '' }); }}
                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'license' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                        }`}
                >
                    System License
                </button>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                {activeTab === 'smtp' ? (
                    <>
                        <div className="px-10 py-8 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100">
                                        <Mail className="w-6 h-6 text-white" />
                                    </div>
                                    <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Email Configuration</h3>
                                </div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.3em] mt-2 ml-1">Setup SMTP for system notifications</p>
                            </div>
                        </div>

                        <form onSubmit={handleSaveSmtp} className="p-10 space-y-8">
                            {message.text && (
                                <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in zoom-in-95 duration-200 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' :
                                    message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' :
                                        'bg-blue-50 text-blue-700 border border-blue-100'
                                    }`}>
                                    {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> :
                                        message.type === 'error' ? <AlertCircle className="w-5 h-5 flex-shrink-0" /> :
                                            <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />}
                                    <p className="text-sm font-bold">{message.text}</p>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <Server className="w-4 h-4" /> Server Details
                                    </h4>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">SMTP Host</label>
                                            <input
                                                type="text"
                                                required
                                                value={smtpSettings.host}
                                                onChange={e => setSmtpSettings({ ...smtpSettings, host: e.target.value })}
                                                className="w-full px-5 py-3 bg-gray-50 border border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-gray-900"
                                                placeholder="smtp.example.com"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Port</label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={smtpSettings.port}
                                                    onChange={e => setSmtpSettings({ ...smtpSettings, port: e.target.value })}
                                                    className="w-full px-5 py-3 bg-gray-50 border border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-gray-900"
                                                    placeholder="587"
                                                />
                                            </div>
                                            <div className="flex flex-col justify-end pb-3">
                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <input
                                                        type="checkbox"
                                                        checked={smtpSettings.secure}
                                                        onChange={e => setSmtpSettings({ ...smtpSettings, secure: e.target.checked })}
                                                        className="w-5 h-5 rounded-lg border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-sm font-bold text-gray-600 group-hover:text-gray-900 transition-colors">SSL/TLS</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <ShieldCheck className="w-4 h-4" /> Authentication
                                    </h4>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Username / Email</label>
                                            <input
                                                type="text"
                                                required
                                                value={smtpSettings.user}
                                                onChange={e => setSmtpSettings({ ...smtpSettings, user: e.target.value })}
                                                className="w-full px-5 py-3 bg-gray-50 border border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-gray-900"
                                                placeholder="user@example.com"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Password</label>
                                            <input
                                                type="password"
                                                required
                                                value={smtpSettings.pass}
                                                onChange={e => setSmtpSettings({ ...smtpSettings, pass: e.target.value })}
                                                className="w-full px-5 py-3 bg-gray-50 border border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-gray-900"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-8 border-t border-gray-50">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">From Email Address</label>
                                        <input
                                            type="email"
                                            required
                                            value={smtpSettings.fromEmail}
                                            onChange={e => setSmtpSettings({ ...smtpSettings, fromEmail: e.target.value })}
                                            className="w-full px-5 py-3 bg-gray-50 border border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-gray-900"
                                            placeholder="noreply@institution.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">From Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={smtpSettings.fromName}
                                            onChange={e => setSmtpSettings({ ...smtpSettings, fromName: e.target.value })}
                                            className="w-full px-5 py-3 bg-gray-50 border border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-gray-900"
                                            placeholder="Institution Admin"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row gap-4 pt-4">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                                >
                                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                    Save Configuration
                                </button>
                                <button
                                    type="button"
                                    onClick={handleTestEmail}
                                    disabled={testLoading || !smtpSettings.host}
                                    className="flex-1 py-4 bg-white text-indigo-600 border-2 border-indigo-50 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                                >
                                    {testLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                                    Send Test Email
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    <>
                        <div className="px-10 py-8 border-b border-gray-50 bg-gray-50/50">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-red-600 rounded-2xl shadow-lg shadow-red-100">
                                    <Key className="w-6 h-6 text-white" />
                                </div>
                                <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Software License</h3>
                            </div>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.3em] mt-2 ml-1">Manage application activation and validity</p>
                        </div>

                        <div className="p-10 space-y-10">
                            {message.text && (
                                <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in zoom-in-95 duration-200 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' :
                                    message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' :
                                        'bg-blue-50 text-blue-700 border border-blue-100'
                                    }`}>
                                    {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> :
                                        message.type === 'error' ? <AlertCircle className="w-5 h-5 flex-shrink-0" /> :
                                            <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />}
                                    <p className="text-sm font-bold">{message.text}</p>
                                </div>
                            )}

                            {licenseStatus.active ? (
                                <div className="bg-green-50 rounded-[2.5rem] p-10 border border-green-100 flex flex-col md:flex-row items-center justify-between gap-8">
                                    <div className="flex items-center gap-6">
                                        <div className="h-20 w-20 bg-green-100 rounded-[2rem] flex items-center justify-center shadow-inner">
                                            <ShieldCheck className="w-10 h-10 text-green-600" />
                                        </div>
                                        <div>
                                            <h4 className="text-2xl font-black text-green-900 uppercase tracking-tight mb-2">Active License</h4>
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-black text-green-600 uppercase tracking-widest bg-white px-2 py-1 rounded-md shadow-sm border border-green-200">VALID UNTIL</span>
                                                <p className="text-lg text-green-700 font-black tracking-tight">
                                                    {new Date(licenseStatus.expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2 text-right">
                                        <span className="inline-flex items-center px-6 py-2 bg-green-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-green-100">
                                            Authenticated
                                        </span>
                                        <p className="text-[10px] font-bold text-green-600/60 uppercase tracking-widest">School: {licenseStatus.schoolName}</p>
                                    </div>
                                </div>
                            ) : licenseStatus.expiryDate ? (
                                <div className="space-y-8">
                                    <div className="bg-red-50 rounded-[2.5rem] p-10 border border-red-100 flex flex-col md:flex-row items-center justify-between gap-8">
                                        <div className="flex items-center gap-6">
                                            <div className="h-20 w-20 bg-red-100 rounded-[2rem] flex items-center justify-center shadow-inner">
                                                <ShieldOff className="w-10 h-10 text-red-600" />
                                            </div>
                                            <div>
                                                <h4 className="text-2xl font-black text-red-900 uppercase tracking-tight mb-2">License Expired</h4>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-black text-red-600 uppercase tracking-widest bg-white px-2 py-1 rounded-md shadow-sm border border-red-200">EXPIRED ON</span>
                                                    <p className="text-lg text-red-700 font-black tracking-tight">
                                                        {new Date(licenseStatus.expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2 text-right">
                                            <span className="inline-flex items-center px-6 py-2 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-red-100">
                                                Access Restricted
                                            </span>
                                            <p className="text-[10px] font-bold text-red-600/60 uppercase tracking-widest">Renewal Required</p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleActivateLicense} className="flex flex-col md:flex-row gap-4">
                                        <div className="flex-1 relative group">
                                            <Key className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
                                            <input
                                                type="text"
                                                value={licenseKey}
                                                onChange={(e) => setLicenseKey(e.target.value)}
                                                placeholder="ENTER NEW ACTIVATION KEY"
                                                className="w-full pl-16 pr-6 py-5 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-[1.5rem] outline-none font-mono text-sm tracking-[0.2em] uppercase transition-all shadow-inner"
                                                required
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={activating || !licenseKey.trim()}
                                            className="px-12 py-5 bg-indigo-600 text-white font-black rounded-[1.5rem] hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-100 active:scale-95 disabled:opacity-50 disabled:scale-100 flex items-center justify-center uppercase tracking-widest text-xs"
                                        >
                                            {activating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify & Activate"}
                                        </button>
                                    </form>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    <div className="bg-amber-50 rounded-[2.5rem] p-10 border border-amber-100 flex items-center gap-6">
                                        <div className="h-16 w-16 bg-amber-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                                            <ShieldAlert className="w-8 h-8 text-amber-600" />
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-black text-amber-900 uppercase tracking-tight mb-1">System Not Activated</h4>
                                            <p className="text-sm text-amber-700 font-medium leading-relaxed">
                                                To unlock full institutional features, please enter your unique 1-year activation key provided by eGlobe.
                                            </p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleActivateLicense} className="flex flex-col md:flex-row gap-4">
                                        <div className="flex-1 relative group">
                                            <Key className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
                                            <input
                                                type="text"
                                                value={licenseKey}
                                                onChange={(e) => setLicenseKey(e.target.value)}
                                                placeholder="ENTER MASTER ACTIVATION KEY"
                                                className="w-full pl-16 pr-6 py-5 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-[1.5rem] outline-none font-mono text-sm tracking-[0.2em] uppercase transition-all shadow-inner"
                                                required
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={activating || !licenseKey.trim()}
                                            className="px-12 py-5 bg-indigo-600 text-white font-black rounded-[1.5rem] hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-100 active:scale-95 disabled:opacity-50 disabled:scale-100 flex items-center justify-center uppercase tracking-widest text-xs"
                                        >
                                            {activating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify & Activate"}
                                        </button>
                                    </form>

                                    <p className="text-center text-[10px] font-black text-gray-300 uppercase tracking-[0.4em] pt-4">
                                        Powered by easyid Professional Suite
                                    </p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
