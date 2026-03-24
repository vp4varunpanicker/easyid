import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, query, orderBy, limit, deleteDoc, doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { Bell, Send, Loader2, CheckCircle2, History, Users, Trash2, Plus, Megaphone, Edit2, Save } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const SYSTEM_ROLES = [
    { id: 'super_admin', name: 'Super Admin' },
    { id: 'teacher', name: 'Teacher' }
];

export default function NotificationManager() {
    const { currentUser } = useAuth();
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [selectedRoles, setSelectedRoles] = useState([]);
    const [availableRoles, setAvailableRoles] = useState([]);
    const [loadingRoles, setLoadingRoles] = useState(true);
    const [sending, setSending] = useState(false);
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [endDate, setEndDate] = useState("");
    const [isActive, setIsActive] = useState(true);

    useEffect(() => {
        fetchRoles();
        fetchHistory();
    }, []);

    const fetchRoles = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "roles"));
            const dbRoles = querySnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));

            const mergedMap = new Map();
            SYSTEM_ROLES.forEach(r => mergedMap.set(r.id, r));
            dbRoles.forEach(r => mergedMap.set(r.id, r));

            setAvailableRoles(Array.from(mergedMap.values()));
        } catch (error) {
            console.error("Error fetching roles:", error);
        } finally {
            setLoadingRoles(false);
        }
    };

    const fetchHistory = async () => {
        try {
            const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(20));
            const querySnapshot = await getDocs(q);
            setHistory(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            console.error("Error fetching history:", error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleRoleToggle = (roleId) => {
        setSelectedRoles(prev =>
            prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
        );
    };

    const handleSelectAll = () => {
        if (selectedRoles.length === availableRoles.length) {
            setSelectedRoles([]);
        } else {
            setSelectedRoles(availableRoles.map(r => r.id));
        }
    };

    const handleEdit = (item) => {
        setEditingId(item.id);
        setTitle(item.title);
        setContent(item.content);
        setSelectedRoles(item.targetRoles || []);
        setIsActive(item.isActive !== false);
        setEndDate(item.endDate?.seconds
            ? new Date(item.endDate.seconds * 1000).toISOString().split('T')[0]
            : "");
        setIsCreating(true);
    };

    const handleToggleActive = async (item) => {
        const newStatus = item.isActive === false;
        try {
            await updateDoc(doc(db, "notifications", item.id), {
                isActive: newStatus
            });
            setHistory(prev => prev.map(n => n.id === item.id ? { ...n, isActive: newStatus } : n));
        } catch (error) {
            console.error("Error toggling status:", error);
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!title.trim() || !content.trim() || selectedRoles.length === 0) return;

        setSending(true);
        try {
            const notificationData = {
                title,
                content,
                targetRoles: selectedRoles,
                isActive,
                endDate: endDate ? (() => {
                    // Split YYYY-MM-DD to create a local date instance
                    const [year, month, day] = endDate.split('-').map(Number);
                    const d = new Date(year, month - 1, day);
                    d.setHours(23, 59, 59, 999);
                    return Timestamp.fromDate(d);
                })() : null,
                updatedAt: new Date(),
                createdBy: currentUser.uid,
                authorName: currentUser.displayName || 'Admin'
            };

            if (editingId) {
                await updateDoc(doc(db, "notifications", editingId), notificationData);
                setHistory(prev => prev.map(n => n.id === editingId ? { ...n, ...notificationData } : n));
                alert("Notification updated successfully!");
            } else {
                const docRef = await addDoc(collection(db, "notifications"), {
                    ...notificationData,
                    createdAt: new Date()
                });
                setHistory([{ id: docRef.id, ...notificationData, createdAt: new Date() }, ...history].slice(0, 20));
                alert("Notification broadcasted successfully!");
            }

            resetForm();
        } catch (error) {
            console.error("Error saving notification:", error);
            alert("Failed to save notification.");
        } finally {
            setSending(false);
        }
    };

    const resetForm = () => {
        setTitle("");
        setContent("");
        setSelectedRoles([]);
        setEndDate("");
        setIsActive(true);
        setEditingId(null);
        setIsCreating(false);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this notification? It will stop appearing for all users.")) return;

        try {
            await deleteDoc(doc(db, "notifications", id));
            setHistory(prev => prev.filter(n => n.id !== id));
        } catch (error) {
            console.error("Error deleting notification:", error);
            alert("Failed to delete notification.");
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="bg-rose-100 p-3 rounded-2xl">
                        <Bell className="w-8 h-8 text-rose-600" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Broadcast Center</h1>
                        <p className="text-gray-500 font-medium">Manage system announcements and alerts</p>
                    </div>
                </div>

                <button
                    onClick={() => {
                        resetForm();
                        setIsCreating(true);
                    }}
                    className="flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:shadow-2xl hover:scale-[1.02] active:scale-95 transition-all"
                >
                    <Plus className="w-5 h-5" />
                    New Announcement
                </button>
            </div>

            {/* NOTIFICATION LOG / HISTORY */}
            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-indigo-50/50 border border-indigo-50 p-8 sm:p-10">
                <div className="flex items-center gap-3 mb-8">
                    <History className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-xl font-bold text-gray-900">Announcement Log</h2>
                </div>

                {loadingHistory ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="w-10 h-10 text-indigo-200 animate-spin" />
                    </div>
                ) : history.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                            <Megaphone className="w-8 h-8 text-gray-200" />
                        </div>
                        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No active announcements</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <AnimatePresence mode="popLayout">
                            {history.map(item => (
                                <motion.div
                                    key={item.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="group relative bg-white border border-gray-100 p-6 rounded-[2rem] hover:shadow-xl hover:border-indigo-100 transition-all duration-300 flex flex-col h-full"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="space-y-1">
                                            <h3 className="font-black text-gray-900 leading-tight uppercase tracking-tight">{item.title}</h3>
                                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                                                {item.createdAt?.seconds
                                                    ? new Date(item.createdAt.seconds * 1000).toLocaleString()
                                                    : 'Just now'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleToggleActive(item)}
                                                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${item.isActive !== false
                                                    ? 'bg-green-50 text-green-600 border border-green-100 hover:bg-green-100'
                                                    : 'bg-slate-100 text-slate-400 border border-slate-200 hover:bg-slate-200'
                                                    }`}
                                            >
                                                {item.isActive !== false ? 'Active' : 'Hidden'}
                                            </button>
                                            <button
                                                onClick={() => handleEdit(item)}
                                                className="p-2 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                title="Edit"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="p-2 text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                                title="Delete permanently"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <p className="text-sm text-gray-500 line-clamp-3 mb-6 leading-relaxed">
                                        {item.content}
                                    </p>

                                    <div className="flex flex-col gap-4 mt-auto">
                                        <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {item.targetRoles?.map(role => (
                                                    <span key={role} className="text-[9px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                                                        {availableRoles.find(r => r.id === role)?.name || role}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                {item.endDate && (
                                                    <span className="text-[9px] font-bold text-amber-500 uppercase tracking-tight">
                                                        Expires: {new Date(item.endDate.seconds * 1000).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-gray-400 font-bold italic">By {item.authorName}</span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* CREATE/EDIT MODAL */}
            <AnimatePresence>
                {isCreating && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={resetForm}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-indigo-50"
                        >
                            <div className="p-8 sm:p-10">
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                                        {editingId ? <Edit2 className="w-5 h-5 text-white" /> : <Send className="w-5 h-5 text-white" />}
                                    </div>
                                    <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">
                                        {editingId ? 'Edit Announcement' : 'Compose Announcement'}
                                    </h2>
                                </div>

                                <form onSubmit={handleSend} className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Announcement Title</label>
                                        <input
                                            type="text"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-bold text-gray-900 transition-all placeholder-gray-300"
                                            placeholder="e.g. Scheduled Maintenance"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Message Body</label>
                                        <textarea
                                            value={content}
                                            onChange={(e) => setContent(e.target.value)}
                                            rows={5}
                                            className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-gray-700 transition-all placeholder-gray-300 resize-none font-medium"
                                            placeholder="Write your message details here..."
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Expiry Date (Optional)</label>
                                            <input
                                                type="date"
                                                value={endDate}
                                                onChange={(e) => setEndDate(e.target.value)}
                                                className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-bold text-gray-900 transition-all cursor-pointer"
                                            />
                                            <p className="text-[10px] text-gray-400 mt-2 ml-1 italic">Leave blank for no expiration</p>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Status</label>
                                            <div
                                                onClick={() => setIsActive(!isActive)}
                                                className={`flex items-center gap-3 px-6 py-4 rounded-2xl border-2 cursor-pointer transition-all ${isActive ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}
                                            >
                                                <div className={`w-10 h-6 rounded-full relative transition-all ${isActive ? 'bg-green-500' : 'bg-slate-300'}`}>
                                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isActive ? 'left-5' : 'left-1'}`} />
                                                </div>
                                                <span className={`text-[11px] font-black uppercase tracking-widest ${isActive ? 'text-green-600' : 'text-slate-400'}`}>
                                                    {isActive ? 'Active' : 'Hidden'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-3 ml-1">
                                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Select Recipients</label>
                                            <button
                                                type="button"
                                                onClick={handleSelectAll}
                                                className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:bg-indigo-50 px-2 py-1 rounded transition-colors"
                                            >
                                                {selectedRoles.length === availableRoles.length ? 'Clear All' : 'Select All'}
                                            </button>
                                        </div>

                                        {loadingRoles ? (
                                            <div className="flex justify-center p-4">
                                                <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                {availableRoles.map(role => {
                                                    const isSelected = selectedRoles.includes(role.id);
                                                    return (
                                                        <div
                                                            key={role.id}
                                                            onClick={() => handleRoleToggle(role.id)}
                                                            className={`cursor-pointer group flex items-center p-4 rounded-2xl border-2 transition-all duration-200 ${isSelected
                                                                ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-100'
                                                                : 'bg-white border-gray-100 hover:border-indigo-100'
                                                                }`}
                                                        >
                                                            <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center mr-3 transition-colors ${isSelected ? 'border-white/40 bg-white/20' : 'border-gray-200 group-hover:border-indigo-200'}`}>
                                                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                                            </div>
                                                            <span className={`text-xs font-black uppercase tracking-widest ${isSelected ? 'text-white' : 'text-gray-500'}`}>
                                                                {role.name}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-6 flex gap-3">
                                        <button
                                            type="button"
                                            onClick={resetForm}
                                            className="flex-1 px-8 py-5 bg-gray-50 text-gray-400 font-black rounded-2xl hover:bg-gray-100 transition-all uppercase tracking-widest text-xs"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={sending || selectedRoles.length === 0}
                                            className="flex-[2] flex items-center justify-center px-8 py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:shadow-2xl hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all uppercase tracking-widest text-xs"
                                        >
                                            {sending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : editingId ? <Save className="w-5 h-5 mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                                            {sending ? 'Saving...' : editingId ? 'Update Announcement' : 'Broadcast Now'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
