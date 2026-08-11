import { auth } from "../../firebaseConfig";

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        const message = data && typeof data.error === "string" ? data.error : "Something went wrong. Try again.";
        throw new Error(message);
    }
    return data as T;
}

export async function submitFeatureRequest(title: string, body?: string): Promise<number> {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("You must be signed in to submit a feature request.");
    }
    const idToken = await user.getIdToken();
    const res = await fetch("/.netlify/functions/submit-feature-request", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ title, body }),
    });
    const data = await parseJsonOrThrow<{ issueNumber: number }>(res);
    return data.issueNumber;
}

export async function checkAndMarkImplementedFeatures(): Promise<string[] | null> {
    const user = auth.currentUser;
    if (!user) return null;
    const idToken = await user.getIdToken();
    const res = await fetch("/.netlify/functions/check-feature-request-status", {
        headers: { Authorization: `Bearer ${idToken}` },
    });
    return parseJsonOrThrow<string[] | null>(res);
}
