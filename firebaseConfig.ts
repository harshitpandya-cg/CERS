
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: Replace the following with your app's Firebase project configuration
// Get these from: Firebase Console -> Project Settings -> General -> Your Apps
const firebaseConfig = {
  apiKey: "AIzaSyCLFHSOiq15OzwFKJcOO1D925NhKyu3mOc",
  authDomain: "cers-plus.firebaseapp.com",
  projectId: "cers-plus",
  storageBucket: "cers-plus.firebasestorage.app",
  messagingSenderId: "994111835488",
  appId: "1:994111835488:web:d56db532de4975d50ca205",
  measurementId: "G-4JC1DVST9P"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore
export const db = getFirestore(app);
