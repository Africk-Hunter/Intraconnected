import { auth } from "../../firebaseConfig";

// The signed-in user, or null (logged) when the call raced sign-in/out.
export function authCheck() {
    const user = auth.currentUser;
    if (!user) {
        console.error("User is not authenticated");
        return null;
    }
    return user;
}
