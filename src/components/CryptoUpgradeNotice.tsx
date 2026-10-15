import { useEffect, useState } from "react";
import { auth } from "../firebaseConfig";
import { clearCryptoUpgradeProblem, hasCryptoUpgradeProblem } from "../utilities/cryptoUpgradeNotice";

function CryptoUpgradeNotice() {
    const [uid, setUid] = useState<string | null>(null);

    useEffect(() => {
        return auth.onAuthStateChanged(user => {
            setUid(user && hasCryptoUpgradeProblem(user.uid) ? user.uid : null);
        });
    }, []);

    if (!uid) return null;

    return (
        <section className="syncBanner" aria-label="Encryption upgrade notice">
            <div className="syncBanner__item syncBanner__item--notice" role="status">
                <p className="syncBanner__text">
                    We could not finish upgrading your account's key protection. Your ideas are unaffected and we will try again the next time you sign in.
                </p>
                <button
                    type="button"
                    className="syncBanner__dismiss"
                    aria-label="Dismiss encryption upgrade notice"
                    onClick={() => {
                        clearCryptoUpgradeProblem(uid);
                        setUid(null);
                    }}
                >
                    ×
                </button>
            </div>
        </section>
    );
}

export default CryptoUpgradeNotice;
