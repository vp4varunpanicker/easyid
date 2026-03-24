import { useState, useEffect } from "react";
import { collection, getDocs, doc, getDoc, updateDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { Shield, Users, Plus, Edit2, Trash2, X, Save, Loader2, AlertCircle, UserPlus, CheckCircle2, Lock, Key } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { logActivity } from "../../services/activityService";

const AVAILABLE_PERMISSIONS = [
    { id: 'institution', label: 'Manage Institution', description: 'Edit institution details' },
    { id: 'teachers', label: 'Manage Staff', description: 'Add/Edit teachers' },
    { id: 'classes', label: 'Manage Classes', description: 'Create/Edit classes' },
    { id: 'students', label: 'Manage Students', description: 'Add/Edit students' },
    { id: 'designer', label: 'ID Card Designer', description: 'Access template designer' },
    { id: 'variables', label: 'Variables', description: 'Manage dynamic fields' },
    { id: 'profile', label: 'Profile', description: 'Access personal profile' },
    { id: 'roles', label: 'Roles & Users', description: 'Manage user access' },
];

const DEFAULT_ROLES = [
    { id: 'super_admin', name: 'Super Admin', color: 'purple', permissions: ['all'], description: 'Full System Access', isSystem: true },
    { id: 'admin', name: 'Admin', color: 'indigo', permissions: ['institution', 'teachers', 'classes', 'students', 'designer', 'variables', 'profile'], description: 'School Administrator Access', isSystem: true },
    { id: 'teacher', name: 'Teacher', color: 'green', permissions: ['students', 'classes'], description: 'Standard Teacher Access', isSystem: true }
];

export default function RolesManager() {
    const { userRole } = useAuth();
    const [activeTab, setActiveTab] = useState('users'); // 'users' or 'roles'

    // User Management State
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [editingUserId, setEditingUserId] = useState(null);
    const [userEditForm, setUserEditForm] = useState({ role: '', email: '' });
    const [showUserAddForm, setShowUserAddForm] = useState(false);
    const [addingUser, setAddingUser] = useState(false);
    const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'teacher' });

    // Manual Password Reset State
    const [showResetModal, setShowResetModal] = useState(false);
    const [selectedUserForReset, setSelectedUserForReset] = useState(null);
    const [manualNewPassword, setManualNewPassword] = useState('');
    const [sendingReset, setSendingReset] = useState(false);
    const [showResetSuccess, setShowResetSuccess] = useState(false);
    const [lastResetInfo, setLastResetInfo] = useState(null);

    // Role Management State
    const [roles, setRoles] = useState([]);
    const [loadingRoles, setLoadingRoles] = useState(true);
    const [editingRoleId, setEditingRoleId] = useState(null); // null = list mode, 'new' = create mode, ID = edit mode
    const [roleForm, setRoleForm] = useState({ name: '', color: 'indigo', description: '', permissions: [] });
    const [savingRole, setSavingRole] = useState(false);

    useEffect(() => {
        if (activeTab === 'users') fetchUsers();
        if (activeTab === 'roles') fetchRoles();
    }, [activeTab]);

    // --- DATA FETCHING ---
    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const querySnapshot = await getDocs(collection(db, "users"));
            const usersList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUsers(usersList.sort((a, b) => {
                if (a.role === 'pending' && b.role !== 'pending') return -1;
                if (a.role !== 'pending' && b.role === 'pending') return 1;
                return (a.name || a.email).localeCompare(b.name || b.email);
            }));
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoadingUsers(false);
        }
    };

    const fetchRoles = async () => {
        setLoadingRoles(true);
        try {
            const querySnapshot = await getDocs(collection(db, "roles"));
            const dbRoles = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Merge with system defaults if they don't exist in DB (conceptually)
            // For now, we just display DB roles + ensure Super Admin exists visually if needed
            // But realistically, we treat the DB as the source of truth for custom roles.
            // We will merge DEFAULT_ROLES with dbRoles, preferring DB versions if ID matches.

            const mergedRoles = [...DEFAULT_ROLES];
            dbRoles.forEach(dbRole => {
                const index = mergedRoles.findIndex(r => r.id === dbRole.id);
                if (index !== -1) {
                    mergedRoles[index] = { ...mergedRoles[index], ...dbRole };
                } else {
                    mergedRoles.push(dbRole);
                }
            });

            setRoles(mergedRoles);
        } catch (error) {
            console.error("Error fetching roles:", error);
        } finally {
            setLoadingRoles(false);
        }
    };

    // --- USER ACTIONS ---
    const handleUserEditClick = (user) => {
        setEditingUserId(user.id);
        setUserEditForm({
            role: user.role || 'pending',
            email: user.email || ''
        });
    };

    const [savingUserId, setSavingUserId] = useState(false);

    const handleUserSave = async (user) => {
        setSavingUserId(user.id);
        try {
            // If email changed, we need to use the backend API
            if (userEditForm.email !== user.email) {
                const response = await fetch('http://127.0.0.1:5000/api/update-user-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        uid: user.id,
                        newEmail: userEditForm.email
                    })
                });

                const text = await response.text();
                let result;
                try {
                    result = JSON.parse(text);
                } catch (e) {
                    throw new Error(`Server returned HTML (likely 404). Please ensure the backend server is running. (Response: ${text.slice(0, 50)}...)`);
                }

                if (!result.success) {
                    throw new Error(result.error || 'Failed to update email in authentication.');
                }
            } else {
                // Just update role in Firestore if email didn't change
                await updateDoc(doc(db, "users", user.id), {
                    role: userEditForm.role,
                    updatedAt: new Date()
                });
            }

            setUsers(users.map(u => u.id === user.id ? { ...u, role: userEditForm.role, email: userEditForm.email } : u));
            setEditingUserId(null);

            // Log Activity
            await logActivity('user', `Updated role/email for ${user.name || user.email}`, currentUser?.uid, currentUser?.email);

            alert("User updated successfully!");
        } catch (error) {
            console.error(error);
            alert("Error: " + error.message);
        } finally {
            setSavingUserId(false);
        }
    };

    const handleUserDelete = async (id) => {
        if (!window.confirm("Delete this user?")) return;
        try {
            await deleteDoc(doc(db, "users", id));
            setUsers(users.filter(u => u.id !== id));
        } catch (err) {
            console.error(err);
        }
    };

    const fetchSmtpSettings = async () => {
        try {
            const docRef = doc(db, "settings", "smtp");
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? docSnap.data() : null;
        } catch (error) {
            console.error("Error fetching SMTP settings:", error);
            return null;
        }
    };

    const handleResetPassword = (user) => {
        setSelectedUserForReset(user);
        setManualNewPassword(Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 10)); // Auto-generate but allow edit
        setShowResetModal(true);
    };



    const handleSendResetEmail = async (e) => {
        e.preventDefault();
        const user = selectedUserForReset;
        if (!user || !manualNewPassword) return;

        const smtp = await fetchSmtpSettings();
        if (!smtp || !smtp.host) {
            alert("Error: SMTP is not configured. Please configure SMTP in Settings first.");
            return;
        }

        setSendingReset(true);
        try {
            // Now handled by server with firebase-admin
            // The server will update the password in Firebase and send the email.


            const response = await fetch('http://127.0.0.1:5000/api/send-reset-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    smtp: smtp,
                    userEmail: user.email,
                    userName: user.name,
                    newPassword: manualNewPassword
                })
            });

            const text = await response.text();
            let result;
            try {
                result = JSON.parse(text);
            } catch (e) {
                throw new Error("Server error: Received HTML response instead of JSON.");
            }

            if (result.success) {
                setLastResetInfo({
                    email: user.email,
                    password: manualNewPassword
                });
                setShowResetModal(false);
                setShowResetSuccess(true);
                setSelectedUserForReset(null);
                setManualNewPassword('');
            } else {
                throw new Error(result.error || 'Failed to send reset email');
            }
        } catch (error) {
            console.error("Reset error:", error);
            alert("Error: " + error.message);
        } finally {
            setSendingReset(false);
        }
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        setAddingUser(true);
        try {
            // First check if SMTP is configured (optional but good for UX)
            const smtp = await fetchSmtpSettings();

            const { initializeApp } = await import('firebase/app');
            const { getAuth, createUserWithEmailAndPassword: createUser } = await import('firebase/auth');
            const firebaseConfig = auth.app.options;
            const secondaryApp = initializeApp(firebaseConfig, 'SecondaryRoles');
            const secondaryAuth = getAuth(secondaryApp);

            const userCredential = await createUser(secondaryAuth, newUser.email, newUser.password);
            const userId = userCredential.user.uid;

            await setDoc(doc(db, "users", userId), {
                email: newUser.email,
                role: newUser.role,
                name: newUser.name,
                createdAt: new Date()
            });

            // Send Welcome Email if SMTP is configured
            if (smtp && smtp.host) {
                try {
                    await fetch('http://127.0.0.1:5000/api/send-welcome-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            smtp: smtp,
                            user: {
                                email: newUser.email,
                                name: newUser.name,
                                password: newUser.password // Sending the raw password provided in the form
                            }
                        })
                    });
                } catch (emailErr) {
                    console.error("Failed to send welcome email:", emailErr);
                    // We don't block the whole process if email fails
                }
            }

            if (secondaryAuth) await secondaryAuth.signOut();
            try {
                if (secondaryApp && typeof secondaryApp.delete === 'function') {
                    await secondaryApp.delete();
                }
            } catch (deleteError) {
                console.warn("Secondary app cleanup warning:", deleteError);
            }

            await fetchUsers(); // Refresh list
            setNewUser({ email: '', password: '', name: '', role: 'teacher' });
            setShowUserAddForm(false);
            alert('User account created successfully!' + (smtp ? ' A welcome email has been sent.' : ''));
        } catch (error) {
            console.error(error);
            alert('Error creating user: ' + error.message);
        } finally {
            setAddingUser(false);
        }
    };


    // --- ROLE ACTIONS ---
    const handleRoleEditClick = (role) => {
        setEditingRoleId(role.id);
        setRoleForm({
            name: role.name,
            color: role.color || 'indigo',
            description: role.description || '',
            permissions: role.permissions || []
        });
    };

    const handleCreateRoleClick = () => {
        setEditingRoleId('new');
        setRoleForm({ name: '', color: 'blue', description: '', permissions: [] });
    };

    const handlePermissionToggle = (permId) => {
        const currentPerms = roleForm.permissions;
        if (currentPerms.includes(permId)) {
            setRoleForm({ ...roleForm, permissions: currentPerms.filter(p => p !== permId) });
        } else {
            setRoleForm({ ...roleForm, permissions: [...currentPerms, permId] });
        }
    };

    const handleRoleSave = async (e) => {
        e.preventDefault();
        setSavingRole(true);
        try {
            const roleData = {
                name: roleForm.name,
                color: roleForm.color,
                description: roleForm.description,
                permissions: roleForm.permissions,
                updatedAt: new Date()
            };

            let roleId = editingRoleId;

            if (editingRoleId === 'new') {
                // Generate a slug-like ID
                roleId = roleForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                await setDoc(doc(db, "roles", roleId), { ...roleData, createdAt: new Date() });
            } else {
                // Update existing
                // If it's a system role (like super_admin), we might want to restrict editing slightly, 
                // but checking permissions allows flexibility.
                await setDoc(doc(db, "roles", roleId), roleData, { merge: true });
            }

            await fetchRoles();
            setEditingRoleId(null);
        } catch (error) {
            console.error("Error saving role:", error);
            alert("Failed to save role.");
        } finally {
            setSavingRole(false);
        }
    };

    const handleRoleDelete = async (roleId) => {
        if (!window.confirm("Delete this role? Users assigned to this role will lose permissions.")) return;
        try {
            await deleteDoc(doc(db, "roles", roleId));
            setRoles(roles.filter(r => r.id !== roleId));
        } catch (err) {
            console.error(err);
            alert("Error deleting role.");
        }
    };


    // Helper for rendering
    const getRoleLabel = (roleId) => {
        // Try to find in roles state first, then defaults
        const role = roles.find(r => r.id === roleId) || DEFAULT_ROLES.find(r => r.id === roleId);
        return role ? role.name : roleId;
    };

    // Combine all available roles for the User Edit select dropdown
    // We should fetch roles if we are in 'users' tab and haven't fetched them yet? 
    // Ideally we fetch generic info on mount or assume roles state is populated. 
    // To be safe, we'll use a combined list derived when valid.
    // Combine all available roles for the User Edit select dropdown
    // We filter super_admin ONLY if the current logged in user is NOT a super_admin
    const allRoleOptions = (roles.length > 0 ? roles : DEFAULT_ROLES).filter(r =>
        r.id !== 'super_admin' || userRole === 'super_admin'
    );


    return (
        <div className="max-w-6xl mx-auto space-y-6">

            {/* TABS HEADER */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-1 flex space-x-1">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`flex-1 flex items-center justify-center py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'users' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'
                        }`}
                >
                    <Users className="w-4 h-4 mr-2" />
                    User Management
                </button>
                <button
                    onClick={() => setActiveTab('roles')}
                    className={`flex-1 flex items-center justify-center py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'roles' ? 'bg-purple-50 text-purple-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'
                        }`}
                >
                    <Shield className="w-4 h-4 mr-2" />
                    Role Definitions
                </button>
            </div>

            {/* USERS TAB CONTENT */}
            {activeTab === 'users' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                        <div className="flex items-center">
                            <Users className="w-5 h-5 text-gray-500 mr-2" />
                            <h3 className="text-lg font-bold text-gray-900">Registered Users</h3>
                        </div>
                        {userRole === 'super_admin' && (
                            <button
                                onClick={() => setShowUserAddForm(true)}
                                className="flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-sm"
                            >
                                <UserPlus className="w-4 h-4 mr-2" />
                                Register New User
                            </button>
                        )}
                    </div>

                    {loadingUsers ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Role</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {users.map((user) => (
                                        <tr key={user.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center">
                                                    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-bold">
                                                        {user.name ? user.name.charAt(0).toUpperCase() : <Users className="w-4 h-4" />}
                                                    </div>
                                                    <div className="ml-3">
                                                        <div className="text-sm font-bold text-gray-900">{user.name || 'No Name'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {editingUserId === user.id ? (
                                                    <input
                                                        type="email"
                                                        value={userEditForm.email}
                                                        onChange={(e) => setUserEditForm({ ...userEditForm, email: e.target.value })}
                                                        className="block w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-indigo-50/30 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                                        placeholder="user@example.com"
                                                    />
                                                ) : (
                                                    user.email
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                {editingUserId === user.id ? (
                                                    <select
                                                        value={userEditForm.role}
                                                        onChange={(e) => setUserEditForm({ ...userEditForm, role: e.target.value })}
                                                        className="block w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                                                    >
                                                        {allRoleOptions.map(r => (
                                                            <option key={r.id} value={r.id}>{r.name}</option>
                                                        ))}
                                                        <option value="pending">Pending</option>
                                                    </select>
                                                ) : (
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.role === 'super_admin' ? 'bg-purple-100 text-purple-800' :
                                                        user.role === 'teacher' ? 'bg-green-100 text-green-800' :
                                                            user.role === 'admin' ? 'bg-indigo-100 text-indigo-800' :
                                                                user.role === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                                    'bg-gray-100 text-gray-800'
                                                        }`}>
                                                        {getRoleLabel(user.role)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm font-medium">
                                                {user.role === 'super_admin' ? (
                                                    <div className="flex justify-end">
                                                        <span className="inline-flex items-center px-2 py-1 bg-gray-50 text-gray-400 rounded-lg text-xs font-bold border border-gray-100">
                                                            <Lock className="w-3 h-3 mr-1" />
                                                            System Protected
                                                        </span>
                                                    </div>
                                                ) : editingUserId === user.id ? (
                                                    <div className="flex justify-end space-x-2">
                                                        <button
                                                            onClick={() => handleUserSave(user)}
                                                            disabled={savingUserId === user.id}
                                                            className={`p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all ${savingUserId === user.id ? 'opacity-50' : ''}`}
                                                        >
                                                            {savingUserId === user.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingUserId(null)}
                                                            disabled={savingUserId === user.id}
                                                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-end space-x-3 text-gray-400">
                                                        {userRole === 'super_admin' && (
                                                            <div className="flex space-x-1">
                                                                <button
                                                                    onClick={() => handleResetPassword(user)}
                                                                    className="hover:text-amber-600 transition-colors p-1.5 hover:bg-amber-50 rounded-lg"
                                                                    title="Manual Password Notification"
                                                                >
                                                                    <Key className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        )}
                                                        <button
                                                            onClick={() => handleUserEditClick(user)}
                                                            className="hover:text-indigo-600 transition-colors p-1.5 hover:bg-indigo-50 rounded-lg"
                                                            title="Edit Role"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleUserDelete(user.id)}
                                                            className="hover:text-red-600 transition-colors p-1.5 hover:bg-red-50 rounded-lg"
                                                            title="Delete User"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}


            {/* ROLES TAB CONTENT */}
            {activeTab === 'roles' && (
                <div className="space-y-6">
                    {/* Role List */}
                    {!editingRoleId && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                                <div className="flex items-center">
                                    <Key className="w-5 h-5 text-gray-500 mr-2" />
                                    <h3 className="text-lg font-bold text-gray-900">Defined Roles</h3>
                                </div>
                                <button
                                    onClick={handleCreateRoleClick}
                                    className="flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-700 transition-all shadow-sm"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Create New Role
                                </button>
                            </div>

                            {loadingRoles ? (
                                <div className="p-8 text-center text-gray-500">Loading roles...</div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                                    {roles.map(role => (
                                        <div key={role.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-purple-200 hover:shadow-md transition-all group relative">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="text-lg font-black text-gray-900">{role.name}</h4>
                                                {role.id !== 'super_admin' && (
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => handleRoleEditClick(role)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                                                        {!role.isSystem && (
                                                            <button onClick={() => handleRoleDelete(role.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 mb-4 h-8">{role.description}</p>

                                            <div className="space-y-2">
                                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Permissions</div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {role.permissions?.includes('all') ? (
                                                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold uppercase tracking-wider rounded">Full Access</span>
                                                    ) : (
                                                        role.permissions?.slice(0, 3).map(p => (
                                                            <span key={p} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wider rounded">
                                                                {AVAILABLE_PERMISSIONS.find(ap => ap.id === p)?.label || p}
                                                            </span>
                                                        ))
                                                    )}
                                                    {role.permissions?.length > 3 && (
                                                        <span className="px-2 py-0.5 bg-gray-50 text-gray-400 text-[10px] font-bold rounded">+{role.permissions.length - 3} more</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Role Editor */}
                    {editingRoleId && (
                        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-900">{editingRoleId === 'new' ? 'Create New Role' : 'Edit Role'}</h3>
                                <button onClick={() => setEditingRoleId(null)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
                            </div>
                            <form onSubmit={handleRoleSave} className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Role Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={roleForm.name}
                                            onChange={e => setRoleForm({ ...roleForm, name: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-bold text-gray-900"
                                            placeholder="e.g. Content Editor"
                                            disabled={editingRoleId === 'super_admin'}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Description</label>
                                        <input
                                            type="text"
                                            value={roleForm.description}
                                            onChange={e => setRoleForm({ ...roleForm, description: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                                            placeholder="Briefly describe what this role does"
                                        />
                                    </div>
                                </div>

                                <div className="mb-8">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Access Permissions</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {/* Special Case: All Access */}
                                        <div
                                            onClick={() => editingRoleId !== 'super_admin' && handlePermissionToggle('all')}
                                            className={`p-4 rounded-xl border border-gray-200 cursor-pointer transition-all ${roleForm.permissions.includes('all')
                                                ? 'bg-purple-50 border-purple-200 ring-1 ring-purple-500'
                                                : 'hover:bg-gray-50'
                                                } ${editingRoleId === 'super_admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <div className="flex items-start">
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 mt-0.5 ${roleForm.permissions.includes('all') ? 'bg-purple-600 border-purple-600' : 'border-gray-300'}`}>
                                                    {roleForm.permissions.includes('all') && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                                </div>
                                                <div>
                                                    <h5 className="font-bold text-gray-900 text-sm">Full System Access</h5>
                                                    <p className="text-xs text-gray-500 mt-0.5">Grants access to ALL modules and settings.</p>
                                                </div>
                                            </div>
                                        </div>

                                        {AVAILABLE_PERMISSIONS.filter(p => p.id !== 'roles').map(perm => {
                                            const isSelected = roleForm.permissions.includes(perm.id) || roleForm.permissions.includes('all');
                                            return (
                                                <div
                                                    key={perm.id}
                                                    onClick={() => !roleForm.permissions.includes('all') && handlePermissionToggle(perm.id)}
                                                    className={`p-4 rounded-xl border border-gray-200 cursor-pointer transition-all ${isSelected
                                                        ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-500'
                                                        : 'hover:bg-gray-50'
                                                        } ${roleForm.permissions.includes('all') ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    <div className="flex items-start">
                                                        <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 mt-0.5 ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                                                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                                        </div>
                                                        <div>
                                                            <h5 className="font-bold text-gray-900 text-sm">{perm.label}</h5>
                                                            <p className="text-xs text-gray-500 mt-0.5">{perm.description}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => setEditingRoleId(null)}
                                        className="px-6 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={savingRole}
                                        className="px-6 py-2.5 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-lg shadow-purple-200 transition-all flex items-center"
                                    >
                                        {savingRole ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                        Save Role Configuration
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            )}


            {/* Add User Modal Logic (Reused from previous, kept simple) */}
            {showUserAddForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-900 leading-none">Register New User</h3>
                            <button onClick={() => setShowUserAddForm(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleAddUser} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Email</label>
                                <input required type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Password</label>
                                <input required type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Name</label>
                                <input required type="text" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Role</label>
                                <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl">
                                    {allRoleOptions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>
                            <button disabled={addingUser} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl mt-4">
                                {addingUser ? 'Creating...' : 'Create Account'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Manual Password Reset Modal */}
            {showResetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="font-bold text-gray-900 leading-none">Reset Password</h3>
                                <p className="text-[10px] text-gray-500 uppercase mt-1">For {selectedUserForReset?.email}</p>
                            </div>
                            <button onClick={() => setShowResetModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleSendResetEmail} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">New Password</label>
                                <div className="flex gap-2">
                                    <input
                                        required
                                        type="text"
                                        value={manualNewPassword}
                                        onChange={e => setManualNewPassword(e.target.value)}
                                        className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm"
                                        placeholder="Enter or generate..."
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setManualNewPassword(Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 10))}
                                        className="px-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-colors"
                                        title="Regenerate"
                                    >
                                        <Key className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-3">
                                <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                                <p className="text-[10px] text-blue-700 leading-relaxed font-medium">
                                    This will update the user's password immediately and email them the new credentials.
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={sendingReset || !manualNewPassword}
                                className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl mt-4 shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center"
                            >
                                {sendingReset ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Mail className="w-5 h-5 mr-2" />}
                                {sendingReset ? 'Sending Email...' : 'Send Password via Email'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Manual Reset Success Modal */}
            {showResetSuccess && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 text-center">
                            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle2 className="w-10 h-10 text-green-500" />
                            </div>
                            <h3 className="text-2xl font-black text-gray-900 mb-2">Email Sent!</h3>
                            <p className="text-sm text-gray-500 leading-relaxed mb-6">
                                We've sent the new credentials to <span className="font-bold text-gray-800">{lastResetInfo?.email}</span>.
                            </p>

                            <div className="bg-gray-50 rounded-2xl p-4 mb-6 border border-gray-100">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">New Password Set</p>
                                <div className="flex items-center justify-center gap-3">
                                    <code className="text-lg font-mono font-bold text-indigo-600 bg-white px-3 py-1 rounded-lg border border-gray-200">
                                        {lastResetInfo?.password}
                                    </code>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(lastResetInfo?.password);
                                            alert("Copied to clipboard!");
                                        }}
                                        className="p-2 hover:bg-white rounded-lg transition-colors text-gray-400 hover:text-indigo-600"
                                        title="Copy Password"
                                    >
                                        <Save className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-left flex gap-3 mb-8">
                                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                                <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                                    <strong>Admin Note:</strong> Since we are in local development mode, please ensure this password is also updated in the Firebase Auth console if it doesn't log in automatically.
                                </p>
                            </div>

                            <button
                                onClick={() => setShowResetSuccess(false)}
                                className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl hover:bg-black transition-all shadow-xl active:scale-95"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
