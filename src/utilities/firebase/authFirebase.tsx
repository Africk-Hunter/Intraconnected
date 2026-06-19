import { auth } from "../../firebaseConfig";
import { clearDEK } from "../dekStore";

export async function signUserOut() {
    try {
        clearDEK();
        await auth.signOut();
        window.location.href = '/';
    } catch (error) {
        console.error("Sign out error:", error);
    }
}
