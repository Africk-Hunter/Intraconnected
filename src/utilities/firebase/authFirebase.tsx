import { auth, db } from "../../firebaseConfig";
import { clearDEK } from "../dekStore";
import {
    EmailAuthProvider,
    reauthenticateWithCredential,
    deleteUser,
    sendPasswordResetEmail,
} from "firebase/auth";
import { collection, getDocs, deleteDoc } from "firebase/firestore";

export async function signUserOut() {
    try {
        clearDEK();
        await auth.signOut();
        window.location.href = '/';
    } catch (error) {
        console.error("Sign out error:", error);
    }
}

export async function deleteUserAccount(password: string): Promise<void> {
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error("No authenticated user");

    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);

    const uid = user.uid;

    // Delete all ideas
    const ideasSnap = await getDocs(collection(db, "users", uid, "ideas"));
    await Promise.all(ideasSnap.docs.map(d => deleteDoc(d.ref)));

    // Delete all meta documents (encryption, sync, preferences)
    const metaSnap = await getDocs(collection(db, "users", uid, "meta"));
    await Promise.all(metaSnap.docs.map(d => deleteDoc(d.ref)));

    // Delete the Firebase Auth user record
    await deleteUser(user);

    clearDEK();
    localStorage.clear();
    window.location.href = '/';
}

export async function sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
}
