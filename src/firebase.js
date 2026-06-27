import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC9qghhWcQ4eNB4FrC7lUcHoix7wcbG90A",
  authDomain: "dungeons-nd-dragons.firebaseapp.com",
  projectId: "dungeons-nd-dragons",
  storageBucket: "dungeons-nd-dragons.firebasestorage.app",
  messagingSenderId: "357930872022",
  appId: "1:357930872022:web:a2b65c8b7c3846d58a2d77",
  measurementId: "G-P4MSP9BH2N"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
