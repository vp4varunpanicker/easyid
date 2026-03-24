
import { Canvas, FabricImage, StaticCanvas, Rect } from 'fabric';
import { jsPDF } from 'jspdf';
import { db } from "../lib/firebase";
import { collection, getDocs } from "firebase/firestore";

/**
 * Normalizes URLs to be relative if they point to the local upload server.
 */
const normalizeUrl = (url) => {
    if (!url) return url;
    if (typeof url !== 'string') return url;
    return url.replace(/^http:\/\/localhost:5000\//, '/');
};

/**
 * Fetches an image and converts it to a DataURL to avoid Tainted Canvas issues.
 */
const getCleanImage = async (url) => {
    if (!url) return null;
    if (url.startsWith('data:')) return url; // Already a data URL
    const targetUrl = normalizeUrl(url);

    // Every URL should be pre-fetched to ensure CORS compatibility
    // and avoid tainting the canvas.

    try {
        const response = await fetch(targetUrl, { mode: 'cors', credentials: 'omit' });
        if (!response.ok) throw new Error(`Fetch failed with status: ${response.status}`);
        const blob = await response.blob();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (err) {
        console.warn("CRITICAL: Image cleanup failed for:", targetUrl, err);
        // Do NOT return the original URL here, as it will taint the canvas.
        // Returning null allows the app to skip this broken image rather than crashing the export.
        return null;
    }
};

/**
 * Generates an ID card image based on a student and a layout.
 */
export const generateCardSide = async (student, layoutInput) => {
    if (!layoutInput) return null;

    // 1. Parse and Deep Clone layout to avoid side-effects
    let layout;
    try {
        if (typeof layoutInput === 'string') {
            layout = JSON.parse(layoutInput);
        } else {
            // Deep clone object to avoid modifying the original React state/prop
            layout = JSON.parse(JSON.stringify(layoutInput));
        }
    } catch (e) {
        console.error("Invalid layout JSON:", e);
        return null;
    }

    // 2. Create a virtual Canvas (StaticCanvas is better for off-screen generation)
    // We create it at the DESIGN size first, then use a multiplier for high-res export
    const virtualCanvas = document.createElement('canvas');
    virtualCanvas.width = 320;
    virtualCanvas.height = 507;

    const fabricCanvas = new StaticCanvas(virtualCanvas, {
        height: 507,
        width: 320,
        backgroundColor: layout.backgroundColor || '#ffffff'
    });

    try {
        // 3. Normalize and Pre-fetch all images in the layout
        if (layout && Array.isArray(layout.objects)) {
            for (let i = 0; i < layout.objects.length; i++) {
                const obj = layout.objects[i];
                if (obj.type === 'image' && obj.src) {
                    try {
                        obj.src = await getCleanImage(obj.src);
                        obj.crossOrigin = 'anonymous'; // Force for future reference
                    } catch (e) {
                        console.warn("Failed to clean image source:", obj.src);
                    }
                }

                // Deep scan groups
                if (obj.type === 'group' && Array.isArray(obj.objects)) {
                    for (let j = 0; j < obj.objects.length; j++) {
                        const sub = obj.objects[j];
                        if (sub.type === 'image' && sub.src) {
                            try {
                                sub.src = await getCleanImage(sub.src);
                                sub.crossOrigin = 'anonymous';
                            } catch (e) {
                                console.warn("Failed to clean group image source:", sub.src);
                            }
                        }
                    }
                }
            }
        }

        // 4. Load the normalized layout
        // For Fabric 7, loadFromJSON is a promise
        await fabricCanvas.loadFromJSON(layout);

        // Ensure everything is rendered
        fabricCanvas.renderAll();

        const objects = fabricCanvas.getObjects();

        // Additional check: Ensure all loaded images on canvas have crossOrigin set
        objects.forEach(obj => {
            if (obj.type === 'image' || obj._element) {
                if (obj.setElement && obj._element) {
                    obj._element.crossOrigin = 'anonymous';
                }
                obj.set('crossOrigin', 'anonymous');
            }
        });
        let photoPlaceholder = null;

        // 5. Populate dynamic text and find photo placeholder
        const varsSnapshot = await getDocs(collection(db, "variables"));
        const dynamicVars = varsSnapshot.docs.map(doc => doc.data());

        objects.forEach((obj) => {
            // Check for text objects
            if (obj.type === 'textbox' || obj.type === 'text' || (obj.text && typeof obj.text === 'string')) {
                let text = obj.text || '';
                const map = {
                    '{Student Name}': student.name || '---',
                    '{Class}': student.class || '---',
                    '{Address}': student.address || '---',
                    '{Emergency Contact}': student.emergencyContact || '---',
                    '{Blood Group}': student.bloodGroup || '---',
                    '{Father\'s Name}': student.fatherName || '---',
                    '{Mother\'s Name}': student.motherName || '---'
                };

                // Add dynamic variables to map
                dynamicVars.forEach(v => {
                    map[v.placeholder] = student[v.slug] || '---';
                });

                let changed = false;
                Object.keys(map).forEach(key => {
                    if (text.includes(key)) {
                        text = text.replaceAll(key, String(map[key] || '---'));
                        changed = true;
                    }
                });
                if (changed) {
                    obj.set({
                        text,
                        originY: 'top' // Force variables to grow downwards from their top position
                    });
                }
            }

            // Find photo placeholder (Robust Detection)
            const isNamedPlaceholder = obj.name === 'photo_placeholder' || obj.get?.('name') === 'photo_placeholder';

            // Fuzzy detection: if it's a group, check if any of its children is a Textbox saying "PHOTO"
            let isFuzzyPlaceholder = false;
            if (obj.type === 'group' && obj.getObjects) {
                isFuzzyPlaceholder = obj.getObjects().some(sub =>
                    (sub.type === 'textbox' || sub.type === 'text') &&
                    sub.text?.toUpperCase().includes('PHOTO')
                );
            }

            if (isNamedPlaceholder || isFuzzyPlaceholder) {
                photoPlaceholder = obj;
            }
        });

        // 6. Populate student photo
        const DEFAULT_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0Ij48cmVjdCB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIGZpbGw9IiM5Y2EzYWYiLz48cGF0aCBkPSJNMTIgMTJDMTQuMjEgMTIgMTYgMTAuMjEgMTYgOEMxNiA1Ljc5IDE0LjIxIDQgMTIgNEM5Ljc5IDQgOCA1Ljc5IDggOEM4IDEwLjIxIDkuNzkgMTIgMTIgMTJaTTEyIDE0QzkuMzMgMTQgNCAxNS4zNCA0IDE4VjIwSDIwVjE4QzIwIDE1LjM0IDE0LjY3IDE0IDEyIDE0WiIgZmlsbD0id2hpdGUiLz48L3N2Zz4=';
        const photoUrl = student.photoUrl || DEFAULT_AVATAR;

        if (photoUrl && photoPlaceholder) {
            try {
                const cleanPhotoUrl = await getCleanImage(photoUrl);

                // Use Fabric's fromURL to be safe
                const fabricImg = await FabricImage.fromURL(cleanPhotoUrl, {
                    crossOrigin: 'anonymous',
                });

                // Match placeholder positioning and scale
                // If it's a group, we want it to cover the same area as the group
                const targetWidth = photoPlaceholder.getScaledWidth();
                const targetHeight = photoPlaceholder.getScaledHeight();

                // Calculate scale to "cover" the placeholder area (aspect fill)
                const scaleX = targetWidth / fabricImg.width;
                const scaleY = targetHeight / fabricImg.height;
                const scale = Math.max(scaleX, scaleY);

                // Get corner radius and border from placeholder
                const rx = photoPlaceholder.rx ||
                    (photoPlaceholder.getObjects && photoPlaceholder.getObjects('rect')[0]?.rx) || 0;
                const stroke = photoPlaceholder.stroke ||
                    (photoPlaceholder.getObjects && photoPlaceholder.getObjects('rect')[0]?.stroke) || null;
                const strokeWidth = photoPlaceholder.strokeWidth ||
                    (photoPlaceholder.getObjects && photoPlaceholder.getObjects('rect')[0]?.strokeWidth) || 0;

                const center = photoPlaceholder.getCenterPoint();
                // To anchor image to the top instead of the center,
                // we calculate the top-center point of the placeholder.
                const topY = center.y - (targetHeight / 2);

                fabricImg.set({
                    scaleX: scale,
                    scaleY: scale,
                    left: center.x,
                    top: topY,
                    angle: photoPlaceholder.angle,
                    originX: 'center',
                    originY: 'top',
                    rx: rx
                });

                // Always apply clipPath to ensure the image stays within the placeholder bounds (1:1 or 3:4 or whatever it is)
                // The clip path must also now be relative to the center of the image
                const clipRect = new Rect({
                    left: 0,
                    top: -(fabricImg.height / 2) + (targetHeight / scale / 2),
                    width: targetWidth / scale,
                    height: targetHeight / scale,
                    rx: (rx || 0) / scale,
                    ry: (rx || 0) / scale,
                    originX: 'center',
                    originY: 'center',
                });
                fabricImg.set('clipPath', clipRect);

                // Add to canvas at the same index as placeholder
                const index = fabricCanvas.getObjects().indexOf(photoPlaceholder);
                fabricCanvas.add(fabricImg);
                if (index !== -1) {
                    fabricCanvas.moveObjectTo(fabricImg, index);
                }

                // Add border directly here using target dimensions
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
                        rx: rx || 0,
                        ry: rx || 0,
                        angle: photoPlaceholder.angle,
                        originX: 'center',
                        originY: 'center',
                        selectable: false,
                        evented: false
                    });
                    fabricCanvas.add(borderRect);
                    if (index !== -1) {
                        fabricCanvas.moveObjectTo(borderRect, index + 1);
                    }
                }

                // Remove placeholder from the actual canvas
                fabricCanvas.remove(photoPlaceholder);
            } catch (e) {
                console.warn("Could not load student photo for preview:", e);
            }
        }

        // 7. General Border Pass: Ensure all images/placeholders show their borders
        // Fabric images often clip their own borders, so we draw them on top
        const finalObjects = [...fabricCanvas.getObjects()];
        finalObjects.forEach(obj => {
            if ((obj.type === 'image' || obj.type === 'FabricImage') && obj.strokeWidth > 0 && obj.stroke) {
                const borderRect = new Rect({
                    left: obj.left,
                    top: obj.top,
                    width: obj.getScaledWidth(),
                    height: obj.getScaledHeight(),
                    fill: 'transparent',
                    stroke: obj.stroke,
                    strokeWidth: obj.strokeWidth,
                    strokeUniform: true,
                    rx: obj.rx || 0,
                    ry: obj.rx || 0,
                    angle: obj.angle,
                    originX: obj.originX,
                    originY: obj.originY,
                    selectable: false,
                    evented: false
                });
                fabricCanvas.add(borderRect);
                const objIndex = fabricCanvas.getObjects().indexOf(obj);
                fabricCanvas.moveObjectTo(borderRect, objIndex + 1);
            }
        });

        fabricCanvas.renderAll();

        // 8. Generate High-Res DataURL using multiplier
        const dataUrl = fabricCanvas.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: 2 // Export at 640x1014
        });

        return dataUrl;
    } catch (err) {
        console.error("Canvas generation error:", err);
        throw err;
    } finally {
        fabricCanvas.dispose();
    }
};

