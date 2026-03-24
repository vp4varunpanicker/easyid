import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { X, Bell, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function NotificationModal() {
    const { currentUser, userRole, showNotificationModal, setShowNotificationModal, setUnreadCount } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (currentUser && userRole) {
            checkNotifications();
        }
    }, [currentUser, userRole]);

    const checkNotifications = async () => {
        try {
            const q = query(
                collection(db, "notifications"),
                orderBy("createdAt", "desc"),
                limit(20)
            );

            const querySnapshot = await getDocs(q);
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);

            const allNotifs = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Filter by: Active, Not Expired, and Target Role
            const relevantNotifs = allNotifs.filter(n => {
                const isActive = n.isActive !== false;
                // Inclusive check: if endDate is today (or future), it shows.
                const isNotExpired = !n.endDate || n.endDate.toDate() >= startOfToday;
                const isForMe = n.targetRoles?.includes(userRole);
                return isActive && isNotExpired && isForMe;
            });

            setNotifications(relevantNotifs);
            setUnreadCount(relevantNotifs.length);

            // Auto-popup logic: 
            // - "Visit" (Navigating to URL, bookmark, etc.): Always show if relevant.
            // - "Refresh": Only show if not already dismissed in this session.
            const sessionDismissKey = `dismissed_notifs_${currentUser.uid}`;
            if (relevantNotifs.length > 0 && !sessionStorage.getItem(sessionDismissKey)) {
                setShowNotificationModal(true);
            }

        } catch (error) {
            console.error("Error checking notifications:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        // Mark as dismissed for this session only
        const sessionDismissKey = `dismissed_notifs_${currentUser.uid}`;
        sessionStorage.setItem(sessionDismissKey, "true");
        setShowNotificationModal(false);
    };

    if (loading) return null;

    return (
        <AnimatePresence>
            {showNotificationModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
                    />

                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 10 }}
                        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                    >
                        {/* Simple Header */}
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-2">
                                <Bell className="w-4 h-4 text-indigo-600" />
                                <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">System Broadcast</h2>
                            </div>
                            <button onClick={handleClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
                                <X className="w-4 h-4 text-slate-400" />
                            </button>
                        </div>

                        {/* Notifications List */}
                        <div className="overflow-y-auto p-4 space-y-3">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center space-y-2">
                                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto text-slate-300">
                                        <Bell className="w-6 h-6" />
                                    </div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No active announcements</p>
                                </div>
                            ) : (
                                notifications.map((notif) => (
                                    <div key={notif.id} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 hover:border-indigo-100 transition-colors">
                                        <div className="flex items-center justify-between mb-1">
                                            <h3 className="text-sm font-bold text-slate-900">{notif.title}</h3>
                                            <span className="text-[9px] text-slate-400 font-bold uppercase">
                                                {notif.createdAt?.toDate().toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-wrap">{notif.content}</p>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Action Footer */}
                        <div className="p-4 border-t border-slate-100">
                            <button
                                onClick={handleClose}
                                className="w-full py-3 bg-indigo-600 text-white text-[11px] font-black rounded-xl hover:bg-indigo-700 transition-all uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                            >
                                <Check className="w-3.5 h-3.5" />
                                Got it
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
