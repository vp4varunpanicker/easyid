import { useState, useEffect } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { User, Mail, Phone, MapPin, Save, Loader2, CheckCircle2, Shield, Lock, Key } from "lucide-react";

export default function ProfileManager() {
    const { currentUser, userRole } = useAuth();
    const [profile, setProfile] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        role: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    // Password change state
    const [showPasswordChange, setShowPasswordChange] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [passwordData, setPasswordData] = useState({ current: '', new: '' });

    const handleChangePassword = async () => {
        if (!passwordData.current || !passwordData.new) return;
        if (passwordData.new.length < 6) {
            setMessage('Error: New password must be at least 6 characters.');
            return;
        }

        setChangingPassword(true);
        setMessage('');

        try {
            const credential = EmailAuthProvider.credential(currentUser.email, passwordData.current);
            await reauthenticateWithCredential(currentUser, credential);
            await updatePassword(currentUser, passwordData.new);

            setMessage('Password updated successfully!');
            setPasswordData({ current: '', new: '' });
            setShowPasswordChange(false);
        } catch (error) {
            console.error("Error changing password:", error);
            setMessage('Error: ' + (error.code === 'auth/wrong-password' ? 'Incorrect current password' : error.message));
        } finally {
            setChangingPassword(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, [currentUser]);

    const fetchProfile = async () => {
        if (!currentUser) return;

        try {
            const userDoc = await getDoc(doc(db, "users", currentUser.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                setProfile({
                    name: data.name || '',
                    email: data.email || currentUser.email,
                    phone: data.phone || '',
                    address: data.address || '',
                    role: data.role || ''
                });
            }
            setLoading(false);
        } catch (error) {
            console.error("Error fetching profile:", error);
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');

        try {
            await updateDoc(doc(db, "users", currentUser.uid), {
                name: profile.name,
                phone: profile.phone,
                address: profile.address,
                updatedAt: new Date()
            });

            setMessage('Profile updated successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error("Error updating profile:", error);
            setMessage('Error updating profile. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64 bg-white rounded-xl shadow-sm border border-gray-100">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                <span className="ml-2 text-gray-500">Loading profile...</span>
            </div>
        );
    }

    return (
        <div className="max-w-3xl">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mr-4">
                                <User className="w-8 h-8 text-indigo-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">{profile.name || 'Your Profile'}</h3>
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-0.5">
                                    {userRole === 'super_admin' ? 'Super Administrator' : 'Administrator'}
                                </p>
                            </div>
                        </div>
                        {userRole === 'super_admin' && (
                            <div className="flex items-center px-3 py-1.5 bg-purple-100 rounded-full">
                                <Shield className="w-4 h-4 text-purple-600 mr-1.5" />
                                <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">System Owner</span>
                            </div>
                        )}
                    </div>
                </div>

                <form onSubmit={handleSave} className="p-6 space-y-6">
                    {/* Status Message */}
                    {message && (
                        <div className={`flex items-center p-4 rounded-xl ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                            <CheckCircle2 className="w-5 h-5 mr-2" />
                            <span className="text-sm font-medium">{message}</span>
                        </div>
                    )}

                    {/* Email (Read-only) */}
                    <div>
                        <label className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                            <Mail className="w-4 h-4 mr-2" />
                            Email Address
                        </label>
                        <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500 font-medium">
                            {profile.email}
                        </div>
                        <p className="text-xs text-gray-400 mt-1 ml-1">Email cannot be changed</p>
                    </div>

                    {/* Full Name */}
                    <div>
                        <label className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                            <User className="w-4 h-4 mr-2" />
                            Full Name
                        </label>
                        <input
                            type="text"
                            value={profile.name}
                            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                            placeholder="Enter your full name"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm font-medium"
                        />
                    </div>

                    {/* Phone Number */}
                    <div>
                        <label className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                            <Phone className="w-4 h-4 mr-2" />
                            Phone Number
                        </label>
                        <input
                            type="tel"
                            value={profile.phone}
                            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                            placeholder="+1234567890"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm font-medium"
                        />
                    </div>

                    {/* Address */}
                    <div>
                        <label className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                            <MapPin className="w-4 h-4 mr-2" />
                            Address
                        </label>
                        <textarea
                            value={profile.address}
                            onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                            rows="3"
                            placeholder="Enter your address"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm font-medium resize-none"
                        />
                    </div>

                    {/* Password Management */}
                    <div className="pt-6 border-t border-gray-100">
                        <h4 className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                            <Lock className="w-4 h-4 mr-2" />
                            Security & Password
                        </h4>

                        {!showPasswordChange ? (
                            <button
                                type="button"
                                onClick={() => setShowPasswordChange(true)}
                                className="px-4 py-2 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all text-xs uppercase tracking-widest"
                            >
                                Change Account Password
                            </button>
                        ) : (
                            <div className="space-y-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 animate-in fade-in slide-in-from-top-2">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Current Password</label>
                                    <input
                                        type="password"
                                        value={passwordData.current}
                                        onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                        placeholder="••••••••"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">New Password</label>
                                    <input
                                        type="password"
                                        value={passwordData.new}
                                        onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                        placeholder="Min. 6 characters"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={handleChangePassword}
                                        disabled={changingPassword || !passwordData.current || !passwordData.new}
                                        className="flex-1 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all text-xs shadow-lg disabled:opacity-50"
                                    >
                                        {changingPassword ? "Updating Password..." : "Update Password"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswordChange(false)}
                                        className="px-4 py-2 bg-white border border-gray-200 text-gray-400 font-bold rounded-xl hover:bg-gray-50 text-xs transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                                <p className="text-[9px] text-gray-400 mt-1 italic">
                                    Changing your password will update your login credentials immediately.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Save Button */}
                    <div className="pt-4 border-t border-gray-100">
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    Saving Profile...
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5 mr-2" />
                                    Save Profile Changes
                                </>
                            )}
                        </button>
                    </div>
                </form>

                {/* Account Information */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Account Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white rounded-lg p-3 border border-gray-100">
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Account Type</p>
                            <p className="text-sm font-bold text-gray-900">
                                {userRole === 'super_admin' ? 'Super Admin' : userRole === 'admin' ? 'Admin' : 'User'}
                            </p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-gray-100">
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">User ID</p>
                            <p className="text-xs font-mono text-gray-600 truncate">{currentUser?.uid}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
