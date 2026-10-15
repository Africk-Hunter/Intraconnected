import { useId, useState } from 'react';
import { unlockVault } from '../../utilities/vault/vaultService';
import { VaultError } from '../../utilities/vault/vaultError';
import { LockIcon } from '../Icons';
import { NO_AUTOFILL, vaultErrorText } from './vaultUi';

interface VaultUnlockFormProps {
    onUnlocked?: () => void;
    // "Forgot passphrase?" and "Set up vault" both go to Profile → Vault.
    onOpenSettings?: () => void;
    autoFocus?: boolean;
    // 'panel' (the vault note modal/sheet): the panel supplies the heading, and
    // Unlock sits beside a Close button in the panel's action row.
    variant?: 'inline' | 'panel';
    onCancel?: () => void;
    // The host shows its own Unlock button (the phone's create sheet keeps it in
    // the pinned footer) and submits this form through `formId`.
    formId?: string;
    hideSubmit?: boolean;
}

function VaultUnlockForm({ onUnlocked, onOpenSettings, autoFocus = true, variant = 'inline', onCancel, formId, hideSubmit = false }: VaultUnlockFormProps) {
    const [passphrase, setPassphrase] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<unknown>(null);
    const inputId = useId();

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!passphrase || busy) return;
        setBusy(true);
        setError(null);
        try {
            await unlockVault(passphrase);
            setPassphrase('');
            onUnlocked?.();
        } catch (caught) {
            setError(caught);
        } finally {
            setBusy(false);
        }
    }

    const notSetUp = error instanceof VaultError && error.code === 'not-set-up';

    const input = (
        <input
            id={inputId}
            className="vault-input neobrutal-input"
            type="password"
            name="vault-passphrase"
            placeholder="Vault passphrase"
            aria-label={variant === 'inline' ? 'Vault passphrase' : undefined}
            value={passphrase}
            onChange={e => setPassphrase(e.target.value)}
            autoFocus={autoFocus}
            {...NO_AUTOFILL}
        />
    );
    const errorLine = error !== null && <p className="vault-error" role="alert">{vaultErrorText(error)}</p>;
    const unlockButton = (className: string) => (
        <button type="submit" className={`${className} neobrutal-button`} disabled={!passphrase || busy}>
            {busy && <span className="authSpinner" aria-hidden="true" />}
            {busy ? 'Unlocking…' : 'Unlock'}
        </button>
    );

    if (variant === 'panel') {
        return (
            <form className="vault-unlock vault-unlock--panel" onSubmit={submit}>
                <div className="vault-sheet vault-sheet--form">
                    <div className="vault-field">
                        <label className="vault-label" htmlFor={inputId}>Passphrase</label>
                        {input}
                    </div>
                    {errorLine}
                    {onOpenSettings && !notSetUp && (
                        <button type="button" className="vault-text-btn" onClick={onOpenSettings}>Forgot passphrase?</button>
                    )}
                </div>
                <footer className="vault-actions">
                    {onCancel && <button type="button" className="vault-action vault-action--cancel neobrutal-button" onClick={onCancel}>Close</button>}
                    {notSetUp && onOpenSettings
                        ? <button type="button" className="vault-action vault-action--go neobrutal-button" onClick={onOpenSettings}>Set up vault</button>
                        : unlockButton('vault-action vault-action--go')}
                </footer>
            </form>
        );
    }

    return (
        <form id={formId} className="vault-unlock" onSubmit={submit}>
            <p className="vault-unlock-title"><LockIcon size={20} /> Your vault is locked</p>
            {input}
            {errorLine}
            <div className="vault-row">
                {notSetUp && onOpenSettings ? (
                    <button type="button" className="vault-btn neobrutal-button" onClick={onOpenSettings}>Set up vault</button>
                ) : hideSubmit ? null : unlockButton('vault-btn vault-btn--primary')}
                {onOpenSettings && !notSetUp && (
                    <button type="button" className="vault-text-btn" onClick={onOpenSettings}>Forgot passphrase?</button>
                )}
            </div>
        </form>
    );
}

export default VaultUnlockForm;
