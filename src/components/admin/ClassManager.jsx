
import { useState, useEffect } from "react";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Plus, X, Trash2, Edit2, Save, School, Info, Users, GraduationCap, ChevronLeft, Eye, ExternalLink, Download, Phone, MapPin, Loader2, FileSpreadsheet, Upload, HelpCircle, CheckCircle2, Search } from "lucide-react";
import * as XLSX from 'xlsx';
import { getTemplates } from "../../services/idCardService";
import { downloadIDCardPDF, generateCardSide } from "../../utils/cardGenerator";
import PreviewModal from "./PreviewModal";
import ImportInstructionsModal from "./ImportInstructionsModal";
import ImageCropperModal from "../shared/ImageCropperModal";


export default function ClassManager() {
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newClass, setNewClass] = useState({ name: '', section: '' });
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', section: '' });
    const [students, setStudents] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [viewingClass, setViewingClass] = useState(null);
    const [editingStudent, setEditingStudent] = useState(null);
    const [showEditForm, setShowEditForm] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState({ type: null, message: "" });
    const [templates, setTemplates] = useState([]);
    const [generating, setGenerating] = useState(false);
    const [generatingId, setGeneratingId] = useState(null);
    const [previewingStudent, setPreviewingStudent] = useState(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showImportHelp, setShowImportHelp] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importPreview, setImportPreview] = useState([]);
    const [dynamicVars, setDynamicVars] = useState([]);
    const [fieldStatus, setFieldStatus] = useState({});
    const [selectedStudents, setSelectedStudents] = useState([]);
    const [showPromotionModal, setShowPromotionModal] = useState(false);
    const [promoting, setPromoting] = useState(false);
    const [showAddStudentForm, setShowAddStudentForm] = useState(false);
    const [newStudent, setNewStudent] = useState({ name: '', address: '', emergencyContact: '', photo: null, bloodGroup: '', fatherName: '', motherName: '' });
    const [searchQuery, setSearchQuery] = useState('');
    const [assignTeacherId, setAssignTeacherId] = useState("");
    const [assigningTeacher, setAssigningTeacher] = useState(false);
    
    // Cropper State
    const [cropImageSrc, setCropImageSrc] = useState(null);
    const [activeCropperType, setActiveCropperType] = useState(null); // 'add' or 'edit'

    const [alertModal, setAlertModal] = useState({ show: false, title: "", message: "", type: "error", onConfirm: null });

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
            setLoading(true);
            try {
                // Fetch Classes
                const classesSnap = await getDocs(collection(db, "classes"));
                const classList = classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                classList.sort((a, b) => {
                    const nameComp = a.name.localeCompare(b.name, undefined, { numeric: true });
                    if (nameComp !== 0) return nameComp;
                    return a.section.localeCompare(b.section);
                });
                setClasses(classList);

                // Fetch Students
                const studentsSnap = await getDocs(collection(db, "students"));
                const studentList = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setStudents(studentList);

                // Fetch Teachers
                const teachersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "teacher")));
                const teacherList = teachersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setTeachers(teacherList);

                // Fetch Templates for Download
                const templateList = await getTemplates();
                setTemplates(templateList);

                // Fetch Dynamic Variables
                const varsSnapshot = await getDocs(collection(db, "variables"));
                const allVars = varsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                const statusMap = {};
                allVars.forEach(v => {
                    statusMap[v.slug] = v.active !== false;
                });
                setFieldStatus(statusMap);

                // Filter out system fields
                const systemSlugs = ['name', 'class', 'address', 'emergencyContact', 'bloodGroup', 'fatherName', 'motherName'];
                setDynamicVars(allVars.filter(v => !systemSlugs.includes(v.slug) && v.active !== false));
            } catch (error) {
                console.error("Error fetching data:", error);
            }
            setLoading(false);
        };
        fetchData();
    }, []);

    const handleFileChange = (e, type) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = () => {
                setCropImageSrc(reader.result);
                setActiveCropperType(type);
            };
            reader.readAsDataURL(file);
            e.target.value = null; // Reset input so same file can be selected again
        }
    };

    const handleCropComplete = (croppedFile) => {
        if (activeCropperType === 'add') {
            setNewStudent({ ...newStudent, photo: croppedFile });
        } else if (activeCropperType === 'edit') {
            setEditingStudent({ ...editingStudent, photoFile: croppedFile });
        }
        setCropImageSrc(null);
        setActiveCropperType(null);
    };

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
        if (!viewingClass) return;

        setImporting(true);
        try {
            let successCount = 0;
            let errorCount = 0;

            for (const student of importPreview) {
                try {

                    // No default photo for imported students
                    const photoUrl = '';
                    const className = `${viewingClass.name}-${viewingClass.section}`;

                    const newStudent = {
                        name: student.name,
                        class: className,
                        classId: viewingClass.id,
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
                    };

                    const docRef = await addDoc(collection(db, "students"), newStudent);

                    // Add to local state immediately
                    setStudents(prev => [...prev, { id: docRef.id, ...newStudent }]);
                    successCount++;
                } catch (err) {
                    console.error('Error adding student:', err);
                    errorCount++;
                }
            }

            setShowImportModal(false);
            setImportPreview([]);
            setStatus({
                type: 'success',
                message: `Imported ${successCount} students successfully${errorCount > 0 ? ` (${errorCount} failed)` : ''}`
            });
            setTimeout(() => setStatus({ type: null, message: "" }), 5000);
        } catch (error) {
            console.error('Error importing students:', error);
            setStatus({ type: 'error', message: "Import failed. Check console." });
        } finally {
            setImporting(false);
        }
    };

    const handleAddStudent = async (e) => {
        e.preventDefault();
        if (!viewingClass) return;
        setUploading(true);
        try {
            let photoUrl = import.meta.env.BASE_URL + 'default-avatar.svg';

            if (newStudent.photo) {
                const formData = new FormData();
                formData.append('file', newStudent.photo);
                const response = await fetch('/api/upload', { method: 'POST', body: formData });
                if (response.ok) {
                    const data = await response.json();
                    photoUrl = data.url;
                }
            }

            const className = `${viewingClass.name}-${viewingClass.section}`;
            const studentData = {
                ...newStudent,
                class: className,
                classId: viewingClass.id,
                photoUrl: photoUrl,
                createdAt: new Date()
            };
            delete studentData.photo;

            const docRef = await addDoc(collection(db, "students"), studentData);
            setStudents(prev => [...prev, { id: docRef.id, ...studentData }]);

            setNewStudent({ name: '', address: '', emergencyContact: '', photo: null, bloodGroup: '', fatherName: '', motherName: '' });
            setCropImageSrc(null);
            setShowAddStudentForm(false);
            setStatus({ type: 'success', message: "Student added successfully!" });
            setTimeout(() => setStatus({ type: null, message: "" }), 3000);
        } catch (err) {
            console.error(err);
            setStatus({ type: 'error', message: "Error adding student: " + err.message });
        } finally {
            setUploading(false);
        }
    };

    const handleAddClass = async (e) => {
        e.preventDefault();

        // Check for duplicate class
        const isDuplicate = classes.some(c =>
            c.name.trim().toLowerCase() === newClass.name.trim().toLowerCase() &&
            c.section.trim().toLowerCase() === newClass.section.trim().toLowerCase()
        );

        if (isDuplicate) {
            setAlertModal({
                show: true,
                title: "Duplicate Class",
                message: `Class ${newClass.name} - Section ${newClass.section} already exists!`,
                type: "error",
                onConfirm: null
            });
            return;
        }

        try {
            const classData = {
                name: newClass.name,
                section: newClass.section,
                createdAt: new Date()
            };
            const docRef = await addDoc(collection(db, "classes"), classData);
            setClasses([...classes, { id: docRef.id, ...classData }].sort((a, b) => {
                const nameComp = a.name.localeCompare(b.name, undefined, { numeric: true });
                if (nameComp !== 0) return nameComp;
                return a.section.localeCompare(b.section);
            }));
            setNewClass({ name: '', section: '' });
            setShowAddForm(false);
        } catch (error) {
            console.error("Error adding class:", error);
            setStatus({ type: 'error', message: "Failed to add class." });
            setTimeout(() => setStatus({ type: null, message: "" }), 5000);
        }
    };

    const handleDeleteClass = async (id) => {
        const c = classes.find(cls => cls.id === id);
        if (c) {
            const hasStudents = students.some(s => s.classId === c.id || s.class === `${c.name}-${c.section}`);
            const hasTeachers = teachers.some(t => t.assignedClassId === c.id || t.assignedClass === `${c.name}-${c.section}`);

            if (hasStudents || hasTeachers) {
                setAlertModal({
                    show: true,
                    title: "Action Denied",
                    message: "Cannot delete this class because it has students or teachers assigned to it. Please reassign them first.",
                    type: "error",
                    onConfirm: null
                });
                return;
            }
        }

        setAlertModal({
            show: true,
            title: "Confirm Deletion",
            message: "Are you sure you want to delete this class? This action cannot be undone.",
            type: "confirm",
            onConfirm: async () => {
                setAlertModal(prev => ({ ...prev, show: false }));
                try {
                    await deleteDoc(doc(db, "classes", id));
                    setClasses(classes.filter(cls => cls.id !== id));
                    setStatus({ type: 'success', message: "Class deleted successfully" });
                    setTimeout(() => setStatus({ type: null, message: "" }), 3000);
                } catch (error) {
                    console.error("Error deleting class:", error);
                    setStatus({ type: 'error', message: "Failed to delete class" });
                    setTimeout(() => setStatus({ type: null, message: "" }), 3000);
                }
            }
        });
    };

    const handleEdit = (c) => {
        const hasStudents = students.some(s => s.classId === c.id || s.class === `${c.name}-${c.section}`);
        const hasTeachers = teachers.some(t => t.assignedClassId === c.id || t.assignedClass === `${c.name}-${c.section}`);

        if (hasStudents || hasTeachers) {
            setAlertModal({
                show: true,
                title: "Action Denied",
                message: "Cannot edit this class because it has students or teachers assigned to it. Please reassign them first.",
                type: "error",
                onConfirm: null
            });
            return;
        }

        setEditingId(c.id);
        setEditForm({ name: c.name, section: c.section });
    };

    const handleUpdate = async (id) => {
        // Check for duplicate class (excluding current one)
        const isDuplicate = classes.some(c =>
            c.id !== id &&
            c.name.trim().toLowerCase() === editForm.name.trim().toLowerCase() &&
            c.section.trim().toLowerCase() === editForm.section.trim().toLowerCase()
        );

        if (isDuplicate) {
            setAlertModal({
                show: true,
                title: "Duplicate Class",
                message: `Class ${editForm.name} - Section ${editForm.section} already exists!`,
                type: "error",
                onConfirm: null
            });
            return;
        }

        try {
            await updateDoc(doc(db, "classes", id), {
                name: editForm.name,
                section: editForm.section
            });
            setClasses(classes.map(c =>
                c.id === id ? { ...c, name: editForm.name, section: editForm.section } : c
            ));
            setEditingId(null);
        } catch (error) {
            console.error("Error updating class:", error);
        }
    };

    const handleEditStudentClick = (student) => {
        setEditingStudent({
            ...student,
            photoFile: null
        });
        setShowEditForm(true);
    };

    const handleUpdateStudent = async (e) => {
        e.preventDefault();
        if (!editingStudent) return;
        setUploading(true);
        try {
            let photoUrl = editingStudent.photoUrl;
            if (editingStudent.photoFile) {
                const formData = new FormData();
                formData.append('file', editingStudent.photoFile);
                const response = await fetch('/api/upload', { method: 'POST', body: formData });
                if (response.ok) {
                    const data = await response.json();
                    photoUrl = data.url;
                }
            }

            const studentData = {
                name: editingStudent.name,
                address: editingStudent.address || '',
                emergencyContact: editingStudent.emergencyContact || '',
                bloodGroup: editingStudent.bloodGroup || '',
                fatherName: editingStudent.fatherName || '',
                motherName: editingStudent.motherName || '',
                photoUrl: photoUrl,
                updatedAt: new Date(),
                // Include dynamic fields
                ...dynamicVars.reduce((acc, v) => {
                    acc[v.slug] = editingStudent[v.slug] || '';
                    return acc;
                }, {})
            };

            await updateDoc(doc(db, "students", editingStudent.id), studentData);
            setStudents(students.map(s => s.id === editingStudent.id ? { ...s, ...studentData } : s));
            setShowEditForm(false);
            setEditingStudent(null);
            setStatus({ type: 'success', message: "Student updated!" });
            setTimeout(() => setStatus({ type: null, message: "" }), 3000);
        } catch (err) {
            console.error(err);
            alert("Error: " + err.message);
        } finally {
            setUploading(false);
        }
    };

    const downloadSingleCard = async (student) => {
        if (templates.length === 0) {
            setStatus({ type: 'error', message: "No ID Card Template found!" });
            setTimeout(() => setStatus({ type: null, message: "" }), 5000);
            return;
        }

        setGenerating(true);
        setGeneratingId(student.id);
        setStatus({ type: 'info', message: `Generating PDF...` });

        try {
            const template = templates[0];
            const layout = typeof template.layout === 'string' ? JSON.parse(template.layout) : template.layout;
            await downloadIDCardPDF(student, layout);
            setStatus({ type: 'success', message: "PDF Downloaded!" });
            setTimeout(() => setStatus({ type: null, message: "" }), 3000);
        } catch (err) {
            console.error(err);
            setStatus({ type: 'error', message: "Failed to generate PDF." });
        } finally {
            setGenerating(false);
            setGeneratingId(null);
        }
    };

    const handlePromoteStudents = async (targetClassId) => {
        if (!targetClassId) return;
        const targetClass = classes.find(c => c.id === targetClassId);
        if (!targetClass) return;

        setPromoting(true);
        try {
            const className = `${targetClass.name}-${targetClass.section}`;
            const promises = selectedStudents.map(studentId =>
                updateDoc(doc(db, "students", studentId), {
                    class: className,
                    classId: targetClass.id,
                    updatedAt: new Date()
                })
            );

            await Promise.all(promises);

            // Update local state
            setStudents(prev => prev.map(s =>
                selectedStudents.includes(s.id)
                    ? { ...s, class: className, classId: targetClass.id }
                    : s
            ));

            setSelectedStudents([]);
            setShowPromotionModal(false);
            setStatus({ type: 'success', message: `Promoted ${selectedStudents.length} students to ${className}!` });
            setTimeout(() => setStatus({ type: null, message: "" }), 3000);
        } catch (err) {
            console.error(err);
            setStatus({ type: 'error', message: "Promotion failed. Check console." });
        } finally {
            setPromoting(false);
        }
    };

    const handleAssignTeacher = async (teacherId, classObj) => {
        if (!teacherId || !classObj) return;
        setAssigningTeacher(true);
        try {
            const className = `${classObj.name}-${classObj.section}`;
            await updateDoc(doc(db, "users", teacherId), {
                assignedClassId: classObj.id,
                assignedClass: className
            });

            // Update local state
            setTeachers(teachers.map(t => 
                t.id === teacherId ? { ...t, assignedClassId: classObj.id, assignedClass: className } : t
            ));
            
            setAssignTeacherId("");
            setStatus({ type: 'success', message: "Teacher assigned successfully!" });
            setTimeout(() => setStatus({ type: null, message: "" }), 3000);
        } catch (error) {
            console.error("Error assigning teacher:", error);
            setStatus({ type: 'error', message: "Failed to assign teacher." });
            setTimeout(() => setStatus({ type: null, message: "" }), 3000);
        } finally {
            setAssigningTeacher(false);
        }
    };

    const toggleStudentSelection = (id) => {
        setSelectedStudents(prev =>
            prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
        );
    };

    const selectVisibleStudents = () => {
        if (!viewingClass) return;
        const visibleIds = students
            .filter(s => s.class === `${viewingClass.name}-${viewingClass.section}`)
            .map(s => s.id);
        setSelectedStudents(visibleIds);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64 bg-white rounded-xl shadow-sm border border-gray-100 font-['Inter']">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <span className="ml-2 text-gray-500 font-bold uppercase tracking-widest text-[10px]">Loading Classes...</span>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 font-['Inter']">
            {!viewingClass && (
                <div className="space-y-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Academic Classes</h2>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.3em] mt-1">Manage Classrooms and Sections</p>
                        </div>
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="flex items-center px-6 py-3 bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            New Class
                        </button>
                    </div>

                    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50/50 border-b border-gray-100">
                                <tr>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Class Info</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Assigned Teacher</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Data Completion</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Student Count</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">Operations</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {classes.map((c) => {
                                    const teacher = teachers.find(t => t.assignedClassId === c.id || t.assignedClass === `${c.name}-${c.section}`);
                                    const classStudents = students.filter(s => s.class === `${c.name}-${c.section}`);
                                    const total = classStudents.length;

                                    const completed = classStudents.filter(s => isProfileComplete(s)).length;

                                    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
                                    const isEditing = editingId === c.id;

                                    return (
                                        <tr key={c.id} className="group hover:bg-gray-50/50 transition-colors">
                                            <td className="px-8 py-6">
                                                {isEditing ? (
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={editForm.name}
                                                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                                            className="w-20 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                                            placeholder="Class"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={editForm.section}
                                                            onChange={(e) => setEditForm({ ...editForm, section: e.target.value })}
                                                            className="w-20 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                                            placeholder="Sec"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                                                            <School className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight">Class {c.name}</h4>
                                                            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-0.5">Section {c.section}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${teacher ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>
                                                        {teacher ? teacher.name?.charAt(0) || 'T' : '?'}
                                                    </div>
                                                    {teacher ? (
                                                        <span className="text-xs font-bold text-gray-900 truncate">
                                                            {teacher.name || teacher.email}
                                                        </span>
                                                    ) : (
                                                        <select
                                                            onChange={(e) => handleAssignTeacher(e.target.value, c)}
                                                            value=""
                                                            disabled={assigningTeacher}
                                                            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-gray-500 w-32 cursor-pointer hover:border-indigo-200 transition-colors"
                                                        >
                                                            <option value="" disabled>Assign Teacher...</option>
                                                            {teachers.filter(t => !t.assignedClassId && !t.assignedClass).map(t => (
                                                                <option key={t.id} value={t.id}>{t.name || t.email}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="w-48">
                                                    <div className="flex justify-between items-center mb-1.5">
                                                        <span className={`text-[9px] font-black uppercase tracking-widest ${percentage === 100 ? 'text-green-600' : 'text-gray-400'}`}>
                                                            {percentage === 100 ? 'Complete' : 'In Progress'}
                                                        </span>
                                                        <span className="text-[9px] font-black text-gray-500">{percentage}%</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-1000 ${percentage === 100 ? 'bg-green-500' : 'bg-indigo-500'}`}
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-lg border border-gray-100">
                                                    <Users className="w-3 h-3 text-gray-400" />
                                                    <span className="text-xs font-black text-gray-900">{total}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                {isEditing ? (
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => handleUpdate(c.id)} className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md">
                                                            <Save className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => setEditingId(null)} className="p-2 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 transition-all">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-end gap-1.5">
                                                        <button onClick={() => setViewingClass(c)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-indigo-100 shadow-sm" title="View Details">
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleEdit(c)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-indigo-100 shadow-sm" title="Edit Class">
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleDeleteClass(c.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-red-100 shadow-sm" title="Delete Class">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {classes.length === 0 && !showAddForm && (
                <div className="col-span-full py-20 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center">
                    <School className="w-16 h-16 text-gray-200 mb-4" />
                    <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-xs">No Classes Registered Yet</p>
                    <button onClick={() => setShowAddForm(true)} className="mt-4 text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:underline">Create First Class</button>
                </div>
            )}


            {
                showAddForm && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xl animate-in fade-in duration-300">
                        <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden border border-white">
                            <div className="px-10 py-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                                <div>
                                    <h3 className="font-black text-gray-900 uppercase tracking-tighter text-xl">Create Class</h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Configure new classroom data</p>
                                </div>
                                <button onClick={() => setShowAddForm(false)} className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm text-gray-400 hover:text-red-500 transition-all"><X className="w-6 h-6" /></button>
                            </div>
                            <form onSubmit={handleAddClass} className="p-10 space-y-6">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Class Name / Grade</label>
                                    <input required type="text" value={newClass.name} onChange={(e) => setNewClass({ ...newClass, name: e.target.value })} className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-sm font-bold" placeholder="e.g. 5, 10, XII" />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Section / Division</label>
                                    <input required type="text" value={newClass.section} onChange={(e) => setNewClass({ ...newClass, section: e.target.value })} className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-sm font-bold" placeholder="e.g. A, B, Blue" />
                                </div>
                                <div className="pt-4">
                                    <button className="w-full py-5 bg-indigo-600 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-3">
                                        <Plus className="w-5 h-5" /> Initialize Class
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {
                viewingClass && (
                    <div className="animate-in slide-in-from-right-10 duration-500">
                        <div className="space-y-8">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                    <button onClick={() => setViewingClass(null)} className="w-12 h-12 flex items-center justify-center bg-white rounded-2xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-all text-gray-400 hover:text-indigo-600 group">
                                        <ChevronLeft className="w-6 h-6 group-hover:scale-110 transition-transform" />
                                    </button>
                                    <div>
                                        <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">Class {viewingClass.name} - {viewingClass.section}</h2>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.3em] mt-1">Full Academic Overview & Roster</p>
                                    </div>
                                </div>
                                <div className="bg-white px-6 py-3 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Progress</p>
                                        <p className="text-sm font-black text-green-600">
                                            {students.filter(s => s.class === `${viewingClass.name}-${viewingClass.section}` && isProfileComplete(s)).length}/{students.filter(s => s.class === `${viewingClass.name}-${viewingClass.section}`).length} Completed
                                        </p>
                                    </div>
                                    <div className="w-px h-8 bg-gray-100" />
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Enrollment</p>
                                        <p className="text-sm font-black text-indigo-600">{students.filter(s => s.class === `${viewingClass.name}-${viewingClass.section}`).length} Students</p>
                                    </div>
                                    <div className="w-px h-8 bg-gray-100" />
                                    <Users className="w-5 h-5 text-gray-400" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setShowAddStudentForm(true)}
                                        className="flex items-center px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add Student
                                    </button>
                                    <label className="flex items-center gap-2 cursor-pointer bg-green-50 hover:bg-green-100 text-green-700 px-4 py-2 rounded-xl transition-colors font-bold text-xs uppercase tracking-widest border border-green-200">
                                        <FileSpreadsheet className="w-4 h-4" />
                                        <span>Import Students</span>
                                        <input
                                            type="file"
                                            accept=".xlsx, .xls, .csv"
                                            onChange={handleExcelImport}
                                            className="hidden"
                                        />
                                    </label>
                                    <button
                                        onClick={() => setShowImportHelp(true)}
                                        className="w-10 h-10 flex items-center justify-center bg-gray-50 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-gray-100"
                                        title="Import Instructions"
                                    >
                                        <HelpCircle className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-8">
                            {/* Staff Section */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <Users className="w-4 h-4 text-indigo-600" />
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Assigned Faculty</h4>
                                </div>
                                <div className="space-y-4">
                                    {teachers.filter(t => t.assignedClassId === viewingClass.id || t.assignedClass === `${viewingClass.name}-${viewingClass.section}`).length > 0 ? (
                                        teachers
                                            .filter(t => t.assignedClassId === viewingClass.id || t.assignedClass === `${viewingClass.name}-${viewingClass.section}`)
                                            .map(teacher => (
                                                <div key={teacher.id} className="bg-white/50 px-8 py-8 border-y border-gray-100 flex items-center justify-between group hover:bg-gray-50/50 transition-all w-full">
                                                    <div className="flex items-center gap-8">
                                                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-indigo-600 border border-gray-100 shadow-sm">
                                                            <Users className="w-8 h-8" />
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-1">Class Teacher</p>
                                                            <h3 className="text-xl font-black text-gray-900 tracking-tight">{teacher.name || teacher.email}</h3>
                                                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">{teacher.email}</p>
                                                        </div>
                                                    </div>
                                                    <div className="hidden md:flex items-center gap-8 pr-6">
                                                        <div className="text-right">
                                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Employee ID</p>
                                                            <p className="text-xs font-black text-gray-900 mt-0.5">#{teacher.id.slice(-6).toUpperCase()}</p>
                                                        </div>
                                                        <div className="w-px h-10 bg-gray-50" />
                                                        <div className="text-right">
                                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Status</p>
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black bg-green-50 text-green-700 uppercase tracking-widest border border-green-100 mt-0.5">Active</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                    ) : (
                                        (() => {
                                            const unassignedTeachers = teachers.filter(t => !t.assignedClassId && !t.assignedClass);
                                            return (
                                                <div className="w-full bg-amber-50/50 px-8 py-6 border-y border-amber-100 flex flex-col md:flex-row items-center justify-between gap-4">
                                                    <div className="flex items-center gap-3">
                                                        <Info className="w-5 h-5 text-amber-500" />
                                                        <p className="text-xs font-black text-amber-700 uppercase tracking-widest">No assigned faculty for this class</p>
                                                    </div>
                                                    {unassignedTeachers.length > 0 ? (
                                                        <div className="flex items-center gap-2 w-full md:w-auto">
                                                            <select
                                                                value={assignTeacherId}
                                                                onChange={(e) => setAssignTeacherId(e.target.value)}
                                                                className="flex-1 md:w-48 px-4 py-2 bg-white border border-amber-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none text-amber-900"
                                                            >
                                                                <option value="">Select Teacher...</option>
                                                                {unassignedTeachers.map(t => (
                                                                    <option key={t.id} value={t.id}>{t.name || t.email}</option>
                                                                ))}
                                                            </select>
                                                            <button
                                                                onClick={() => handleAssignTeacher(assignTeacherId, viewingClass)}
                                                                disabled={!assignTeacherId || assigningTeacher}
                                                                className="px-4 py-2 bg-amber-500 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-amber-600 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                                            >
                                                                {assigningTeacher ? "Assigning..." : "Assign"}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="text-[10px] font-black text-amber-500/70 uppercase tracking-widest">
                                                            No unassigned teachers available
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()
                                    )}
                                </div>
                            </div>

                            {/* Student Roster */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <GraduationCap className="w-4 h-4 text-indigo-600" />
                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Student Roster</h4>
                                    </div>

                                    <div className="flex items-center flex-1 max-w-md mx-8">
                                        <div className="relative w-full">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="Search students by name, contact, info..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-full pl-11 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {selectedStudents.length > 0 ? (
                                            <>
                                                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                                                    {selectedStudents.length} SELECTED
                                                </span>
                                                <button
                                                    onClick={() => setShowPromotionModal(true)}
                                                    className="px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                                                >
                                                    Promote Class
                                                </button>
                                                <button
                                                    onClick={() => setSelectedStudents([])}
                                                    className="px-4 py-1.5 bg-white text-gray-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gray-50 transition-all border border-gray-100"
                                                >
                                                    Clear
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={selectVisibleStudents}
                                                className="px-4 py-1.5 bg-white text-gray-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gray-50 transition-all border border-gray-100"
                                            >
                                                Select All
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-gray-50/50 border-b border-gray-50">
                                                <th className="px-8 py-4 w-10">
                                                </th>
                                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Student</th>
                                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Contact</th>
                                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Address</th>
                                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {students
                                                .filter(s => s.class === `${viewingClass.name}-${viewingClass.section}`)
                                                .filter(s => {
                                                    const query = searchQuery.toLowerCase();
                                                    return (
                                                        s.name?.toLowerCase().includes(query) ||
                                                        s.emergencyContact?.toLowerCase().includes(query) ||
                                                        s.address?.toLowerCase().includes(query) ||
                                                        Object.values(s).some(val => String(val).toLowerCase().includes(query))
                                                    );
                                                })
                                                .map(student => (
                                                    <tr key={student.id} className={`group hover:bg-gray-50 transition-colors ${selectedStudents.includes(student.id) ? 'bg-indigo-50/30' : ''}`}>
                                                        <td className="px-8 py-4">
                                                            <div
                                                                onClick={() => toggleStudentSelection(student.id)}
                                                                className={`w-5 h-5 rounded-lg border-2 transition-all cursor-pointer flex items-center justify-center ${selectedStudents.includes(student.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-200 bg-white hover:border-indigo-300'}`}
                                                            >
                                                                {selectedStudents.includes(student.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-4">
                                                            <div className="flex items-center gap-4">
                                                                <img
                                                                    src={(student.photoUrl?.startsWith('/uploads') ? import.meta.env.BASE_URL + student.photoUrl.slice(1) : student.photoUrl) || import.meta.env.BASE_URL + 'default-avatar.svg'}
                                                                    onError={(e) => { e.target.onerror = null; e.target.src = import.meta.env.BASE_URL + 'default-avatar.svg'; }}
                                                                    className="w-10 h-10 rounded-xl object-cover border border-gray-100 shadow-sm"
                                                                    alt=""
                                                                />
                                                                <div>
                                                                    <p className="font-bold text-gray-900">{student.name}</p>
                                                                    {isProfileComplete(student) ? (
                                                                        <p className="text-[9px] font-bold text-green-600 uppercase tracking-widest mt-0.5 flex items-center gap-1">
                                                                            <CheckCircle2 className="w-3 h-3" /> Complete
                                                                        </p>
                                                                    ) : (
                                                                        <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest mt-0.5 flex items-center gap-1">
                                                                            <Info className="w-3 h-3" /> Incomplete
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-4">
                                                            <p className="text-xs font-bold text-gray-600">{student.emergencyContact}</p>
                                                        </td>
                                                        <td className="px-8 py-4">
                                                            <p className="text-xs text-gray-400 truncate max-w-[200px]">{student.address}</p>
                                                        </td>
                                                        <td className="px-8 py-4 text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <button
                                                                    onClick={() => handleEditStudentClick(student)}
                                                                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                                    title="Edit Student"
                                                                >
                                                                    <Edit2 className="w-4 h-4" />
                                                                </button>
                                                                {templates.length > 0 && templates[0].isLocked && isProfileComplete(student) && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => setPreviewingStudent(student)}
                                                                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                                            title="Preview ID Card"
                                                                        >
                                                                            <Eye className="w-4 h-4" />
                                                                        </button>
                                                                        {isProfileComplete(student) && (
                                                                            <button
                                                                                onClick={() => downloadSingleCard(student)}
                                                                                disabled={generating}
                                                                                className={`p-2 transition-all rounded-xl ${generatingId === student.id ? 'text-indigo-600 animate-pulse' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                                                                                title="Download ID Card"
                                                                            >
                                                                                {generatingId === student.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                                                            </button>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            {students.filter(s => s.class === `${viewingClass.name}-${viewingClass.section}`).length === 0 && (
                                                <tr>
                                                    <td colSpan="3" className="px-8 py-20 text-center">
                                                        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No students enrolled in this class</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {showPromotionModal && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden relative">
                        <button
                            onClick={() => setShowPromotionModal(false)}
                            className="absolute top-4 right-4 z-10 w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-red-50 rounded-xl text-gray-400 hover:text-red-500 transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="p-8">
                            <div className="flex items-center gap-4">
                                {/* Left Column - Current Class */}
                                <div className="flex-1">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.25em] mb-2 text-center">Promoting From</p>
                                    <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-5 shadow-lg">
                                        <h3 className="text-2xl font-black text-white uppercase tracking-tight text-center">
                                            {viewingClass.name} - {viewingClass.section}
                                        </h3>
                                    </div>
                                    <p className="text-[10px] font-bold text-gray-500 mt-2 uppercase tracking-wide text-center">
                                        {selectedStudents.length} Student{selectedStudents.length !== 1 ? 's' : ''}
                                    </p>
                                </div>

                                {/* Arrow */}
                                <div className="flex-shrink-0">
                                    <svg className="w-10 h-10 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </div>

                                {/* Right Column - Target Class */}
                                <div className="flex-1">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.25em] mb-2 text-center">Promote To</p>
                                    <select
                                        required
                                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-bold text-center"
                                        onChange={(e) => {
                                            const targetId = e.target.value;
                                            if (targetId) handlePromoteStudents(targetId);
                                        }}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>Select Target Class</option>
                                        {(() => {
                                            // Extract numeric part from current class name
                                            const currentClassNumber = parseInt(viewingClass.name.match(/\d+/)?.[0]);
                                            const nextClassNumber = currentClassNumber + 1;

                                            // Filter classes to show only next grade level
                                            return classes
                                                .filter(c => {
                                                    const classNumber = parseInt(c.name.match(/\d+/)?.[0]);
                                                    return classNumber === nextClassNumber;
                                                })
                                                .map(c => (
                                                    <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
                                                ));
                                        })()}
                                    </select>
                                </div>
                            </div>

                            {/* Info Banner */}
                            <div className="mt-6 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                <p className="text-[9px] font-bold text-indigo-700 uppercase tracking-wide text-center">
                                    <Info className="w-3 h-3 inline mr-1 mb-0.5" />
                                    This will update the class association for all selected students
                                </p>
                            </div>

                            {promoting && (
                                <div className="mt-4 flex items-center justify-center">
                                    <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                                    <span className="ml-2 text-xs font-bold text-gray-500 uppercase tracking-wide">Promoting...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {
                showAddStudentForm && viewingClass && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xl animate-in fade-in duration-300">
                        <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden border border-white">
                            <div className="px-10 py-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                                <div>
                                    <h3 className="font-black text-gray-900 uppercase tracking-tighter text-xl">Add Student</h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Class {viewingClass.name} - {viewingClass.section}</p>
                                </div>
                                <button onClick={() => setShowAddStudentForm(false)} className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm text-gray-400 hover:text-red-500 transition-all"><X className="w-6 h-6" /></button>
                            </div>
                            <form onSubmit={handleAddStudent} className="p-10 space-y-4 max-h-[70vh] overflow-y-auto">
                                {isActive('name') && (
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Full Name</label>
                                        <input required type="text" value={newStudent.name} onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold" />
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-4">
                                    {isActive('emergencyContact') && (
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Emergency No.</label>
                                            <input required type="text" value={newStudent.emergencyContact} onChange={(e) => setNewStudent({ ...newStudent, emergencyContact: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold" />
                                        </div>
                                    )}
                                    {isActive('bloodGroup') && (
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Blood Group</label>
                                            <input type="text" value={newStudent.bloodGroup} onChange={(e) => setNewStudent({ ...newStudent, bloodGroup: e.target.value })} placeholder="e.g. O+" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold" />
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    {isActive('fatherName') && (
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Father's Name</label>
                                            <input type="text" value={newStudent.fatherName} onChange={(e) => setNewStudent({ ...newStudent, fatherName: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold" />
                                        </div>
                                    )}
                                    {isActive('motherName') && (
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Mother's Name</label>
                                            <input type="text" value={newStudent.motherName} onChange={(e) => setNewStudent({ ...newStudent, motherName: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold" />
                                        </div>
                                    )}
                                </div>

                                {dynamicVars.length > 0 && (
                                    <div className="pt-4 border-t border-gray-50 space-y-4">
                                        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] ml-1">Additional Fields</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            {dynamicVars.map(v => {
                                                const isDateField = ['dateofbirth', 'dob', 'birthdate', 'date_of_birth'].includes(v.slug.toLowerCase());
                                                return (
                                                    <div key={v.id}>
                                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                                                            {v.name}{isDateField && <span className="text-[9px] normal-case ml-1 text-gray-300">(DD/MM/YYYY)</span>}
                                                        </label>
                                                        <input
                                                            type={isDateField ? "date" : "text"}
                                                            value={newStudent[v.slug] || ''}
                                                            onChange={(e) => setNewStudent({ ...newStudent, [v.slug]: e.target.value })}
                                                            placeholder={isDateField ? "DD/MM/YYYY" : ""}
                                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold"
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {isActive('address') && (
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Home Address</label>
                                        <textarea required value={newStudent.address} onChange={(e) => setNewStudent({ ...newStudent, address: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold" rows="2" />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Photo</label>
                                    <div className="flex items-center gap-4">
                                        {newStudent.photo && (
                                            <div className="w-16 h-16 rounded-xl overflow-hidden border border-gray-100 flex-shrink-0 bg-gray-50">
                                                <img src={URL.createObjectURL(newStudent.photo)} className="w-full h-full object-cover" alt="Preview" />
                                            </div>
                                        )}
                                        <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'add')} className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                                    </div>
                                </div>

                                <button disabled={uploading} className="w-full py-5 bg-indigo-600 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50">
                                    {uploading ? "Saving..." : "Create Student"}
                                </button>
                            </form>
                        </div>
                    </div>
                )
            }

            {
                showEditForm && editingStudent && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <h3 className="font-bold text-gray-900 leading-none">Edit Student</h3>
                                <button onClick={() => setShowEditForm(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-6 h-6" /></button>
                            </div>
                            <form onSubmit={handleUpdateStudent} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                                {isActive('name') && (
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Full Name</label>
                                        <input required type="text" value={editingStudent.name} onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold" />
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-4">
                                    {isActive('emergencyContact') && (
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Emergency No.</label>
                                            <input required type="text" value={editingStudent.emergencyContact} onChange={(e) => setEditingStudent({ ...editingStudent, emergencyContact: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold" />
                                        </div>
                                    )}
                                    {isActive('bloodGroup') && (
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Blood Group</label>
                                            <input type="text" value={editingStudent.bloodGroup || ''} onChange={(e) => setEditingStudent({ ...editingStudent, bloodGroup: e.target.value })} placeholder="e.g. O+" className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold" />
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    {isActive('fatherName') && (
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Father's Name</label>
                                            <input type="text" value={editingStudent.fatherName || ''} onChange={(e) => setEditingStudent({ ...editingStudent, fatherName: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold" />
                                        </div>
                                    )}
                                    {isActive('motherName') && (
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Mother's Name</label>
                                            <input type="text" value={editingStudent.motherName || ''} onChange={(e) => setEditingStudent({ ...editingStudent, motherName: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold" />
                                        </div>
                                    )}
                                </div>

                                {/* DYNAMIC VARIABLES FOR EDITING */}
                                {dynamicVars.length > 0 && (
                                    <div className="pt-4 border-t border-gray-100 space-y-4">
                                        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] ml-1">Additional Fields</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            {dynamicVars.map(v => {
                                                const isDateField = ['dateofbirth', 'dob', 'birthdate', 'date_of_birth'].includes(v.slug.toLowerCase());
                                                return (
                                                    <div key={v.id}>
                                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                                                            {v.name}{isDateField && <span className="text-[9px] normal-case ml-1 text-gray-300">(DD/MM/YYYY)</span>}
                                                        </label>
                                                        <input
                                                            type={isDateField ? "date" : "text"}
                                                            value={editingStudent[v.slug] || ''}
                                                            onChange={(e) => setEditingStudent({ ...editingStudent, [v.slug]: e.target.value })}
                                                            placeholder={isDateField ? "DD/MM/YYYY" : ""}
                                                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold"
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {isActive('address') && (
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Home Address</label>
                                        <textarea required value={editingStudent.address} onChange={(e) => setEditingStudent({ ...editingStudent, address: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold" rows="2" />
                                    </div>
                                )}
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-xl overflow-hidden border border-gray-100 flex-shrink-0 bg-gray-50">
                                        <img
                                            src={editingStudent.photoFile ? URL.createObjectURL(editingStudent.photoFile) : ((editingStudent.photoUrl?.startsWith('/uploads') ? import.meta.env.BASE_URL + editingStudent.photoUrl.slice(1) : editingStudent.photoUrl) || import.meta.env.BASE_URL + 'default-avatar.svg')}
                                            onError={(e) => { e.target.onerror = null; e.target.src = import.meta.env.BASE_URL + 'default-avatar.svg'; }}
                                            className="w-full h-full object-cover"
                                            alt="Preview"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Change Photo (Optional)</label>
                                        <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'edit')} className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all font-bold" />
                                    </div>
                                </div>
                                <button disabled={uploading} className="w-full py-4 bg-indigo-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl mt-4 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 disabled:opacity-50">
                                    {uploading ? "Updating..." : "Update Student"}
                                </button>
                            </form>
                        </div>
                    </div>
                )
            }

            {
                previewingStudent && templates[0] && (
                    <PreviewModal
                        student={previewingStudent}
                        template={templates[0]}
                        onClose={() => setPreviewingStudent(null)}
                        students={students.filter(s => s.class === `${viewingClass.name}-${viewingClass.section}` && templates.length > 0 && templates[0].isLocked && isProfileComplete(s))}
                        currentIndex={students.filter(s => s.class === `${viewingClass.name}-${viewingClass.section}` && templates.length > 0 && templates[0].isLocked && isProfileComplete(s)).findIndex(s => s.id === previewingStudent.id)}
                        onNavigate={(newIndex) => {
                            const completeStudents = students.filter(s => s.class === `${viewingClass.name}-${viewingClass.section}` && templates.length > 0 && templates[0].isLocked && isProfileComplete(s));
                            if (newIndex >= 0 && newIndex < completeStudents.length) {
                                setPreviewingStudent(completeStudents[newIndex]);
                            }
                        }}
                    />
                )
            }

            {
                status.message && (
                    <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center px-6 py-3 rounded-2xl text-xs font-black shadow-2xl animate-in fade-in slide-in-from-bottom-5 z-[120] ${status.type === 'success' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-white'}`}>
                        {status.message.toUpperCase()}
                    </div>
                )
            }

            {/* Import Preview Modal */}
            {
                showImportModal && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <div>
                                    <h3 className="font-bold text-gray-900 leading-none">Import Preview (Class {viewingClass?.name}-{viewingClass?.section})</h3>
                                    <p className="text-xs text-gray-500 mt-1">Found {importPreview.length} students in file</p>
                                </div>
                                <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-6 h-6" /></button>
                            </div>
                            <div className="overflow-auto p-0 flex-1">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100">Name</th>
                                            <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100">Target Class</th>
                                            <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100">Data Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {importPreview.map((s, i) => (
                                            <tr key={i} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-3 text-sm font-bold text-gray-900">{s.name}</td>
                                                <td className="px-6 py-3 text-xs text-indigo-600 font-bold bg-indigo-50">
                                                    {viewingClass?.name}-{viewingClass?.section}
                                                </td>
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
                )
            }

            <ImportInstructionsModal
                isOpen={showImportHelp}
                onClose={() => setShowImportHelp(false)}
                dynamicVars={dynamicVars}
            />

            {cropImageSrc && (
                <ImageCropperModal
                    imageSrc={cropImageSrc}
                    onCropComplete={handleCropComplete}
                    onCancel={() => {
                        setCropImageSrc(null);
                        setActiveCropperType(null);
                    }}
                />
            )}

            {alertModal.show && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className={`px-6 py-4 flex justify-between items-center ${alertModal.type === 'error' ? 'bg-red-50' : 'bg-indigo-50'} border-b ${alertModal.type === 'error' ? 'border-red-100' : 'border-indigo-100'}`}>
                            <div className="flex items-center gap-2">
                                <Info className={`w-5 h-5 ${alertModal.type === 'error' ? 'text-red-500' : 'text-indigo-500'}`} />
                                <h3 className={`font-bold ${alertModal.type === 'error' ? 'text-red-900' : 'text-indigo-900'}`}>{alertModal.title}</h3>
                            </div>
                            <button onClick={() => setAlertModal({ ...alertModal, show: false })} className={`${alertModal.type === 'error' ? 'text-red-400 hover:text-red-600' : 'text-indigo-400 hover:text-indigo-600'}`}>
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="text-sm font-bold text-gray-600 leading-relaxed">
                                {alertModal.message}
                            </p>
                            <div className="mt-8 flex justify-end gap-3">
                                <button
                                    onClick={() => setAlertModal({ ...alertModal, show: false })}
                                    className="px-6 py-3 text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 rounded-xl transition-all"
                                >
                                    {alertModal.type === 'confirm' ? 'Cancel' : 'Ok, Got It'}
                                </button>
                                {alertModal.type === 'confirm' && (
                                    <button
                                        onClick={alertModal.onConfirm}
                                        className="px-6 py-3 text-xs font-black uppercase tracking-widest bg-red-600 text-white rounded-xl shadow-lg hover:bg-red-700 transition-all active:scale-95"
                                    >
                                        Delete
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
