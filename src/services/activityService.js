
import { db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

/**
 * Types of activities:
 * - 'student': adding/editing/deleting students
 * - 'system': settings changes, SMTP, roles
 * - 'design': template changes, locking/unlocking
 * - 'user': user approvals, role assignments
 */

export const logActivity = async (type, message, userId = null, userName = 'System') => {
    try {
        await addDoc(collection(db, "activity"), {
            type,
            message,
            userId,
            userName,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Error logging activity:", error);
    }
};
