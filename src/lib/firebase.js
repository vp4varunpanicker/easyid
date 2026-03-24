import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// TODO: Replace with your actual Firebase configuration
// You can get this from the Firebase Console -> Project Settings -> General -> Your apps
const firebaseConfig = {
    apiKey: "AIzaSyCpQJXSCFN--LknPqn-Rs6BR1DbYVWQEwQ",
    authDomain: "idcardiseasy.firebaseapp.com",
    projectId: "idcardiseasy",
    storageBucket: "idcardiseasy.appspot.com",
    messagingSenderId: "446593705678",
    appId: "1:446593705678:web:ce1d670816a57d3b94d29f"
};


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
