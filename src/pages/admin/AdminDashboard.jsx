import { useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useNavigate, Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import IDCardDesigner from "../../components/admin/IDCardDesigner";
import TeacherManager from "../../components/admin/TeacherManager";
import InstitutionManager from "../../components/admin/InstitutionManager";
import StudentManager from "../../components/admin/StudentManager";
import ClassManager from "../../components/admin/ClassManager";
import VariableManager from "../../components/admin/VariableManager";
import RolesManager from "../../components/admin/RolesManager";
import ProfileManager from "../../components/admin/ProfileManager";
import SettingsManager from "../../components/admin/SettingsManager";
import NotificationManager from "../../components/admin/NotificationManager";
import NotificationModal from "../../components/notifications/NotificationModal";
import Documentation from "../../components/shared/Documentation";
import {
    LogOut,
    School,
    Users,
    GraduationCap,
    LayoutDashboard,
    Settings,
    UserCircle,
    BookOpen,
    Shield,
    Tag,
    Lightbulb,
    UserCircle2,
    HelpCircle,
    Bell,
    CheckCircle2,
    Clock,
    Activity,
    AlertTriangle,
    MailCheck,
    MailWarning,
    Lock as LockIcon,
    Unlock
} from "lucide-react";
import { collection, query, getDocs, orderBy, limit, doc, getDoc, where } from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function AdminDashboard() {
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUser, userRole, permissions, unreadCount, setShowNotificationModal, licenseStatus } = useAuth();
    const activeView = location.pathname.split('/').pop() || 'dashboard';
    const [isDesignerExpanded, setIsDesignerExpanded] = useState(false);
    const [profile, setProfile] = useState({ name: '' });

    // Reset expansion when changing routes
    useEffect(() => {
        setIsDesignerExpanded(false);
    }, [location.pathname]);

    const [stats, setStats] = useState({
        readyClasses: 0,
        pendingApprovals: 0,
        designLocked: false,
        smtpConfigured: false
    });
    const [recentActivity, setRecentActivity] = useState([]);
    const [loadingStats, setLoadingStats] = useState(true);

    // Fetch dashboard stats and activity
    useEffect(() => {
        const fetchDashboardData = async () => {
            if (activeView !== 'dashboard' && activeView !== 'admin') return;

            setLoadingStats(true);
            try {
                // 1. Pending Approvals
                const usersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "pending")));
                const pendingCount = usersSnap.size;

                // 2. Design Status
                const templatesSnap = await getDocs(collection(db, "idCardTemplates"));
                const defaultTemplate = templatesSnap.docs.find(d => d.data().isDefault) || templatesSnap.docs[0];
                const isLocked = defaultTemplate?.data()?.isLocked || false;

                // 3. SMTP Status
                const smtpSnap = await getDoc(doc(db, "settings", "smtp"));
                const isSmtpConfigured = smtpSnap.exists() && smtpSnap.data().host && smtpSnap.data().user;

                // 4. Classes Ready (100% completion)
                const studentsSnap = await getDocs(collection(db, "students"));
                const varsSnap = await getDocs(collection(db, "variables"));
                const activeVars = varsSnap.docs.filter(d => d.data().active !== false).map(d => d.data().slug);

                const students = studentsSnap.docs.map(d => d.data());
                const classGroups = students.reduce((acc, s) => {
                    if (!s.class) return acc;
                    if (!acc[s.class]) acc[s.class] = [];
                    acc[s.class].push(s);
                    return acc;
                }, {});

                let readyCount = 0;
                Object.values(classGroups).forEach(classStudents => {
                    const isClassReady = classStudents.every(student => {
                        const hasBasicInfo = student.name && student.photoUrl && student.photoUrl !== import.meta.env.BASE_URL + 'default-avatar.svg';
                        const hasDynamicInfo = activeVars.every(v => student[v] && String(student[v]).trim() !== '');
                        return hasBasicInfo && hasDynamicInfo;
                    });
                    if (isClassReady && classStudents.length > 0) readyCount++;
                });

                // 5. Recent Activity
                const activitySnap = await getDocs(query(
                    collection(db, "activity"),
                    orderBy("timestamp", "desc"),
                    limit(6)
                ));
                const activities = activitySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                setStats({
                    readyClasses: readyCount,
                    pendingApprovals: pendingCount,
                    designLocked: isLocked,
                    smtpConfigured: isSmtpConfigured
                });
                setRecentActivity(activities);
            } catch (error) {
                console.error("Error fetching dashboard stats:", error);
            } finally {
                setLoadingStats(false);
            }
        };

        fetchDashboardData();
    }, [activeView, currentUser]);

    // Fetch user profile
    useEffect(() => {
        const fetchProfile = async () => {
            if (currentUser) {
                const docSnap = await getDoc(doc(db, "users", currentUser.uid));
                if (docSnap.exists()) {
                    setProfile(docSnap.data());
                }
            }
        };
        fetchProfile();
    }, [currentUser]);



    const handleLogout = async () => {
        sessionStorage.removeItem(`dismissed_notifs_${currentUser.uid}`);
        await signOut(auth);
        navigate("/login");
    };

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-blue-600', bg: 'bg-blue-50' },
        { id: 'institution', label: 'Institution', icon: School, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { id: 'teachers', label: 'Staff', icon: Users, color: 'text-pink-600', bg: 'bg-pink-50' },
        { id: 'classes', label: 'Classes', icon: BookOpen, color: 'text-cyan-600', bg: 'bg-cyan-50' },
        { id: 'students', label: 'Students', icon: GraduationCap, color: 'text-amber-600', bg: 'bg-amber-50' },
        { id: 'designer', label: 'Designer', icon: Lightbulb, color: 'text-teal-600', bg: 'bg-teal-50' },
        { id: 'variables', label: 'Variables', icon: Tag, color: 'text-orange-600', bg: 'bg-orange-50' },
        { id: 'roles', label: 'Roles & Users', icon: Shield, color: 'text-purple-600', bg: 'bg-purple-50' },
        { id: 'notifications', label: 'Notify', icon: Bell, color: 'text-rose-600', bg: 'bg-rose-50', superOnly: true },
        { id: 'profile', label: 'Profile', icon: UserCircle2, color: 'text-gray-600', bg: 'bg-gray-50' },
        { id: 'docs', label: 'Docs', icon: HelpCircle, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    ];

    const visibleNavItems = navItems.filter(item => {
        if (item.superOnly && userRole !== 'super_admin') return false;
        if (permissions.includes('all')) return true;
        if (userRole === 'super_admin') return true; // Force show all for Super Admin
        if (item.id === 'dashboard') return true;
        return permissions.includes(item.id);
    });

    const DashboardHome = () => (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Insights Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-4 shadow-sm">
                    <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 leading-none mb-1">Classes Ready</p>
                        <h4 className="text-xl font-black text-gray-900 leading-none">{stats.readyClasses}</h4>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-4 shadow-sm">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stats.pendingApprovals > 0 ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-400'}`}>
                        <Clock className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 leading-none mb-1">Pending Approvals</p>
                        <h4 className="text-xl font-black text-gray-900 leading-none">{stats.pendingApprovals}</h4>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-4 shadow-sm">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stats.designLocked ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'}`}>
                        {stats.designLocked ? <LockIcon className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 leading-none mb-1">Design Status</p>
                        <h4 className="text-sm font-black text-gray-900 leading-none">{stats.designLocked ? 'LOCKED' : 'DRAFT'}</h4>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-4 shadow-sm">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stats.smtpConfigured ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'}`}>
                        {stats.smtpConfigured ? <MailCheck className="w-5 h-5" /> : <MailWarning className="w-5 h-5" />}
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 leading-none mb-1">SMTP Status</p>
                        <h4 className="text-sm font-black text-gray-900 leading-none">{stats.smtpConfigured ? 'CONNECTED' : 'ACTION REQ.'}</h4>
                    </div>
                </div>
            </div>

            {/* Navigation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {visibleNavItems.filter(item => item.id !== 'dashboard').map((item) => (
                    <Link
                        key={item.id}
                        to={`/admin/${item.id}`}
                        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col hover:shadow-xl hover:border-indigo-100 transition-all group cursor-pointer"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`${item.bg} w-10 h-10 rounded-xl flex items-center justify-center ${item.color} group-hover:scale-110 transition-transform flex-shrink-0`}>
                                <item.icon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight truncate leading-none mb-1">{item.label}</h3>
                                <p className="text-gray-400 text-[8px] font-bold uppercase tracking-widest truncate leading-none">Manage {item.label.toLowerCase()}</p>
                            </div>
                        </div>
                        <div className="mt-auto w-full py-2 rounded-xl text-[8px] font-black uppercase tracking-[0.2em] bg-gray-50 text-gray-400 group-hover:bg-indigo-600 group-hover:text-white transition-all text-center">ENTER</div>
                    </Link>
                ))}
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mt-16">
                <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-gray-400" />
                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-900">Recent Activity</h3>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400">LIVE FEED</span>
                </div>
                <div className="divide-y divide-gray-50">
                    {recentActivity.length === 0 ? (
                        <div className="px-6 py-8 text-center text-gray-400 text-[10px] font-bold uppercase tracking-widest">
                            No recent activity recorded
                        </div>
                    ) : (
                        recentActivity.map((activity) => (
                            <div key={activity.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                    <div>
                                        <p className="text-xs font-bold text-gray-900 leading-tight">{activity.message}</p>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">By {activity.userName}</p>
                                    </div>
                                </div>
                                <span className="text-[9px] font-black text-gray-300 uppercase tracking-tighter">
                                    {activity.timestamp && typeof activity.timestamp.toDate === 'function'
                                        ? activity.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                        : 'Recent'}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );

    const getTitle = () => {
        if (activeView === 'settings') return 'System Settings';
        const active = navItems.find(item => item.id === activeView);
        return active ? active.label : 'Dashboard';
    };

    return (
        <div className="flex h-screen bg-[#FDFDFF] overflow-hidden font-['Inter']">
            <NotificationModal />
            {/* LEFT SIDEBAR NAVIGATION */}
            <nav className={`w-[120px] flex-shrink-0 bg-white border-r border-gray-100 flex flex-col items-center py-10 shadow-[20px_0_40px_rgba(0,0,0,0.02)] z-50 overflow-y-auto overflow-x-hidden scrollbar-hide ${isDesignerExpanded || !licenseStatus.active ? 'hidden' : ''}`}>
                <div className="mb-12">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 rotate-3 mx-auto">
                        <GraduationCap className="w-7 h-7 text-white" />
                    </div>
                    <div className="mt-3 text-center">
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] leading-none">easyid</span>
                    </div>
                </div>

                <div className="flex-1 w-full px-3 flex flex-col gap-2 min-h-0 py-2">
                    {visibleNavItems.filter(item => !['profile', 'docs'].includes(item.id)).map((item) => (
                        <Link
                            key={item.id}
                            to={item.id === 'dashboard' ? '/admin' : `/admin/${item.id}`}
                            className={`group w-full flex-shrink-0 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition-all duration-300 ${activeView === item.id || (item.id === 'dashboard' && activeView === 'admin')
                                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100'
                                : 'text-gray-300 hover:bg-gray-50 hover:text-gray-500'
                                }`}
                        >
                            <item.icon className={`w-6 h-6 ${activeView === item.id || (item.id === 'dashboard' && activeView === 'admin') ? 'opacity-100' : 'group-hover:scale-110 transition-transform'}`} />
                            <span className={`text-[9px] font-bold uppercase tracking-wider leading-none ${activeView === item.id || (item.id === 'dashboard' && activeView === 'admin') ? 'text-white' : 'text-gray-400'}`}>
                                {item.label}
                            </span>
                        </Link>
                    ))}
                </div>

            </nav>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col relative overflow-hidden">
                <header className={`h-[100px] flex-shrink-0 flex items-center justify-between px-12 bg-white/50 backdrop-blur-xl border-b border-gray-100/50 z-40 ${isDesignerExpanded ? 'hidden' : ''}`}>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-[900] text-gray-900 uppercase tracking-tighter">{getTitle()}</h1>
                            {activeView !== 'dashboard' && activeView !== 'admin' && (
                                <Link
                                    to="/admin"
                                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-400 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest"
                                >
                                    Exit View
                                </Link>
                            )}
                        </div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.3em] mt-1">Institution ID Management System • Admin Panel</p>
                    </div>

                    <div className="hidden md:flex items-center gap-2">
                        <div className="flex flex-col items-end">
                            <span className="text-sm font-black text-gray-900 tracking-tight">{profile.name || 'Admin'}</span>
                            <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-[0.2em] px-2 py-0.5 bg-indigo-50 rounded-full mt-0.5 border border-indigo-100">{userRole === 'super_admin' ? 'Super Admin' : 'Administrator'}</span>
                        </div>
                        <Link to="/admin/profile" className="w-10 h-10 bg-gray-100 rounded-2xl border-2 border-white shadow-sm overflow-hidden p-1 hover:border-indigo-400 transition-all group">
                            <div className="w-full h-full bg-indigo-100 rounded-xl flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                                <UserCircle className="w-6 h-6 text-indigo-400 group-hover:text-indigo-600 transition-colors" />
                            </div>
                        </Link>

                        <button
                            onClick={() => setShowNotificationModal(true)}
                            className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-all border-2 relative ${unreadCount > 0
                                ? 'bg-rose-50 text-rose-600 border-rose-100'
                                : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600 border-transparent hover:border-gray-100'
                                }`}
                            title="Notifications"
                        >
                            <Bell className="w-5 h-5" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-lg flex items-center justify-center shadow-sm border-2 border-white">
                                    {unreadCount}
                                </span>
                            )}
                        </button>
                        {userRole === 'super_admin' && (
                            <Link
                                to="/admin/settings"
                                className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-all border-2 ${activeView === 'settings'
                                    ? 'bg-red-50 text-red-600 border-red-100'
                                    : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600 border-transparent hover:border-gray-100'
                                    }`}
                                title="System Settings"
                            >
                                <Settings className="w-5 h-5" />
                            </Link>
                        )}
                        <Link
                            to="/admin/docs"
                            className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-all border-2 ${activeView === 'docs'
                                ? 'bg-indigo-50 text-indigo-600 border-indigo-100'
                                : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600 border-transparent hover:border-gray-100'
                                }`}
                            title="Documentation"
                        >
                            <HelpCircle className="w-5 h-5" />
                        </Link>
                        <button
                            onClick={handleLogout}
                            className="w-10 h-10 flex items-center justify-center rounded-2xl text-red-400 hover:bg-red-50 hover:text-red-600 transition-all border-2 border-transparent hover:border-red-100"
                            title="Logout"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                <main className={`flex-1 overflow-y-auto scroll-smooth ${isDesignerExpanded ? 'p-0' : 'p-12'}`}>
                    <Routes>
                        <Route index element={<DashboardHome />} />

                        {/* Protected Routes */}
                        {(permissions.includes('all') || permissions.includes('institution') || permissions.includes('school')) && <Route path="institution" element={<InstitutionManager />} />}
                        {(permissions.includes('all') || permissions.includes('teachers')) && <Route path="teachers" element={<TeacherManager />} />}
                        {(permissions.includes('all') || permissions.includes('classes')) && <Route path="classes" element={<ClassManager />} />}
                        {(permissions.includes('all') || permissions.includes('students')) && <Route path="students" element={<StudentManager />} />}
                        {(permissions.includes('all') || permissions.includes('designer')) && (
                            <Route path="designer" element={<IDCardDesigner isExpanded={isDesignerExpanded} onToggleExpand={() => setIsDesignerExpanded(!isDesignerExpanded)} />} />
                        )}
                        {(permissions.includes('all') || permissions.includes('variables')) && <Route path="variables" element={<VariableManager />} />}
                        {(permissions.includes('all') || permissions.includes('roles')) && <Route path="roles" element={<RolesManager />} />}
                        {userRole === 'super_admin' && <Route path="settings" element={<SettingsManager />} />}
                        {userRole === 'super_admin' && <Route path="notifications" element={<NotificationManager />} />}

                        <Route path="profile" element={<ProfileManager />} />
                        <Route path="docs" element={<Documentation />} />

                        {/* Fallback for unauthorized access */}
                        <Route path="*" element={<Navigate to="/admin" replace />} />
                    </Routes>
                </main>
                <NotificationModal />
            </div>
        </div>
    );
}
