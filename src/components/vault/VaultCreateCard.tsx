import { useEffect, useRef, useState } from 'react';
import { useVaultState } from '../../utilities/vault/useVaultState';
import { touchVault } from '../../utilities/vault/vaultSession';
import { unlockVault } from '../../utilities/vault/vaultService';
import VaultLockGlyph from './VaultLockGlyph';
import type { VaultDraft } from './VaultSecretFields';
import { NO_AUTOFILL, useVaultSetupStatus, vaultErrorText } from './vaultUi';

// What the Create modal's main button does on the Vault tab.
export interface VaultCardFooter {
    action: 'create' | 'unlock' | 'setup' | 'wait';
    canSubmit: boolean;
    busy: boolean;
}

interface VaultCreateCardProps {
    draft: VaultDraft;
    onChange: (draft: VaultDraft) => void;
    // The Vault tab is showing: focus its first field.
    active: boolean;
    // The modal's Unlock button submits the passphrase form through this id.
    formId: string;
    onSubmit: () => void;
    onOpenSettings: () => void;
    onFooter: (footer: VaultCardFooter) => void;
}

// The desktop Create modal's Vault tab, drawn as the violet card it makes.
// The phone's create sheet uses VaultCreateFields instead.
function VaultCreateCard({ draft, onChange, active, formId, onSubmit, onOpenSettings, onFooter }: VaultCreateCardProps) {
    const { unlocked } = useVaultState();
    const { status } = useVaultSetupStatus();
    const [passphrase, setPassphrase] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<unknown>(null);
    const nameRef = useRef<HTMLInputElement>(null);
    const siteRef = useRef<HTMLInputElement>(null);
    const secretRef = useRef<HTMLTextAreaElement>(null);
    const passRef = useRef<HTMLInputElement>(null);

    const mode = unlocked ? 'open' : status === 'ready' ? 'locked' : status;
    const action: VaultCardFooter['action'] =
        mode === 'open' ? 'create' : mode === 'locked' ? 'unlock' : mode === 'none' ? 'setup' : 'wait';
    const canSubmit = action === 'unlock' && passphrase !== '';

    useEffect(() => { onFooter({ action, canSubmit, busy }); }, [onFooter, action, canSubmit, busy]);

    useEffect(() => {
        if (!active) return;
        if (mode === 'open') nameRef.current?.focus();
        else if (mode === 'locked') passRef.current?.focus();
    }, [active, mode]);

    async function unlock(e: React.FormEvent) {
        e.preventDefault();
        if (!passphrase || busy) return;
        setBusy(true);
        setError(null);
        try {
            await unlockVault(passphrase);
            setPassphrase('');
        } catch (caught) {
            setError(caught);
        } finally {
            setBusy(false);
        }
    }

    function edit(field: keyof VaultDraft, value: string) {
        touchVault();
        onChange({ ...draft, [field]: value });
    }

    // Enter steps name → site → secret; Enter in the secret creates (Shift+Enter is a new line).
    function onKey(e: React.KeyboardEvent, next: React.RefObject<HTMLElement | null> | null) {
        if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
        if (e.shiftKey && !(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();
        if (next && !(e.ctrlKey || e.metaKey)) next.current?.focus();
        else onSubmit();
    }

    const title =
        mode === 'locked' ? 'Unlock your vault' :
        mode === 'none' ? 'Set up your vault' :
        mode === 'offline' ? "You're offline" :
        'Checking your vault…';

    const dots = (
        <div className="vault-ccard-slot" aria-hidden="true" key={mode}>
            <span className="vault-ccard-dots">••••••••••</span>
        </div>
    );

    return (
        <div className={`vault-ccard${mode === 'open' ? ' vault-ccard--open' : ''}`}>
            <div className="vault-ccard-head">
                <span className="vault-card-eyebrow">Vault note</span>
                {mode === 'open' ? (
                    <>
                        <input
                            ref={nameRef}
                            className="vault-ccard-name"
                            aria-label="Name"
                            placeholder="Name"
                            maxLength={100}
                            value={draft.label}
                            onChange={(e) => edit('label', e.target.value)}
                            onKeyDown={(e) => onKey(e, siteRef)}
                            {...NO_AUTOFILL}
                        />
                        <input
                            ref={siteRef}
                            className="vault-ccard-site"
                            aria-label="Site address (optional)"
                            placeholder="Site address (optional)"
                            value={draft.link}
                            onChange={(e) => edit('link', e.target.value)}
                            onKeyDown={(e) => onKey(e, secretRef)}
                            {...NO_AUTOFILL}
                        />
                    </>
                ) : (
                    <span className={`vault-ccard-title${mode === 'loading' ? ' vault-opening' : ''}`}>{title}</span>
                )}
            </div>

            <div className="vault-ccard-body">
                {mode === 'open' ? (
                    <div className="vault-ccard-slot" key="open">
                        <textarea
                            ref={secretRef}
                            className="vault-ccard-secret"
                            aria-label="Secret"
                            placeholder="Password or secret"
                            maxLength={20000}
                            rows={3}
                            spellCheck={false}
                            value={draft.secret}
                            onChange={(e) => edit('secret', e.target.value)}
                            onKeyDown={(e) => onKey(e, null)}
                            {...NO_AUTOFILL}
                        />
                    </div>
                ) : mode === 'locked' ? (
                    <form id={formId} className="vault-ccard-slot" onSubmit={unlock}>
                        <input
                            ref={passRef}
                            className="vault-ccard-pass"
                            type="password"
                            name="vault-passphrase"
                            aria-label="Vault passphrase"
                            placeholder="Vault passphrase"
                            value={passphrase}
                            onChange={(e) => { setPassphrase(e.target.value); setError(null); }}
                            {...NO_AUTOFILL}
                        />
                    </form>
                ) : dots}

                <div className="vault-ccard-foot">
                    <span className="vault-chip">
                        <VaultLockGlyph open={mode === 'open'} />
                        {mode === 'open' ? 'Unlocked' : 'Locked'}
                    </span>
                    {error !== null && <p className="vault-ccard-error" role="alert">{vaultErrorText(error)}</p>}
                    {mode === 'locked' && (
                        <button type="button" className="vault-text-btn" onClick={onOpenSettings}>Forgot passphrase?</button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default VaultCreateCard;
