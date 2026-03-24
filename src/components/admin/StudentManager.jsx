
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, query, getDocs, addDoc, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { Plus, User, X, Download, Loader2, Phone, MapPin, Search, Filter, CheckCircle2, AlertCircle, Edit2, Eye, FileSpreadsheet, Upload } from "lucide-react";

import { getTemplates } from "../../services/idCardService";
import { downloadIDCardPDF, generateCardSide } from "../../utils/cardGenerator";
import PreviewModal from "./PreviewModal";
import ImageCropperModal from "../shared/ImageCropperModal";
import { logActivity } from "../../services/activityService";
import { useAuth } from "../../contexts/AuthContext";


export default function StudentManager() {
    const { currentUser } = useAuth();
    const [students, setStudents] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [classes, setClasses] = useState([]); // Master list from DB
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [generatingId, setGeneratingId] = useState(null);
    const [status, setStatus] = useState({ type: null, message: "" });
    const [searchTerm, setSearchTerm] = useState("");
    const [filterClass, setFilterClass] = useState("all");
    const [showAddForm, setShowAddForm] = useState(false);
    const [newStudent, setNewStudent] = useState({ name: '', address: '', emergencyContact: '', class: '', classId: '', photo: null, bloodGroup: '', fatherName: '', motherName: '' });
    const [editingStudent, setEditingStudent] = useState(null);
    const [showEditForm, setShowEditForm] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [previewingStudent, setPreviewingStudent] = useState(null);
    const [dynamicVars, setDynamicVars] = useState([]);
    const [fieldStatus, setFieldStatus] = useState({});
    
    // Cropper State
    const [cropImageSrc, setCropImageSrc] = useState(null);
    const [activeCropperType, setActiveCropperType] = useState(null); // 'add' or 'edit'


    useEffect(() => {
        const fetchData = async () => {
            try {
                const q = query(collection(db, "students"));
                const querySnapshot = await getDocs(q);
                const studentList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setStudents(studentList);

                const t = await getTemplates();
                setTemplates(t);

                const classesSnapshot = await getDocs(collection(db, "classes"));
                const classList = classesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setClasses(classList);

                const varsSnapshot = await getDocs(collection(db, "variables"));
                const allVars = varsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                const statusMap = {};
                allVars.forEach(v => {
                    statusMap[v.slug] = v.active !== false;
                });
                setFieldStatus(statusMap);

                // Only keep custom vars (non-system) in dynamicVars for the loop
                const systemSlugs = ['name', 'class', 'address', 'emergencyContact', 'bloodGroup', 'fatherName', 'motherName'];
                setDynamicVars(allVars.filter(v => !systemSlugs.includes(v.slug) && v.active !== false));
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const filteredStudents = students.filter(s => {
        const nameMatch = s.name ? s.name.toLowerCase().includes(searchTerm.toLowerCase()) : false;
        const classMatch = filterClass === "all" || s.class === filterClass;
        return nameMatch && classMatch;
    });

    // Simplified class listing for filters
    const filterClasses = [...new Set(students.map(s => s.class))].filter(Boolean);

    const isActive = (slug) => fieldStatus[slug] !== false;

    const isProfileComplete = (student) => {
        if (!student.name) return false;
        if (!student.photoUrl || student.photoUrl === '/default-avatar.svg') return false;
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

    const handleAddStudent = async (e) => {
        e.preventDefault();
        setUploading(true);
        try {
            let photoUrl = '/default-avatar.svg';

            if (newStudent.photo) {
                const formData = new FormData();
                formData.append('file', newStudent.photo);
                const response = await fetch('/api/upload', { method: 'POST', body: formData });
                if (response.ok) {
                    const data = await response.json();
                    photoUrl = data.url;
                }
            }

            const studentData = {
                ...newStudent,
                photoUrl: photoUrl,
                createdAt: new Date()
            };
            delete studentData.photo; // Don't save File object to Firestore

            const docRef = await addDoc(collection(db, "students"), studentData);
            setStudents([...students, { id: docRef.id, ...studentData }]);

            // Log Activity
            await logActivity('student', `Added student ${newStudent.name} to Class ${newStudent.class}`, currentUser?.uid, currentUser?.displayName || currentUser?.email);

            setNewStudent({ name: '', address: '', emergencyContact: '', class: '', classId: '', photo: null, bloodGroup: '', fatherName: '', motherName: '' });
            setCropImageSrc(null);
            setShowAddForm(false);
            setStatus({ type: 'success', message: "Student added successfully!" });
            setTimeout(() => setStatus({ type: null, message: "" }), 3000);
        } catch (err) {
            console.error(err);
            setStatus({ type: 'error', message: "Error: " + err.message });
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
                ...editingStudent,
                photoUrl: photoUrl,
                updatedAt: new Date()
            };
            delete studentData.photoFile;
            delete studentData.id; // Don't save ID inside the document data
            delete studentData.classId; // Usually not needed in document if we store name-section

            await updateDoc(doc(db, "students", editingStudent.id), studentData);
            setStudents(students.map(s => s.id === editingStudent.id ? { ...s, ...studentData } : s));

            // Log Activity
            await logActivity('student', `Updated student ${studentData.name} records`, currentUser?.uid, currentUser?.displayName || currentUser?.email);

            setShowEditForm(false);
            setEditingStudent(null);
            setStatus({ type: 'success', message: "Student updated!" });
            setTimeout(() => setStatus({ type: null, message: "" }), 3000);
        } catch (err) {
            console.error(err);
            setStatus({ type: 'error', message: "Error: " + err.message });
        } finally {
            setUploading(false);
        }
    };

    const handleEditClick = (student) => {
        const classObj = classes.find(c => `${c.name}-${c.section}` === student.class);
        setEditingStudent({
            ...student,
            classId: classObj ? classObj.id : '',
            photoFile: null
        });
        setShowEditForm(true);
    };

    const handleDeleteStudent = async (id) => {
        if (!window.confirm("Delete this student?")) return;
        try {
            await deleteDoc(doc(db, "students", id));
            setStudents(students.filter(s => s.id !== id));
            setStatus({ type: 'success', message: "Student deleted!" });
            setTimeout(() => setStatus({ type: null, message: "" }), 3000);
        } catch (err) {
            console.error(err);
        }
    };

    const downloadSingleCard = async (student) => {
        if (templates.length === 0) {
            setStatus({ type: 'error', message: "No ID Card Template found! Please create one in the Designer first." });
            setTimeout(() => setStatus({ type: null, message: "" }), 5000);
            return;
        }

        if (!templates[0].isLocked) {
            setStatus({ type: 'error', message: "Design Pending Approval. Waiting for confirmation." });
            setTimeout(() => setStatus({ type: null, message: "" }), 3000);
            return;
        }

        setGenerating(true);
        setGeneratingId(student.id);
        setStatus({ type: 'info', message: `Generating PDF for ${student.name}...` });

        try {
            const template = templates[0];
            const layout = typeof template.layout === 'string' ? JSON.parse(template.layout) : template.layout;

            await downloadIDCardPDF(student, layout);

            setStatus({ type: 'success', message: "PDF Downloaded!" });
            setTimeout(() => setStatus({ type: null, message: "" }), 3000);
        } catch (err) {
            console.error(err);
            setStatus({ type: 'error', message: "Failed to generate PDF. Check console." });
        } finally {
            setGenerating(false);
            setGeneratingId(null);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading students...</div>;

    const totalStudents = filteredStudents.length;
    const completedStudents = filteredStudents.filter(s => isProfileComplete(s)).length;
    const percentage = totalStudents === 0 ? 0 : Math.round((completedStudents / totalStudents) * 100);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Search & Actions */}
                <div className="lg:col-span-9 flex flex-col xl:flex-row items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100 h-full">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search students..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                    </div>
                    <div className="flex gap-2 w-full xl:w-auto">
                        <select
                            value={filterClass}
                            onChange={(e) => setFilterClass(e.target.value)}
                            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm font-medium flex-1 xl:flex-none xl:min-w-[150px]"
                        >
                            <option value="all">All Classes</option>
                            {filterClasses.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm whitespace-nowrap"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Student
                        </button>
                    </div>
                </div>

                {/* Data Completion */}
                <div className="lg:col-span-3 bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center gap-4 h-full">
                    <div>
                        <h3 className="text-sm font-black text-gray-900 tracking-tight uppercase">Student Data Completion</h3>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">
                            {completedStudents} / {totalStudents} Profiles Complete
                        </p>
                    </div>
                    <div className="w-full">
                        <div className="flex justify-between items-center mb-1.5">
                            <span className={`text-[9px] font-black uppercase tracking-widest ${percentage === 100 && totalStudents > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                {percentage === 100 && totalStudents > 0 ? 'All Complete' : 'In Progress'}
                            </span>
                            <span className="text-[9px] font-black text-gray-500">{percentage}%</span>
                        </div>
                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ${percentage === 100 && totalStudents > 0 ? 'bg-green-500' : 'bg-indigo-500'}`}
                                style={{ width: `${percentage}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredStudents.map(student => (
                    <div key={student.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-all group">
                        <div className="flex items-start gap-4">
                            <img
                                src={student.photoUrl || '/default-avatar.svg'}
                                onError={(e) => { e.target.onerror = null; e.target.src = '/default-avatar.svg'; }}
                                alt=""
                                className="w-14 h-14 rounded-xl object-cover bg-gray-50 border border-gray-100 shadow-sm"
                            />
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-black text-gray-900 truncate tracking-tight mb-0.5">{student.name}</h4>
                                <div className="flex flex-wrap gap-1 mb-2">
                                    <div className="inline-flex px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase tracking-widest rounded-md border border-indigo-100">Class {student.class}</div>
                                    {student.bloodGroup && (
                                        <div className="inline-flex px-1.5 py-0.5 bg-red-50 text-red-600 text-[8px] font-black uppercase tracking-widest rounded-md border border-red-100">{student.bloodGroup}</div>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center text-[10px] text-gray-500 font-bold tracking-tight">
                                        <Phone className="w-2.5 h-2.5 text-gray-400 mr-2" />
                                        {student.emergencyContact}
                                    </div>
                                    <div className="flex items-start text-[10px] text-gray-500 font-bold tracking-tight">
                                        <MapPin className="w-2.5 h-2.5 text-gray-400 mr-2 flex-shrink-0 mt-0.5" />
                                        <span className="truncate leading-tight">{student.address}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between items-center bg-gray-50/50 -mx-4 -mb-4 px-4 py-3 rounded-b-xl gap-2">
                            <div className="flex gap-2">
                                {templates.length > 0 && templates[0].isLocked && isProfileComplete(student) && (
                                    <button
                                        onClick={() => setPreviewingStudent(student)}
                                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-indigo-100"
                                        title="Preview ID Card"
                                    >
                                        <Eye className="w-5 h-5" />
                                    </button>
                                )}
                                {templates.length > 0 && templates[0].isLocked && isProfileComplete(student) && (
                                    <button
                                        onClick={() => downloadSingleCard(student)}
                                        disabled={generating}
                                        className={`p-2 transition-all rounded-xl shadow-sm border border-transparent ${generatingId === student.id ? 'text-indigo-600 bg-white animate-pulse' : 'text-gray-400 hover:text-green-600 hover:bg-white hover:border-green-100'}`}
                                        title="Download ID Card"
                                    >
                                        {generatingId === student.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleEditClick(student)}
                                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-indigo-100"
                                    title="Edit Student"
                                >
                                    <Edit2 className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => handleDeleteStudent(student.id)}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-red-100"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {showAddForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-900">Add New Student</h3>
                            <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleAddStudent} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            {isActive('name') && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Full Name</label>
                                    <input required type="text" value={newStudent.name} onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                {isActive('class') && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Class</label>
                                        <select
                                            required
                                            value={newStudent.classId}
                                            onChange={(e) => {
                                                const selectedClass = classes.find(c => c.id === e.target.value);
                                                setNewStudent({
                                                    ...newStudent,
                                                    classId: e.target.value,
                                                    class: selectedClass ? `${selectedClass.name}-${selectedClass.section}` : ''
                                                });
                                            }}
                                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        >
                                            <option value="">Select Class</option>
                                            {classes.map(c => (
                                                <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                {isActive('emergencyContact') && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Emergency No.</label>
                                        <input required type="text" value={newStudent.emergencyContact} onChange={(e) => setNewStudent({ ...newStudent, emergencyContact: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {isActive('bloodGroup') && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Blood Group</label>
                                        <input type="text" value={newStudent.bloodGroup} onChange={(e) => setNewStudent({ ...newStudent, bloodGroup: e.target.value })} placeholder="e.g. O+" className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                                    </div>
                                )}
                                {isActive('fatherName') && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Father's Name</label>
                                        <input type="text" value={newStudent.fatherName} onChange={(e) => setNewStudent({ ...newStudent, fatherName: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                                    </div>
                                )}
                            </div>
                            {isActive('motherName') && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Mother's Name</label>
                                    <input type="text" value={newStudent.motherName} onChange={(e) => setNewStudent({ ...newStudent, motherName: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                                </div>
                            )}

                            {/* DYNAMIC VARIABLES */}
                            {dynamicVars.length > 0 && (
                                <div className="pt-4 border-t border-gray-100 space-y-4">
                                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] ml-1">Additional Fields</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        {dynamicVars.map(v => {
                                            const isDateField = ['dateofbirth', 'dob', 'birthdate', 'date_of_birth'].includes(v.slug.toLowerCase());
                                            return (
                                                <div key={v.id}>
                                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                                                        {v.name}{isDateField && <span className="text-[9px] normal-case ml-1 text-gray-300">(DD/MM/YYYY)</span>}
                                                    </label>
                                                    <input
                                                        type={isDateField ? "date" : "text"}
                                                        value={newStudent[v.slug] || ''}
                                                        onChange={(e) => setNewStudent({ ...newStudent, [v.slug]: e.target.value })}
                                                        placeholder={isDateField ? "DD/MM/YYYY" : ""}
                                                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {isActive('address') && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Home Address</label>
                                    <textarea required value={newStudent.address} onChange={(e) => setNewStudent({ ...newStudent, address: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" rows="2" />
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Photo</label>
                                <div className="flex items-center gap-4">
                                    {newStudent.photo && (
                                        <div className="w-16 h-16 rounded-xl overflow-hidden border border-gray-100 flex-shrink-0 bg-gray-50">
                                            <img src={URL.createObjectURL(newStudent.photo)} className="w-full h-full object-cover" alt="Preview" />
                                        </div>
                                    )}
                                    <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'add')} className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                                </div>
                            </div>
                            <button disabled={uploading} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl mt-4 hover:bg-indigo-700 transition-all shadow-lg active:scale-95 disabled:opacity-50">
                                {uploading ? "Saving..." : "Add Student"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {showEditForm && editingStudent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
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
                                {isActive('class') && (
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Class</label>
                                        <select
                                            required
                                            value={editingStudent.classId}
                                            onChange={(e) => {
                                                const selectedClass = classes.find(c => c.id === e.target.value);
                                                setEditingStudent({
                                                    ...editingStudent,
                                                    classId: e.target.value,
                                                    class: selectedClass ? `${selectedClass.name}-${selectedClass.section}` : ''
                                                });
                                            }}
                                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold"
                                        >
                                            <option value="">Select Class</option>
                                            {classes.map(c => (
                                                <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                {isActive('emergencyContact') && (
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Emergency No.</label>
                                        <input required type="text" value={editingStudent.emergencyContact} onChange={(e) => setEditingStudent({ ...editingStudent, emergencyContact: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold" />
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {isActive('bloodGroup') && (
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Blood Group</label>
                                        <input type="text" value={editingStudent.bloodGroup || ''} onChange={(e) => setEditingStudent({ ...editingStudent, bloodGroup: e.target.value })} placeholder="e.g. O+" className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold" />
                                    </div>
                                )}
                                {isActive('fatherName') && (
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Father's Name</label>
                                        <input type="text" value={editingStudent.fatherName || ''} onChange={(e) => setEditingStudent({ ...editingStudent, fatherName: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold" />
                                    </div>
                                )}
                            </div>
                            {isActive('motherName') && (
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Mother's Name</label>
                                    <input type="text" value={editingStudent.motherName || ''} onChange={(e) => setEditingStudent({ ...editingStudent, motherName: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold" />
                                </div>
                            )}

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
                                        src={editingStudent.photoFile ? URL.createObjectURL(editingStudent.photoFile) : (editingStudent.photoUrl || '/default-avatar.svg')}
                                        onError={(e) => { e.target.onerror = null; e.target.src = '/default-avatar.svg'; }}
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
            )}

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

            {previewingStudent && templates[0] && (
                <PreviewModal
                    student={previewingStudent}
                    template={templates[0]}
                    onClose={() => setPreviewingStudent(null)}
                    students={students.filter(s => templates.length > 0 && templates[0].isLocked && isProfileComplete(s))}
                    currentIndex={students.filter(s => templates.length > 0 && templates[0].isLocked && isProfileComplete(s)).findIndex(s => s.id === previewingStudent.id)}
                    onNavigate={(newIndex) => {
                        const completeStudents = students.filter(s => templates.length > 0 && templates[0].isLocked && isProfileComplete(s));
                        if (newIndex >= 0 && newIndex < completeStudents.length) {
                            setPreviewingStudent(completeStudents[newIndex]);
                        }
                    }}
                />
            )}

            {status.message && (
                <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center px-6 py-3 rounded-2xl text-xs font-black shadow-2xl animate-in fade-in slide-in-from-bottom-5 z-[60] ${status.type === 'success' ? 'bg-indigo-600 text-white' :
                    status.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-800 text-white'
                    }`}>
                    {status.type === 'success' ? <CheckCircle2 className="w-4 h-4 mr-3" /> :
                        status.type === 'error' ? <AlertCircle className="w-4 h-4 mr-3" /> : <Loader2 className="w-4 h-4 mr-3 animate-spin" />}
                    {status.message.toUpperCase()}
                </div>
            )}
        </div>
    );
}
