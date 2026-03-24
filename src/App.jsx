
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import PendingApproval from "./pages/auth/PendingApproval";
import AdminDashboard from "./pages/admin/AdminDashboard";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import { Loader2, Lock, AlertTriangle } from "lucide-react";

const LicenseGuard = ({ children }) => {
  const { currentUser, licenseStatus, userRole, logout } = useAuth();
  const navigate = useNavigate();

  if (licenseStatus.loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center mb-6 animate-pulse">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
        <h2 className="text-xl font-black text-gray-900 uppercase tracking-widest animate-pulse">easyid</h2>
      </div>
    );
  }

  // If NOT logged in, let the other guards handle redirects (to /login etc)
  // If license is active, also just return children.
  if (!currentUser || licenseStatus.active) {
    return children;
  }

  if (!licenseStatus.active) {
    const currentPath = window.location.pathname;
    const isPublicPath = ['/login', '/signup', '/pending', '/'].includes(currentPath);
    const isSettingsPage = currentPath.includes('/admin/settings');
    const isSuperAdmin = userRole === 'super_admin';

    // 1. Always allow public paths
    if (isPublicPath) {
      return children;
    }

    // 2. Super Admin handling: allow only if on settings page, otherwise show lockout
    if (isSuperAdmin) {
      if (isSettingsPage) return children;

      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans text-center">
          <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20">
            <div className="p-10">
              <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-3 shadow-lg shadow-red-100">
                <Lock className="w-10 h-10 text-red-600" />
              </div>

              <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter mb-4 leading-none">System Restricted</h1>
              <p className="text-gray-500 font-medium leading-relaxed mb-8">
                Your software license has <span className="text-red-600 font-bold uppercase">expired</span> or has not been <span className="text-red-600 font-bold uppercase">activated</span> for this school.
              </p>

              <div className="bg-gray-50 rounded-2xl p-4 mb-8 border border-gray-100 flex items-center text-left">
                <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center mr-4 shadow-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Status</div>
                  <div className="text-sm font-bold text-gray-700">Activation Required</div>
                </div>
              </div>

              <div className="space-y-3">
                <a
                  href="/admin/settings"
                  className="w-full inline-flex items-center justify-center py-4 px-6 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
                >
                  Go to Activation Settings
                </a>
                <button
                  onClick={logout}
                  className="w-full py-4 px-6 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors uppercase tracking-widest"
                >
                  Logout & Switch Account
                </button>
              </div>
            </div>

            <div className="bg-gray-50 py-4 border-t border-gray-100 text-center">
              <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">easyid Enterprise</span>
            </div>
          </div>
        </div>
      );
    }

    // 3. Regular Admins / Teachers: Show a clean "Expired" screen (no dashboard access)
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-center">
        <div className="max-w-xs">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-2">License Expired</h2>
          <p className="text-gray-500 text-sm font-medium leading-relaxed mb-8">
            Your institution's software license has expired. Please contact your <span className="text-indigo-600 font-bold">Super Admin</span> to renew your access.
          </p>
          <button
            onClick={logout}
            className="w-full inline-flex items-center justify-center py-3.5 px-6 bg-gray-900 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-gray-800 transition-all shadow-xl shadow-gray-100 active:scale-95 mb-8"
          >
            Logout to Switch Account
          </button>
          <div className="pt-6 border-t border-gray-100">
            <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">easyid Support</span>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

const PrivateRoute = ({ children, requiredRole }) => {
  const { currentUser, userRole } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  if (requiredRole) {
    if (!userRole) {
      return <Navigate to="/pending" />;
    }

    const isTeacher = userRole === 'teacher';
    const isAdminArea = requiredRole === 'admin';
    const isTeacherArea = requiredRole === 'teacher';

    // Permission logic
    let hasPermission = false;
    if (isAdminArea) {
      // Anyone who isn't a teacher can access /admin (includes super_admin, admin, and custom roles like designer)
      hasPermission = !isTeacher;
    } else if (isTeacherArea) {
      // Only teachers can access /teacher
      hasPermission = isTeacher;
    }

    if (!hasPermission) {
      if (userRole === 'teacher') return <Navigate to="/teacher" />;
      return <Navigate to="/admin" />;
    }
  }

  // If authenticated but no role, and not already on pending page
  if (!userRole && window.location.pathname !== '/pending') {
    return <Navigate to="/pending" />;
  }

  return children;
};

const AuthenticatedGuard = ({ children }) => {
  const { currentUser, userRole, loading } = useAuth();

  if (loading) return null; // Wait for auth provider to settle

  if (currentUser && userRole) {
    if (userRole === 'teacher') {
      return <Navigate to="/teacher" />;
    }
    if (userRole === 'pending') {
      return <Navigate to="/pending" />;
    }
    return <Navigate to="/admin" />;
  }

  return children;
};

const RoleBasedRedirect = () => {
  const { userRole } = useAuth();

  if (!userRole) {
    return <Navigate to="/pending" />;
  }

  if (userRole === 'teacher') {
    return <Navigate to="/teacher" />;
  }

  return <Navigate to="/admin" />;
};

function App() {
  return (
    <Router basename="/easyid">
      <LicenseGuard>
        <Routes>
          <Route path="/login" element={<AuthenticatedGuard><Login /></AuthenticatedGuard>} />
          <Route path="/signup" element={<AuthenticatedGuard><Signup /></AuthenticatedGuard>} />
          <Route path="/pending" element={<PrivateRoute><PendingApproval /></PrivateRoute>} />

          <Route
            path="/admin/*"
            element={
              <PrivateRoute requiredRole="admin">
                <AdminDashboard />
              </PrivateRoute>
            }
          />

          <Route
            path="/teacher/*"
            element={
              <PrivateRoute requiredRole="teacher">
                <TeacherDashboard />
              </PrivateRoute>
            }
          />

          {/* Default redirect based on role or to login */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <RoleBasedRedirect />
              </PrivateRoute>
            }
          />
        </Routes>
      </LicenseGuard>
    </Router>
  );
}

export default App;