/**
 * Generates both sides and packs them into a single PDF.
 */
export const downloadIDCardPDF = async (student, templateLayoutInput) => {
    if (!templateLayoutInput) return;
    const layout = typeof templateLayoutInput === 'string' ? JSON.parse(templateLayoutInput) : templateLayoutInput;

    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [54, 86] // Standard CR80 Vertical size
    });

    // Process sides
    const sides = [];
    // Normalization: front side can be layout.front OR the layout itself if it has objects
    const sideFront = layout.front || (layout.objects ? layout : null);
    const sideBack = layout.isDoubleSided !== false ? layout.back : null;

    if (sideFront) {
        sides.push(await generateCardSide(student, sideFront));
    }

    if (sideBack) {
        sides.push(await generateCardSide(student, sideBack));
    }

    // Add sides to PDF
    sides.forEach((imgData, index) => {
        if (!imgData) return;
        if (index > 0) pdf.addPage([54, 86], 'portrait');
        pdf.addImage(imgData, 'PNG', 0, 0, 54, 86);
    });

    // Generate filename: Name_Class_Section_Year
    const studentName = (student.name || 'Student').replace(/\s+/g, '_');
    const classInfo = student.class || '';
    const [className = '', section = ''] = classInfo.split('-');
    const year = new Date().getFullYear();
    const filename = `${studentName}_${className}_${section}_${year}.pdf`;

    pdf.save(filename);
};

// Keep for compatibility but prioritize PDF
export const generateCardCanvas = async (student, layout) => {
    return { front: await generateCardSide(student, layout) };
};
