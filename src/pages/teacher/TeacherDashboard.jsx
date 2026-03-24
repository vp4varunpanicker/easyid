
import { useState, useEffect, useMemo } from "react";
import { signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { useNavigate, Routes, Route, Link } from "react-router-dom";
import { LogOut, Plus, User, FileDown, X, Download, Loader2, Phone, MapPin, Settings, Save, AlertCircle, Users, Edit2, Eye, FileSpreadsheet, Upload, HelpCircle, Lock, Trash2, Search, Filter, Bell, Check, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from 'xlsx';
import { getTemplates } from "../../services/idCardService";
import { downloadIDCardPDF } from "../../utils/cardGenerator";
import { collection, query, where, getDocs, addDoc, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";
import ImportInstructionsModal from "../../components/admin/ImportInstructionsModal";
import NotificationModal from "../../components/notifications/NotificationModal";
import PreviewModal from "../../components/admin/PreviewModal";

export default function TeacherDashboard() {
    const { currentUser, unreadCount, setShowNotificationModal } = useAuth();
    const navigate = useNavigate();
    const [students, setStudents] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [newStudent, setNewStudent] = useState({ name: '', address: '', emergencyContact: '', photo: null, bloodGroup: '', fatherName: '', motherName: '' });
    const [uploading, setUploading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [assignedClass, setAssignedClass] = useState("");
    const [selectedStudents, setSelectedStudents] = useState([]);
    const [teacherProfile, setTeacherProfile] = useState({ name: '', phone: '', address: '' });
    const [teacherId, setTeacherId] = useState(null);
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileMessage, setProfileMessage] = useState('');
    const [dynamicVars, setDynamicVars] = useState([]);
    const [fieldStatus, setFieldStatus] = useState({});
    const [editingStudent, setEditingStudent] = useState(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showImportHelp, setShowImportHelp] = useState(false);
    const [previewingStudent, setPreviewingStudent] = useState(null);
    const [importing, setImporting] = useState(false);
    const [importPreview, setImportPreview] = useState([]);
    const [deleting, setDeleting] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    // Password change state
    const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
    const [changingPassword, setChangingPassword] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });

    const isActive = (slug) => fieldStatus[slug] !== false;

    const isProfileComplete = (student) => {
        if (!student.name) return false;
        if (!student.photoUrl || student.photoUrl === import.meta.env.BASE_URL + 'default-avatar.svg') return false;
        if (isActive('emergencyContact') && (!student.emergencyContact || student.emergencyContact.trim() === '')) return false;
        if (isActive('address') && (!student.address || student.address.trim() === '')) return false;
        if (isActive('bloodGroup') && (!student.bloodGroup || student.bloodGroup.trim() === '')) return false;
        if (isActive('fatherName') && (!student.fatherName || student.fatherName.trim() === '')) return false;
        if (isActive('motherName') && (!student.motherName || student.motherName.trim() === '')) return false;
        for (const v of dynamicVars) {
            if (!student[v.slug] || String(student[v.slug]).trim() === '') return false;
        }
        return true;
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!currentUser) return;

            const userQ = query(collection(db, "users"), where("email", "==", currentUser.email));
            const userSnap = await getDocs(userQ);
            let currentClass = assignedClass;
            if (!userSnap.empty) {
                const userData = userSnap.docs[0].data();
                const userId = userSnap.docs[0].id;
                setTeacherId(userId);

                if (userData.assignedClass) {
                    currentClass = userData.assignedClass;
                    setAssignedClass(userData.assignedClass);
                }

                // Load teacher profile data
                setTeacherProfile({
                    name: userData.name || '',
                    phone: userData.phone || '',
                    address: userData.address || ''
                });
            }

            const t = await getTemplates();
            setTemplates(t);

            const varsSnapshot = await getDocs(collection(db, "variables"));
            const allVars = varsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const statusMap = {};
            allVars.forEach(v => {
                statusMap[v.slug] = v.active !== false;
            });
            setFieldStatus(statusMap);

            const systemSlugs = ['name', 'class', 'address', 'emergencyContact', 'bloodGroup', 'fatherName', 'motherName'];
            setDynamicVars(allVars.filter(v => !systemSlugs.includes(v.slug) && v.active !== false));

            if (currentClass) {
                const q = query(collection(db, "students"), where("class", "==", currentClass));
                const querySnapshot = await getDocs(q);
                const studentList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setStudents(studentList);
            } else {
                setStudents([]);
            }
        };
        fetchData();
    }, [currentUser]);

    const handleExcelImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const workbook = XLSX.read(event.target.result, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(worksheet);

                // Helper to normalize keys (remove extra spaces, lowercase, remove special chars)
                const normalizeKeys = (obj) => {
                    const newObj = {};
                    Object.keys(obj).forEach(key => {
                        // Remove all non-alphanumeric characters and convert to lowercase
                        const normalizedKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                        newObj[normalizedKey] = obj[key];
                    });
                    return newObj;
                };

                // Map Excel columns to student fields
                const mappedData = data.map(row => {
                    const normalizedRow = normalizeKeys(row);
                    const studentData = {
                        name: normalizedRow['fullname'] || normalizedRow['name'] || normalizedRow['studentname'] || '',
                        address: normalizedRow['homeaddress'] || normalizedRow['address'] || '',
                        emergencyContact: normalizedRow['emergencyno'] || normalizedRow['emergencycontact'] || normalizedRow['phone'] || normalizedRow['contact'] || normalizedRow['emergencynumber'] || '',
                        bloodGroup: normalizedRow['bloodgroup'] || '',
                        fatherName: normalizedRow['fathersname'] || normalizedRow['fathername'] || '',
                        motherName: normalizedRow['mothersname'] || normalizedRow['mothername'] || '',
                        // Add dynamic fields
                    };

                    // Map dynamic fields
                    dynamicVars.forEach(v => {
                        const normalizedLabel = v.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                        const normalizedSlug = v.slug.toLowerCase().replace(/[^a-z0-9]/g, '');
                        if (normalizedRow[normalizedLabel] || normalizedRow[normalizedSlug]) {
                            studentData[v.slug] = normalizedRow[normalizedLabel] || normalizedRow[normalizedSlug];
                        }
                    });

                    return studentData;
                });

                setImportPreview(mappedData);
                setShowImportModal(true);
            } catch (error) {
                console.error('Error parsing Excel file:', error);
                alert('Error reading Excel file. Please ensure it has the correct format.');
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = ''; // Reset input
    };

    const handleConfirmImport = async () => {
        if (!assignedClass) {
            alert("Error: No class assigned to you.");
            return;
        }

        setImporting(true);
        try {
            let successCount = 0;
            let errorCount = 0;

            for (const student of importPreview) {
                try {

                    const photoUrl = ''; // No default photo

                    await addDoc(collection(db, "students"), {
                        name: student.name,
                        class: assignedClass, // Automatically assign to teacher's class
                        address: student.address,
                        emergencyContact: student.emergencyContact,
                        bloodGroup: student.bloodGroup,
                        fatherName: student.fatherName,
                        motherName: student.motherName,
                        photoUrl: photoUrl,
                        createdAt: new Date(),
                        // Add dynamic fields
                        ...Object.keys(student).reduce((acc, key) => {
                            if (!['name', 'address', 'emergencyContact', 'bloodGroup', 'fatherName', 'motherName'].includes(key)) {
                                acc[key] = student[key];
                            }
                            return acc;
                        }, {})
                    });
                    successCount++;
                } catch (err) {
                    console.error('Error adding student:', err);
                    errorCount++;
                }
            }

            // Refresh student list
            const q = query(collection(db, "students"), where("class", "==", assignedClass));
            const querySnapshot = await getDocs(q);
            const studentList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setStudents(studentList);

            setShowImportModal(false);
            setImportPreview([]);
            const message = `Import completed!\n✓ ${successCount} students added successfully${errorCount > 0 ? `\n✗ ${errorCount} failed` : ''}`;
            alert(message);
        } catch (error) {
            console.error('Error importing students:', error);
            alert('Error importing students. Please try again.');
        } finally {
            setImporting(false);
        }
    };

    const handleLogout = async () => {
        sessionStorage.removeItem(`dismissed_notifs_${currentUser.uid}`);
        await signOut(auth);
        navigate("/login");
    };

    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            setNewStudent({ ...newStudent, photo: e.target.files[0] });
        }
    };

    const handleAddStudent = async (e) => {
        e.preventDefault();
        setUploading(true);

        try {
            let photoUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${newStudent.name}`;

            if (newStudent.photo) {
                const formData = new FormData();
                formData.append('file', newStudent.photo);

                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    const data = await response.json();
                    photoUrl = data.url;
                }
            }

            const studentData = {
                ...newStudent,
                photoUrl: photoUrl,
                class: assignedClass,
                createdAt: new Date()
            };
            delete studentData.photo; // Don't save the File object to Firestore

            const docRef = await addDoc(collection(db, "students"), studentData);

            setStudents([...students, { id: docRef.id, ...studentData }]);
            setNewStudent({ name: '', address: '', emergencyContact: '', photo: null, bloodGroup: '', fatherName: '', motherName: '' });
            navigate("/teacher");
        } catch (err) {
            console.error(err);
            alert("Error adding student: " + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleUpdateStudent = async (e) => {
        e.preventDefault();
        if (!editingStudent) return;
        setUploading(true);

        try {
            let photoUrl = editingStudent.photoUrl;

            if (editingStudent.photo) {
                const formData = new FormData();
                formData.append('file', editingStudent.photo);

                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    const data = await response.json();
                    photoUrl = data.url;
                }
            }

            const studentData = {
                ...editingStudent,
                photoUrl: photoUrl,
                updatedAt: new Date()
            };
            delete studentData.photo;
            delete studentData.id;

            await updateDoc(doc(db, "students", editingStudent.id), studentData);

            setStudents(students.map(s => s.id === editingStudent.id ? { id: editingStudent.id, ...studentData } : s));
            setEditingStudent(null);
            navigate("/teacher");
        } catch (err) {
            console.error(err);
            alert("Error updating student: " + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleEditClick = (student) => {
        setEditingStudent({ ...student, photo: null });
        navigate("edit");
    };

    const handleDeleteStudent = async (id) => {
        if (!window.confirm("Are you sure you want to delete this student?")) return;
        try {
            await deleteDoc(doc(db, "students", id));
            setStudents(students.filter(s => s.id !== id));
        } catch (err) {
            console.error(err);
        }
    };

    const triggerDownload = (dataUrl, filename) => {
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();
    };

    const generateAllCards = async () => {
        if (templates.length === 0) {
            alert("No templates found.");
            return;
        }

        setGenerating(true);
        try {
            const template = templates[0];
            const layout = typeof template.layout === 'string' ? JSON.parse(template.layout) : template.layout;

            for (const student of students) {
                if (!isProfileComplete(student)) continue;
                await downloadIDCardPDF(student, layout);
                // Smaller delay since PDF generation is handled per student
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (error) {
            console.error(error);
        } finally {
            setGenerating(false);
        }
    };

    const downloadSingleCard = async (student) => {
        if (templates.length === 0) return;
        try {
            const template = templates[0];
            const layout = typeof template.layout === 'string' ? JSON.parse(template.layout) : template.layout;
            await downloadIDCardPDF(student, layout);
        } catch (err) {
            console.error(err);
        }
    };

    const toggleStudentSelection = (studentId) => {
        setSelectedStudents(prev =>
            prev.includes(studentId)
                ? prev.filter(id => id !== studentId)
                : [...prev, studentId]
        );
    };

    const selectAllStudents = () => {
        setSelectedStudents(students.map(s => s.id));
    };

    const deselectAllStudents = () => {
        setSelectedStudents([]);
    };

    const generateSelectedCards = async () => {
        if (templates.length === 0) {
            alert("No templates found.");
            return;
        }

        if (selectedStudents.length === 0) {
            alert("Please select at least one student.");
            return;
        }

        setGenerating(true);
        try {
            const template = templates[0];
            const layout = typeof template.layout === 'string' ? JSON.parse(template.layout) : template.layout;

            const studentsToGenerate = students.filter(s => selectedStudents.includes(s.id) && isProfileComplete(s));

            for (const student of studentsToGenerate) {
                await downloadIDCardPDF(student, layout);
                await new Promise(r => setTimeout(r, 1000));
            }

            // Clear selection after successful generation
            setSelectedStudents([]);
        } catch (error) {
            console.error(error);
        } finally {
            setGenerating(false);
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedStudents.length === 0) return;

        if (!window.confirm(`Are you sure you want to delete ${selectedStudents.length} selected student(s)? This action cannot be undone.`)) {
            return;
        }

        setDeleting(true);
        try {
            // Delete each student document
            const deletePromises = selectedStudents.map(id => deleteDoc(doc(db, "students", id)));
            await Promise.all(deletePromises);

            // Update local state
            setStudents(prev => prev.filter(s => !selectedStudents.includes(s.id)));
            setSelectedStudents([]);

        } catch (error) {
            console.error("Error deleting students:", error);
            alert("Failed to delete some students. Please try again.");
        } finally {
            setDeleting(false);
        }
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        if (!teacherId) {
            setProfileMessage('Error: Teacher ID not found');
            return;
        }

        setSavingProfile(true);
        setProfileMessage('');

        try {
            await updateDoc(doc(db, "users", teacherId), {
                name: teacherProfile.name,
                phone: teacherProfile.phone,
                address: teacherProfile.address
            });

            setProfileMessage('Profile updated successfully!');
            setTimeout(() => setProfileMessage(''), 3000);
        } catch (error) {
            console.error(error);
            setProfileMessage('Error updating profile. Please try again.');
            setTimeout(() => setProfileMessage(''), 3000);
        } finally {
            setSavingProfile(false);
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setChangingPassword(true);
        setPasswordMessage({ type: '', text: '' });

        if (passwords.new !== passwords.confirm) {
            setPasswordMessage({ type: 'error', text: 'New passwords do not match' });
            setChangingPassword(false);
            return;
        }

        if (passwords.new.length < 6) {
            setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters' });
            setChangingPassword(false);
            return;
        }

        try {
            const credential = EmailAuthProvider.credential(currentUser.email, passwords.current);
            await reauthenticateWithCredential(currentUser, credential);
            await updatePassword(currentUser, passwords.new);

            setPasswordMessage({ type: 'success', text: 'Password updated successfully!' });
            setPasswords({ current: '', new: '', confirm: '' });
            setTimeout(() => setPasswordMessage({ type: '', text: '' }), 3000);
        } catch (error) {
            console.error("Error updating password:", error);
            if (error.code === 'auth/wrong-password') {
                setPasswordMessage({ type: 'error', text: 'Incorrect current password' });
            } else if (error.code === 'auth/too-many-requests') {
                setPasswordMessage({ type: 'error', text: 'Too many attempts. Please try again later.' });
            } else {
                setPasswordMessage({ type: 'error', text: 'Failed to update password. Please check your current password.' });
            }
        } finally {
            setChangingPassword(false);
        }
    };

    const filteredStudents = useMemo(() => {
        return students.filter(s =>
            s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.emergencyContact?.includes(searchTerm)
        );
    }, [students, searchTerm]);

    return (
        <div className="min-h-screen bg-[#f8fafc] pb-24 font-['Plus_Jakarta_Sans',_sans-serif] overflow-x-hidden">
            <NotificationModal />
            {/* Premium Header Banner */}
            <div className="relative mb-12">
                {/* Background Banner */}
                <div className="absolute top-0 left-0 right-0 h-[220px] bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 rounded-b-[3rem] shadow-2xl overflow-hidden">
                    {/* Decorative Elements */}
                    <div className="absolute top-[-10%] right-[-5%] w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-[-20%] left-[-10%] w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />
                </div>

                <div className="relative max-w-3xl mx-auto px-4 sm:px-6 pt-8">
                    {/* Top Top Bar: Logo & Global Actions */}
                    <div className="flex justify-between items-center mb-8">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/30 rotate-3">
                                <Shield className="w-5 h-5 text-white" />
                            </div>
                            <h1 className="text-lg font-black text-white tracking-[0.2em] uppercase">easyID</h1>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowNotificationModal(true)}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all backdrop-blur-md border ${unreadCount > 0
                                    ? 'bg-rose-500/20 border-rose-300/40 text-rose-100'
                                    : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                                    }`}
                            >
                                <Bell className="w-5 h-5" />
                                {unreadCount > 0 && (
                                    <span className="absolute top-0 right-0 w-4 h-4 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-indigo-700">
                                        {unreadCount}
                                    </span>
                                )}
                            </button>
                            <button onClick={handleLogout} className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all flex items-center justify-center">
                                <LogOut className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Main Greeting & Status Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2.5rem] p-6 shadow-2xl shadow-indigo-900/20"
                    >
                        <div className="flex items-center gap-5">
                            <Link to="/teacher/profile" className="relative group shrink-0">
                                <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white/50 shadow-lg bg-indigo-100">
                                    <div className="w-full h-full flex items-center justify-center text-indigo-600 font-black text-2xl">
                                        {teacherProfile.name.charAt(0)}
                                    </div>
                                </div>
                                <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-lg text-indigo-600 shadow-md transform group-hover:scale-110 transition-transform">
                                    <Settings className="w-3.5 h-3.5" />
                                </div>
                            </Link>

                            <div className="flex-1 min-w-0">
                                <h2 className="text-xl sm:text-2xl font-black text-white truncate hover:text-indigo-100 transition-colors">
                                    Hi, {teacherProfile.name.split(' ')[0] || 'Teacher'} 👋
                                </h2>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                    <div className="px-2.5 py-1 bg-white/20 backdrop-blur-md rounded-lg text-white text-[10px] font-black uppercase tracking-widest border border-white/10">
                                        {assignedClass ? `Class ${assignedClass}` : 'No Class Assigned'}
                                    </div>
                                    <div className="px-2.5 py-1 bg-indigo-500/30 backdrop-blur-md rounded-lg text-indigo-100 text-[10px] font-black uppercase tracking-widest border border-indigo-400/20">
                                        {students.length} Students
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 sm:px-6">

                <Routes>
                    <Route index element={
                        <>
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-6 mb-8 overflow-hidden relative"
                            >
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />

                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 mb-6">
                                    <div className="space-y-0.5">
                                        <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Student Roster</h3>
                                        <p className="text-slate-400 text-[13px] font-bold uppercase tracking-widest">{students.length} Total</p>
                                    </div>

                                    {assignedClass && (
                                        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
                                            <label className="flex-shrink-0 sm:flex-none whitespace-nowrap inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[13px] font-black rounded-2xl transition-all cursor-pointer border border-slate-200">
                                                <FileSpreadsheet className="w-4 h-4" />
                                                <span className="hidden sm:inline">Import</span>
                                                <input type="file" accept=".xlsx, .xls, .csv" onChange={handleExcelImport} className="hidden" />
                                            </label>
                                            <button
                                                onClick={() => setShowImportHelp(true)}
                                                className="flex-shrink-0 p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all border border-slate-100 bg-slate-50/50"
                                                title="Import Instructions"
                                            >
                                                <HelpCircle className="w-5 h-5" />
                                            </button>
                                            <Link to="/teacher/add" className="flex-shrink-0 sm:flex-none whitespace-nowrap inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-black rounded-2xl transition-all shadow-lg shadow-indigo-100">
                                                <Plus className="w-4 h-4" />
                                                <span className="hidden sm:inline">Add Student</span>
                                            </Link>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search by name or contact..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                        />
                                    </div>

                                    {students.length > 0 && (
                                        <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={selectAllStudents}
                                                    className="text-[10px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-700 p-1"
                                                >
                                                    Select All
                                                </button>
                                                <button
                                                    onClick={deselectAllStudents}
                                                    className="text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-600 p-1"
                                                >
                                                    Clear Selection
                                                </button>
                                            </div>

                                            <AnimatePresence>
                                                {selectedStudents.length > 0 && (
                                                    <motion.div
                                                        initial={{ opacity: 0, x: 10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        exit={{ opacity: 0, x: 10 }}
                                                        className="flex items-center gap-3"
                                                    >
                                                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                                                            {selectedStudents.length} Selected
                                                        </span>
                                                        <button
                                                            onClick={handleDeleteSelected}
                                                            disabled={deleting}
                                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete Selected"
                                                        >
                                                            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                        </button>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    )}
                                </div>
                            </motion.div>

                            {templates.length > 0 && !templates[0].isLocked && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-bold text-amber-800">ID Card Design Pending Approval</h4>
                                        <p className="text-xs text-amber-600 mt-1">
                                            The ID card layout is currently being designed or reviewed.
                                            Download Access is restricted until the Super Admin locks and confirms the design.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <motion.div
                                layout
                                className="flex flex-col gap-3"
                            >
                                {!assignedClass ? (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="bg-amber-50 rounded-3xl p-10 border border-amber-100 text-center space-y-4 shadow-sm"
                                    >
                                        <div className="bg-white w-16 h-16 rounded-3xl rotate-3 flex items-center justify-center mx-auto shadow-md">
                                            <AlertCircle className="w-8 h-8 text-amber-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-amber-900 text-xl font-bold">Unassigned Status</p>
                                            <p className="text-amber-700 text-sm font-medium">Please wait for the administrator to assign your class.</p>
                                        </div>
                                    </motion.div>
                                ) : filteredStudents.length === 0 ? (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="bg-white rounded-[2rem] p-12 border border-slate-100 text-center shadow-lg shadow-slate-200/50"
                                    >
                                        <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <Users className="w-10 h-10 text-slate-300" />
                                        </div>
                                        <h4 className="text-lg font-bold text-slate-900 mb-2">No students found</h4>
                                        <p className="text-slate-500 text-sm font-medium">
                                            {searchTerm ? `No results for "${searchTerm}"` : "Get started by adding your first student"}
                                        </p>
                                    </motion.div>
                                ) : (
                                    <AnimatePresence mode="popLayout">
                                        {filteredStudents.map((student, index) => (
                                            <motion.div
                                                key={student.id}
                                                layout
                                                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.98 }}
                                                transition={{ delay: index * 0.03 }}
                                                className={`group relative bg-white rounded-2xl sm:rounded-3xl shadow-sm hover:shadow-xl hover:shadow-indigo-100/30 border transition-all duration-300 ${selectedStudents.includes(student.id) ? 'border-indigo-500 ring-4 ring-indigo-500/5' : 'border-slate-100'}`}
                                            >
                                                <div className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
                                                    {/* Selection & Avatar */}
                                                    <div className="relative shrink-0">
                                                        <img
                                                            src={student.photoUrl || import.meta.env.BASE_URL + 'default-avatar.svg'}
                                                            alt=""
                                                            className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl sm:rounded-2xl object-cover bg-slate-50 border-2 border-white shadow-sm transition-transform group-hover:scale-105"
                                                        />
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedStudents.includes(student.id)}
                                                            onChange={() => toggleStudentSelection(student.id)}
                                                            className="peer absolute -top-1 -left-1 w-5 h-5 opacity-0 cursor-pointer z-20"
                                                        />
                                                        <div className={`absolute -top-1 -left-1 w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center z-10 ${selectedStudents.includes(student.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 bg-white group-hover:border-slate-300 shadow-sm'}`}>
                                                            {selectedStudents.includes(student.id) && <Check className="w-3 h-3 text-white" />}
                                                        </div>
                                                    </div>
    
                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-1">
                                                            <h4 className="text-sm sm:text-base font-black text-slate-900 tracking-tight truncate">
                                                                {student.name}
                                                            </h4>
                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                {student.bloodGroup && (
                                                                    <span className="bg-red-50 text-red-600 text-[9px] font-black px-1.5 py-0.5 rounded border border-red-100 uppercase">
                                                                        {student.bloodGroup}
                                                                    </span>
                                                                )}
                                                                {isProfileComplete(student) ? (
                                                                    <span className="text-[9px] font-black uppercase text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">READY</span>
                                                                ) : (
                                                                    <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">DUE</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center text-[11px] text-slate-400 font-bold tracking-tight">
                                                            <Phone className="w-2.5 h-2.5 mr-1.5 text-slate-300" />
                                                            <span className="truncate">{student.emergencyContact || 'No Contact Number'}</span>
                                                        </div>
                                                    </div>
    
                                                    {/* Actions */}
                                                    <div className="flex items-center gap-1 sm:gap-2 shrink-0 border-l border-slate-50 pl-3 sm:pl-4">
                                                        {templates.length > 0 && templates[0].isLocked && (
                                                            <button onClick={(e) => { e.stopPropagation(); setPreviewingStudent(student); }} className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Preview Card">
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {templates.length > 0 && templates[0].isLocked && isProfileComplete(student) && (
                                                            <button onClick={(e) => { e.stopPropagation(); downloadSingleCard(student); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Download Card">
                                                                <Download className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <button onClick={(e) => { e.stopPropagation(); handleEditClick(student); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Edit Student">
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteStudent(student.id); }} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Delete Student">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                )}
                            </motion.div>

                            <AnimatePresence>
                                {selectedStudents.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 100 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 100 }}
                                        className="fixed bottom-8 left-4 right-4 z-[60] pointer-events-none"
                                    >
                                        <div className="max-w-xl mx-auto pointer-events-auto">
                                            <button
                                                onClick={generateSelectedCards}
                                                disabled={generating || deleting || !templates.length || !templates[0].isLocked}
                                                className={`w-full flex justify-between items-center pl-7 pr-6 py-4 rounded-3xl text-white shadow-[0_20px_50px_rgba(79,70,229,0.3)] transition-all transform active:scale-[0.97] group border-2 border-white/10 backdrop-blur-md ${!templates.length || !templates[0].isLocked ? 'bg-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    {generating ? <Loader2 className="w-6 h-6 animate-spin" /> : (!templates.length || !templates[0].isLocked) ? <Lock className="w-6 h-6" /> : <FileDown className="w-6 h-6" />}
                                                    <span className="font-black text-[15px] sm:text-lg tracking-tight">
                                                        {generating ? "Exporting..." : (!templates.length || !templates[0].isLocked) ? "Design Not Yet Confirmed" : "Export ID Cards"}
                                                    </span>
                                                </div>
                                                <div className="bg-white/20 px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-widest border border-white/20">
                                                    {selectedStudents.length} Selected
                                                </div>
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Import Preview Modal */}
                            {showImportModal && (
                                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                            <div>
                                                <h3 className="font-bold text-gray-900 leading-none">Import Preview</h3>
                                                <p className="text-xs text-gray-500 mt-1">Found {importPreview.length} students in file</p>
                                            </div>
                                            <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-6 h-6" /></button>
                                        </div>
                                        <div className="overflow-auto p-0 flex-1">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-gray-50 sticky top-0 z-10">
                                                    <tr>
                                                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100">Name</th>
                                                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100">Data Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                    {importPreview.map((s, i) => (
                                                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                                                            <td className="px-6 py-3 text-sm font-bold text-gray-900">{s.name}</td>
                                                            <td className="px-6 py-3 text-xs text-gray-400">
                                                                {s.emergencyContact ? <span className="text-green-600">Contact OK</span> : <span className="text-red-400">Missing Contact</span>}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
                                            <button onClick={() => setShowImportModal(false)} className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>
                                            <button onClick={handleConfirmImport} disabled={importing} className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center">
                                                {importing ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Upload className="w-5 h-5 mr-2" />}
                                                {importing ? "Importing..." : `Import ${importPreview.length} Students`}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    } />

                    <Route path="add" element={
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100 border border-slate-100 overflow-hidden"
                        >
                            <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                                <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Add New Student</h3>
                                <Link to="/teacher" className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                                    <X className="w-6 h-6" />
                                </Link>
                            </div>

                            <form onSubmit={handleAddStudent} className="p-5 sm:p-8 space-y-5 sm:space-y-6 max-h-[75vh] sm:max-h-[70vh] overflow-y-auto custom-scrollbar">
                                {(!fieldStatus || fieldStatus['name'] !== false) && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                                        <input type="text" required value={newStudent.name} onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })} className="block w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700" placeholder="Enter student's full name" />
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    {(!fieldStatus || fieldStatus['emergencyContact'] !== false) && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Emergency Contact</label>
                                            <div className="relative">
                                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                <input type="text" required value={newStudent.emergencyContact} onChange={(e) => setNewStudent({ ...newStudent, emergencyContact: e.target.value })} className="block w-full pl-11 pr-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700" placeholder="Phone number" />
                                            </div>
                                        </div>
                                    )}

                                    {(!fieldStatus || fieldStatus['bloodGroup'] !== false) && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Blood Group</label>
                                            <input type="text" value={newStudent.bloodGroup} onChange={(e) => setNewStudent({ ...newStudent, bloodGroup: e.target.value })} className="block w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 uppercase" placeholder="e.g. O+" />
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    {(!fieldStatus || fieldStatus['fatherName'] !== false) && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Father's Name</label>
                                            <input type="text" value={newStudent.fatherName} onChange={(e) => setNewStudent({ ...newStudent, fatherName: e.target.value })} className="block w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700" />
                                        </div>
                                    )}

                                    {(!fieldStatus || fieldStatus['motherName'] !== false) && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Mother's Name</label>
                                            <input type="text" value={newStudent.motherName} onChange={(e) => setNewStudent({ ...newStudent, motherName: e.target.value })} className="block w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700" />
                                        </div>
                                    )}
                                </div>

                                {dynamicVars.length > 0 && (
                                    <div className="pt-6 mt-6 border-t border-slate-100 space-y-6">
                                        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] ml-1">Additional Fields</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            {dynamicVars.map(v => (
                                                <div key={v.id} className="space-y-2">
                                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{v.name}</label>
                                                    <input
                                                        type="text"
                                                        value={newStudent[v.slug] || ''}
                                                        onChange={(e) => setNewStudent({ ...newStudent, [v.slug]: e.target.value })}
                                                        className="block w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {(!fieldStatus || fieldStatus['address'] !== false) && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Residential Address</label>
                                        <div className="relative">
                                            <MapPin className="absolute left-4 top-4 w-4 h-4 text-slate-400" />
                                            <textarea required value={newStudent.address} onChange={(e) => setNewStudent({ ...newStudent, address: e.target.value })} className="block w-full pl-11 pr-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 min-h-[100px]" placeholder="Full address details..." />
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Student Photo</label>
                                    <div className="group relative border-2 border-dashed border-slate-200 rounded-[2rem] p-8 bg-slate-50 hover:bg-white hover:border-indigo-400 transition-all cursor-pointer text-center">
                                        <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                        <div className="space-y-3">
                                            <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                                                <Upload className="w-5 h-5 text-indigo-600" />
                                            </div>
                                            <div>
                                                <p className="font-black text-indigo-600">Choose a photo</p>
                                                <p className="text-xs font-medium text-slate-400 mt-1">{newStudent.photo ? newStudent.photo.name : "High resolution recommended"}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </form>
                        </motion.div>
                    } />

                    <Route path="edit" element={
                        editingStudent ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100 border border-slate-100 overflow-hidden"
                            >
                                <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                                    <div className="space-y-1">
                                        <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Edit Student</h3>
                                        <p className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Updating {editingStudent.name}</p>
                                    </div>
                                    <button onClick={() => { setEditingStudent(null); navigate("/teacher"); }} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>

                                <form onSubmit={handleUpdateStudent} className="p-5 sm:p-8 space-y-5 sm:space-y-6 max-h-[75vh] sm:max-h-[70vh] overflow-y-auto custom-scrollbar">
                                    <div className="flex justify-center mb-8">
                                        <div className="relative group">
                                            <div className="w-24 h-24 rounded-[2rem] overflow-hidden border-4 border-white shadow-xl bg-slate-100">
                                                <img
                                                    src={editingStudent.photo ? URL.createObjectURL(editingStudent.photo) : editingStudent.photoUrl}
                                                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                                    alt="Preview"
                                                />
                                            </div>
                                            <input type="file" accept="image/*" onChange={(e) => setEditingStudent({ ...editingStudent, photo: e.target.files[0] })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                            <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white p-2 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                                                <Edit2 className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </div>

                                    {(!fieldStatus || fieldStatus['name'] !== false) && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                                            <input required type="text" value={editingStudent.name} onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })} className="block w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700" />
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        {(!fieldStatus || fieldStatus['emergencyContact'] !== false) && (
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Emergency Contact</label>
                                                <div className="relative">
                                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                    <input required type="text" value={editingStudent.emergencyContact} onChange={(e) => setEditingStudent({ ...editingStudent, emergencyContact: e.target.value })} className="block w-full pl-11 pr-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700" />
                                                </div>
                                            </div>
                                        )}

                                        {(!fieldStatus || fieldStatus['bloodGroup'] !== false) && (
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Blood Group</label>
                                                <input type="text" value={editingStudent.bloodGroup || ''} onChange={(e) => setEditingStudent({ ...editingStudent, bloodGroup: e.target.value })} className="block w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 uppercase" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        {(!fieldStatus || fieldStatus['fatherName'] !== false) && (
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Father's Name</label>
                                                <input type="text" value={editingStudent.fatherName || ''} onChange={(e) => setEditingStudent({ ...editingStudent, fatherName: e.target.value })} className="block w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700" />
                                            </div>
                                        )}

                                        {(!fieldStatus || fieldStatus['motherName'] !== false) && (
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Mother's Name</label>
                                                <input type="text" value={editingStudent.motherName || ''} onChange={(e) => setEditingStudent({ ...editingStudent, motherName: e.target.value })} className="block w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700" />
                                            </div>
                                        )}
                                    </div>

                                    {/* DYNAMIC VARIABLES */}
                                    {dynamicVars.length > 0 && (
                                        <div className="pt-6 mt-6 border-t border-slate-100 space-y-6">
                                            <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] ml-1">Additional Fields</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                {dynamicVars.map(v => (
                                                    <div key={v.id} className="space-y-2">
                                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{v.name}</label>
                                                        <input
                                                            type="text"
                                                            value={editingStudent[v.slug] || ''}
                                                            onChange={(e) => setEditingStudent({ ...editingStudent, [v.slug]: e.target.value })}
                                                            className="block w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {(!fieldStatus || fieldStatus['address'] !== false) && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Home Address</label>
                                            <div className="relative">
                                                <MapPin className="absolute left-4 top-4 w-4 h-4 text-slate-400" />
                                                <textarea required value={editingStudent.address} onChange={(e) => setEditingStudent({ ...editingStudent, address: e.target.value })} className="block w-full pl-11 pr-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 min-h-[100px]" />
                                            </div>
                                        </div>
                                    )}

                                    <button type="submit" disabled={uploading} className="w-full py-5 rounded-[2rem] text-white bg-indigo-600 hover:bg-indigo-700 font-black tracking-tight shadow-xl shadow-indigo-100 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-3">
                                        {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                        {uploading ? "Updating..." : "Update Student"}
                                    </button>
                                </form>
                            </motion.div>
                        ) : (
                            <div className="bg-white rounded-[2.5rem] p-12 text-center space-y-4 border border-slate-100">
                                <AlertCircle className="w-16 h-16 text-amber-500 mx-auto" />
                                <h3 className="text-xl font-bold">No student selected</h3>
                                <p className="text-slate-500 font-medium">Please go back and select a student to edit.</p>
                                <Link to="/teacher" className="inline-block px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100">Go Back</Link>
                            </div>
                        )
                    } />

                    <Route path="profile" element={
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100 border border-slate-100 overflow-hidden"
                        >
                            <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                                <div className="flex items-center gap-3 sm:gap-4">
                                    <Link to="/teacher" className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                                        <X className="w-6 h-6" />
                                    </Link>
                                    <div>
                                        <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Teacher Profile</h3>
                                        <p className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Account Settings</p>
                                    </div>
                                </div>
                            </div>

                            <form onSubmit={handleSaveProfile} className="p-6 sm:p-8 space-y-5 sm:space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={teacherProfile.name}
                                        onChange={(e) => setTeacherProfile({ ...teacherProfile, name: e.target.value })}
                                        className="block w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                                        placeholder="Enter your full name"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Contact Number</label>
                                    <div className="relative">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="tel"
                                            required
                                            value={teacherProfile.phone}
                                            onChange={(e) => setTeacherProfile({ ...teacherProfile, phone: e.target.value })}
                                            className="block w-full pl-11 pr-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                                            placeholder="e.g. +91 9876543210"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Office Address</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-4 top-4 w-4 h-4 text-slate-400" />
                                        <textarea
                                            required
                                            value={teacherProfile.address}
                                            onChange={(e) => setTeacherProfile({ ...teacherProfile, address: e.target.value })}
                                            className="block w-full pl-11 pr-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 min-h-[100px]"
                                            placeholder="Your full address..."
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={savingProfile}
                                    className="w-full py-5 rounded-[2rem] text-white bg-indigo-600 hover:bg-indigo-700 font-black tracking-tight shadow-xl shadow-indigo-100 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                                >
                                    {savingProfile ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Saving Changes...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-5 h-5" />
                                            Save Profile
                                        </>
                                    )}
                                </button>

                                {profileMessage && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className={`mt-4 p-4 rounded-2xl text-sm font-bold text-center border ${profileMessage.includes('success')
                                            ? 'bg-green-50 text-green-700 border-green-100'
                                            : 'bg-red-50 text-red-700 border-red-100'
                                            }`}
                                    >
                                        {profileMessage}
                                    </motion.div>
                                )}
                            </form>

                            <div className="border-t border-slate-100 p-8 bg-slate-50/50">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center">
                                        <Lock className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-900 tracking-tight">Security</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Update password</p>
                                    </div>
                                </div>
                                <form onSubmit={handlePasswordChange} className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Current Password</label>
                                        <input
                                            type="password"
                                            required
                                            value={passwords.current}
                                            onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                                            className="block w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                                            <input
                                                type="password"
                                                required
                                                minLength={6}
                                                value={passwords.new}
                                                onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                                className="block w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                                                placeholder="Min 6 chars"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Confirm New</label>
                                            <input
                                                type="password"
                                                required
                                                minLength={6}
                                                value={passwords.confirm}
                                                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                                                className="block w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                                                placeholder="Confirm new"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={changingPassword}
                                        className="w-full py-5 rounded-[2rem] text-slate-700 bg-white border border-slate-200 hover:border-indigo-600 hover:text-indigo-600 font-black tracking-tight shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                                    >
                                        {changingPassword ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            "Update Security Key"
                                        )}
                                    </button>

                                    {passwordMessage.text && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={`p-4 rounded-2xl text-sm font-bold text-center border ${passwordMessage.type === 'error'
                                                ? 'bg-red-50 text-red-700 border-red-100'
                                                : 'bg-green-50 text-green-700 border-green-100'
                                                }`}
                                        >
                                            {passwordMessage.text}
                                        </motion.div>
                                    )}
                                </form>
                            </div>
                        </motion.div>
                    } />
                </Routes>

                <div className="mt-12 text-center pb-8 opacity-40 hover:opacity-100 transition-opacity">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Developed by <a href="https://eglobeits.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-600 transition-colors">eGlobe IT Solutions</a>
                    </p>
                </div>
                </div>

            <ImportInstructionsModal
                isOpen={showImportHelp}
                onClose={() => setShowImportHelp(false)}
                dynamicVars={dynamicVars}
            />

            {previewingStudent && templates[0] && (
                <PreviewModal
                    student={previewingStudent}
                    template={templates[0]}
                    onClose={() => setPreviewingStudent(null)}
                    students={students}
                    currentIndex={students.findIndex(s => s.id === previewingStudent.id)}
                    onNavigate={(newIndex) => {
                        if (newIndex >= 0 && newIndex < students.length) {
                            setPreviewingStudent(students[newIndex]);
                        }
                    }}
                />
            )}
        </div>
    );
}
