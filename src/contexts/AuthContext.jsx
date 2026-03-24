
import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [permissions, setPermissions] = useState([]);
    const [licenseStatus, setLicenseStatus] = useState({ loading: true, active: false, expiryDate: null });
    const [loading, setLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotificationModal, setShowNotificationModal] = useState(false);

    useEffect(() => {
        const syncLicense = async () => {
            try {
                const res = await fetch('/api/license/sync');
                if (res.ok) {
                    const masterData = await res.json();

                    // We check against the current Firestore state to avoid unnecessary writes
                    const schoolDoc = await getDoc(doc(db, "schools", "main"));
                    const schoolData = schoolDoc.data();
                    const currentInfo = schoolData?.licenseInfo;
                    const currentSchoolEmail = schoolData?.email;

                    if (!currentInfo ||
                        currentInfo.expiryDate !== masterData.expiryDate ||
                        currentInfo.schoolName !== masterData.schoolName ||
                        currentInfo.activatedKey !== masterData.masterKey.toLowerCase() ||
                        currentInfo.activatedEmail !== masterData.institutionEmail ||
                        currentSchoolEmail !== masterData.institutionEmail || // Strict check: DB email must match JSON email
                        (masterData.active && currentInfo.status !== 'active') ||
                        (!masterData.active && currentInfo.status !== 'expired')) {

                        console.log("Syncing license with master file (license.json)...");
                        const statusToSet = (
                            masterData.active &&
                            currentInfo?.activatedKey === masterData.masterKey.toLowerCase() &&
                            currentInfo?.activatedEmail === masterData.institutionEmail &&
                            currentSchoolEmail === masterData.institutionEmail // All 3 must match
                        ) ? 'active' : 'expired';

                        await setDoc(doc(db, "schools", "main"), {
                            licenseInfo: {
                                ...(currentInfo || {}),
                                expiryDate: masterData.expiryDate,
                                schoolName: masterData.schoolName,
                                // If key or email is mismatch, we force it to NOT be active
                                status: statusToSet,
                                lastSyncedAt: new Date().toISOString()
                            }
                        }, { merge: true });
                    }
                }
            } catch (error) {
                // Silently fail if server is down, fallback to Firestore state
                console.warn("License sync skipped: local server not reachable.");
            }
        };

        syncLicense();

        const unsubscribeLicense = onSnapshot(doc(db, "schools", "main"), (docSnap) => {
            if (docSnap.exists()) {
                const licenseInfo = docSnap.data().licenseInfo;
                if (licenseInfo && licenseInfo.status === 'active') {
                    const today = new Date();
                    const expiry = new Date(licenseInfo.expiryDate);

                    setLicenseStatus({
                        loading: false,
                        active: today <= expiry,
                        expiryDate: licenseInfo.expiryDate,
                        schoolName: licenseInfo.schoolName
                    });
                    return;
                }
            }
            setLicenseStatus({ loading: false, active: false, expiryDate: null });
        }, (error) => {
            console.error("Error watching license:", error);
            setLicenseStatus(prev => ({ ...prev, loading: false }));
        });

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) {
                        const role = userDoc.data().role;
                        setUserRole(role);

                        // Special case for super_admin: all permissions
                        if (role === 'super_admin') {
                            setPermissions(['all']);
                        } else if (role) {
                            // Fetch permissions from roles collection
                            const roleDoc = await getDoc(doc(db, "roles", role));
                            if (roleDoc.exists()) {
                                setPermissions(roleDoc.data().permissions || []);
                            } else {
                                setPermissions([]);
                            }
                        }
                    } else {
                        setUserRole(null);
                        setPermissions([]);
                    }
                } catch (error) {
                    console.error("Error fetching user role/permissions:", error);
                    setUserRole(null);
                    setPermissions([]);
                }
                setCurrentUser(user);
            } else {
                setCurrentUser(null);
                setUserRole(null);
                setPermissions([]);
            }
            setLoading(false);
        });

        return () => {
            unsubscribe();
            unsubscribeLicense();
        };
    }, []);

    const logout = () => auth.signOut();

    const value = {
        currentUser,
        userRole,
        permissions,
        licenseStatus,
        loading,
        unreadCount,
        setUnreadCount,
        showNotificationModal,
        setShowNotificationModal,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
