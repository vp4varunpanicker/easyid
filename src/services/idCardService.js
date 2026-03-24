
import { db } from "../lib/firebase";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { logActivity } from "./activityService";

// Collection reference
const TEMPLATES_COLLECTION = "idCardTemplates";

export const saveTemplate = async (templateName, canvasJson, templateId = null) => {
    try {
        const data = {
            name: templateName,
            layout: JSON.stringify(canvasJson),
            updatedAt: new Date()
        };

        if (templateId) {
            await updateDoc(doc(db, TEMPLATES_COLLECTION, templateId), data);
            await logActivity('design', `Updated ID card template: ${templateName}`);
            return templateId;
        }

        // Fallback to name search if no ID (for legacy or first-time saves)
        const querySnapshot = await getDocs(collection(db, TEMPLATES_COLLECTION));
        const existingDoc = querySnapshot.docs.find(d => d.data().name === templateName);

        if (existingDoc) {
            await updateDoc(doc(db, TEMPLATES_COLLECTION, existingDoc.id), data);
            return existingDoc.id;
        } else {
            const docRef = await addDoc(collection(db, TEMPLATES_COLLECTION), {
                ...data,
                createdAt: new Date()
            });

            await logActivity('design', `Created new ID card template: ${templateName}`);
            return docRef.id;
        }
    } catch (error) {
        console.error("Error saving template: ", error);
        throw error;
    }
};

export const getTemplates = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, TEMPLATES_COLLECTION));
        const templates = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort by updatedAt descending so the newest is first
        return templates.sort((a, b) => {
            if (a.isDefault) return -1;
            if (b.isDefault) return 1;
            const dateA = a.updatedAt?.seconds || 0;
            const dateB = b.updatedAt?.seconds || 0;
            return dateB - dateA;
        });
    } catch (error) {
        console.error("Error fetching templates: ", error);
        throw error;
    }
};
export const setDefaultTemplate = async (templateId) => {
    try {
        const querySnapshot = await getDocs(collection(db, TEMPLATES_COLLECTION));

        // Reset all defaults first
        for (const docSnap of querySnapshot.docs) {
            if (docSnap.data().isDefault) {
                await updateDoc(doc(db, TEMPLATES_COLLECTION, docSnap.id), { isDefault: false });
            }
        }

        // Set new default
        await updateDoc(doc(db, TEMPLATES_COLLECTION, templateId), { isDefault: true });
    } catch (error) {
        console.error("Error setting default template: ", error);
        throw error;
    }
};

export const deleteTemplate = async (templateId) => {
    try {
        await deleteDoc(doc(db, TEMPLATES_COLLECTION, templateId));
    } catch (error) {
        console.error("Error deleting template: ", error);
        throw error;
    }
};

export const toggleTemplateLock = async (templateId, isLocked) => {
    try {
        await updateDoc(doc(db, TEMPLATES_COLLECTION, templateId), { isLocked });
        await logActivity('design', `${isLocked ? 'Locked' : 'Unlocked'} ID card template`);
    } catch (error) {
        console.error("Error toggling template lock: ", error);
        throw error;
    }
};
