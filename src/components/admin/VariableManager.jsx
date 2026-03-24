
import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Settings, Plus, X, Tag, Trash2, Edit2, Check, AlertCircle, Search, Loader2, Circle, CheckCircle2, ShieldCheck } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

const SYSTEM_VARS = [
    { name: 'Student Name', slug: 'name', placeholder: '{Student Name}', isSystem: true },
    { name: 'Class', slug: 'class', placeholder: '{Class}', isSystem: true },
    { name: 'Home Address', slug: 'address', placeholder: '{Address}', isSystem: true },
    { name: 'Emergency No.', slug: 'emergencyContact', placeholder: '{Emergency Contact}', isSystem: true },
    { name: 'Blood Group', slug: 'bloodGroup', placeholder: '{Blood Group}', isSystem: true },
    { name: "Father's Name", slug: 'fatherName', placeholder: "{Father's Name}", isSystem: true },
    { name: "Mother's Name", slug: 'motherName', placeholder: "{Mother's Name}", isSystem: true },
];

export default function VariableManager() {
    const { userRole } = useAuth();
    const [variables, setVariables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        fetchVariables();
    }, []);

    const fetchVariables = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "variables"));
            const dbVars = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Merge System Vars with their status in DB
            const mergedSystem = SYSTEM_VARS.map(sv => {
                const dbMatch = dbVars.find(dv => dv.slug === sv.slug);
                return {
                    ...sv,
                    id: dbMatch ? dbMatch.id : sv.slug,
                    active: dbMatch ? (dbMatch.active !== false) : true
                };
            });

            // Get custom vars (those not in system list)
            const customVars = dbVars.filter(dv => !SYSTEM_VARS.find(sv => sv.slug === dv.slug));

            const allVars = [...mergedSystem, ...customVars];
            setVariables(allVars.sort((a, b) => (a.name || "").localeCompare(b.name || "")));
            setLoading(false);
        } catch (error) {
            console.error("Error fetching variables:", error);
            setLoading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newName.trim()) return;

        setIsSaving(true);
        try {
            const slug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
            const placeholder = `{${newName}}`;

            // Check if slug already exists in built-in or existing
            if (SYSTEM_VARS.some(s => s.slug === slug) || variables.some(v => v.slug === slug)) {
                alert("This variable name (or a variation of it) is already in use by the system.");
                setIsSaving(false);
                return;
            }

            const docRef = await addDoc(collection(db, "variables"), {
                name: newName,
                slug: slug,
                placeholder: placeholder,
                active: true,
                createdAt: new Date()
            });

            const newVar = {
                id: docRef.id,
                name: newName,
                slug: slug,
                placeholder: placeholder,
                active: true
            };

            setVariables([...variables, newVar].sort((a, b) => (a.name || "").localeCompare(b.name || "")));
            setNewName("");
            setIsAdding(false);
        } catch (error) {
            console.error("Error adding variable:", error);
            alert("Failed to add variable.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleActive = async (variable) => {
        try {
            const newStatus = !variable.active;

            // For system variables that aren't in DB yet, we use setDoc
            if (variable.isSystem && variable.id === variable.slug) {
                await setDoc(doc(db, "variables", variable.slug), {
                    name: variable.name,
                    slug: variable.slug,
                    placeholder: variable.placeholder,
                    active: newStatus,
                    isSystem: true,
                    updatedAt: new Date()
                });
            } else {
                await updateDoc(doc(db, "variables", variable.id), {
                    active: newStatus
                });
            }

            setVariables(variables.map(v =>
                v.id === variable.id ? { ...v, active: newStatus } : v
            ));
        } catch (error) {
            console.error("Error toggling variable:", error);
            alert("Failed to update status.");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this variable? It will no longer be available in the designer or student form. Existing data on students will remain but won't be easily editable.")) return;
        try {
            await deleteDoc(doc(db, "variables", id));
            setVariables(variables.filter(v => v.id !== id));
        } catch (error) {
            console.error("Error deleting variable:", error);
        }
    };

    const filteredVars = variables.filter(v =>
        (v.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.slug || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (userRole !== 'super_admin') {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="bg-red-50 p-6 rounded-2xl mb-4 text-red-500">
                    <AlertCircle className="w-12 h-12" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
                <p className="text-gray-500 max-w-md">Only Super Administrators can manage system variables.</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* DEBUG INFO - Will remove once confirmed working */}
            {process.env.NODE_ENV === 'development' && (
                <div className="text-[10px] text-gray-300 px-8">Variables Loaded: {variables.length} | Role: {userRole}</div>
            )}
            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden min-h-[600px]">
                <div className="px-8 py-8 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                            <span className="p-2 bg-pink-100 rounded-lg shadow-sm border border-pink-200">
                                <Tag className="w-6 h-6 text-pink-600" />
                            </span>
                            Manage Data Variables
                        </h2>
                        <p className="mt-1 text-sm text-gray-500 font-medium">Define custom data fields for student ID cards</p>
                    </div>

                    <div className="flex gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search fields..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 w-48"
                            />
                        </div>
                        <button
                            onClick={() => setIsAdding(true)}
                            className="px-6 py-3 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center gap-2 active:scale-95"
                        >
                            <Plus className="w-4 h-4" /> Add Field
                        </button>
                    </div>
                </div>

                <div className="p-8">
                    {isAdding && (
                        <div className="bg-indigo-50/50 border border-indigo-100 rounded-[2rem] p-8 mb-8 animate-in zoom-in-95 duration-200 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100/50 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                            <div className="relative z-10">
                                <h3 className="text-xs font-black text-indigo-900 mb-6 uppercase tracking-widest flex items-center gap-2">
                                    <Plus className="w-4 h-4" /> Create New Field
                                </h3>
                                <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4">
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="Variable Name (e.g. Admission No.)"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        className="flex-1 px-5 py-4 bg-white border border-indigo-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold shadow-sm"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            disabled={isSaving}
                                            type="submit"
                                            className="flex-1 md:flex-none px-8 py-4 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-100 active:scale-95"
                                        >
                                            {isSaving ? "Saving..." : "Save Field"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsAdding(false)}
                                            className="px-5 py-4 bg-white text-gray-400 hover:text-gray-600 rounded-2xl transition-all border border-indigo-100 shadow-sm hover:border-indigo-200 active:scale-95"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </form>
                                <div className="mt-6 flex items-center gap-2 text-[10px] text-indigo-400 font-bold uppercase tracking-widest">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    <span>Slug and placeholder tokens will be generated automatically.</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {loading ? (
                            <div className="col-span-2 py-24 text-center">
                                <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mx-auto mb-4" />
                                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Loading custom variables...</p>
                            </div>
                        ) : filteredVars.length === 0 ? (
                            <div className="col-span-2 py-24 text-center">
                                <div className="w-20 h-20 bg-gray-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-gray-100">
                                    <Tag className="w-8 h-8 text-gray-300" />
                                </div>
                                <h3 className="text-gray-900 font-black uppercase tracking-tighter text-lg mb-2">No variables found</h3>
                                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] max-w-[240px] mx-auto leading-relaxed">
                                    {searchTerm ? 'Try searching with different keywords' : 'Click the button above to add your first dynamic field'}
                                </p>
                            </div>
                        ) : (
                            filteredVars.map((v) => (
                                <div key={v.id} className="group bg-white border border-gray-100 p-6 rounded-[1.5rem] shadow-sm hover:shadow-xl hover:border-pink-100 transition-all duration-300 flex items-center justify-between relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-pink-50/30 rounded-full -mr-8 -mt-8 blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="flex items-center gap-5 relative z-10">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-transform shadow-sm ${v.isSystem ? 'bg-indigo-50 border-indigo-100' : 'bg-pink-50 border-pink-100'}`}>
                                            {v.isSystem ? <ShieldCheck className="w-6 h-6 text-indigo-500" /> : <Tag className="w-6 h-6 text-pink-500" />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className={`text-sm font-black uppercase tracking-tighter transition-colors ${v.isSystem ? 'text-indigo-900' : 'text-gray-900 group-hover:text-pink-600'}`}>{v.name}</h4>
                                                {v.isSystem && <span className="text-[7px] font-black bg-indigo-600 text-white px-1.5 py-0.5 rounded-full uppercase tracking-widest">Built-in</span>}
                                            </div>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                <div className={`text-[9px] px-2 py-1 rounded-lg font-black border transition-colors ${v.isSystem ? 'bg-indigo-100/50 text-indigo-700 border-indigo-200' : 'bg-gray-50 group-hover:bg-pink-100 text-gray-500 group-hover:text-pink-700 border-gray-100 group-hover:border-pink-200'}`}>
                                                    {v.placeholder}
                                                </div>
                                                <div className="text-[9px] text-gray-400 font-bold tracking-widest uppercase mt-0.5">
                                                    SLUG: <span className="text-gray-600">{v.slug}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 relative z-10">
                                        <button
                                            onClick={() => handleToggleActive(v)}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${v.active
                                                ? 'bg-green-50 text-green-600 border border-green-100'
                                                : 'bg-gray-100 text-gray-400 border border-gray-200'
                                                }`}
                                        >
                                            {v.active ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5 text-gray-300" />}
                                            {v.active ? 'Active' : 'Hidden'}
                                        </button>
                                        {!v.isSystem && (
                                            <button
                                                onClick={() => handleDelete(v.id)}
                                                className="p-3 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 shadow-sm hover:shadow-red-100 hover:scale-110"
                                                title="Delete Variable"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 mt-auto">
                    <div className="flex items-start gap-4 text-gray-400">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-indigo-400" />
                        <div>
                            <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-1">About Data Variables</h5>
                            <p className="text-[9px] font-medium leading-relaxed max-w-2xl">
                                Variables allow you to add custom fields to student profiles. Once added, they will appear in the Student Manager form and can be placed on ID card templates in the Designer using their corresponding {`{Brackets}`} token.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

