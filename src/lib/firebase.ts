import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBWK0dr-8M1olaeXNStS3FNJGpEQUkFM-U",
  authDomain: "freeapikey-3e430.firebaseapp.com",
  projectId: "freeapikey-3e430",
  storageBucket: "freeapikey-3e430.firebasestorage.app",
  messagingSenderId: "338441477842",
  appId: "1:338441477842:web:d44b3484680ca7a62e970b",
  measurementId: "G-R8T4HGZTDG"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
