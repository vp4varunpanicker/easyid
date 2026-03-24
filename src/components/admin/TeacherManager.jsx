import { useState, useEffect } from "react";
import { collection, query, where, getDocs, doc, updateDoc, addDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { Edit2, Save, X, Users, Trash2, Plus, Loader2 } from "lucide-react";

export default function TeacherManager() {
    const [teachers, setTeachers] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ assignedClassId: "" });

    useEffect(() => {
        const loadAllData = async () => {
            await Promise.all([fetchTeachers(), fetchClasses()]);
            setLoading(false);
        };
        loadAllData();
    }, []);

    const fetchClasses = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "classes"));
            const classList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setClasses(classList);
        } catch (err) { console.error(err); }
    };

    const fetchTeachers = async () => {
        try {
            const q = query(collection(db, "users"), where("role", "==", "teacher"));
            const querySnapshot = await getDocs(q);
            const teachersList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setTeachers(teachersList);
        } catch (error) {
            console.error("Error fetching teachers:", error);
        }
    };

    const handleEdit = (teacher) => {
        setEditingId(teacher.id);
        setEditForm({ assignedClassId: teacher.assignedClassId || "" });
    };

    const handleSave = async (id) => {
        try {
            const teacherRef = doc(db, "users", id);
            const assignedClass = classes.find(c => c.id === editForm.assignedClassId);
            const className = assignedClass ? `${assignedClass.name}-${assignedClass.section}` : "";

            await updateDoc(teacherRef, {
                assignedClassId: editForm.assignedClassId,
                assignedClass: className // Keep string for legacy/display compatibility
            });

            setTeachers(teachers.map(t =>
                t.id === id ? { ...t, assignedClassId: editForm.assignedClassId, assignedClass: className } : t
            ));
            setEditingId(null);
            alert("Teacher updated successfully!");
        } catch (error) {
            console.error("Error updating teacher:", error);
            alert("Failed to update teacher.");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to remove this teacher? This will NOT delete their account but will remove them from the list. (Admin action required for full deletion)")) return;
        try {
            await updateDoc(doc(db, "users", id), { role: 'user', assignedClass: '', assignedClassId: '' });
            setTeachers(teachers.filter(t => t.id !== id));
        } catch (err) {
            console.error(err);
        }
    };

    const handleCancel = () => {
        setEditingId(null);
    };


    if (loading) {
        return (
            <div className="flex justify-center items-center h-64 bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <span className="ml-2 text-gray-500">Loading teachers...</span>
            </div>
        );
    }

    return (
        <div className="max-w-5xl">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center">
                        <Users className="w-5 h-5 text-gray-500 mr-2" />
                        <h3 className="text-lg font-bold text-gray-900">Registered Teachers</h3>
                    </div>
                </div>

                <div className="p-6">


                    {teachers.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                            <Users className="mx-auto h-12 w-12 text-gray-300" />
                            <p className="mt-2 text-sm text-gray-500">No teachers found. Ask them to sign up!</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Name
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Email
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Phone
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Assigned Class
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {teachers.map((teacher) => (
                                        <tr key={teacher.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                                {teacher.name || <span className="text-gray-400 italic">Not set</span>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {teacher.email}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {teacher.phone || <span className="text-gray-400 italic">Not set</span>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {editingId === teacher.id ? (
                                                    <select
                                                        value={editForm.assignedClassId}
                                                        onChange={(e) => setEditForm({ ...editForm, assignedClassId: e.target.value })}
                                                        className="block w-full px-2 py-1 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
                                                        autoFocus
                                                    >
                                                        <option value="">Select a Class</option>
                                                        {classes.map(c => {
                                                            // Check if this class is taken by someone else
                                                            const isAssignedToOther = teachers.some(t => t.id !== teacher.id && t.assignedClassId === c.id);
                                                            if (isAssignedToOther) return null;
                                                            return (
                                                                <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
                                                            );
                                                        })}
                                                    </select>
                                                ) : (
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${teacher.assignedClass
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-yellow-100 text-yellow-800'
                                                        }`}>
                                                        {teacher.assignedClass || "Unassigned"}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                {editingId === teacher.id ? (
                                                    <div className="flex justify-end space-x-2">
                                                        <button
                                                            onClick={() => handleSave(teacher.id)}
                                                            className="text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded-md text-xs flex items-center transition-colors"
                                                        >
                                                            <Save className="w-3 h-3 mr-1" /> Save
                                                        </button>
                                                        <button
                                                            onClick={handleCancel}
                                                            className="text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-md text-xs flex items-center transition-colors"
                                                        >
                                                            <X className="w-3 h-3 mr-1" /> Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-end space-x-3">
                                                        <button
                                                            onClick={() => handleEdit(teacher)}
                                                            className="text-indigo-600 hover:text-indigo-900 flex items-center transition-colors"
                                                        >
                                                            <Edit2 className="w-4 h-4 mr-1" /> Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(teacher.id)}
                                                            className="text-red-600 hover:text-red-900 flex items-center transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4 mr-1" /> Remove
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
            </div>

        </div>
    );
}
