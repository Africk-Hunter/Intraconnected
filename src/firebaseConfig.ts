import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth, indexedDBLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { isNative } from "./utilities/platform";

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
// getAuth() also loads the popup/redirect sign-in machinery, which tries to
// load a frame from firebaseapp.com. Inside the app's WebView (served from
// capacitor://localhost) that commonly leaves onAuthStateChanged without an
// answer. The app only uses email + password, so it sets up auth without
// that and keeps the session in IndexedDB.
const auth = isNative()
    ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
    : getAuth(app);
const db = getFirestore(app);

export { db, auth };
