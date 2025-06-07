import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyAx8r4cjSGIkWVxUpTl14X89xXkSrUfpG0",
  authDomain: "fitness-trainer-ai-gemini.firebaseapp.com",
  projectId: "fitness-trainer-ai-gemini",
  storageBucket: "fitness-trainer-ai-gemini.firebasestorage.app",
  messagingSenderId: "124719960704",
  appId: "1:124719960704:web:4877d17b2a28e884b54c65",
  measurementId: "G-FVCHEL63PV",
  databaseURL: "https://fitness-trainer-ai-gemini-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
export const database = getDatabase(app); 