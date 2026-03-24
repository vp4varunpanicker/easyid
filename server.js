import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import admin from 'firebase-admin';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin (Try to load serviceAccountKey.json)
try {
    const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        // Check if it's a dummy file (contains YOUR_PROJECT_ID) to avoid initialization error
        if (serviceAccount.project_id && serviceAccount.project_id !== 'YOUR_PROJECT_ID') {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log("Firebase Admin initialized successfully.");
        } else {
            console.log("Pending Service Account configuration: serviceAccountKey.json is a placeholder.");
        }
    } else {
        console.log("No serviceAccountKey.json found. Password updates will be disabled.");
    }
} catch (error) {
    console.error("Failed to initialize Firebase Admin:", error);
}


const app = express();
const PORT = 5000;

// Auto-Sync License Logic
const syncLicenseOnStartup = async () => {
    const licensePath = path.join(__dirname, 'license.json');
    if (fs.existsSync(licensePath)) {
        try {
            const licenseData = JSON.parse(fs.readFileSync(licensePath, 'utf8'));
            const expiryDate = new Date(licenseData.expiryDate);
            const today = new Date();
            const status = today <= expiryDate ? 'active' : 'expired';

            if (admin.apps.length > 0) {
                await admin.firestore().collection('schools').doc('main').set({
                    email: licenseData.institutionEmail,
                    licenseInfo: {
                        status: status,
                        activatedAt: new Date().toISOString(),
                        expiryDate: licenseData.expiryDate,
                        schoolName: licenseData.schoolName,
                        activatedBy: 'system-auto-sync',
                        activatedKey: licenseData.masterKey.toLowerCase(),
                        activatedEmail: licenseData.institutionEmail,
                        lastSyncedAt: new Date().toISOString()
                    }
                }, { merge: true });
                console.log("License automatically synchronized with Firestore.");
            }
        } catch (error) {
            console.error("Auto-license sync failed:", error);
        }
    }
};

syncLicenseOnStartup();


app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res) => {
        res.set('Access-Control-Allow-Origin', '*');
    }
}));

// Configure Multer for local storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Upload Endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
});

