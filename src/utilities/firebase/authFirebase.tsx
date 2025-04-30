import { auth } from "../../firebaseConfig";

export async function signUserOut() {
    try {
        await auth.signOut();
        window.location.href = '/';
    } catch (error) {
        console.error("Sign out error:", error);
    }
}