import { useState } from 'react';
import { auth } from '../../firebaseConfig';
import { downloadFile } from '../../utilities/download';

interface RecoveryCodeCardProps {
    code: string;
    confirmLabel: string;
    busy: boolean;
    error?: string;
    onConfirm: () => void;
    onBack: () => void;
}

// Shows a recovery code once. Nothing is saved until Confirm.
function RecoveryCodeCard({ code, confirmLabel, busy, error, onConfirm, onBack }: RecoveryCodeCardProps) {
    const [copied, setCopied] = useState(false);

    function download() {
        const email = auth.currentUser?.email ?? '';
        const contents = [
            'Intraconnected vault recovery code',
            `Account: ${email}`,
            `Created: ${new Date().toISOString().slice(0, 10)}`,
            '',
            code,
            '',
            'Use this code in Profile > Vault > Forgot passphrase? if you forget your vault passphrase.',
            'Anyone with this code and access to your account can open your vault notes. Keep it private.',
            '',
        ].join('\n');
        downloadFile(contents, 'text/plain', 'intraconnected-vault-recovery-code.txt');
    }

    function copy() {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        }).catch(() => {});
    }

    return (
        <div className="vault-recovery">
            <p className="profile-section-desc">
                This is your recovery code. If you forget your vault passphrase, it's the only way back in. Save it somewhere safe outside this app, such as a password manager or on paper. It won't be shown again.
            </p>
            <p className="vault-code" aria-label="Recovery code">{code}</p>
            <div className="vault-row vault-row--tight">
                <button type="button" className="profile-action-btn neutral neobrutal-button" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
                <button type="button" className="profile-action-btn neutral neobrutal-button" onClick={download}>Download</button>
            </div>
            {error && <p className="profile-error" role="alert">{error}</p>}
            <div className="vault-row">
                <button type="button" className="profile-action-btn neutral neobrutal-button" onClick={onBack} disabled={busy}>Back</button>
                <button type="button" className="profile-action-btn neobrutal-button" onClick={onConfirm} disabled={busy}>
                    {busy ? 'Saving…' : confirmLabel}
                </button>
            </div>
        </div>
    );
}

export default RecoveryCodeCard;