// Email endpoints
app.post('/api/test-email', async (req, res) => {
    const { smtp, to } = req.body;

    try {
        const transporter = nodemailer.createTransport({
            host: smtp.host,
            port: parseInt(smtp.port),
            secure: smtp.secure,
            auth: {
                user: smtp.user,
                pass: smtp.pass
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        await transporter.sendMail({
            from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
            to: to,
            subject: "SMTP Configuration Test",
            text: "Success! Your SMTP settings are correctly configured for the School ID Management System.",
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #f3f4f6; border-radius: 24px; background-color: #ffffff;">
                    <div style="margin-bottom: 32px; text-align: center;">
                        <span style="font-size: 24px; font-weight: 900; color: #4f46e5; text-transform: uppercase; letter-spacing: 4px;">easyid</span>
                    </div>
                    <div style="padding: 20px; border-radius: 16px; background-color: #f5f3ff; border: 1px solid #ede9fe;">
                        <h2 style="color: #4f46e5; margin-top: 0;">SMTP Test Successful</h2>
                        <p style="color: #4b5563;">Success! Your SMTP settings are correctly configured for the <strong>School ID Management System</strong>.</p>
                        <p style="color: #4b5563; margin-bottom: 0;">This is a test email sent from your dashboard.</p>
                    </div>
                    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center;">
                        <p style="font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 2px; font-weight: bold; margin: 0;">Developed by <span style="color: #4f46e5;">eglobe</span></p>
                    </div>
                </div>
            `
        });

        res.json({ success: true });
    } catch (error) {
        console.error("Email error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/send-welcome-email', async (req, res) => {
    const { smtp, user } = req.body;

    try {
        const transporter = nodemailer.createTransport({
            host: smtp.host,
            port: parseInt(smtp.port),
            secure: smtp.secure,
            auth: {
                user: smtp.user,
                pass: smtp.pass
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        await transporter.sendMail({
            from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
            to: user.email,
            subject: `Welcome to School ID Portal - Your Account Details`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #f3f4f6; border-radius: 24px; background-color: #ffffff;">
                    <div style="margin-bottom: 32px; text-align: center;">
                        <span style="font-size: 24px; font-weight: 900; color: #4f46e5; text-transform: uppercase; letter-spacing: 4px;">easyid</span>
                    </div>
                    <h2 style="color: #111827; font-size: 24px; font-weight: 900; margin-top: 0; margin-bottom: 16px; text-align: center;">Welcome, ${user.name}!</h2>
                    <p style="color: #4b5563; text-align: center; margin-bottom: 32px;">Your account has been created on the School ID Management System.</p>
                    
                    <div style="background-color: #f9fafb; padding: 24px; border-radius: 16px; margin: 24px 0; border: 1px solid #f3f4f6;">
                        <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 13px; font-weight: bold; uppercase; tracking: 1px;">ACCOUNT DETAILS</p>
                        <div style="margin-bottom: 8px;">
                            <strong style="color: #374151; font-size: 14px;">Email:</strong>
                            <div style="color: #111827; font-family: monospace; font-size: 16px; margin-top: 4px;">${user.email}</div>
                        </div>
                        <div>
                            <strong style="color: #374151; font-size: 14px;">Password:</strong>
                            <div style="color: #111827; font-family: monospace; font-size: 16px; margin-top: 4px; background: #ffffff; display: inline-block; padding: 4px 8px; border-radius: 6px; border: 1px solid #e5e7eb;">${user.password}</div>
                        </div>
                    </div>

                    <div style="text-align: center; margin-top: 32px;">
                        <a href="http://localhost:5173/login" style="display: inline-block; background-color: #4f46e5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">Login Now</a>
                    </div>

                    <p style="color: #9ca3af; font-size: 13px; text-align: center; margin-top: 32px;">Please login and change your password as soon as possible.</p>

                    <div style="margin-top: 48px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center;">
                        <p style="font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 2px; font-weight: bold; margin: 0;">Developed by <span style="color: #4f46e5;">eglobe</span></p>
                    </div>
                </div>
            `
        });

        res.json({ success: true });
    } catch (error) {
        console.error("Welcome email error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Simple proxy endpoint for sending reset email only
app.post('/api/send-reset-email', async (req, res) => {
    const { smtp, userEmail, userName, newPassword } = req.body;

    try {
        // Attempt to update password in Firebase Auth if Admin SDK is initialized
        if (admin.apps.length > 0) {
            try {
                const userRecord = await admin.auth().getUserByEmail(userEmail);
                await admin.auth().updateUser(userRecord.uid, {
                    password: newPassword
                });
                console.log(`Password updated for user: ${userEmail}`);
            } catch (authError) {
                console.error("Error updating password in Firebase Auth:", authError);
                // Continue to send email even if auth update fails (though ideally we'd want both)
                // However, without serviceAccountKey.json, this will fail. We should perhaps warn?
                if (authError.code === 'auth/internal-error') {
                    // Likely missing credentials or init failure
                }
                throw new Error(`Failed to update password in Firebase: ${authError.message}. Ensure serviceAccountKey.json is valid.`);
            }
        } else {
            console.warn("Firebase Admin SDK not initialized. Skipping password update.");
            throw new Error("Server not configured for password updates. Missing serviceAccountKey.json?");
        }

        const transporter = nodemailer.createTransport({
            host: smtp.host,
            port: parseInt(smtp.port),
            secure: smtp.secure,
            auth: {
                user: smtp.user,
                pass: smtp.pass
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        await transporter.sendMail({
            from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
            to: userEmail,
            subject: `Password Reset - School ID Portal`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #f3f4f6; border-radius: 24px; background-color: #ffffff;">
                    <div style="margin-bottom: 32px; text-align: center;">
                        <span style="font-size: 24px; font-weight: 900; color: #4f46e5; text-transform: uppercase; letter-spacing: 4px;">easyid</span>
                    </div>
                    <h2 style="color: #111827; font-size: 24px; font-weight: 900; margin-top: 0; margin-bottom: 16px; text-align: center;">Password Update</h2>
                    <p style="color: #4b5563; text-align: center; margin-bottom: 32px;">Hello ${userName || 'User'}, your password has been updated by the administrator.</p>
                    
                    <div style="background-color: #f9fafb; padding: 24px; border-radius: 16px; margin: 24px 0; border: 1px solid #f3f4f6;">
                        <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 13px; font-weight: bold; uppercase; tracking: 1px;">NEW CREDENTIALS</p>
                        <div style="margin-bottom: 8px;">
                            <strong style="color: #374151; font-size: 14px;">Email:</strong>
                            <div style="color: #111827; font-family: monospace; font-size: 16px; margin-top: 4px;">${userEmail}</div>
                        </div>
                        <div>
                            <strong style="color: #374151; font-size: 14px;">New Password:</strong>
                            <div style="color: #111827; font-family: monospace; font-size: 16px; margin-top: 4px; background: #ffffff; display: inline-block; padding: 4px 8px; border-radius: 6px; border: 1px solid #e5e7eb;">${newPassword}</div>
                        </div>
                    </div>

                    <div style="text-align: center; margin-top: 32px;">
                        <a href="http://localhost:5173/login" style="display: inline-block; background-color: #4f46e5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px;">Login Now</a>
                    </div>

                    <p style="color: #9ca3af; font-size: 13px; text-align: center; margin-top: 32px;">You can now login with these new credentials.</p>

                    <div style="margin-top: 48px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center;">
                        <p style="font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 2px; font-weight: bold; margin: 0;">Developed by <span style="color: #4f46e5;">eglobe</span></p>
                    </div>
                </div>
            `
        });

        res.json({ success: true });
    } catch (error) {
        console.error("Reset email error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/update-user-email', async (req, res) => {
    const { uid, newEmail } = req.body;

    if (!uid || !newEmail) {
        return res.status(400).json({ error: 'UID and newEmail are required.' });
    }

    try {
        if (admin.apps.length > 0) {
            await admin.auth().updateUser(uid, {
                email: newEmail
            });
            console.log(`Email updated in Auth for UID: ${uid} to ${newEmail}`);

            // Note: Frontend will handle Firestore update for consistency with existing patterns,
            // or we could do it here too. Doing it here is safer.
            await admin.firestore().collection('users').doc(uid).update({
                email: newEmail,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`Email updated in Firestore for UID: ${uid}`);

            res.json({ success: true });
        } else {
            throw new Error("Firebase Admin SDK not initialized.");
        }
    } catch (error) {
        console.error("Update email error:", error);
        res.status(500).json({ error: error.message });
    }
});

// License Verification Endpoint
app.post('/api/license/verify', (req, res) => {
    const { key, email } = req.body;
    const licensePath = path.join(__dirname, 'license.json');
    console.log(`License verification request received. Key: ${key}`);
    console.log(`Looking for license file at: ${licensePath}`);

    if (!fs.existsSync(licensePath)) {
        console.error("License file NOT FOUND at path:", licensePath);
        return res.status(404).json({ error: `Master license file not found at ${licensePath}` });
    }

    try {
        const licenseData = JSON.parse(fs.readFileSync(licensePath, 'utf8'));
        console.log(`Verifying license key: ${key}`);

        if (licenseData.masterKey.toLowerCase() === key.toLowerCase()) {
            // Check email mismatch
            if (licenseData.institutionEmail && licenseData.institutionEmail.toLowerCase() !== email?.toLowerCase()) {
                console.warn(`Email mismatch for key verification. Expected: ${licenseData.institutionEmail}, Got: ${email}`);
                return res.status(403).json({
                    success: false,
                    error: "This license key is not registered for this email address."
                });
            }

            // Check if expired
            const today = new Date();
            const expiry = new Date(licenseData.expiryDate);

            if (today <= expiry) {
                res.json({
                    success: true,
                    message: "License verified successfully.",
                    expiryDate: licenseData.expiryDate,
                    schoolName: licenseData.schoolName
                });
            } else {
                res.status(403).json({
                    success: false,
                    error: "This license key has expired.",
                    expiryDate: licenseData.expiryDate
                });
            }
        } else {
            res.status(401).json({ success: false, error: "Invalid license key." });
        }
    } catch (error) {
        console.error("License verification error:", error);
        res.status(500).json({ error: "Server error during license verification." });
    }
});

// GET endpoint to sync current license.json status with frontend/Firestore
app.get('/api/license/sync', (req, res) => {
    const licensePath = path.join(__dirname, 'license.json');

    if (!fs.existsSync(licensePath)) {
        return res.status(404).json({ error: "License file not founded." });
    }

    try {
        const licenseData = JSON.parse(fs.readFileSync(licensePath, 'utf8'));
        const today = new Date();
        const expiry = new Date(licenseData.expiryDate);

        res.json({
            masterKey: licenseData.masterKey,
            expiryDate: licenseData.expiryDate,
            schoolName: licenseData.schoolName,
            institutionEmail: licenseData.institutionEmail,
            active: today <= expiry
        });
    } catch (error) {
        res.status(500).json({ error: "Sync failed." });
    }
});

app.listen(PORT, () => {
    console.log(`Local upload server running at http://localhost:${PORT}`);
});
