import { db, auth } from "../../firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";

interface TrackedIssue {
    issueNumber: number;
    title: string;
    seenClosed: boolean;
}

function authCheck() {
    const user = auth.currentUser;
    if (!user) return null;
    return user;
}

export async function saveTrackedIssue(issueNumber: number, title: string): Promise<void> {
    const user = authCheck();
    if (!user) return;
    const ref = doc(db, "users", user.uid, "meta", "featureRequests");
    const snap = await getDoc(ref);
    const existing: TrackedIssue[] = snap.exists() ? (snap.data().issues ?? []) : [];
    await setDoc(ref, { issues: [...existing, { issueNumber, title, seenClosed: false }] });
}

export async function checkAndMarkImplementedFeatures(): Promise<string[] | null> {
    const user = authCheck();
    if (!user) return null;
    const ref = doc(db, "users", user.uid, "meta", "featureRequests");
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;

    const issues: TrackedIssue[] = snap.data().issues ?? [];
    const pending = issues.filter(i => !i.seenClosed);
    if (pending.length === 0) return null;

    const token = import.meta.env.VITE_GITHUB_TOKEN;
    const repo = import.meta.env.VITE_GITHUB_REPO;
    const implemented: TrackedIssue[] = [];

    await Promise.all(pending.map(async (issue) => {
        try {
            const res = await fetch(`https://api.github.com/repos/${repo}/issues/${issue.issueNumber}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.github+json',
                },
            });
            if (!res.ok) return;
            const data = await res.json();
            if (data.state === 'closed' && data.state_reason === 'completed') {
                implemented.push(issue);
            }
        } catch { /* ignore network errors */ }
    }));

    if (implemented.length === 0) return null;

    const updated = issues.map(i =>
        implemented.some(impl => impl.issueNumber === i.issueNumber)
            ? { ...i, seenClosed: true }
            : i
    );
    await setDoc(ref, { issues: updated });

    return implemented.map(i => i.title);
}
