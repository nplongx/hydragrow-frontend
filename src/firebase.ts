import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyAjxXN5YIUztbY_pSpor1xsleEvHNuZqnc",
  authDomain: "hydragrow-iot.firebaseapp.com",
  projectId: "hydragrow-iot",
  storageBucket: "hydragrow-iot.firebasestorage.app",
  messagingSenderId: "810716913891",
  appId: "1:810716913891:web:a2fea867c0d63df1bfa5d6",
  measurementId: "G-14M8B93S7V"
};

export const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);
