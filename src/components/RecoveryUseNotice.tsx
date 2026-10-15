import { useEffect, useState } from "react";
import { collection, getDocsFromServer, query, where } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

interface RecoveryNotice {
    uid: string;
    at: number;
}

const LAST_SEEN_PREFIX = "recovery_audit_seen_";

function timestampMillis(value: unknown): number | null {
    if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
        const millis = value.toMillis();
        return Number.isFinite(millis) ? millis : null;
    }
    return null;
}

function RecoveryUseNotice() {
    const [notice, setNotice] = useState<RecoveryNotice | null>(null);

    useEffect(() => {
        let currentUid: string | null = null;
        let active = true;

        const unsubscribe = auth.onAuthStateChanged(user => {
            currentUid = user?.uid ?? null;
            setNotice(null);
            if (!user) return;

            void (async () => {
                try {
                    const auditQuery = query(collection(db, "recoveryAudit"), where("uid", "==", user.uid));
                    const snapshot = await getDocsFromServer(auditQuery);
                    if (!active || currentUid !== user.uid) return;

                    let latestAt: number | null = null;
                    for (const audit of snapshot.docs) {
                        if (audit.data().result !== "success") continue;
                        const at = timestampMillis(audit.data().at);
                        if (at !== null && (latestAt === null || at > latestAt)) latestAt = at;
                    }
                    if (latestAt === null) return;

                    const lastSeen = Number(localStorage.getItem(`${LAST_SEEN_PREFIX}${user.uid}`) ?? 0);
                    if (latestAt > lastSeen) setNotice({ uid: user.uid, at: latestAt });
                } catch (error) {
                    console.error("Could not check the encryption recovery audit log.", error);
                }
            })();
        });

        return () => {
            active = false;
            unsubscribe();
        };
    }, []);

    if (!notice) return null;
    const recoveryDate = new Date(notice.at).toLocaleString();

    return (
        <section className="syncBanner" aria-label="Encryption recovery notice">
            <div className="syncBanner__item syncBanner__item--notice" role="status">
                <p className="syncBanner__text">
                    On {recoveryDate}, your account's backup key was used to give you back access to your ideas. This happens after a password reset and is normal. If you did not reset your password, change it now and contact support.
                </p>
                <button
                    type="button"
                    className="syncBanner__dismiss"
                    aria-label="Dismiss recovery notice"
                    onClick={() => {
                        try {
                            localStorage.setItem(`${LAST_SEEN_PREFIX}${notice.uid}`, String(notice.at));
                            setNotice(null);
                        } catch (error) {
                            console.error("Could not remember that the recovery notice was dismissed.", error);
                            setNotice(null);
                        }
                    }}
                >
                    ×
                </button>
            </div>
        </section>
    );
}

export default RecoveryUseNotice;
