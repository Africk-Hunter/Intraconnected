import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAWUtJuGgekpbt-aAXNMNPy2EiNw3-IwI0",
    authDomain: "interconnectedness-3a37b.firebaseapp.com",
    projectId: "interconnectedness-3a37b",
    storageBucket: "interconnectedness-3a37b.firebasestorage.app",
    messagingSenderId: "1004696732601",
    appId: "1:1004696732601:web:bbf96b44da0f891387ec68",
    measurementId: "G-Z446LHYRS8"
  };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { db, auth };