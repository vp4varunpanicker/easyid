import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, setDoc, deleteDoc, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Shield, Save, Search, UserCog, AlertTriangle, Key, Plus, Trash2, CheckSquare, Square, X } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

const AVAILABLE_PERMISSIONS = [
    { id: 'dashboard', label: 'Dashboard Overview' },
    { id: 'institution', label: 'Institution Profile' },
    { id: 'teachers', label: 'Staff Management' },
    { id: 'classes', label: 'Class Management' },
    { id: 'students', label: 'Student Management' },
    { id: 'designer', label: 'ID Card Designer' },
    { id: 'variables', label: 'System Variables' },
    { id: 'roles', label: 'Roles & Permissions' },
];

export default function RolesManager() {
    const { currentUser, userRole } = useAuth();
    const [activeTab, setActiveTab] = useState("users"); // "users" or "roles"
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [editingUserId, setEditingUserId] = useState(null);
    const [selectedUserRole, setSelectedUserRole] = useState("");

    // Role Definition State
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [newRole, setNewRole] = useState({ name: '', slug: '', permissions: [] });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersSnap, rolesSnap] = await Promise.all([
                getDocs(collection(db, "users")),
                getDocs(collection(db, "roles"))
            ]);

            setUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setRoles(rolesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleUserRoleEdit = (user) => {
        setEditingUserId(user.id);
        setSelectedUserRole(user.role || "teacher");
    };

    const handleUserRoleSave = async (userId) => {
        try {
            if (selectedUserRole !== 'super_admin') {
                const currentSuperAdmins = users.filter(u => u.role === 'super_admin');
                const isTargetSuperAdmin = users.find(u => u.id === userId)?.role === 'super_admin';
                if (isTargetSuperAdmin && currentSuperAdmins.length <= 1) {
                    alert("Cannot remove the last Super Admin.");
                    return;
                }
            }

            await updateDoc(doc(db, "users", userId), { role: selectedUserRole });
            setUsers(users.map(u => u.id === userId ? { ...u, role: selectedUserRole } : u));
            setEditingUserId(null);
        } catch (error) {
            console.error("Error updating user role:", error);
        }
    };

    const handleCreateOrUpdateRole = async (e) => {
        e.preventDefault();
        try {
            const slug = newRole.slug || newRole.name.toLowerCase().replace(/\s+/g, '_');
            const roleData = {
                name: newRole.name,
                slug: slug,
                permissions: newRole.permissions,
                updatedAt: new Date()
            };

            await setDoc(doc(db, "roles", slug), roleData);

            if (editingRole) {
                setRoles(roles.map(r => r.id === slug ? { id: slug, ...roleData } : r));
            } else {
                setRoles([...roles, { id: slug, ...roleData }]);
            }

            setShowRoleModal(false);
            setEditingRole(null);
            setNewRole({ name: '', slug: '', permissions: [] });
        } catch (error) {
            console.error("Error saving role:", error);
        }
    };

    const handleDeleteRole = async (roleId) => {
        if (!window.confirm("Are you sure? This might affect users assigned to this role.")) return;
        try {
            await deleteDoc(doc(db, "roles", roleId));
            setRoles(roles.filter(r => r.id !== roleId));
        } catch (error) {
            console.error("Error deleting role:", error);
        }
    };

    const togglePermission = (permId) => {
        setNewRole(prev => ({
            ...prev,
            permissions: prev.permissions.includes(permId)
                ? prev.permissions.filter(p => p !== permId)
                : [...prev.permissions, permId]
        }));
    };

    if (userRole !== 'super_admin') {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="bg-red-50 p-6 rounded-2xl mb-4"><Shield className="w-12 h-12 text-red-500" /></div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
                <p className="text-gray-500 max-w-md">Only Super Administrators can manage roles.</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Tab Navigation */}
            <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl w-fit">
                <button
                    onClick={() => setActiveTab("users")}
                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    User Management
                </button>
                <button
                    onClick={() => setActiveTab("roles")}
                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'roles' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Role Definitions
                </button>
            </div>

            {activeTab === 'users' ? (
                <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden animate-in fade-in duration-300">
                    <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                                <UserCog className="w-6 h-6 text-indigo-600" />
                                Assign User Roles
                            </h2>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search users..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full md:w-64"
                            />
                        </div>
                    </div>
                    <div className="p-8 overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">User</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Assigned Role</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {users.filter(u => u.email?.toLowerCase().includes(searchTerm.toLowerCase())).map(user => (
                                    <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">{user.email?.[0].toUpperCase()}</div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-bold text-gray-900">{user.name || 'User'}</div>
                                                    <div className="text-xs text-gray-500">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {editingUserId === user.id ? (
                                                <select
                                                    value={selectedUserRole}
                                                    onChange={(e) => setSelectedUserRole(e.target.value)}
                                                    className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"
                                                >
                                                    <option value="super_admin">Super Admin</option>
                                                    <option value="teacher">Teacher (Default)</option>
                                                    {roles.map(r => (
                                                        <option key={r.id} value={r.slug}>{r.name}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                !user.role ? (
                                                    <span className="px-3 py-1 bg-amber-50 text-amber-600 border border-amber-100 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                                                        Pending Approval
                                                    </span>
                                                ) : (
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${user.role === 'super_admin' ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                                                        {user.role}
                                                    </span>
                                                )
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right whitespace-nowrap">
                                            {editingUserId === user.id ? (
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => handleUserRoleSave(user.id)} className="p-2 hover:bg-green-50 text-green-600 rounded-lg"><Save className="w-5 h-5" /></button>
                                                    <button onClick={() => setEditingUserId(null)} className="p-2 hover:bg-gray-100 text-gray-400 rounded-lg"><X className="w-5 h-5" /></button>
                                                </div>
                                            ) : (
                                                <button onClick={() => handleUserRoleEdit(user)} className="text-indigo-600 text-xs font-black uppercase hover:underline">Edit Role</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden animate-in fade-in duration-300">
                    <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                            <Shield className="w-6 h-6 text-indigo-600" />
                            Define Custom Roles
                        </h2>
                        <button onClick={() => { setEditingRole(null); setNewRole({ name: '', slug: '', permissions: [] }); setShowRoleModal(true); }} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100 flex items-center gap-2">
                            <Plus className="w-4 h-4" /> Create New Role
                        </button>
                    </div>
                    <div className="p-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {roles.map(role => (
                                <div key={role.id} className="p-6 bg-gray-50 border border-gray-100 rounded-3xl relative group">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-white rounded-2xl shadow-sm"><Key className="w-6 h-6 text-indigo-600" /></div>
                                        <div className="flex gap-1">
                                            <button onClick={() => { setEditingRole(role); setNewRole(role); setShowRoleModal(true); }} className="p-2 text-gray-400 hover:text-indigo-600 bg-white rounded-xl opacity-0 group-hover:opacity-100 transition-all"><UserCog className="w-4 h-4" /></button>
                                            <button onClick={() => handleDeleteRole(role.id)} className="p-2 text-gray-400 hover:text-red-500 bg-white rounded-xl opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter">{role.name}</h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-4">Slug: {role.slug}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {role.permissions?.map(p => (
                                            <span key={p} className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[9px] font-black uppercase rounded-lg border border-indigo-200">{p}</span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Role Modal */}
            {showRoleModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden">
                        <div className="px-8 py-6 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">{editingRole ? 'Edit Role' : 'Create New Role'}</h3>
                            <button onClick={() => setShowRoleModal(false)} className="text-gray-400 hover:text-gray-900"><X className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleCreateOrUpdateRole} className="p-8 space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 ml-1">Role Name (e.g. Designer)</label>
                                <input
                                    required
                                    type="text"
                                    value={newRole.name}
                                    onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                                    className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold"
                                    placeholder="Enter role name..."
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 ml-1">Assign Permissions</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {AVAILABLE_PERMISSIONS.map(permission => (
                                        <button
                                            key={permission.id}
                                            type="button"
                                            onClick={() => togglePermission(permission.id)}
                                            className={`flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${newRole.permissions.includes(permission.id) ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-100 text-gray-500'}`}
                                        >
                                            {newRole.permissions.includes(permission.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-gray-200" />}
                                            <span className="text-xs font-bold">{permission.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2">
                                <Save className="w-5 h-5" /> {editingRole ? 'Update Role' : 'Create Role'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
