# School ID Card Generator System

## Setup Instructions

### 1. Configure Firebase
1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Create a new project.
3. Enable **Authentication** (Email/Password provider).
4. Enable **Firestore Database** (Start in Test Mode).
5. Enable **Storage**.
6. Go to Project Settings -> General, scroll down and copy the `firebaseConfig` object.
7. Open `src/lib/firebase.js` and replace the placeholder config with your actual config.

### 2. Create Initial Admin User (Manual Step)
Since there is no signup page (checking roles requires admin), you likely need to create the first user manually in Firebase Authentication, and then manually add a document in Firestore `users` collection:
- **Collection**: `users`
- **Document ID**: `(The UID from Authentication)`
- **Field**: `role` (string) = `admin`

### 3. Run the Application
```bash
npm install
npm run dev
```

### 4. Usage
- **Admin**: Login with the admin account to design cards.
  - To finalize a design, you must input a name and click **Save**. 
  - To select the card design used for students, open the **Layouts** library and click the **Star** (Set as Default) icon on your preferred template.
  - To prevent accidental edits, click the **Lock** button on the saved template.
- **Teacher**: Login with a teacher account (created by admin) to add students.

For full instructions, please refer to the `docs.html` file included in this repository.
To deploy to Firebase Hosting:
```bash
npm run build
firebase login
firebase init hosting
firebase deploy
```
