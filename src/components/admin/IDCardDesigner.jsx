
import { useEffect, useRef, useState } from 'react';
import { Canvas, Rect, Circle, Textbox, FabricImage, Line, Group, Path } from 'fabric';
import { saveTemplate as saveTemplateService, getTemplates, setDefaultTemplate, deleteTemplate, toggleTemplateLock } from '../../services/idCardService';
import { doc, getDoc, collection, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import {
    Type, Square, Circle as CircleIcon, Image as ImageIcon, Save, MousePointer,
    Info, Layers, Loader2, RotateCw, Copy, GraduationCap,
    School, User, CreditCard, CheckCircle2, AlertCircle, Phone, MapPin,
    AlignLeft, AlignCenter, AlignRight, AlignStartVertical, AlignCenterVertical, AlignEndVertical,
    AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, Bold, Italic, Maximize2, Palette,
    Minimize2, Settings, Star, Trash2, List, Plus, Lock, Unlock,
    Eye, EyeOff, Shuffle, Undo, Redo
} from 'lucide-react';

// --- Override fabric.Rect to natively support individual border radii ---
const originalRectRender = Rect.prototype._render;
Rect.prototype._render = function (ctx) {
    if (this.customRx && Array.isArray(this.customRx)) {
        const w = this.width, h = this.height;
        const x = -w / 2, y = -h / 2;

        const maxRx = w / 2;
        const maxRy = h / 2;
        const tl = Math.max(0, Math.min(this.customRx[0], maxRx, maxRy));
        const tr = Math.max(0, Math.min(this.customRx[1], maxRx, maxRy));
        const br = Math.max(0, Math.min(this.customRx[2], maxRx, maxRy));
        const bl = Math.max(0, Math.min(this.customRx[3], maxRx, maxRy));

        const k = 0.5522847498307936; // Magic bezier constant for circular arcs

        ctx.beginPath();
        ctx.moveTo(x + tl, y);
        ctx.lineTo(x + w - tr, y);
        if (tr > 0) ctx.bezierCurveTo(x + w - k * tr, y, x + w, y + k * tr, x + w, y + tr);
        else ctx.lineTo(x + w, y);

        ctx.lineTo(x + w, y + h - br);
        if (br > 0) ctx.bezierCurveTo(x + w, y + h - k * br, x + w - k * br, y + h, x + w - br, y + h);
        else ctx.lineTo(x + w, y + h);

        ctx.lineTo(x + bl, y + h);
        if (bl > 0) ctx.bezierCurveTo(x + k * bl, y + h, x, y + h - k * bl, x, y + h - bl);
        else ctx.lineTo(x, y + h);

        ctx.lineTo(x, y + tl);
        if (tl > 0) ctx.bezierCurveTo(x, y + k * tl, x + k * tl, y, x + tl, y);
        else ctx.lineTo(x, y);

        ctx.closePath();
        this._renderPaintInOrder(ctx);
    } else {
        originalRectRender.call(this, ctx);
    }
};

const FONTS = [
    'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat',
    'Oswald', 'Raleway', 'Arial', 'Verdana', 'Georgia',
    'Courier New', 'Impact'
];

const SERIALIZE_PROPS = [
    'name', 'selectable', 'evented', 'rx', 'ry', 'customRx',
    'stroke', 'strokeWidth', 'clipPath', 'originY',
    'lockMovementX', 'lockMovementY', 'lockRotation',
    'lockScalingX', 'lockScalingY', 'hasControls',
    'opacity'
];

export default function IDCardDesigner({ isExpanded, onToggleExpand }) {
    const canvasRef = useRef(null);
    const [fabricCanvas, setFabricCanvas] = useState(null);
    const [templateId, setTemplateId] = useState(null);
    const [templateName, setTemplateName] = useState('My ID Card Template');
    const [isLocked, setIsLocked] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState({ type: null, message: "" });
    const [activeObject, setActiveObject] = useState(null);
    const [activeProps, setActiveProps] = useState({}); // Stores snapshot of properties for UI
    const [activeSide, setActiveSide] = useState('front');
    const [isDoubleSided, setIsDoubleSided] = useState(true);
    const [layouts, setLayouts] = useState({ front: null, back: null });
    const [institutionDetails, setInstitutionDetails] = useState(null);
    const [bgColor, setBgColor] = useState('#f3f4f6');
    const [showControls, setShowControls] = useState(true);
    const [dynamicVars, setDynamicVars] = useState([]);
    const [fieldStatus, setFieldStatus] = useState({});
    const [savedTemplates, setSavedTemplates] = useState([]);
    const [showTemplates, setShowTemplates] = useState(false);
    const [layers, setLayers] = useState([]);
    const [sidebarTab, setSidebarTab] = useState('editor'); // 'editor' or 'library'
    const [previewMode, setPreviewMode] = useState(false);
    const [previewStudent, setPreviewStudent] = useState(null);

    const isLockedRef = useRef(isLocked);
    const previewModeRef = useRef(previewMode);

    useEffect(() => {
        isLockedRef.current = isLocked;
        previewModeRef.current = previewMode;
    }, [isLocked, previewMode]);
    const [completedStudents, setCompletedStudents] = useState([]);
    const [contextMenu, setContextMenu] = useState(null);
    const [adjustedMenuPos, setAdjustedMenuPos] = useState({ x: 0, y: 0 });
    const contextMenuRef = useRef(null);
    const [isMenuVisible, setIsMenuVisible] = useState(false);

    // Close context menu on any global click
    useEffect(() => {
        const handleClickOutside = () => setContextMenu(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    // Adjust context menu position to stay within viewport
    useEffect(() => {
        if (contextMenu) {
            // Give DOM a moment to render so we can measure
            setIsMenuVisible(false); // Hide while calculating to avoid flicker
            requestAnimationFrame(() => {
                let { x, y } = contextMenu;
                if (contextMenuRef.current) {
                    const rect = contextMenuRef.current.getBoundingClientRect();
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;
                    const padding = 10;

                    if (x + rect.width > viewportWidth - padding) {
                        x = viewportWidth - rect.width - padding;
                    }
                    if (y + rect.height > viewportHeight - padding) {
                        y = viewportHeight - rect.height - padding;
                    }

                    setAdjustedMenuPos({ x, y });
                    setIsMenuVisible(true);
                }
            });
        } else {
            setIsMenuVisible(false);
        }
    }, [contextMenu]);

    // Undo/Redo State
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const historyRef = useRef([]);
    const historyIndexRef = useRef(-1);
    const isHistoryProcessing = useRef(false);

    const { userRole } = useAuth();

    // History tracking function
    const saveHistoryState = (canvas = fabricCanvas) => {
        if (!canvas || isHistoryProcessing.current) return;

        try {
            const json = canvas.toObject(SERIALIZE_PROPS);
            const jsonString = JSON.stringify(json);

            const prev = historyRef.current;
            const currentIndex = historyIndexRef.current;

            const newHistory = prev.slice(0, currentIndex + 1);

            if (newHistory.length > 0 && newHistory[newHistory.length - 1] === jsonString) {
                return;
            }

            if (newHistory.length >= 50) {
                newHistory.shift();
            }

            newHistory.push(jsonString);

            // Update state
            setHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);

            // Update refs immediately to avoid race conditions in fast events
            historyRef.current = newHistory;
            historyIndexRef.current = newHistory.length - 1;
        } catch (err) {
            console.error("Failed to save history state:", err);
        }
    };

    // Helper to restore custom border radii after JSON load
    const restoreCustomRx = (canvas) => {
        if (!canvas) return;

        const processObject = (obj) => {
            if (!obj) return;

            // Get effective radius array
            const rxArray = obj.customRx || (obj.rx ? [obj.rx, obj.rx, obj.rx, obj.rx] : null);

            if (rxArray) {
                const isUniform = rxArray.every(r => r === rxArray[0]);

                if (isUniform) {
                    const uniformRx = rxArray[0];
                    if (obj.type === 'rect' || obj.name === 'preview_border') {
                        obj.set({ rx: uniformRx, ry: uniformRx, clipPath: null, customRx: rxArray });
                    } else if (obj.type === 'image' || obj.type === 'FabricImage' || obj.name === 'preview_photo') {
                        obj.set('clipPath', new Rect({ width: obj.width, height: obj.height, rx: uniformRx, ry: uniformRx, originX: 'center', originY: 'center', left: 0, top: 0 }));
                        obj.set({ customRx: rxArray });
                    }
                } else {
                    if (obj.type === 'rect' || obj.name === 'preview_border') {
                        obj.set({ rx: 0, ry: 0, clipPath: null, customRx: rxArray });
                    } else if (obj.type === 'image' || obj.type === 'FabricImage' || obj.name === 'preview_photo') {
                        const w = obj.width, h = obj.height;
                        const r = rxArray.map(rad => Math.max(0.001, Math.min(rad, w / 2, h / 2)));
                        const x = -w / 2, y = -h / 2;
                        const pathStr = `M ${x + r[0]} ${y} L ${x + w - r[1]} ${y} A ${r[1]} ${r[1]} 0 0 1 ${x + w} ${y + r[1]} L ${x + w} ${y + h - r[2]} A ${r[2]} ${r[2]} 0 0 1 ${x + w - r[2]} ${y + h} L ${x + r[3]} ${y + h} A ${r[3]} ${r[3]} 0 0 1 ${x} ${y + h - r[3]} L ${x} ${y + r[0]} A ${r[0]} ${r[0]} 0 0 1 ${x + r[0]} ${y} Z`;
                        obj.set({ clipPath: new Path(pathStr, { originX: 'center', originY: 'center', left: 0, top: 0 }), customRx: rxArray });
                    }
                }
                obj.dirty = true;
            }

            // Recurse into groups
            if (obj.getObjects && obj.type === 'group') {
                obj.getObjects().forEach(processObject);
            }
        };

        canvas.getObjects().forEach(processObject);
        canvas.requestRenderAll();
    };

    // Undo / Redo execution
    const handleUndo = async () => {
        const currentIndex = historyIndexRef.current;
        if (currentIndex <= 0 || !fabricCanvas || isHistoryProcessing.current) return;

        const previousState = historyRef.current[currentIndex - 1];
        if (!previousState) return;

        isHistoryProcessing.current = true;
        try {
            await fabricCanvas.loadFromJSON(JSON.parse(previousState));
            restoreCustomRx(fabricCanvas);

            fabricCanvas.getObjects().forEach(obj => {
                obj.set({ objectCaching: false });
                if (obj.selectable === false || obj.lockMovementX === true) {
                    obj.set({
                        selectable: obj.selectable,
                        evented: obj.evented,
                        lockMovementX: true,
                        lockMovementY: true,
                        lockRotation: true,
                        lockScalingX: true,
                        lockScalingY: true,
                        hasControls: false
                    });
                }
            });

            fabricCanvas.requestRenderAll();
            setHistoryIndex(currentIndex - 1);
            historyIndexRef.current = currentIndex - 1;
        } finally {
            isHistoryProcessing.current = false;
        }
    };

    const handleRedo = async () => {
        const currentIndex = historyIndexRef.current;
        if (currentIndex >= historyRef.current.length - 1 || !fabricCanvas || isHistoryProcessing.current) return;

        const nextState = historyRef.current[currentIndex + 1];
        if (!nextState) return;

        isHistoryProcessing.current = true;
        try {
            await fabricCanvas.loadFromJSON(JSON.parse(nextState));
            restoreCustomRx(fabricCanvas);

            fabricCanvas.getObjects().forEach(obj => {
                obj.set({ objectCaching: false });
                if (obj.selectable === false || obj.lockMovementX === true) {
                    obj.set({
                        selectable: obj.selectable,
                        evented: obj.evented,
                        lockMovementX: true,
                        lockMovementY: true,
                        lockRotation: true,
                        lockScalingX: true,
                        lockScalingY: true,
                        hasControls: false
                    });
                }
            });

            fabricCanvas.requestRenderAll();
            setHistoryIndex(currentIndex + 1);
            historyIndexRef.current = currentIndex + 1;
        } finally {
            isHistoryProcessing.current = false;
        }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

            const activeObj = fabricCanvas?.getActiveObject();

            // Undo / Redo Shortcuts
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    handleRedo();
                } else {
                    handleUndo();
                }
                return;
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                handleRedo();
                return;
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (activeObj) {
                    fabricCanvas.remove(activeObj);
                    fabricCanvas.discardActiveObject();
                    fabricCanvas.requestRenderAll();
                }
            } else if ((e.ctrlKey || e.metaKey) && (e.code === 'BracketRight' || e.code === 'BracketLeft' || ['[', ']', '{', '}'].includes(e.key) || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                if (!activeObj) return;
                e.preventDefault();

                const isForward = e.code === 'BracketRight' || e.key === ']' || e.key === '}' || e.key === 'ArrowUp';
                const isBackward = e.code === 'BracketLeft' || e.key === '[' || e.key === '{' || e.key === 'ArrowDown';

                if (activeObj.type === 'activeSelection') {
                    const objects = activeObj.getObjects();
                    if (isForward) {
                        objects.forEach(obj => {
                            if (e.shiftKey) fabricCanvas.bringObjectToFront(obj);
                            else fabricCanvas.bringObjectForward(obj);
                        });
                    } else if (isBackward) {
                        [...objects].reverse().forEach(obj => {
                            if (e.shiftKey) fabricCanvas.sendObjectToBack(obj);
                            else fabricCanvas.sendObjectBackwards(obj);
                        });
                    }
                } else {
                    if (isForward) {
                        if (e.shiftKey) fabricCanvas.bringObjectToFront(activeObj);
                        else fabricCanvas.bringObjectForward(activeObj);
                    } else if (isBackward) {
                        if (e.shiftKey) fabricCanvas.sendObjectToBack(activeObj);
                        else fabricCanvas.sendObjectBackwards(activeObj);
                    }
                }

                // Ensure centerLine remains on top if active
                const centerLine = fabricCanvas.getObjects().find(o => o.id === 'centerLine');
                if (centerLine) fabricCanvas.bringObjectToFront(centerLine);

                fabricCanvas.fire('object:modified', { target: activeObj });
                fabricCanvas.requestRenderAll();
            } else if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.key.toLowerCase() === 'c') {
                if (!activeObj || activeObj.isEditing) return;
                e.preventDefault();
                activeObj.centerH();
                activeObj.setCoords();
                fabricCanvas.requestRenderAll();
                setActiveProps(prev => ({ ...prev, left: Math.round(activeObj.left) }));
            } else if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.key.toLowerCase() === 'e') {
                if (!activeObj || activeObj.isEditing) return;
                e.preventDefault();
                activeObj.centerV();
                activeObj.setCoords();
                fabricCanvas.requestRenderAll();
                setActiveProps(prev => ({ ...prev, top: Math.round(activeObj.top) }));
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
                if (!activeObj || !(activeObj.type === 'textbox' || activeObj.type === 'text')) return;
                e.preventDefault();
                const weight = activeObj.fontWeight === 'bold' ? 'normal' : 'bold';
                activeObj.set('fontWeight', weight);
                fabricCanvas.requestRenderAll();
                setActiveProps(prev => ({ ...prev, fontWeight: weight }));
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
                if (!activeObj || !(activeObj.type === 'textbox' || activeObj.type === 'text')) return;
                e.preventDefault();
                const style = activeObj.fontStyle === 'italic' ? 'normal' : 'italic';
                activeObj.set('fontStyle', style);
                fabricCanvas.requestRenderAll();
                setActiveProps(prev => ({ ...prev, fontStyle: style }));
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
                if (!activeObj || activeObj.type === 'activeSelection') return;
                e.preventDefault();
                activeObj.clone().then(cloned => {
                    cloned.set({ left: cloned.left + 10, top: cloned.top + 10, evented: true });
                    fabricCanvas.add(cloned);
                    fabricCanvas.setActiveObject(cloned);
                    fabricCanvas.requestRenderAll();
                });
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
                if (!activeObj) return;
                e.preventDefault();
                if (e.shiftKey) {
                    if (activeObj.type === 'group') {
                        activeObj.toActiveSelection();
                        fabricCanvas.requestRenderAll();
                    }
                } else {
                    if (activeObj.type === 'activeSelection') {
                        activeObj.toGroup();
                        fabricCanvas.requestRenderAll();
                    }
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
                if (!activeObj) return;
                e.preventDefault();
                const isLocked = activeObj.lockMovementX;
                activeObj.set({
                    selectable: true,
                    evented: true,
                    lockMovementX: !isLocked,
                    lockMovementY: !isLocked,
                    lockRotation: !isLocked,
                    lockScalingX: !isLocked,
                    lockScalingY: !isLocked,
                    hasControls: isLocked
                });
                fabricCanvas.requestRenderAll();
            } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                if (!activeObj || e.ctrlKey || e.metaKey) return;

                // Prevent browser scrolling
                e.preventDefault();

                const nudge = e.shiftKey ? 10 : 1;

                switch (e.key) {
                    case 'ArrowLeft':
                        activeObj.set('left', activeObj.left - nudge);
                        break;
                    case 'ArrowRight':
                        activeObj.set('left', activeObj.left + nudge);
                        break;
                    case 'ArrowUp':
                        activeObj.set('top', activeObj.top - nudge);
                        break;
                    case 'ArrowDown':
                        activeObj.set('top', activeObj.top + nudge);
                        break;
                }

                activeObj.setCoords();
                fabricCanvas.requestRenderAll();
                // Sync properties for UI
                setActiveProps(prev => ({
                    ...prev,
                    left: Math.round(activeObj.left),
                    top: Math.round(activeObj.top)
                }));
            }

            if (e.key === 'Escape' && isExpanded) {
                onToggleExpand();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [fabricCanvas, isExpanded, history, historyIndex]);

    useEffect(() => {
        if (fabricCanvas) {
            // Give layout a moment to settle
            setTimeout(() => {
                fabricCanvas.requestRenderAll();
                fabricCanvas.calcOffset();
            }, 100);
        }
    }, [fabricCanvas, isExpanded]);

    useEffect(() => {
        const fetchDynamicVars = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, "variables"));
                const allVars = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                const statusMap = {};
                allVars.forEach(v => {
                    statusMap[v.slug] = v.active !== false;
                });
                setFieldStatus(statusMap);

                const systemSlugs = ['name', 'class', 'address', 'emergencyContact', 'bloodGroup', 'fatherName', 'motherName'];
                setDynamicVars(allVars.filter(v => !systemSlugs.includes(v.slug) && v.active !== false));
            } catch (err) {
                console.error("Error fetching variables:", err);
            }
        };
        fetchDynamicVars();
    }, []);

    // 1. Live Institution Details Listener
    useEffect(() => {
        const institutionRef = doc(db, "schools", "main");
        const unsub = onSnapshot(institutionRef, (snap) => {
            if (snap.exists()) setInstitutionDetails(snap.data());
        }, (err) => console.error("Institution sync error:", err));

        return () => unsub();
    }, []);

    // 2. Automatic Canvas Branding Sync
    useEffect(() => {
        if (!fabricCanvas || !institutionDetails || loading || previewMode) return;

        const syncBranding = async () => {
            const objects = fabricCanvas.getObjects();
            let needsRender = false;

            for (const obj of objects) {
                // Skip if it's a student preview object
                if (obj.name && obj.name.startsWith('preview_')) continue;

                // 1. Sync & Tag School Name
                if (obj.type === 'textbox' || obj.type === 'text') {
                    const isSchoolName = obj.name === 'school_name';
                    // If it's tagged OR exactly matches current school name, keep it updated
                    if (isSchoolName && obj.text !== institutionDetails.name) {
                        obj.set({ text: institutionDetails.name });
                        needsRender = true;
                    }
                }

                // 2. Sync & Tag School Address
                if (obj.type === 'textbox' || obj.type === 'text') {
                    const isSchoolAddr = obj.name === 'school_address';
                    if (isSchoolAddr && obj.text !== institutionDetails.address) {
                        obj.set({ text: institutionDetails.address });
                        needsRender = true;
                    }
                }

                // 2b. Sync & Tag School Phone
                if (obj.type === 'textbox' || obj.type === 'text') {
                    const isSchoolPhone = obj.name === 'school_phone';
                    if (isSchoolPhone && obj.text !== institutionDetails.phone) {
                        obj.set({ text: institutionDetails.phone });
                        needsRender = true;
                    }
                }

                // 2c. Sync & Tag School Email
                if (obj.type === 'textbox' || obj.type === 'text') {
                    const isSchoolEmail = obj.name === 'school_email';
                    if (isSchoolEmail && obj.text !== institutionDetails.email) {
                        obj.set({ text: institutionDetails.email });
                        needsRender = true;
                    }
                }

                // 3. Sync & Tag Institution Logo
                if (obj.name === 'school_logo' && institutionDetails.logoUrl) {
                    if (obj._currentUrl !== institutionDetails.logoUrl) {
                        try {
                            const oldIndex = fabricCanvas.getObjects().indexOf(obj);
                            const oldState = obj.toObject(SERIALIZE_PROPS);
                            delete oldState.type;
                            delete oldState.version;
                            delete oldState.src;
                            delete oldState.crossOrigin;

                            const newImg = await FabricImage.fromURL(institutionDetails.logoUrl, { crossOrigin: 'anonymous' });
                            newImg.set({
                                ...oldState,
                                _currentUrl: institutionDetails.logoUrl,
                                objectCaching: false
                            });
                            fabricCanvas.remove(obj);
                            fabricCanvas.add(newImg);
                            if (fabricCanvas.moveObjectTo && oldIndex !== -1) {
                                fabricCanvas.moveObjectTo(newImg, oldIndex);
                            }
                            needsRender = true;
                        } catch (e) {
                            console.error("Failed to auto-update institution logo:", e);
                        }
                    }
                }

                // 4. Sync & Tag Authorized Signature
                if (obj.name === 'school_signature' && institutionDetails.signatureUrl) {
                    if (obj._currentUrl !== institutionDetails.signatureUrl) {
                        try {
                            const oldIndex = fabricCanvas.getObjects().indexOf(obj);
                            const oldState = obj.toObject(SERIALIZE_PROPS);
                            delete oldState.type;
                            delete oldState.version;
                            delete oldState.src;
                            delete oldState.crossOrigin;

                            const newImg = await FabricImage.fromURL(institutionDetails.signatureUrl, { crossOrigin: 'anonymous' });
                            newImg.set({
                                ...oldState,
                                _currentUrl: institutionDetails.signatureUrl,
                                objectCaching: false
                            });
                            fabricCanvas.remove(obj);
                            fabricCanvas.add(newImg);
                            if (fabricCanvas.moveObjectTo && oldIndex !== -1) {
                                fabricCanvas.moveObjectTo(newImg, oldIndex);
                            }
                            needsRender = true;
                        } catch (e) {
                            console.error("Failed to auto-update institution signature:", e);
                        }
                    }
                }
            }

            if (needsRender) {
                fabricCanvas.requestRenderAll();
            }
        };

        syncBranding();
    }, [institutionDetails, fabricCanvas, loading, previewMode]);

    const isActive = (type) => {
        const mapping = {
            'name': 'name',
            'class': 'class',
            'contact': 'emergencyContact',
            'address': 'address',
            'blood': 'bloodGroup',
            'father': 'fatherName',
            'mother': 'motherName'
        };
        const slug = mapping[type] || type;
        return fieldStatus[slug] !== false;
    };

    useEffect(() => {
        if (canvasRef.current && !fabricCanvas) {
            const canvas = new Canvas(canvasRef.current, {
                height: 507,
                width: 320,
                backgroundColor: bgColor,
                preserveObjectStacking: true,
                selection: true,
                selectionColor: 'rgba(99, 102, 241, 0.15)', // Indigo-500 with opacity
                selectionBorderColor: '#6366f1',
                selectionLineWidth: 1,
                fireRightClick: true,
                stopContextMenu: true,
                enableRetinaScaling: true,
                imageSmoothingEnabled: true
            });
            setFabricCanvas(canvas);

            // Set initially based on lock state
            canvas.selection = !isLockedRef.current && !previewModeRef.current;

            // Fix blurry scaling and pixelation
            canvas.on('object:added', (e) => {
                if (e.target) {
                    e.target.set({ objectCaching: false });
                }
            });

            let centerLine = null;

            canvas.on('object:moving', (e) => {
                const obj = e.target;
                const canvasCenter = canvas.width / 2;
                const objCenter = obj.getCenterPoint().x;

                if (Math.abs(objCenter - canvasCenter) < 10) {
                    // Force center by coordinates
                    if (obj.originX === 'center') {
                        obj.set({ left: canvasCenter });
                    } else {
                        obj.set({ left: canvasCenter - (obj.getScaledWidth() / 2) });
                    }
                    obj.setCoords();

                    if (!centerLine) {
                        centerLine = new Line([canvasCenter, 0, canvasCenter, canvas.height], {
                            stroke: '#6366f1',
                            strokeWidth: 2,
                            selectable: false,
                            evented: false,
                            name: 'centerLine',
                            opacity: 0.5
                        });
                        canvas.add(centerLine);
                        canvas.bringObjectToFront(centerLine);
                    }
                } else {
                    if (centerLine) {
                        canvas.remove(centerLine);
                        centerLine = null;
                    }
                }
            });

            canvas.on('object:rotating', (e) => {
                const obj = e.target;
                let angle = obj.angle % 360;
                if (angle < 0) angle += 360;

                const snapPoints = [0, 90, 180, 270, 360];
                const threshold = 5;
                let snapped = false;

                for (let point of snapPoints) {
                    if (Math.abs(angle - point) < threshold) {
                        const targetAngle = point === 360 ? 0 : point;
                        obj.set('angle', targetAngle);
                        snapped = true;

                        // Temporary visual feedback in status - throttled by the fact it only happens near snap
                        setStatus({ type: 'info', message: `Snapped to ${targetAngle}°` });
                        setTimeout(() => setStatus({ type: null, message: '' }), 1500);
                        break;
                    }
                }

                if (!snapped) {
                    // Update UI props during rotation so the number changes live
                    setActiveProps(prev => ({ ...prev, angle: Math.round(angle) }));
                }
            });

            canvas.on('mouse:move', (e) => {
                if (centerLine && centerLine.visible) {
                    centerLine.set({ visible: false });
                    canvas.requestRenderAll();
                }
            });

            canvas.on('mouse:up', () => {
                if (centerLine) {
                    canvas.remove(centerLine);
                    centerLine = null;
                    canvas.requestRenderAll();
                }
            });

            // Prevent context menu and selection if locked
            canvas.on('mouse:down:before', (e) => {
                if (isLockedRef.current) {
                    canvas.selection = false;
                }
            });

            canvas.on('mouse:down', (e) => {
                if (isLockedRef.current && !previewModeRef.current) {
                    setContextMenu(null);
                    canvas.discardActiveObject();
                    canvas.requestRenderAll();
                    return; // Stop further processing for mouse down events
                }

                // In Fabric v7, e.button is not reliable, use e.e.button === 2 for right click
                if (e.e && e.e.button === 2) {
                    e.e.preventDefault(); // Prevent browser context menu
                    let target = e.target;

                    if (target) {
                        const activeObjects = canvas.getActiveObjects();
                        if (activeObjects.length > 1 && activeObjects.includes(target)) {
                            target = canvas.getActiveObject();
                        } else {
                            canvas.setActiveObject(target);
                        }

                        setContextMenu({
                            x: e.e.clientX,
                            y: e.e.clientY,
                            target: target
                        });
                    }
                } else {
                    setContextMenu(null);
                }
            });

            const syncLayers = () => {
                const objs = canvas.getObjects().filter(o => o.name !== 'centerLine');
                // Reverse for stack order (top-most first)
                setLayers([...objs].reverse());
            };

            canvas.on('object:added', (e) => {
                syncLayers();
                if (e.target && e.target.name !== 'centerLine' && !e.target.name?.startsWith('preview_')) {
                    saveHistoryState(canvas);
                }
            });
            canvas.on('object:removed', (e) => {
                syncLayers();
                if (e.target && e.target.name !== 'centerLine' && !e.target.name?.startsWith('preview_')) {
                    saveHistoryState(canvas);
                }
            });
            canvas.on('selection:created', (e) => {
                if (isLockedRef.current && !previewModeRef.current) {
                    canvas.discardActiveObject();
                    return;
                }
                syncActiveObject(canvas.getActiveObject());
            });
            canvas.on('selection:updated', () => {
                if (isLockedRef.current && !previewModeRef.current) {
                    canvas.discardActiveObject();
                    return;
                }
                syncActiveObject(canvas.getActiveObject());
            });
            canvas.on('selection:cleared', () => {
                setActiveObject(null);
                setActiveProps({});
            });
            canvas.on('object:modified', (e) => {
                if (isLockedRef.current) return;
                syncLayers();
                saveHistoryState(canvas);
                syncActiveObject(canvas.getActiveObject());
            });
            canvas.on('selection:cleared', syncLayers); // Just to be sure

            const syncActiveObject = (obj) => {
                if (!obj) return;
                setActiveObject(obj);

                // Extract properties with priority: 
                // 1. Root object properties
                // 2. Inner object properties (if group)
                // 3. ClipPath properties (for image rx)

                const getProp = (p, def) => {
                    if (obj[p] !== undefined && obj[p] !== null) return obj[p];
                    if (obj.getObjects) {
                        const inner = obj.getObjects('rect')[0] || obj.getObjects()[0];
                        if (inner && inner[p] !== undefined) return inner[p];
                    }
                    return def;
                };

                let rx = obj.customRx !== undefined ? obj.customRx : getProp('rx', 0);
                if ((rx === 0 || (Array.isArray(rx) && rx.every(v => v === 0))) && obj.clipPath && obj.clipPath.rx) {
                    rx = obj.clipPath.rx;
                }

                // Ensure rx is always in a consistent format for the UI (array of 4)
                const rxArray = Array.isArray(rx) ? rx : [rx, rx, rx, rx];

                setActiveProps({
                    fontSize: obj.fontSize || 18,
                    fontFamily: obj.fontFamily || 'Inter',
                    textAlign: obj.textAlign || 'center',
                    fill: obj.fill || '#000000',
                    fontWeight: obj.fontWeight || 'normal',
                    fontStyle: obj.fontStyle || 'normal',
                    opacity: obj.opacity !== undefined ? obj.opacity : 1,
                    strokeWidth: obj.strokeWidth || 0,
                    stroke: obj.stroke || '#000000',
                    rx: rxArray,
                    angle: obj.angle || 0,
                    left: Math.round(obj.left),
                    top: Math.round(obj.top)
                });
            };

            // (Object tracking sync is handled in the modified event above)
            const updateActive = () => {
                const activeObject = canvas.getActiveObject();
                if (activeObject) {
                    syncActiveObject(activeObject);
                } else {
                    setActiveObject(null);
                    setActiveProps({});
                }
            };

            canvas.on('selection:created', updateActive);
            canvas.on('selection:updated', updateActive);
            canvas.on('selection:cleared', updateActive);
            canvas.on('object:modified', () => {
                updateActive();
                saveHistoryState(canvas);
            });

            return () => { canvas.dispose(); };
        }
    }, [canvasRef]);

    useEffect(() => {
        const loadInitialData = async () => {
            if (!fabricCanvas) return;
            try {
                setLoading(true);
                // School details are now handled by live listener

                const templatesList = await getTemplates();
                setSavedTemplates(templatesList);

                if (templatesList && templatesList.length > 0) {
                    // Prioritize default template
                    const defaultTemplate = templatesList.find(t => t.isDefault);
                    const latest = defaultTemplate || templatesList[0];

                    setTemplateId(latest.id);
                    setTemplateName(latest.name);
                    setIsLocked(latest.isLocked || false);
                    if (latest.layout) {
                        const parsed = JSON.parse(latest.layout);
                        setLayouts(parsed);
                        setIsDoubleSided(parsed.isDoubleSided !== undefined ? parsed.isDoubleSided : true);
                        const sideLayout = parsed[activeSide] || parsed.front || parsed;

                        isHistoryProcessing.current = true;
                        try {
                            await fabricCanvas.loadFromJSON(sideLayout);
                            restoreCustomRx(fabricCanvas);
                            // Manually enforce lock states after load to ensure Fabric v7 respects them
                            fabricCanvas.getObjects().forEach(obj => {
                                obj.set({ objectCaching: false });
                                if (obj.selectable === false || obj.lockMovementX === true) {
                                    obj.set({
                                        selectable: obj.selectable,
                                        evented: obj.evented,
                                        lockMovementX: true,
                                        lockMovementY: true,
                                        lockRotation: true,
                                        lockScalingX: true,
                                        lockScalingY: true,
                                        hasControls: false
                                    });
                                }
                            });
                            if (fabricCanvas.backgroundColor) setBgColor(fabricCanvas.backgroundColor);
                            fabricCanvas.requestRenderAll();
                            setPreviewMode(false);
                            setPreviewStudent(null);
                            setHistory([]);
                            setHistoryIndex(-1);
                            historyRef.current = [];
                            historyIndexRef.current = -1;

                            // Wait a tiny bit before tracking history to clear any lagging async image added events
                            setTimeout(() => {
                                if (isHistoryProcessing.current) isHistoryProcessing.current = false;
                                saveHistoryState();
                            }, 100);
                        } catch (e) {
                            isHistoryProcessing.current = false;
                            throw e;
                        }
                    }
                }
            } catch (err) { console.error(err); } finally { setLoading(false); }
        };
        loadInitialData();
    }, [fabricCanvas]);

    useEffect(() => {
        if (fabricCanvas) {
            const isReadonly = isLocked || previewMode;
            fabricCanvas.selection = !isReadonly;
            fabricCanvas.defaultCursor = isReadonly ? 'no-drop' : 'default';
            
            // Sync all objects' hover cursor to match the readonly state
            fabricCanvas.getObjects().forEach(obj => {
                // Skip centerLine or internal preview objects if necessary, 
                // but generally everything should show no-drop if readonly
                obj.hoverCursor = isReadonly ? 'no-drop' : (obj.selectable ? 'move' : 'default');
            });

            if (isReadonly) {
                fabricCanvas.discardActiveObject();
            }
            fabricCanvas.requestRenderAll();
        }
    }, [isLocked, previewMode, fabricCanvas]);

    const handleNewDesign = () => {
        if (fabricCanvas) {
            if (window.confirm("Start a new design? Current unsaved changes will be lost.")) {
                fabricCanvas.clear();
                fabricCanvas.set({ backgroundColor: '#f3f4f6' });
                setBgColor('#f3f4f6');
                setTemplateId(null);
                setTemplateName('My ID Card Template');
                setIsLocked(false);
                setIsDoubleSided(true);
                setLayouts({ front: null, back: null });
                setActiveObject(null);
                setShowTemplates(false);
                setPreviewMode(false);
                setPreviewStudent(null);
                setHistory([]);
                setHistoryIndex(-1);
                historyRef.current = [];
                historyIndexRef.current = -1;
                setTimeout(() => saveHistoryState(), 100);
            }
        }
    };

    const handleLoadTemplate = async (tmpl) => {
        if (!fabricCanvas || loading) return;
        setTemplateId(tmpl.id);
        setTemplateName(tmpl.name);
        setIsLocked(tmpl.isLocked || false);
        if (tmpl.layout) {
            const parsed = JSON.parse(tmpl.layout);
            setLayouts(parsed);
            setIsDoubleSided(parsed.isDoubleSided !== undefined ? parsed.isDoubleSided : true);
            const sideLayout = (parsed.isDoubleSided === false) ? parsed.front : (parsed[activeSide] || parsed.front || parsed);
            if (parsed.isDoubleSided === false && activeSide === 'back') setActiveSide('front');

            isHistoryProcessing.current = true;
            try {
                await fabricCanvas.loadFromJSON(sideLayout);
                restoreCustomRx(fabricCanvas);
                // Manually enforce lock states after load
                fabricCanvas.getObjects().forEach(obj => {
                    if (obj.selectable === false || obj.lockMovementX === true) {
                        obj.set({
                            selectable: obj.selectable,
                            evented: obj.evented,
                            lockMovementX: true,
                            lockMovementY: true,
                            lockRotation: true,
                            lockScalingX: true,
                            lockScalingY: true,
                            hasControls: false
                        });
                    }
                });
                if (fabricCanvas.backgroundColor) setBgColor(fabricCanvas.backgroundColor);
                fabricCanvas.requestRenderAll();

                // Critical: Ensure we are in Editor Mode on load
                setPreviewMode(false);
                setPreviewStudent(null);
                setHistory([]);
                setHistoryIndex(-1);
                historyRef.current = [];
                historyIndexRef.current = -1;
                setStatus({ type: 'success', message: `Loaded ${tmpl.name}` });
                setTimeout(() => setStatus({ type: null }), 2000);
                setTimeout(() => {
                    if (isHistoryProcessing.current) isHistoryProcessing.current = false;
                    saveHistoryState();
                }, 100);
            } catch (e) {
                isHistoryProcessing.current = false;
                throw e;
            }
        }
        setShowTemplates(false);
    };

    const handleSetDefault = async (tid) => {
        try {
            setStatus({ type: 'info', message: "Setting as default..." });
            await setDefaultTemplate(tid);
            const updated = await getTemplates();
            setSavedTemplates(updated);
            setStatus({ type: 'success', message: "Default updated!" });
            setTimeout(() => setStatus({ type: null, message: "" }), 2000);
        } catch (e) {
            setStatus({ type: 'error', message: "Error setting default" });
        }
    };

    const handleDuplicateTemplate = async (tmpl) => {
        try {
            setLoading(true);
            const newName = `${tmpl.name} (Copy)`;
            const layout = typeof tmpl.layout === 'string' ? JSON.parse(tmpl.layout) : tmpl.layout;

            // SAFETY: If we are in preview mode on the current canvas, we MUST revert it before duplicating 
            // otherwise we duplicate the student's personal info into the new template
            if (previewMode) {
                await togglePreview(); // This restores original placeholders
            }

            // If the canvas is live, use its current state
            const currentLayout = fabricCanvas ? fabricCanvas.toObject(SERIALIZE_PROPS) : (layout[activeSide] || layout.front || layout);
            const finalLayouts = fabricCanvas ? { ...layout, [activeSide]: currentLayout } : layout;

            // Save as a new document (passing null as templateId)
            const newId = await saveTemplateService(newName, finalLayouts, null);

            // Refresh list
            const updated = await getTemplates();
            setSavedTemplates(updated);

            // Load the duplicate
            handleLoadTemplate({ ...tmpl, id: newId, name: newName });

            setStatus({ type: 'success', message: "Template duplicated!" });
            setTimeout(() => setStatus({ type: null, message: "" }), 2000);
        } catch (e) {
            console.error(e);
            setStatus({ type: 'error', message: "Error duplicating template" });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTemplate = async (tid) => {
        if (!window.confirm("Delete this template permanently?")) return;
        try {
            await deleteTemplate(tid);
            setSavedTemplates(savedTemplates.filter(t => t.id !== tid));
            if (templateId === tid) {
                setTemplateId(null);
                setTemplateName('My ID Card Template');
            }
        } catch (e) {
            alert("Error deleting template");
        }
    };

    const changeBg = (color) => {
        if (!fabricCanvas) return;
        setBgColor(color);
        fabricCanvas.set({ backgroundColor: color });
        fabricCanvas.requestRenderAll();
    };

    const switchSide = async (side) => {
        if (!fabricCanvas || side === activeSide || loading) return;

        // Capture current state before switching
        const wasPreviewing = previewMode;
        const studentBeingPreviewed = previewStudent;

        // 1. If in preview, temporarily revert current canvas to template mode so we can save the CLEAN layout
        if (wasPreviewing) {
            // We duplicate the revert logic here without toggling the state variable to false yet
            fabricCanvas.getObjects().forEach(obj => {
                // Restore text & visibility
                if (obj._originalText !== undefined) {
                    obj.set({ text: obj._originalText });
                    delete obj._originalText;
                }
                if (obj._originalVisible !== undefined) {
                    obj.set({ visible: obj._originalVisible });
                    delete obj._originalVisible;
                }
                // Restore interaction state
                if (obj._originalState) {
                    obj.set(obj._originalState);
                    delete obj._originalState;
                }
            });
            const previewItems = fabricCanvas.getObjects().filter(o => o.name && o.name.startsWith('preview_'));
            previewItems.forEach(o => fabricCanvas.remove(o));
            fabricCanvas.requestRenderAll();
        }

        // 2. Now safe to serialize the current side (which is back to variable placeholders)
        const currentJSON = fabricCanvas.toObject(SERIALIZE_PROPS);
        const updatedLayouts = { ...layouts, [activeSide]: currentJSON };
        setLayouts(updatedLayouts);

        // 3. Clear and Load the NEW side
        fabricCanvas.clear();
        const nextLayout = updatedLayouts[side];

        setActiveSide(side);
        setActiveObject(null);
        setHistory([]);
        setHistoryIndex(-1);
        historyRef.current = [];
        historyIndexRef.current = -1;

        if (nextLayout) {
            isHistoryProcessing.current = true;
            try {
                await fabricCanvas.loadFromJSON(nextLayout);
                restoreCustomRx(fabricCanvas);
                // Manually enforce lock states after load (standard procedure for Fabric v6/v7)
                fabricCanvas.getObjects().forEach(obj => {
                    obj.set({ objectCaching: false });
                    if (obj.selectable === false || obj.lockMovementX === true) {
                        obj.set({
                            selectable: obj.selectable,
                            evented: obj.evented,
                            lockMovementX: true,
                            lockMovementY: true,
                            lockRotation: true,
                            lockScalingX: true,
                            lockScalingY: true,
                            hasControls: false
                        });
                    }
                });
                setBgColor(fabricCanvas.backgroundColor || '#f3f4f6');
                setTimeout(() => {
                    if (isHistoryProcessing.current) isHistoryProcessing.current = false;
                    saveHistoryState();
                }, 100);
            } catch (e) {
                isHistoryProcessing.current = false;
                throw e;
            }
        } else {
            fabricCanvas.set({ backgroundColor: '#f3f4f6' });
            setBgColor('#f3f4f6');
        }

        // 4. If we were previewing, re-apply preview mode to the NEW side immediately
        if (wasPreviewing && studentBeingPreviewed) {
            // Lock all objects on new side first
            fabricCanvas.discardActiveObject();
            fabricCanvas.getObjects().forEach(obj => {
                obj._originalState = {
                    selectable: obj.selectable,
                    evented: obj.evented,
                    lockMovementX: obj.lockMovementX,
                    lockMovementY: obj.lockMovementY,
                    lockRotation: obj.lockRotation,
                    lockScalingX: obj.lockScalingX,
                    lockScalingY: obj.lockScalingY,
                    hasControls: obj.hasControls,
                    hoverCursor: obj.hoverCursor
                };
                obj.set({
                    selectable: false,
                    evented: false,
                    lockMovementX: true,
                    lockMovementY: true,
                    lockRotation: true,
                    lockScalingX: true,
                    lockScalingY: true,
                    hasControls: false,
                    hoverCursor: 'default'
                });
            });

            // Re-apply data
            await applyPreviewData(studentBeingPreviewed);

            // State remains true
            setPreviewMode(true);
            setPreviewStudent(studentBeingPreviewed);
        } else {
            // Ensure state is reset if not previewing
            setPreviewMode(false);
            setPreviewStudent(null);
        }

        fabricCanvas.requestRenderAll();
    };

    const centerObject = () => {
        if (!fabricCanvas) return;
        const active = fabricCanvas.getActiveObject();
        if (!active) return;
        fabricCanvas.centerObjectH(active);
        active.setCoords();
        fabricCanvas.requestRenderAll();
        setStatus({ type: 'success', message: "Centered Horizontally!" });
        setTimeout(() => setStatus({ type: null, message: "" }), 2000);
    };

    const centerObjectV = () => {
        if (!fabricCanvas) return;
        const active = fabricCanvas.getActiveObject();
        if (!active) return;
        fabricCanvas.centerObjectV(active);
        active.setCoords();
        fabricCanvas.requestRenderAll();
        setStatus({ type: 'success', message: "Centered Vertically!" });
        setTimeout(() => setStatus({ type: null, message: "" }), 2000);
    };

    const alignObjects = (alignment) => {
        if (!fabricCanvas) return;
        const active = fabricCanvas.getActiveObject();
        if (!active) return;

        // More robust check for multi-selection in Fabric v7
        const isMulti = active.type === 'activeSelection' || (active.getObjects && active.getObjects().length > 1);
        const objects = isMulti ? active.getObjects() : [active];

        if (isMulti) {
            // Multi-selection alignment (relative to selection bounding box)
            // Membership in ActiveSelection means positions are relative to the selection center
            objects.forEach(obj => {
                switch (alignment) {
                    case 'left':
                        obj.set({ originX: 'left', left: -active.width / 2 });
                        break;
                    case 'center':
                        obj.set({ originX: 'center', left: 0 });
                        break;
                    case 'right':
                        obj.set({ originX: 'right', left: active.width / 2 });
                        break;
                    case 'top':
                        obj.set({ originY: 'top', top: -active.height / 2 });
                        break;
                    case 'middle':
                        obj.set({ originY: 'center', top: 0 });
                        break;
                    case 'bottom':
                        obj.set({ originY: 'bottom', top: active.height / 2 });
                        break;
                }
                obj.setCoords();
            });
            active.setCoords();
        } else {
            // Single object alignment (relative to canvas)
            const obj = active;
            switch (alignment) {
                case 'left':
                    obj.set({ originX: 'left', left: 0 });
                    break;
                case 'center':
                    fabricCanvas.centerObjectH(obj);
                    break;
                case 'right':
                    obj.set({ originX: 'right', left: fabricCanvas.width });
                    break;
                case 'top':
                    obj.set({ originY: 'top', top: 0 });
                    break;
                case 'middle':
                    fabricCanvas.centerObjectV(obj);
                    break;
                case 'bottom':
                    obj.set({ originY: 'bottom', top: fabricCanvas.height });
                    break;
            }
            obj.setCoords();
        }

        fabricCanvas.requestRenderAll();
        fabricCanvas.fire('object:modified');
        setStatus({ type: 'success', message: `Aligned ${alignment}!` });
        setTimeout(() => setStatus({ type: null, message: "" }), 2000);
    };

    const handleDuplicateLayer = async () => {
        if (!activeObject || !fabricCanvas) return;

        try {
            // clone is async in Fabric v7+
            const cloned = await activeObject.clone(SERIALIZE_PROPS);

            // Offset the position slightly to make it obvious
            cloned.set({
                left: (activeObject.left || 0) + 15,
                top: (activeObject.top || 0) + 15,
                evented: true,
                selectable: true
            });

            // Ensure name is preserved or slightly modified
            if (activeObject.name) {
                cloned.set('name', `${activeObject.name}_copy`);
            }

            fabricCanvas.add(cloned);
            fabricCanvas.setActiveObject(cloned);
            fabricCanvas.requestRenderAll();
            setStatus({ type: 'success', message: "Layer Duplicated!" });
            setTimeout(() => setStatus({ type: null, message: "" }), 2000);
        } catch (err) {
            console.error("Duplication error:", err);
            setStatus({ type: 'error', message: "Duplication failed" });
        }
    };

    const fitToCanvas = () => {
        if (!fabricCanvas) return;
        const active = fabricCanvas.getActiveObject();
        if (!active) return;

        active.set({
            left: 0,
            top: 0,
            angle: 0,
            scaleX: fabricCanvas.width / active.width,
            scaleY: fabricCanvas.height / active.height
        });
        active.setCoords();
        fabricCanvas.requestRenderAll();
        setStatus({ type: 'success', message: "Filled Canvas!" });
        setTimeout(() => setStatus({ type: null, message: "" }), 2000);
    };

    const addText = (content = 'New Text', options = {}) => {
        if (!fabricCanvas) return;
        const text = new Textbox(content, {
            left: 60, top: 100, width: 200, fontSize: 18,
            fill: '#000000', fontFamily: 'Inter', textAlign: 'center',
            originY: 'top', // Default to top alignment for consistency
            lockScalingY: true,
            lockScalingFlip: true,
            ...options
        });

        // For Textbox, we want "Area Control" (width resize) not "Object Scaling" (font stretch)
        // We disable corner handles and vertical handles to force side-handle width resizing
        text.setControlsVisibility({
            mt: false,
            mb: false,
            tl: false,
            tr: false,
            bl: false,
            br: false,
            ml: true,
            mr: true,
            mtr: true // keep rotation handle
        });

        fabricCanvas.add(text);
        fabricCanvas.setActiveObject(text);
    };

    const addShape = (shapeType) => {
        if (!fabricCanvas) return;
        let shape;
        if (shapeType === 'rect') {
            shape = new Rect({
                width: 100, height: 100,
                fill: '#6366F1',
                left: 160, top: 250,
                originX: 'center', originY: 'center',
                rx: 0, ry: 0
            });
        } else if (shapeType === 'circle') {
            shape = new Circle({
                radius: 50,
                fill: '#6366F1',
                left: 160, top: 250,
                originX: 'center', originY: 'center'
            });
        }

        if (shape) {
            fabricCanvas.add(shape);
            fabricCanvas.setActiveObject(shape);
            fabricCanvas.requestRenderAll();

            setActiveProps(prev => ({
                ...prev,
                fill: shape.fill,
                angle: 0,
                strokeWidth: 0,
                stroke: '#6366F1',
                rx: shape.rx || 0
            }));
        }
    };

    const applyPreviewData = async (student) => {
        if (!fabricCanvas || !student) return;

        // Dynamic vars mapping
        const mapper = {
            '{Student Name}': student.name,
            '{Class}': (student.class && student.section) ? `${student.class}-${student.section}` : (student.class || student.section || ''),
            '{Address}': student.address || '',
            '{Emergency Contact}': student.emergencyContact || '',
            '{Blood Group}': student.bloodGroup || '',
            '{Father\'s Name}': student.fatherName || '',
            '{Mother\'s Name}': student.motherName || '',
        };

        dynamicVars.forEach(v => {
            mapper[v.placeholder] = student[v.slug] || student.metadata?.[v.slug] || '';
        });

        // 1. Remove existing preview items
        const previewItems = fabricCanvas.getObjects().filter(o => o.name && o.name.startsWith('preview_'));
        previewItems.forEach(o => fabricCanvas.remove(o));

        // 2. Process objects
        const objects = [...fabricCanvas.getObjects()];
        for (const obj of objects) {
            // Text replacement
            if (obj.type === 'textbox' || obj.type === 'text') {
                const currentText = obj._originalText || obj.text;
                if (mapper[currentText] !== undefined) {
                    if (!obj._originalText) obj._originalText = obj.text;
                    obj.set({ text: mapper[currentText] });
                }
            }

            // Photo replacement
            const isNamedPlaceholder = obj.name === 'photo_placeholder' || obj.get?.('name') === 'photo_placeholder';
            let isFuzzyPlaceholder = false;
            if (obj.type === 'group' && obj.getObjects) {
                isFuzzyPlaceholder = obj.getObjects().some(sub =>
                    (sub.type === 'textbox' || sub.type === 'text') &&
                    sub.text?.toUpperCase().includes('PHOTO')
                );
            }

            if (isNamedPlaceholder || isFuzzyPlaceholder) {
                if (obj._originalVisible === undefined) obj._originalVisible = obj.visible;
                let usePlaceholder = true;

                if (student.photoUrl && student.photoUrl !== import.meta.env.BASE_URL + 'default-avatar.svg') {
                    try {
                        const imgUrl = student.photoUrl;
                        const isExternal = imgUrl.startsWith('http');

                        // Use more robust manual load with timeout
                        const imgElement = new Image();
                        if (isExternal) imgElement.crossOrigin = 'anonymous';

                        const loadPromise = new Promise((resolve, reject) => {
                            const timeout = setTimeout(() => reject(new Error("Image load timeout")), 10000);
                            imgElement.onload = () => {
                                clearTimeout(timeout);
                                resolve(imgElement);
                            };
                            imgElement.onerror = () => {
                                clearTimeout(timeout);
                                reject(new Error("Image failed to load (CORS or Invalid URL)"));
                            };
                            imgElement.src = imgUrl;
                        });

                        const loadedImg = await loadPromise;
                        const img = new FabricImage(loadedImg);

                        let innerRectInfo = { width: 120, height: 150, rx: 0, customRx: null, stroke: null, strokeWidth: 0 };
                        if (obj.type === 'group' && obj.getObjects) {
                            const firstObj = obj.getObjects()[0]; // It's always the bg rect
                            if (firstObj) {
                                innerRectInfo = {
                                    width: firstObj.width,
                                    height: firstObj.height,
                                    rx: firstObj.rx,
                                    customRx: firstObj.customRx,
                                    stroke: firstObj.stroke,
                                    strokeWidth: firstObj.strokeWidth
                                };
                            }
                        } else {
                            innerRectInfo = {
                                width: obj.width || 120,
                                height: obj.height || 150,
                                rx: obj.rx || 0,
                                customRx: obj.customRx,
                                stroke: obj.stroke || null,
                                strokeWidth: obj.strokeWidth || 0
                            };
                        }

                        // Calculate target bounds from placeholder group
                        const targetWidth = innerRectInfo.width * obj.scaleX;
                        const targetHeight = innerRectInfo.height * obj.scaleY;

                        // Fit image to placeholder dimensions (Fill/Cover style)
                        const scaleX = targetWidth / img.width;
                        const scaleY = targetHeight / img.height;
                        const scale = Math.max(scaleX, scaleY);
                        img.scale(scale);

                        const center = obj.getCenterPoint();
                        const topY = center.y - (targetHeight / 2);

                        img.set({
                            left: center.x,
                            top: topY,
                            name: 'preview_photo',
                            originX: 'center',
                            originY: 'top',
                            angle: obj.angle,
                            selectable: false,
                            evented: false,
                            strokeUniform: true
                        });

                        // Propagation for custom corners
                        const rxArray = obj.customRx || (obj.rx ? [obj.rx, obj.rx, obj.rx, obj.rx] : (innerRectInfo.customRx || [innerRectInfo.rx, innerRectInfo.rx, innerRectInfo.rx, innerRectInfo.rx]));
                        const isUniform = Array.isArray(rxArray) ? rxArray.every(v => v === rxArray[0]) : true;

                        // Calculate vertical offset for clipPath since originY is 'top' but clipPath is relative to center
                        const clipVerticalOffset = -(img.height / 2) + (targetHeight / scale / 2);

                        if (isUniform) {
                            const rx = (Array.isArray(rxArray) ? rxArray[0] : (obj.rx || innerRectInfo.rx || 0));
                            const clipRect = new Rect({
                                left: 0,
                                top: clipVerticalOffset,
                                width: targetWidth / scale,
                                height: targetHeight / scale,
                                rx: rx / scale,
                                ry: rx / scale,
                                originX: 'center',
                                originY: 'center',
                            });
                            img.set('clipPath', clipRect);
                        } else {
                            const w_clip = targetWidth / scale, h_clip = targetHeight / scale;
                            const r = rxArray.map(rad => Math.max(0.001, Math.min(rad / scale, w_clip / 2, h_clip / 2)));
                            const x_clip = -w_clip / 2, y_clip = -h_clip / 2;
                            // Path string for scaled clipPath
                            const pathStr = `M ${x_clip + r[0]} ${y_clip} L ${x_clip + w_clip - r[1]} ${y_clip} A ${r[1]} ${r[1]} 0 0 1 ${x_clip + w_clip} ${y_clip + r[1]} L ${x_clip + w_clip} ${y_clip + h_clip - r[2]} A ${r[2]} ${r[2]} 0 0 1 ${x_clip + w_clip - r[2]} ${y_clip + h_clip} L ${x_clip + r[3]} ${y_clip + h_clip} A ${r[3]} ${r[3]} 0 0 1 ${x_clip} ${y_clip + h_clip - r[3]} L ${x_clip} ${y_clip + r[0]} A ${r[0]} ${r[0]} 0 0 1 ${x_clip + r[0]} ${y_clip} Z`;
                            img.set('clipPath', new Path(pathStr, {
                                originX: 'center',
                                originY: 'center',
                                left: 0,
                                top: clipVerticalOffset
                            }));
                        }

                        // Hide placeholder since we successfully loaded image
                        obj.set({ visible: false });
                        usePlaceholder = false;

                        fabricCanvas.add(img);
                        // Ensure it stays at the same layer as the placeholder
                        const index = fabricCanvas.getObjects().indexOf(obj);
                        if (index !== -1 && fabricCanvas.moveObjectTo) {
                            fabricCanvas.moveObjectTo(img, index);
                        }

                        // Apply border overlay if the placeholder has a stroke
                        const stroke = obj.stroke || innerRectInfo.stroke || null;
                        const strokeWidth = obj.strokeWidth || innerRectInfo.strokeWidth || 0;
                        if (strokeWidth > 0 && stroke) {
                            const borderRect = new Rect({
                                left: center.x,
                                top: center.y,
                                width: targetWidth,
                                height: targetHeight,
                                fill: 'transparent',
                                stroke: stroke,
                                strokeWidth: strokeWidth,
                                strokeUniform: true,
                                rx: isUniform && Array.isArray(rxArray) ? rxArray[0] : 0,
                                ry: isUniform && Array.isArray(rxArray) ? rxArray[0] : 0,
                                customRx: rxArray,
                                angle: obj.angle,
                                originX: 'center',
                                originY: 'center',
                                selectable: false,
                                evented: false,
                                name: 'preview_border'
                            });
                            fabricCanvas.add(borderRect);
                            if (index !== -1 && fabricCanvas.moveObjectTo) {
                                fabricCanvas.moveObjectTo(borderRect, index + 1);
                            }
                        }
                    } catch (err) {
                        console.error("Error loading preview photo for student:", student.name, err);
                        setStatus({ type: 'error', message: `Photo failed for ${student.name}: ${err.message}` });
                        // Fails to load -> keep placeholder
                    }
                }

                if (usePlaceholder) {
                    obj.set({ visible: true });
                }
            }
        }
        fabricCanvas.requestRenderAll();
    };

    const togglePreview = async () => {
        if (!fabricCanvas) return;

        if (previewMode) {
            // Restore original template
            fabricCanvas.getObjects().forEach(obj => {
                // Restore text & visibility
                if (obj._originalText !== undefined) {
                    obj.set({ text: obj._originalText });
                    delete obj._originalText;
                }
                if (obj._originalVisible !== undefined) {
                    obj.set({ visible: obj._originalVisible });
                    delete obj._originalVisible;
                }

                // Restore interaction state
                if (obj._originalState) {
                    obj.set(obj._originalState);
                    delete obj._originalState;
                }
            });

            // Remove preview images and diagnostics
            const previewItems = fabricCanvas.getObjects().filter(o => o.name && o.name.startsWith('preview_'));
            previewItems.forEach(o => fabricCanvas.remove(o));

            setPreviewMode(false);
            setPreviewStudent(null);
            fabricCanvas.requestRenderAll();
        } else {
            // Enter Preview Mode
            let pool = completedStudents;
            if (pool.length === 0) {
                setStatus({ type: 'info', message: "Finding completed student profiles..." });
                try {
                    const snap = await getDocs(collection(db, "students"));
                    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

                    // Filter for 100% complete
                    pool = all.filter(s => {
                        const hasName = s.name && s.name.trim().length > 0;
                        const hasPhoto = s.photoUrl && s.photoUrl !== import.meta.env.BASE_URL + 'default-avatar.svg';
                        const hasContact = !isActive('contact') || (s.emergencyContact && s.emergencyContact.trim().length > 0);
                        const hasAddress = !isActive('address') || (s.address && s.address.trim().length > 0);
                        return hasName && hasPhoto && hasContact && hasAddress;
                    });
                    setCompletedStudents(pool);
                } catch (err) {
                    console.error(err);
                    setStatus({ type: 'error', message: "Failed to fetch students" });
                    return;
                }
            }

            if (pool.length === 0) {
                setStatus({ type: 'error', message: "No 100% completed student profiles found!" });
                setTimeout(() => setStatus({ type: null }), 3000);
                return;
            }

            const randomStudent = pool[Math.floor(Math.random() * pool.length)];
            setPreviewStudent(randomStudent);

            // Lock all objects
            fabricCanvas.discardActiveObject(); // Deselect first
            fabricCanvas.getObjects().forEach(obj => {
                // Save original state
                obj._originalState = {
                    selectable: obj.selectable,
                    evented: obj.evented,
                    lockMovementX: obj.lockMovementX,
                    lockMovementY: obj.lockMovementY,
                    lockRotation: obj.lockRotation,
                    lockScalingX: obj.lockScalingX,
                    lockScalingY: obj.lockScalingY,
                    hasControls: obj.hasControls,
                    hoverCursor: obj.hoverCursor
                };

                // Apply lock
                obj.set({
                    selectable: false,
                    evented: false,
                    lockMovementX: true,
                    lockMovementY: true,
                    lockRotation: true,
                    lockScalingX: true,
                    lockScalingY: true,
                    hasControls: false,
                    hoverCursor: 'default'
                });
            });

            await applyPreviewData(randomStudent);
            setPreviewMode(true);
            setStatus({ type: 'success', message: `Previewing ${randomStudent.name}` });
            setTimeout(() => setStatus({ type: null }), 2000);
        }
    };

    const shufflePreview = async () => {
        if (!previewMode || completedStudents.length <= 1) return;

        let next;
        do {
            next = completedStudents[Math.floor(Math.random() * completedStudents.length)];
        } while (next.id === previewStudent.id);

        setPreviewStudent(next);
        await applyPreviewData(next);
        setStatus({ type: 'success', message: `Previewing ${next.name}` });
        setTimeout(() => setStatus({ type: null }), 1500);
    };

    const addPlaceholder = (type) => {
        if (!fabricCanvas) return;
        let textStr = '';
        let options = { fill: '#4F46E5', fontWeight: 'bold' };

        const presets = {
            'name': '{Student Name}',
            'class': '{Class}',
            'address': '{Address}',
            'contact': '{Emergency Contact}',
            'blood': '{Blood Group}',
            'father': '{Father\'s Name}',
            'mother': '{Mother\'s Name}'
        };

        if (presets[type]) {
            textStr = presets[type];
        } else if (type === 'photo') {
            const width = 120;
            const height = 150;

            // Background box - centered origin
            const rect = new Rect({
                width: width,
                height: height,
                fill: '#F8FAFC',
                stroke: '#6366F1',
                strokeWidth: 2,
                rx: 12,
                ry: 12,
                originX: 'center',
                originY: 'center'
            });

            // User icon head - positioned relative to center
            const head = new Rect({
                width: 36,
                height: 36,
                fill: '#CBD5E1',
                rx: 18,
                ry: 18,
                left: 0,
                top: -30,
                originX: 'center',
                originY: 'center'
            });

            // User icon body - positioned relative to center
            const body = new Rect({
                width: 64,
                height: 32,
                fill: '#CBD5E1',
                rx: 12,
                ry: 12,
                left: 0,
                top: 10,
                originX: 'center',
                originY: 'center'
            });

            // Label text - positioned relative to center
            const label = new Textbox('PHOTO', {
                width: width,
                fontSize: 10,
                fontWeight: '800',
                fill: '#94A3B8',
                textAlign: 'center',
                left: 0,
                top: 45,
                fontFamily: 'Inter',
                originX: 'center',
                originY: 'center',
                lockScalingY: true,
                lockScalingFlip: true
            });

            // Create group with sub-objects already correctly offset from center
            const group = new Group([rect, head, body, label], {
                left: 150,
                top: 150,
                name: 'photo_placeholder',
                rx: 12, // Track at group level for serializing
                ry: 12
            });

            fabricCanvas.add(group);
            fabricCanvas.setActiveObject(group);
            fabricCanvas.requestRenderAll();
            return;
        }
        addText(textStr, options);
    };

    const importInstitutionInfo = async (type) => {
        if (!institutionDetails || !fabricCanvas) return;

        if (type === 'logo' && institutionDetails.logoUrl) {
            const img = await FabricImage.fromURL(institutionDetails.logoUrl, { crossOrigin: 'anonymous' });
            img.scale(0.2);
            img.set({
                left: 10,
                top: 10,
                name: 'school_logo',
                _currentUrl: institutionDetails.logoUrl // Track URL for sync
            });
            fabricCanvas.add(img);
            fabricCanvas.setActiveObject(img);
        } else if (type === 'signature' && institutionDetails.signatureUrl) {
            const img = await FabricImage.fromURL(institutionDetails.signatureUrl, { crossOrigin: 'anonymous' });
            img.scale(0.3);
            img.set({
                left: 10,
                top: 400,
                name: 'school_signature',
                _currentUrl: institutionDetails.signatureUrl
            });
            fabricCanvas.add(img);
            fabricCanvas.setActiveObject(img);
        } else if (type === 'name' && institutionDetails.name) {
            addText(institutionDetails.name, {
                fontSize: 22,
                fontWeight: 'bold',
                textAlign: 'center',
                fill: '#1e293b',
                name: 'school_name'
            });
        } else if (type === 'address' && institutionDetails.address) {
            addText(institutionDetails.address, {
                fontSize: 14,
                textAlign: 'center',
                fill: '#475569',
                width: 250,
                name: 'school_address'
            });
        } else if (type === 'phone' && institutionDetails.phone) {
            addText(institutionDetails.phone, {
                fontSize: 14,
                textAlign: 'center',
                fill: '#475569',
                name: 'school_phone'
            });
        } else if (type === 'email' && institutionDetails.email) {
            addText(institutionDetails.email, {
                fontSize: 14,
                textAlign: 'center',
                fill: '#475569',
                name: 'school_email'
            });
        }
    };

    const handleFileUpload = (e) => {
        if (!fabricCanvas || !e.target.files[0]) return;
        const reader = new FileReader();
        reader.onload = (f) => {
            FabricImage.fromURL(f.target.result, { crossOrigin: 'anonymous' }).then(img => {
                img.set({
                    left: 0,
                    top: 0,
                    selectable: false,
                    evented: false,
                    name: 'background_image'
                });
                img.scaleToWidth(fabricCanvas.width);
                fabricCanvas.add(img);
                fabricCanvas.sendObjectToBack(img);
                fabricCanvas.requestRenderAll();
                e.target.value = ''; // Reset input
            });
        };
        reader.readAsDataURL(e.target.files[0]);
    };

    const handleImageLayerUpload = (e) => {
        if (!fabricCanvas || !e.target.files[0]) return;
        const reader = new FileReader();
        reader.onload = (f) => {
            FabricImage.fromURL(f.target.result, { crossOrigin: 'anonymous' }).then(img => {
                img.scaleToWidth(100);
                img.set({
                    left: 50,
                    top: 50,
                    name: 'image_layer',
                    stroke: '#6366F1',
                    strokeWidth: 0,
                    rx: 0,
                    ry: 0,
                    strokeUniform: true
                });
                fabricCanvas.add(img);
                fabricCanvas.setActiveObject(img);
                fabricCanvas.requestRenderAll();
                e.target.value = ''; // Reset input
            });
        };
        reader.readAsDataURL(e.target.files[0]);
    };

    const handleSave = async () => {
        if (!fabricCanvas || saving) return;
        if (!templateName.trim()) {
            setStatus({ type: 'error', message: "Provide a name first!" });
            return;
        }

        setSaving(true);
        setStatus({ type: 'info', message: "Preparing Design..." });

        try {
            // CRITICAL SAFETY CHECK: If in preview mode, we MUST revert the data 
            // temporarily to ensure we don't save a student's data as the template variables.
            let wasPreview = false;
            if (previewMode) {
                wasPreview = true;
                await togglePreview(); // This restores placeholders like {Student Name}
            }

            setStatus({ type: 'info', message: "Uploading to Database..." });

            // Include critical properties during serialization to ensure persistence (locks, etc.)
            const currentJSON = fabricCanvas.toObject(SERIALIZE_PROPS);
            const finalLayouts = { ...layouts, [activeSide]: currentJSON, isDoubleSided };
            const savedId = await saveTemplateService(templateName, finalLayouts, templateId);

            setTemplateId(savedId);
            const updatedTemplates = await getTemplates();
            setSavedTemplates(updatedTemplates);
            setLayouts(finalLayouts);

            setStatus({ type: 'success', message: "Design Saved Successfully!" });

            // If we were previewing, go back to preview mode for the user
            if (wasPreview) {
                setTimeout(async () => {
                    await togglePreview();
                    setStatus({ type: 'success', message: "Design Saved (Preview Restored)" });
                }, 500);
            }

            setTimeout(() => setStatus({ type: null, message: "" }), 3000);
        } catch (e) {
            console.error("Save error:", e);
            setStatus({ type: 'error', message: "Save failed. Check console." });
        } finally {
            setSaving(false);
        }
    };

    const updateActiveProp = (prop, value) => {
        if (!activeObject) return;

        // Prevent canvas from entering text edit mode while we use sidebar
        if (activeObject.isEditing) {
            activeObject.exitEditing();
        }

        // Special handling for locks
        if (prop === 'lock') {
            const isLocked = value;
            activeObject.set({
                selectable: !isLocked,
                evented: !isLocked,
                lockMovementX: isLocked,
                lockMovementY: isLocked,
                lockRotation: isLocked,
                lockScalingX: isLocked,
                lockScalingY: isLocked,
                hasControls: !isLocked
            });
            if (isLocked) fabricCanvas.discardActiveObject();
            fabricCanvas.requestRenderAll();
            setActiveObject(isLocked ? null : activeObject);
            return;
        }

        if (prop === 'fontSize') {
            const numValue = parseInt(value, 10);
            if (isNaN(numValue) || numValue <= 0) return;
            activeObject.set({
                fontSize: numValue,
                scaleX: 1,
                scaleY: 1
            });
        } else if (prop === 'rx' || prop.startsWith('rx_')) {
            const val = parseInt(value, 10) || 0;
            let currentRx = activeObject.customRx !== undefined ? activeObject.customRx : (activeObject.rx || 0);
            let rxArray = Array.isArray(currentRx) ? [...currentRx] : [currentRx, currentRx, currentRx, currentRx];

            if (prop.startsWith('rx_')) {
                const index = parseInt(prop.split('_')[1], 10);
                rxArray[index] = val;
            } else {
                rxArray = [val, val, val, val];
            }

            const isUniform = rxArray.every(r => r === rxArray[0]);

            // Store customRx since Fabric Rect breaks if rx is an array
            activeObject.set({ customRx: rxArray });

            const applyCornerRadii = (obj) => {
                obj.set({ customRx: rxArray });
                if (isUniform) {
                    const uniformRx = rxArray[0];
                    if (obj.type === 'rect') {
                        obj.set({ rx: uniformRx, ry: uniformRx, clipPath: null });
                    } else if (obj.type === 'image' || obj.type === 'FabricImage') {
                        obj.set('clipPath', new Rect({ width: obj.width, height: obj.height, rx: uniformRx, ry: uniformRx, originX: 'center', originY: 'center', left: 0, top: 0 }));
                    }
                } else {
                    if (obj.type === 'rect') {
                        obj.set({ rx: 0, ry: 0, clipPath: null }); // custom render handles it natively!
                    } else if (obj.type === 'image' || obj.type === 'FabricImage') {
                        const w = obj.width, h = obj.height;
                        const r = rxArray.map(rad => Math.max(0.001, Math.min(rad, w / 2, h / 2)));
                        const x = -w / 2, y = -h / 2;
                        const pathStr = `M ${x + r[0]} ${y} L ${x + w - r[1]} ${y} A ${r[1]} ${r[1]} 0 0 1 ${x + w} ${y + r[1]} L ${x + w} ${y + h - r[2]} A ${r[2]} ${r[2]} 0 0 1 ${x + w - r[2]} ${y + h} L ${x + r[3]} ${y + h} A ${r[3]} ${r[3]} 0 0 1 ${x} ${y + h - r[3]} L ${x} ${y + r[0]} A ${r[0]} ${r[0]} 0 0 1 ${x + r[0]} ${y} Z`;
                        obj.set('clipPath', new Path(pathStr, { originX: 'center', originY: 'center', left: 0, top: 0 }));
                    }
                }
                obj.dirty = true; // Force Fabric to re-render caches for this object
            };

            applyCornerRadii(activeObject);

            // If it's a placeholder group, also update the child rect
            if (activeObject.getObjects) {
                const inner = activeObject.getObjects('rect')[0];
                if (inner) applyCornerRadii(inner);
            }
        } else if (prop === 'angle') {
            const val = parseInt(value, 10);
            activeObject.set({ angle: isNaN(val) ? 0 : val });
            activeObject.setCoords();
        } else if (prop === 'strokeWidth') {
            const val = parseInt(value, 10);
            if (activeObject.name === 'photo_placeholder' || activeObject.getObjects) {
                const innerRect = (activeObject.getObjects && activeObject.getObjects('rect')[0]);
                if (innerRect) innerRect.set({ strokeWidth: val, strokeDashArray: null, strokeUniform: true });
                activeObject.set({ strokeWidth: val, strokeDashArray: null, strokeUniform: true });
            } else {
                activeObject.set({ strokeWidth: val, strokeDashArray: null, strokeUniform: true });
            }
        } else if (prop === 'stroke') {
            if (activeObject.name === 'photo_placeholder' || activeObject.getObjects) {
                const innerRect = (activeObject.getObjects && activeObject.getObjects('rect')[0]);
                if (innerRect) innerRect.set({ stroke: value, strokeDashArray: null, strokeUniform: true });
                activeObject.set({ stroke: value, strokeDashArray: null, strokeUniform: true });
            } else {
                activeObject.set({ stroke: value, strokeDashArray: null, strokeUniform: true });
            }
        } else if (prop === 'fill') {
            activeObject.set({ fill: value });
            // If it's a group (like photo placeholder), also update the background rect
            if (activeObject.getObjects) {
                const innerRect = activeObject.getObjects('rect')[0];
                if (innerRect) innerRect.set({ fill: value });
            }
        } else if (prop === 'opacity') {
            const val = parseFloat(value);
            activeObject.set({ opacity: isNaN(val) ? 1 : val });
        } else {
            // Default property application
            activeObject.set(prop, value);
        }

        if (prop === 'originY') {
            activeObject.setCoords();
        }

        fabricCanvas.requestRenderAll();

        // Update local state for UI syncing
        if (prop === 'rx' || prop.startsWith('rx_')) {
            setActiveProps(prev => ({
                ...prev,
                rx: activeObject.customRx || [0, 0, 0, 0]
            }));
        } else {
            setActiveProps(prev => ({
                ...prev,
                [prop]: value,
                ...(prop === 'fontSize' ? { scaleX: 1, scaleY: 1 } : {})
            }));
        }
    };

    const unlockAll = () => {
        if (!fabricCanvas) return;
        fabricCanvas.getObjects().forEach(obj => {
            // Background images should stay locked unless we really want them unlocked
            // But 'Unlock All' usually means 'get me out of this cage'
            obj.set({
                selectable: true,
                evented: true,
                lockMovementX: false,
                lockMovementY: false,
                lockRotation: false,
                lockScalingX: false,
                lockScalingY: false,
                hasControls: true
            });
        });
        fabricCanvas.requestRenderAll();
        // Force a layer sync
        const objs = fabricCanvas.getObjects().filter(o => o.name !== 'centerLine');
        setLayers([...objs].reverse());

        setStatus({ type: 'success', message: "All layers unlocked!" });
        setTimeout(() => setStatus({ type: null, message: "" }), 2000);
    };

    const toggleLock = (obj) => {
        if (!obj || !fabricCanvas) return;
        const isCurrentlyLocked = !obj.selectable;
        const newLocked = !isCurrentlyLocked;

        obj.set({
            selectable: !newLocked,
            evented: !newLocked,
            lockMovementX: newLocked,
            lockMovementY: newLocked,
            lockRotation: newLocked,
            lockScalingX: newLocked,
            lockScalingY: newLocked,
            hasControls: !newLocked
        });

        if (newLocked) {
            fabricCanvas.discardActiveObject();
        } else {
            fabricCanvas.setActiveObject(obj);
        }

        fabricCanvas.requestRenderAll();
        // Sync state manually since some events might not fire on internal set
        const objs = fabricCanvas.getObjects().filter(o => o.name !== 'centerLine');
        setLayers([...objs].reverse());
    };

    const selectLayer = (obj) => {
        if (!obj || !fabricCanvas) return;
        // Even if locked, we want to select it via the panel
        // Temporary enable selection to set as active? 
        // No, Fabric v7 setActiveObject(obj) works if we want it to, but usually we want to keep it "locked" on canvas
        // Best approach: If user clicks in panel, they WANT to interact, so maybe unlock it?
        // Or just let it be selected but still locked? 
        // Let's unlock Movement but keep it selected so they can edit properties

        fabricCanvas.setActiveObject(obj);
        fabricCanvas.requestRenderAll();
    };

    return (
        <div className={`transition-all duration-300 flex flex-col gap-6 ${isExpanded ? 'max-w-none w-full h-full' : 'max-w-7xl mx-auto p-4'}`}>

            {/* Full-width Designer Header */}
            <div className="w-full bg-white border border-gray-200 px-6 py-3 flex flex-wrap items-center justify-between z-30 sticky top-0 shadow-sm">

                {/* Left Group: Sidedness & Perspective */}
                <div className="flex items-center gap-3">
                    <div className="flex gap-1 bg-gray-50 p-1 rounded-xl">
                        <button onClick={() => switchSide('front')} className={`flex items-center px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeSide === 'front' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-900'}`}><CreditCard className="w-4 h-4 mr-2" /> Front</button>
                        {isDoubleSided && (
                            <button onClick={() => switchSide('back')} className={`flex items-center px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeSide === 'back' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-900'}`}><RotateCw className="w-4 h-4 mr-2" /> Back</button>
                        )}
                    </div>

                    <div className="flex items-center bg-gray-100 p-0.5 rounded-xl text-[10px] font-black uppercase tracking-widest">
                        <button
                            onClick={() => {
                                if (!isDoubleSided) return;
                                setIsDoubleSided(false);
                                if (activeSide === 'back') switchSide('front');
                            }}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg transition-all ${!isDoubleSided ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Plus className="w-3.5 h-3.5" /> Single
                        </button>
                        <button
                            onClick={() => {
                                if (isDoubleSided) return;
                                setIsDoubleSided(true);
                            }}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg transition-all ${isDoubleSided ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Layers className="w-3.5 h-3.5" /> Double
                        </button>
                    </div>
                </div>

                {/* Center Group: Mode & History */}
                <div className="flex items-center justify-center gap-3">
                    <div className="flex items-center p-0.5 rounded-[12px] text-[10px] font-black uppercase tracking-widest bg-indigo-50/50">
                        <button
                            onClick={() => { if (previewMode) togglePreview(); }}
                            className={`flex items-center gap-1.5 px-6 py-2 rounded-lg transition-all ${!previewMode ? 'bg-indigo-600 text-white shadow-md' : 'text-indigo-600/70 hover:text-indigo-800'}`}
                        >
                            <Type className="w-4 h-4" /> Editor
                        </button>
                        <button
                            onClick={() => { if (!previewMode) togglePreview(); }}
                            className={`flex items-center gap-1.5 px-6 py-2 rounded-lg transition-all ${previewMode ? 'bg-indigo-600 text-white shadow-md animate-pulse' : 'text-indigo-600/70 hover:text-indigo-800'}`}
                        >
                            <Eye className="w-4 h-4" /> Preview
                        </button>
                    </div>

                    <div className="w-px h-6 bg-gray-200 mx-1" />

                    <div className="flex p-0.5 rounded-[12px] items-center gap-1 bg-gray-50">
                        <button
                            onClick={handleUndo}
                            disabled={historyIndex <= 0 || isHistoryProcessing.current}
                            className={`p-2 rounded-lg transition-all ${historyIndex <= 0 || isHistoryProcessing.current ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-white shadow-sm hover:text-indigo-600'}`}
                            title="Undo (Ctrl+Z)"
                        >
                            <Undo className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleRedo}
                            disabled={historyIndex >= history.length - 1 || isHistoryProcessing.current}
                            className={`p-2 rounded-lg transition-all ${historyIndex >= history.length - 1 || isHistoryProcessing.current ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-white shadow-sm hover:text-indigo-600'}`}
                            title="Redo (Ctrl+Y)"
                        >
                            <Redo className="w-4 h-4" />
                        </button>
                    </div>

                    {previewMode && (
                        <>
                            <div className="w-px h-6 bg-gray-200 mx-1" />
                            <button
                                onClick={shufflePreview}
                                className="flex items-center gap-1.5 px-4 py-2 bg-pink-50 text-pink-600 rounded-lg border border-pink-100 hover:bg-pink-100 transition-all font-black text-[10px] uppercase tracking-widest animate-in slide-in-from-left-2 duration-300"
                            >
                                <Shuffle className="w-3.5 h-3.5" /> Shuffle
                            </button>
                        </>
                    )}
                </div>

                {/* Right Group: Layouts & Settings */}
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <button
                            onClick={() => setShowTemplates(!showTemplates)}
                            className={`h-10 flex items-center gap-3 px-4 rounded-xl transition-all ${showTemplates ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 bg-gray-50 hover:bg-gray-100'}`}
                            title="Templates Library"
                        >
                            <List className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline-block">Layout</span>
                            {templateId && savedTemplates.find(t => t.id === templateId && t.isDefault) && (
                                <div className="flex items-center gap-1.5 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">
                                    <Star className="w-3 h-3 text-amber-500 fill-amber-500 animate-pulse" />
                                    <span className="text-[8px] font-black text-amber-600 uppercase tracking-tighter leading-none">Primary</span>
                                </div>
                            )}
                        </button>

                        {showTemplates && (
                            <div className="absolute top-12 right-0 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 z-50 animate-in fade-in zoom-in-95 duration-200 max-h-[60vh] overflow-y-auto">
                                <div className="flex items-center justify-between mb-4 px-2">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Saved Layouts</h4>
                                    <button
                                        onClick={handleNewDesign}
                                        className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-md transition-colors flex items-center gap-1"
                                    >
                                        <Plus className="w-3 h-3" /> New
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {savedTemplates.map(tmpl => (
                                        <div key={tmpl.id} className={`group p-3 rounded-xl border flex items-center justify-between transition-all ${templateId === tmpl.id ? 'border-indigo-600 bg-indigo-50' : 'border-gray-50 hover:border-indigo-100 hover:bg-gray-50'}`}>
                                            <div className="flex-1 cursor-pointer" onClick={() => handleLoadTemplate(tmpl)}>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-gray-900 leading-none">{tmpl.name}</span>
                                                    {tmpl.isDefault && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                                                    {templateId === tmpl.id && (
                                                        <span className={`text-[7px] font-medium px-1.5 py-0.5 rounded-full uppercase tracking-tighter ${tmpl.isDefault ? 'bg-amber-500 text-white' : 'bg-indigo-600 text-white'}`}>
                                                            Editing
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[9px] text-gray-400 mt-1 uppercase tracking-tighter">Updated {tmpl.updatedAt?.toDate?.()?.toLocaleDateString() || 'Recently'}</p>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => handleDuplicateTemplate(tmpl)} className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors" title="Duplicate Template">
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                                {userRole === 'super_admin' && !tmpl.isDefault && (
                                                    <button onClick={() => handleSetDefault(tmpl.id)} className="p-1.5 text-gray-400 hover:text-amber-500 transition-colors" title="Set as Default">
                                                        <Star className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button onClick={() => handleDeleteTemplate(tmpl.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Delete Template">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {savedTemplates.length === 0 && (
                                        <div className="p-4 text-center text-gray-400 text-xs font-medium">No saved templates yet.</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-1">
                        {isExpanded && (
                            <button
                                onClick={() => setShowControls(!showControls)}
                                className={`w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl transition-all ${!showControls ? 'text-indigo-600 border border-indigo-200 bg-indigo-50' : 'text-gray-400 hover:text-indigo-600'}`}
                                title={showControls ? "Hide Toolbox" : "Show Toolbox"}
                            >
                                <Settings className={`w-5 h-5 ${!showControls ? 'animate-spin-slow' : ''}`} />
                            </button>
                        )}
                        <button
                            onClick={onToggleExpand}
                            className={`w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl transition-all ${isExpanded ? 'text-red-500 hover:bg-red-50' : 'text-gray-400 hover:text-indigo-600'}`}
                            title={isExpanded ? "Exit Fullscreen" : "Enter Fullscreen"}
                        >
                            {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </div>

            <div className={`flex flex-col xl:flex-row gap-8 items-start min-h-full ${isExpanded ? 'flex-1 overflow-y-auto scroll-smooth p-12 pt-0' : ''}`}>
                <div className={`flex-1 flex flex-col items-center gap-6 w-full relative`}>
                    {loading && (
                        <div className="absolute inset-0 z-[100] bg-white/80 backdrop-blur-sm rounded-box flex flex-col items-center justify-center border border-indigo-100">
                            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                            <p className="text-gray-900 font-bold uppercase tracking-widest text-xs">Loading...</p>
                        </div>
                    )}

                    {/* Canvas Area */}
                    <div className="relative group transition-all duration-500 ease-out z-10 pt-4">
                        <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-2xl overflow-hidden"><canvas ref={canvasRef} /></div>
                    </div>
                    {status.message && (
                        <div className={`flex items-center px-4 py-2 rounded-lg text-xs font-bold animate-in fade-in slide-in-from-bottom-1 z-20 ${status.type === 'success' ? 'bg-green-100 text-green-700' : status.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                            {status.type === 'success' ? (
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                            ) : status.type === 'error' ? (
                                <AlertCircle className="w-4 h-4 mr-2" />
                            ) : status.type === 'info' ? (
                                <Info className="w-4 h-4 mr-2" />
                            ) : (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            )}
                            {status.message}
                        </div>
                    )}

                    {contextMenu && (
                        <div
                            ref={contextMenuRef}
                            className={`fixed bg-white shadow-xl border border-gray-100 rounded-xl z-[100] py-2 w-48 transition-opacity duration-150 ${isMenuVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                            style={{ left: adjustedMenuPos.x, top: adjustedMenuPos.y }}
                            onContextMenu={(e) => e.preventDefault()}
                        >
                            {/* Alignment Options */}
                            <div className="px-4 py-1.5 mt-1 text-[8px] font-black uppercase tracking-widest text-gray-400 bg-gray-50/50">Alignment</div>
                            <button
                                className="w-full text-left px-4 py-2 text-[10px] font-black uppercase text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
                                onClick={() => { alignObjects('middle'); setContextMenu(null); }}
                            >
                                <AlignCenterVertical className="w-4 h-4" /> Center Horizontal
                            </button>
                            <button
                                className="w-full text-left px-4 py-2 text-[10px] font-black uppercase text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
                                onClick={() => { alignObjects('center'); setContextMenu(null); }}
                            >
                                <AlignCenterHorizontal className="w-4 h-4" /> Center Vertical
                            </button>
                            <button
                                className="w-full text-left px-4 py-2 text-[10px] font-black uppercase text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
                                onClick={() => { centerObject(); setContextMenu(null); }}
                            >
                                <AlignCenterVertical className="w-4 h-4 opacity-75" /> Canvas H
                            </button>
                            <button
                                className="w-full text-left px-4 py-2 text-[10px] font-black uppercase text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
                                onClick={() => { centerObjectV(); setContextMenu(null); }}
                            >
                                <AlignCenterHorizontal className="w-4 h-4 opacity-75" /> Canvas V
                            </button>

                            {/* Text Specific Options */}
                            {(contextMenu.target.type === 'textbox' || contextMenu.target.type === 'text') && (
                                <>
                                    <div className="px-4 py-1.5 mt-1 text-[8px] font-black uppercase tracking-widest text-gray-400 bg-gray-50/50">Typography</div>
                                    <button
                                        className="w-full text-left px-4 py-2 text-[10px] font-black uppercase text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
                                        onClick={() => {
                                            const weight = contextMenu.target.fontWeight === 'bold' ? 'normal' : 'bold';
                                            contextMenu.target.set('fontWeight', weight);
                                            fabricCanvas.requestRenderAll();
                                            setActiveProps(prev => ({ ...prev, fontWeight: weight }));
                                            setContextMenu(null);
                                        }}
                                    >
                                        <Bold className="w-4 h-4" /> Toggle Bold <span className="ml-auto font-mono text-[9px] text-gray-400">Ctrl+B</span>
                                    </button>
                                    <button
                                        className="w-full text-left px-4 py-2 text-[10px] font-black uppercase text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
                                        onClick={() => {
                                            const style = contextMenu.target.fontStyle === 'italic' ? 'normal' : 'italic';
                                            contextMenu.target.set('fontStyle', style);
                                            fabricCanvas.requestRenderAll();
                                            setActiveProps(prev => ({ ...prev, fontStyle: style }));
                                            setContextMenu(null);
                                        }}
                                    >
                                        <Italic className="w-4 h-4" /> Toggle Italic <span className="ml-auto font-mono text-[9px] text-gray-400">Ctrl+I</span>
                                    </button>
                                </>
                            )}

                            {/* Selection Actions (Group/Ungroup/Duplicate) */}
                            <div className="px-4 py-1.5 mt-1 text-[8px] font-black uppercase tracking-widest text-gray-400 bg-gray-50/50">Actions</div>
                            {contextMenu.target.type !== 'activeSelection' && (
                                <button
                                    className="w-full text-left px-4 py-2 text-[10px] font-black uppercase text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
                                    onClick={() => {
                                        const activeObj = fabricCanvas.getActiveObject();
                                        if (activeObj) {
                                            activeObj.clone().then(cloned => {
                                                cloned.set({
                                                    left: cloned.left + 10,
                                                    top: cloned.top + 10,
                                                    evented: true,
                                                });
                                                fabricCanvas.add(cloned);
                                                fabricCanvas.setActiveObject(cloned);
                                                fabricCanvas.requestRenderAll();
                                            });
                                        }
                                        setContextMenu(null);
                                    }}
                                >
                                    <Copy className="w-4 h-4" /> Duplicate <span className="ml-auto font-mono text-[9px] text-gray-400">Ctrl+D</span>
                                </button>
                            )}

                            {contextMenu.target.type === 'activeSelection' && (
                                <button
                                    className="w-full text-left px-4 py-2 text-[10px] font-black uppercase text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
                                    onClick={() => {
                                        const activeObj = fabricCanvas.getActiveObject();
                                        if (activeObj.type === 'activeSelection') {
                                            activeObj.toGroup();
                                            fabricCanvas.requestRenderAll();
                                        }
                                        setContextMenu(null);
                                    }}
                                >
                                    <Layers className="w-4 h-4" /> Group <span className="ml-auto font-mono text-[9px] text-gray-400">Ctrl+G</span>
                                </button>
                            )}

                            {contextMenu.target.type === 'group' && (
                                <button
                                    className="w-full text-left px-4 py-2 text-[10px] font-black uppercase text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
                                    onClick={() => {
                                        const activeObj = fabricCanvas.getActiveObject();
                                        if (activeObj.type === 'group') {
                                            activeObj.toActiveSelection();
                                            fabricCanvas.requestRenderAll();
                                        }
                                        setContextMenu(null);
                                    }}
                                >
                                    <Layers className="w-4 h-4 opacity-50" /> Ungroup <span className="ml-auto font-mono text-[9px] text-gray-400">Ctrl+Shift+G</span>
                                </button>
                            )}

                            <button
                                className="w-full text-left px-4 py-2 text-[10px] font-black uppercase text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
                                onClick={() => {
                                    const isLocked = contextMenu.target.lockMovementX;
                                    contextMenu.target.set({
                                        lockMovementX: !isLocked,
                                        lockMovementY: !isLocked,
                                        lockRotation: !isLocked,
                                        lockScalingX: !isLocked,
                                        lockScalingY: !isLocked,
                                        hasControls: isLocked, // enable controls when unlocked
                                        selectable: true // always selectable to be able to right click again
                                    });
                                    fabricCanvas.requestRenderAll();
                                    setContextMenu(null);
                                }}
                            >
                                {contextMenu.target.lockMovementX ? (
                                    <><Unlock className="w-4 h-4" /> Unlock Layer <span className="ml-auto font-mono text-[9px] text-gray-400">Ctrl+L</span></>
                                ) : (
                                    <><Lock className="w-4 h-4" /> Lock Layer <span className="ml-auto font-mono text-[9px] text-gray-400">Ctrl+L</span></>
                                )}
                            </button>

                            <div className="px-4 py-1.5 mt-1 text-[8px] font-black uppercase tracking-widest text-gray-400 bg-gray-50/50">Stack Order</div>
                            <button
                                className="w-full text-left px-4 py-2 text-[10px] font-black uppercase text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
                                onClick={() => {
                                    fabricCanvas.bringObjectToFront(contextMenu.target);
                                    fabricCanvas.requestRenderAll();
                                    setContextMenu(null);
                                }}
                            >
                                <Layers className="w-4 h-4" /> Bring to Front <span className="ml-auto font-mono text-[9px] text-gray-400">Ctrl+Shift+]</span>
                            </button>
                            <button
                                className="w-full text-left px-4 py-2 text-[10px] font-black uppercase text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
                                onClick={() => {
                                    fabricCanvas.bringObjectForward(contextMenu.target);
                                    fabricCanvas.requestRenderAll();
                                    setContextMenu(null);
                                }}
                            >
                                <Layers className="w-4 h-4 opacity-75" /> Bring Forward <span className="ml-auto font-mono text-[9px] text-gray-400">Ctrl+]</span>
                            </button>
                            <button
                                className="w-full text-left px-4 py-2 text-[10px] font-black uppercase text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
                                onClick={() => {
                                    fabricCanvas.sendObjectBackwards(contextMenu.target);
                                    fabricCanvas.requestRenderAll();
                                    setContextMenu(null);
                                }}
                            >
                                <Layers className="w-4 h-4 opacity-50" /> Send Backward <span className="ml-auto font-mono text-[9px] text-gray-400">Ctrl+[</span>
                            </button>
                            <button
                                className="w-full text-left px-4 py-2 text-[10px] font-black uppercase text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
                                onClick={() => {
                                    fabricCanvas.sendObjectToBack(contextMenu.target);
                                    fabricCanvas.requestRenderAll();
                                    setContextMenu(null);
                                }}
                            >
                                <Layers className="w-4 h-4 opacity-25" /> Send to Back <span className="ml-auto font-mono text-[9px] text-gray-400">Ctrl+Shift+[</span>
                            </button>
                            <div className="h-px bg-gray-100 my-1"></div>
                            <button
                                className="w-full text-left px-4 py-2 text-[10px] font-black uppercase text-red-600 hover:bg-red-50 flex items-center gap-2"
                                onClick={() => {
                                    fabricCanvas.remove(contextMenu.target);
                                    fabricCanvas.discardActiveObject();
                                    fabricCanvas.requestRenderAll();
                                    setActiveObject(null);
                                    setContextMenu(null);
                                }}
                            >
                                <Trash2 className="w-4 h-4" /> Delete Layer <span className="ml-auto font-mono text-[9px] text-red-300">Del</span>
                            </button>
                        </div>
                    )}
                </div>

                <div className={`transition-all duration-500 ease-in-out flex flex-col gap-6 sticky top-8 p-1 ${loading ? 'opacity-50 pointer-events-none' : 'opacity-100'} ${((!showControls && isExpanded) || previewMode) ? 'w-0 h-0 opacity-0 translate-x-10 overflow-hidden' : 'w-full xl:w-96'} ${isLocked ? 'grayscale-[0.5]' : ''}`}>

                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
                        <div className="flex items-center justify-between ml-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 block">Template Name</label>
                            {isLocked && (
                                <div className="flex items-center gap-1.5 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 mb-1">
                                    <Lock className="w-2.5 h-2.5 text-amber-500" />
                                    <span className="text-[8px] font-black text-amber-600 uppercase tracking-tighter">LOCKED</span>
                                </div>
                            )}
                        </div>
                        <input
                            type="text"
                            placeholder="Design name..."
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-[11px] font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleSave}
                            disabled={saving || loading || isLocked}
                            className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center text-[10px] uppercase tracking-widest disabled:opacity-50"
                            title={isLocked ? "Unlock to edit" : "Save changes"}
                        >
                            {saving ? "SAVING..." : <><Save className="w-3 h-3 mr-2" /> Save</>}
                        </button>

                        {userRole === 'super_admin' && (
                            <button
                                onClick={async () => {
                                    if (!templateId) return alert("Please save the design first.");
                                    try {
                                        const newStatus = !isLocked;
                                        await toggleTemplateLock(templateId, newStatus);
                                        setIsLocked(newStatus);
                                        setStatus({ type: 'success', message: newStatus ? "Layout Locked" : "Layout Unlocked" });
                                        setTimeout(() => setStatus({ type: null, message: "" }), 2000);
                                    } catch (e) {
                                        setStatus({ type: 'error', message: "Error changing lock" });
                                    }
                                }}
                                disabled={!templateId}
                                className={`flex-1 py-3 rounded-xl font-black shadow-md transition-all flex items-center justify-center text-[10px] uppercase tracking-widest disabled:opacity-50 ${isLocked ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                            >
                                {isLocked ? <><Unlock className="w-3 h-3 mr-2" /> Unlock</> : <><Lock className="w-3 h-3 mr-2" /> Lock</>}
                            </button>
                        )}
                    </div>


                    <div className="bg-white rounded-3xl p-2 shadow-sm border border-gray-100 flex flex-col">
                        <div className="flex border-b border-gray-100">
                            <button
                                onClick={() => setSidebarTab('editor')}
                                className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${sidebarTab === 'editor' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Editor
                            </button>
                            <button
                                onClick={() => setSidebarTab('library')}
                                className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${sidebarTab === 'library' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Library
                            </button>
                        </div>

                        <div className={`p-4 space-y-6 ${(isLocked || previewMode) ? 'pointer-events-none opacity-50' : ''}`}>
                            {sidebarTab === 'editor' ? (
                                <>
                                    {/* Primary Add Tools moved here */}
                                    <div className="grid grid-cols-2 gap-2 p-1 bg-gray-50/50 rounded-2xl border border-gray-100 mb-6">
                                        <label className="flex flex-col items-center justify-center p-3 bg-white rounded-xl hover:bg-indigo-50 transition-colors cursor-pointer group border border-gray-100 shadow-sm">
                                            <ImageIcon className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 mb-1.5" />
                                            <span className="text-[9px] font-bold text-gray-500 group-hover:text-indigo-700 uppercase leading-none">Add BG</span>
                                            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button onClick={() => addText('New Text')} className="flex flex-col items-center justify-center p-3 bg-white rounded-xl hover:bg-indigo-50 transition-colors group border border-gray-100 shadow-sm">
                                                <Type className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 mb-1.5" />
                                                <span className="text-[9px] font-bold text-gray-500 group-hover:text-indigo-700 uppercase leading-none">Text</span>
                                            </button>
                                            <div className="relative group">
                                                <input type="file" accept="image/*" onChange={handleImageLayerUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                                <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl hover:bg-indigo-50 transition-colors group border border-gray-100 shadow-sm">
                                                    <ImageIcon className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 mb-1.5" />
                                                    <span className="text-[9px] font-bold text-gray-500 group-hover:text-indigo-700 uppercase leading-none">Image</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 p-1 bg-gray-50/50 rounded-2xl border border-gray-100 mb-6">
                                        <button onClick={() => addShape('rect')} className="flex flex-col items-center justify-center p-3 bg-white rounded-xl hover:bg-indigo-50 transition-colors group border border-gray-100 shadow-sm">
                                            <Square className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 mb-1.5" />
                                            <span className="text-[9px] font-bold text-gray-500 group-hover:text-indigo-700 uppercase leading-none">Rectangle</span>
                                        </button>
                                        <button onClick={() => addShape('circle')} className="flex flex-col items-center justify-center p-3 bg-white rounded-xl hover:bg-indigo-50 transition-colors group border border-gray-100 shadow-sm">
                                            <CircleIcon className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 mb-1.5" />
                                            <span className="text-[9px] font-bold text-gray-500 group-hover:text-indigo-700 uppercase leading-none">Circle</span>
                                        </button>
                                    </div>

                                    {activeObject && (activeObject.type === 'textbox' || activeObject.type === 'text') && (
                                        <section className="bg-gradient-to-br from-indigo-50 to-blue-50 p-4 rounded-2xl border border-indigo-100 animate-in zoom-in-95 duration-200">
                                            <h4 className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-2 text-center">Typography</h4>
                                            <div className="flex gap-2 mb-3">
                                                <select className="flex-1 bg-white border border-indigo-200 rounded-lg py-2 px-3 text-sm font-medium outline-none shadow-sm" onChange={(e) => updateActiveProp('fontFamily', e.target.value)} value={activeProps.fontFamily}>
                                                    {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                                                </select>
                                                <div className="flex items-center bg-white border border-indigo-200 rounded-lg px-2 shadow-sm w-24">
                                                    <span className="text-[10px] font-black text-gray-400 mr-2">SIZE</span>
                                                    <input
                                                        type="number"
                                                        className="w-full text-sm font-bold outline-none"
                                                        value={Math.round(activeProps.fontSize * (activeProps.scaleX || 1))}
                                                        onChange={(e) => updateActiveProp('fontSize', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 mb-3">
                                                <button onClick={() => updateActiveProp('textAlign', 'left')} className={`flex-1 flex justify-center py-2 rounded-lg border transition-all ${activeProps.textAlign === 'left' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200'}`}><AlignLeft className="w-4 h-4" /></button>
                                                <button onClick={() => updateActiveProp('textAlign', 'center')} className={`flex-1 flex justify-center py-2 rounded-lg border transition-all ${activeProps.textAlign === 'center' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200'}`}><AlignCenter className="w-4 h-4" /></button>
                                                <button onClick={() => updateActiveProp('textAlign', 'right')} className={`flex-1 flex justify-center py-2 rounded-lg border transition-all ${activeProps.textAlign === 'right' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200'}`}><AlignRight className="w-4 h-4" /></button>
                                            </div>
                                            <div className="flex items-center gap-1 mb-3">
                                                <button onClick={() => updateActiveProp('originY', 'top')} className={`flex-1 text-[9px] font-black py-2 rounded-lg border transition-all ${activeProps.originY === 'top' || !activeProps.originY ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200'}`}>TOP</button>
                                                <button onClick={() => updateActiveProp('originY', 'center')} className={`flex-1 text-[9px] font-black py-2 rounded-lg border transition-all ${activeProps.originY === 'center' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200'}`}>MID</button>
                                                <button onClick={() => updateActiveProp('originY', 'bottom')} className={`flex-1 text-[9px] font-black py-2 rounded-lg border transition-all ${activeProps.originY === 'bottom' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200'}`}>BTM</button>
                                            </div>
                                            <div className="flex items-center gap-1 mb-3">
                                                <button onClick={() => updateActiveProp('fontWeight', activeProps.fontWeight === 'bold' ? 'normal' : 'bold')} className={`flex-1 flex justify-center py-2 rounded-lg border transition-all ${activeProps.fontWeight === 'bold' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200'}`}><Bold className="w-4 h-4" /></button>
                                                <button onClick={() => updateActiveProp('fontStyle', activeProps.fontStyle === 'italic' ? 'normal' : 'italic')} className={`flex-1 flex justify-center py-2 rounded-lg border transition-all ${activeProps.fontStyle === 'italic' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200'}`}><Italic className="w-4 h-4" /></button>
                                                <div className="flex items-center bg-white border border-indigo-200 rounded-lg px-2 shadow-sm w-24" title="Line Height">
                                                    <span className="text-[10px] font-black text-gray-400 mr-2">LH</span>
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        className="w-full text-sm font-bold outline-none"
                                                        value={activeProps.lineHeight || 1.16}
                                                        onChange={(e) => updateActiveProp('lineHeight', parseFloat(e.target.value))}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="flex-1 flex items-center bg-white border border-indigo-200 rounded-lg px-3 py-2 shadow-sm">
                                                    <span className="text-[10px] font-black text-gray-400 mr-3 italic">ANGLE</span>
                                                    <input
                                                        type="number"
                                                        className="w-full text-sm font-bold outline-none"
                                                        value={activeProps.angle || 0}
                                                        onChange={(e) => updateActiveProp('angle', e.target.value)}
                                                    />
                                                    <span className="text-xs font-bold text-gray-300 ml-1">°</span>
                                                </div>
                                                <div className="flex gap-1">
                                                    {[0, 90, 180, 270].map(deg => (
                                                        <button
                                                            key={deg}
                                                            onClick={() => updateActiveProp('angle', deg)}
                                                            className={`w-8 h-8 flex items-center justify-center text-[8px] font-black rounded-lg border transition-all ${activeProps.angle === deg ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-400 border-gray-100 hover:border-indigo-300'}`}
                                                        >
                                                            {deg}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-black text-indigo-400 uppercase">Color</span>
                                                <input type="color" className="flex-1 h-8 rounded-lg cursor-pointer border-2 border-white shadow-sm" value={activeProps.fill} onChange={(e) => updateActiveProp('fill', e.target.value)} />
                                            </div>
                                        </section>
                                    )}

                                    {activeObject && (activeObject.type === 'image' || activeObject.type === 'FabricImage' || activeObject.name === 'photo_placeholder' || activeObject.type === 'rect' || activeObject.type === 'circle' || activeObject.type === 'group') && (
                                        <section className="bg-gradient-to-br from-amber-50 to-orange-50 p-4 rounded-2xl border border-amber-100 animate-in zoom-in-95 duration-200">
                                            <h4 className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-3 text-center">Image & Shape Styling</h4>

                                            <div className="space-y-3">
                                                {/* Border Radius - Multi-Corner */}
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between px-1">
                                                        <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Border Radius</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {[
                                                            { label: 'TL', prop: 'rx_0' },
                                                            { label: 'TR', prop: 'rx_1' },
                                                            { label: 'BL', prop: 'rx_3' },
                                                            { label: 'BR', prop: 'rx_2' }
                                                        ].map((corner, idx) => (
                                                            <div key={corner.prop} className="flex items-center bg-white border border-amber-200 rounded-lg px-2 py-1.5 shadow-sm focus-within:border-amber-400 transition-colors">
                                                                <span className="text-[8px] font-black text-amber-400 w-5">{corner.label}</span>
                                                                <input
                                                                    type="number"
                                                                    className="w-full text-[11px] font-bold outline-none bg-transparent"
                                                                    value={activeProps.rx ? activeProps.rx[idx === 2 ? 3 : idx === 3 ? 2 : idx] : 0}
                                                                    onChange={(e) => updateActiveProp(corner.prop, e.target.value)}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Stroke Controls */}
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 flex items-center bg-white border border-amber-200 rounded-lg px-3 py-2 shadow-sm">
                                                        <span className="text-[9px] font-black text-gray-400 mr-3">BORDER</span>
                                                        <input
                                                            type="number"
                                                            className="w-full text-sm font-bold outline-none"
                                                            value={activeProps.strokeWidth || 0}
                                                            onChange={(e) => updateActiveProp('strokeWidth', e.target.value)}
                                                        />
                                                    </div>
                                                    <input
                                                        type="color"
                                                        className="w-10 h-10 p-1 rounded-lg bg-white border border-amber-200 cursor-pointer shadow-sm"
                                                        value={activeProps.stroke || '#6366F1'}
                                                        onChange={(e) => updateActiveProp('stroke', e.target.value)}
                                                    />
                                                </div>

                                                {/* Angle for Images */}
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 flex items-center bg-white border border-amber-200 rounded-lg px-3 py-2 shadow-sm">
                                                        <span className="text-[10px] font-black text-gray-400 mr-3 italic">ANGLE</span>
                                                        <input
                                                            type="number"
                                                            className="w-full text-sm font-bold outline-none"
                                                            value={activeProps.angle || 0}
                                                            onChange={(e) => updateActiveProp('angle', e.target.value)}
                                                        />
                                                        <span className="text-xs font-bold text-gray-300 ml-1">°</span>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        {[0, 90, 180, 270].map(deg => (
                                                            <button
                                                                key={deg}
                                                                onClick={() => updateActiveProp('angle', deg)}
                                                                className={`w-8 h-8 flex items-center justify-center text-[8px] font-black rounded-lg border transition-all ${activeProps.angle === deg ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-400 border-amber-100 hover:border-amber-300'}`}
                                                            >
                                                                {deg}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Fill Color for Shapes/Group Backgrounds */}
                                                <div className="flex items-center justify-between gap-4 pt-4 border-t border-amber-100">
                                                    <div className="flex flex-col gap-1 w-full">
                                                        <span className="text-[9px] font-black text-amber-500 uppercase">Background & Fill</span>
                                                        <input
                                                            type="color"
                                                            className="w-full h-8 rounded-lg cursor-pointer border-2 border-white shadow-sm"
                                                            value={activeProps.fill || '#F8FAFC'}
                                                            onChange={(e) => updateActiveProp('fill', e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-1 w-full relative">
                                                        <span className="text-[9px] font-black text-amber-500 uppercase flex justify-between">
                                                            <span>Opacity</span>
                                                            <span className="text-gray-400 font-mono">{(activeProps.opacity !== undefined ? activeProps.opacity : 1).toFixed(2)}</span>
                                                        </span>
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max="1"
                                                            step="0.05"
                                                            className="w-full h-8 accent-amber-500"
                                                            value={activeProps.opacity !== undefined ? activeProps.opacity : 1}
                                                            onChange={(e) => updateActiveProp('opacity', parseFloat(e.target.value))}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </section>
                                    )}

                                    {activeObject && (
                                        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden animate-in zoom-in-95 duration-200">
                                            <div className="bg-gray-50/50 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                    <Layers className="w-3 h-3" /> Layout & Alignment
                                                </h4>
                                            </div>
                                            <div className="p-4 space-y-4">
                                                {/* Alignment Grid */}
                                                <div className="grid grid-cols-3 gap-2">
                                                    <button onClick={() => alignObjects('left')} className="p-2.5 flex items-center justify-center bg-white border border-gray-100 rounded-xl hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm group" title="Align Left">
                                                        <AlignStartVertical className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" />
                                                    </button>
                                                    <button onClick={() => alignObjects('center')} className="p-2.5 flex items-center justify-center bg-white border border-gray-100 rounded-xl hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm group" title="Align Center (Horizontal)">
                                                        <AlignCenterVertical className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" />
                                                    </button>
                                                    <button onClick={() => alignObjects('right')} className="p-2.5 flex items-center justify-center bg-white border border-gray-100 rounded-xl hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm group" title="Align Right">
                                                        <AlignEndVertical className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" />
                                                    </button>
                                                    <button onClick={() => alignObjects('top')} className="p-2.5 flex items-center justify-center bg-white border border-gray-100 rounded-xl hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm group" title="Align Top">
                                                        <AlignStartHorizontal className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" />
                                                    </button>
                                                    <button onClick={() => alignObjects('middle')} className="p-2.5 flex items-center justify-center bg-white border border-gray-100 rounded-xl hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm group" title="Align Middle (Vertical)">
                                                        <AlignCenterHorizontal className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" />
                                                    </button>
                                                    <button onClick={() => alignObjects('bottom')} className="p-2.5 flex items-center justify-center bg-white border border-gray-100 rounded-xl hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm group" title="Align Bottom">
                                                        <AlignEndHorizontal className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" />
                                                    </button>
                                                </div>

                                                {/* Layer Controls */}
                                                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-gray-50">
                                                    <button onClick={() => { fabricCanvas.bringObjectToFront(activeObject); fabricCanvas.requestRenderAll(); }} className="flex flex-col items-center justify-center gap-1 py-1.5 bg-white border border-gray-100 rounded-xl text-[8px] font-black text-gray-500 uppercase tracking-tight hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm">
                                                        <Layers className="w-3 h-3" /> To Front
                                                    </button>
                                                    <button onClick={() => { fabricCanvas.bringObjectForward(activeObject); fabricCanvas.requestRenderAll(); }} className="flex flex-col items-center justify-center gap-1 py-1.5 bg-white border border-gray-100 rounded-xl text-[8px] font-black text-gray-500 uppercase tracking-tight hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm">
                                                        <Layers className="w-3 h-3 opacity-75" /> Up
                                                    </button>
                                                    <button onClick={() => { fabricCanvas.sendObjectBackwards(activeObject); fabricCanvas.requestRenderAll(); }} className="flex flex-col items-center justify-center gap-1 py-1.5 bg-white border border-gray-100 rounded-xl text-[8px] font-black text-gray-500 uppercase tracking-tight hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm">
                                                        <Layers className="w-3 h-3 opacity-50" /> Down
                                                    </button>
                                                    <button onClick={() => { fabricCanvas.sendObjectToBack(activeObject); fabricCanvas.requestRenderAll(); }} className="flex flex-col items-center justify-center gap-1 py-1.5 bg-white border border-gray-100 rounded-xl text-[8px] font-black text-gray-500 uppercase tracking-tight hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm">
                                                        <Layers className="w-3 h-3 opacity-25" /> To Back
                                                    </button>
                                                </div>

                                                <div className="flex justify-center mt-2">
                                                    <button onClick={handleDuplicateLayer} className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-[8px] font-black text-indigo-700 uppercase tracking-tight hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                                                        <Copy className="w-3 h-3" /> Duplicate Component
                                                    </button>
                                                </div>

                                                {/* Canvas Centering */}
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button onClick={centerObject} className="py-2.5 bg-indigo-50 text-indigo-700 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all">Canvas H</button>
                                                    <button onClick={centerObjectV} className="py-2.5 bg-indigo-50 text-indigo-700 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all">Canvas V</button>
                                                </div>


                                            </div>
                                        </section>
                                    )}

                                    <section>
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center"><Palette className="w-3 h-3 mr-2 text-indigo-400" /> Page Background</h4>
                                        </div>
                                        <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
                                            <div className="flex gap-1.5 flex-1">
                                                <button onClick={() => changeBg('#ffffff')} className={`w-6 h-6 rounded-lg border border-white bg-white shadow-sm ${bgColor === '#ffffff' ? 'ring-2 ring-indigo-500' : ''}`} title="White" />
                                                <button onClick={() => changeBg('#f3f4f6')} className={`w-6 h-6 rounded-lg border border-white bg-gray-100 shadow-sm ${bgColor === '#f3f4f6' ? 'ring-2 ring-indigo-500' : ''}`} title="Subtle Grey" />
                                                <button onClick={() => changeBg('#111827')} className={`w-6 h-6 rounded-lg border border-white bg-gray-900 shadow-sm ${bgColor === '#111827' ? 'ring-2 ring-indigo-500' : ''}`} title="Dark" />
                                            </div>
                                            <div className="h-6 w-px bg-gray-200" />
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="color"
                                                    value={bgColor}
                                                    onChange={(e) => changeBg(e.target.value)}
                                                    className="w-8 h-8 p-0 border-0 bg-transparent cursor-pointer rounded-lg overflow-hidden"
                                                />
                                                <span className="text-[10px] font-black text-gray-400 font-mono hidden sm:block">{bgColor.toUpperCase()}</span>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Locked Layers Panel - Moved inside Editor Tab */}
                                    <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden animate-in zoom-in-95 duration-200">
                                        <div className="bg-gray-50/50 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                <Lock className="w-3 h-3" /> Locked Layers
                                            </h4>
                                            <button onClick={unlockAll} className="text-[8px] font-black text-indigo-600 hover:text-white hover:bg-indigo-600 px-2 py-1 rounded-md border border-indigo-100 transition-all uppercase tracking-tighter">
                                                Unlock All
                                            </button>
                                        </div>
                                        <div className="p-2 max-h-40 overflow-y-auto custom-scrollbar">
                                            <div className="space-y-1">
                                                {layers.filter(l => !l.selectable).map((layer, idx) => (
                                                    <div
                                                        key={idx}
                                                        className={`flex items-center justify-between p-2 rounded-xl border transition-all ${activeObject === layer ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-transparent hover:bg-gray-50'}`}
                                                    >
                                                        <div
                                                            className="flex items-center gap-2 flex-1 cursor-pointer overflow-hidden"
                                                            onClick={() => selectLayer(layer)}
                                                        >
                                                            <div className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
                                                                {layer.type === 'textbox' || layer.type === 'text' ? <Type className="w-3 h-3 text-gray-400" /> : <ImageIcon className="w-3 h-3 text-gray-400" />}
                                                            </div>
                                                            <span className="text-[10px] font-bold text-gray-700 truncate capitalize">
                                                                {layer.name || layer.type || 'Object'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); toggleLock(layer); }}
                                                                className="p-1.5 rounded-lg transition-all text-indigo-600 bg-indigo-100 hover:bg-indigo-200"
                                                                title="Unlock"
                                                            >
                                                                <Lock className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                                {layers.filter(l => !l.selectable).length === 0 && (
                                                    <div className="p-4 text-center text-gray-400 text-[10px] font-medium italic">No locked layers.</div>
                                                )}
                                            </div>
                                        </div>
                                    </section>

                                    {/* Delete Layer Button - Moved inside Editor Tab */}
                                    {activeObject && (
                                        <button
                                            onClick={() => {
                                                if (window.confirm("Remove this layer from design?")) {
                                                    fabricCanvas.remove(activeObject);
                                                    fabricCanvas.discardActiveObject();
                                                    fabricCanvas.requestRenderAll();
                                                    setActiveObject(null);
                                                }
                                            }}
                                            className="w-full py-4 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-black rounded-2xl border border-red-100 shadow-sm"
                                        >
                                            DELETE LAYER
                                        </button>
                                    )}
                                </>
                            ) : (
                                <>
                                    <section className="animate-in slide-in-from-right-2 duration-300">
                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center"><School className="w-3 h-3 mr-2 text-indigo-400" /> Branding</h4>
                                        <div className="grid grid-cols-5 gap-1">
                                            <button onClick={() => importInstitutionInfo('logo')} className="py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[8px] font-black rounded-xl transition-all border border-indigo-100">LOGO</button>
                                            <button onClick={() => importInstitutionInfo('name')} className="py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[8px] font-black rounded-xl transition-all border border-indigo-100">NAME</button>
                                            <button onClick={() => importInstitutionInfo('address')} className="py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[8px] font-black rounded-xl transition-all border border-indigo-100">ADDR</button>
                                            <button onClick={() => importInstitutionInfo('phone')} className="py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[8px] font-black rounded-xl transition-all border border-indigo-100">PHONE</button>
                                            <button onClick={() => importInstitutionInfo('email')} className="py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[8px] font-black rounded-xl transition-all border border-indigo-100">EMAIL</button>
                                            <button onClick={() => importInstitutionInfo('signature')} className="py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[8px] font-black rounded-xl transition-all border border-amber-100">AUTH SIGN</button>
                                        </div>
                                    </section>

                                    <section className="animate-in slide-in-from-right-2 duration-300 delay-75">
                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center"><User className="w-3 h-3 mr-2 text-indigo-400" /> Dynamic Info</h4>
                                        <div className="grid grid-cols-2 gap-1">
                                            {isActive('name') && <button onClick={() => addPlaceholder('name')} className="py-3 bg-gray-50 hover:bg-gray-200 text-gray-700 text-[9px] font-bold rounded-lg transition-all border border-gray-100 uppercase">Student Name</button>}
                                            {isActive('class') && <button onClick={() => addPlaceholder('class')} className="py-3 bg-gray-50 hover:bg-gray-200 text-gray-700 text-[9px] font-bold rounded-lg transition-all border border-gray-100 uppercase">Class/Sec</button>}
                                            {isActive('contact') && <button onClick={() => addPlaceholder('contact')} className="py-3 bg-gray-50 hover:bg-gray-200 text-gray-700 text-[9px] font-bold rounded-lg transition-all border border-gray-100 uppercase">Emergency No</button>}
                                            {isActive('address') && <button onClick={() => addPlaceholder('address')} className="py-3 bg-gray-50 hover:bg-gray-200 text-gray-700 text-[9px] font-bold rounded-lg transition-all border border-gray-100 uppercase">Home Address</button>}
                                            {isActive('blood') && <button onClick={() => addPlaceholder('blood')} className="py-3 bg-gray-50 hover:bg-gray-200 text-gray-700 text-[9px] font-bold rounded-lg transition-all border border-gray-100 uppercase">Blood Group</button>}
                                            {isActive('father') && <button onClick={() => addPlaceholder('father')} className="py-3 bg-gray-50 hover:bg-gray-200 text-gray-700 text-[9px] font-bold rounded-lg transition-all border border-gray-100 uppercase">Father's Name</button>}
                                            {isActive('mother') && <button onClick={() => addPlaceholder('mother')} className="py-3 bg-gray-50 hover:bg-gray-200 text-gray-700 text-[9px] font-bold rounded-lg transition-all border border-gray-100 uppercase">Mother's Name</button>}

                                            {dynamicVars.map(v => (
                                                <button
                                                    key={v.id}
                                                    onClick={() => addText(v.placeholder, { fill: '#4F46E5', fontWeight: 'bold' })}
                                                    className="py-3 px-2 bg-pink-50 hover:bg-pink-100 text-pink-700 text-[9px] font-black rounded-lg transition-all border border-pink-100 uppercase truncate"
                                                    title={v.name}
                                                >
                                                    {v.name.length > 15 ? v.name.substring(0, 14) + '..' : v.name}
                                                </button>
                                            ))}
                                            <button onClick={() => addPlaceholder('photo')} className="col-span-2 py-3 bg-white hover:bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-lg transition-all border-dashed border-2 border-indigo-200 uppercase tracking-widest">Photo</button>
                                        </div>
                                    </section>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
