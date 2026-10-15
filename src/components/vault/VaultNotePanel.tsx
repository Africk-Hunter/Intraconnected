import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useIdeaContext } from '../../context/IdeaContext';
import { fetchFullIdeaList, isVaultIdea, openIdeaLink, resolveIdeaLabel, VAULT_LABEL } from '../../utilities/idea/helpers';
import { decryptVaultNote, loadVaultMeta, saveVaultNote, vaultNoteKeyId, type VaultNoteText } from '../../utilities/vault/vaultService';
import { lockVault, touchVault } from '../../utilities/vault/vaultSession';
import { useVaultState } from '../../utilities/vault/useVaultState';
import { VaultError } from '../../utilities/vault/vaultError';
import { LinkOutIcon, WarningIcon } from '../Icons';
import VaultLockGlyph from './VaultLockGlyph';
import VaultSecretFields from './VaultSecretFields';
import VaultUnlockForm from './VaultUnlockForm';
import { vaultErrorText } from './vaultUi';

interface VaultNotePanelProps {
    ideaId: number;
    initialMode: 'view' | 'edit';
    onClose: () => void;
    onOpenVaultSettings: () => void;
    onDelete: (id: number) => void;
    onDirtyChange?: (dirty: boolean) => void;
}

interface PanelHeadProps {
    eyebrow: string;
    title: string;
    open: boolean;
    tone?: 'danger';
    children?: ReactNode;
}

// Badge, small label and title. Every state of the panel starts with it, so
// switching between them only changes what's underneath.
function PanelHead({ eyebrow, title, open, tone, children }: PanelHeadProps) {
    return (
        <header className="vault-head">
            <span className={`vault-badge${tone ? ` vault-badge--${tone}` : ''}`} aria-hidden="true">
                {tone === 'danger' ? <WarningIcon size={26} /> : <VaultLockGlyph open={open} size={26} />}
            </span>
            <div className="vault-head-text">
                <p className="vault-eyebrow">{eyebrow}</p>
                <h2 className="vault-title">{title}</h2>
            </div>
            {children}
        </header>
    );
}

function errorText(error: unknown): string {
    return error instanceof Error && !(error instanceof VaultError) ? error.message : vaultErrorText(error);
}

// One vault note, viewed or edited. Plaintext lives only in this component's
// state and is wiped the moment the vault locks.
function VaultNotePanel({ ideaId, initialMode, onClose, onOpenVaultSettings, onDelete, onDirtyChange }: VaultNotePanelProps) {
    const { newIdeaSwitch, setNewIdeaSwitch } = useIdeaContext();
    const { unlocked, keyId } = useVaultState();
    const idea = fetchFullIdeaList().find((i) => i.id === ideaId);
    const vaultIdea = isVaultIdea(idea) ? idea : null;

    const [mode, setMode] = useState<'view' | 'edit'>(initialMode);
    const [text, setText] = useState<VaultNoteText | null>(null);
    const [draft, setDraft] = useState<VaultNoteText>({ label: '', secret: '', link: '' });
    const [revealed, setRevealed] = useState(false);
    const [error, setError] = useState<unknown>(null);
    const [copied, setCopied] = useState<'secret' | 'link' | null>(null);
    const [hasVault, setHasVault] = useState<boolean | null>(null);
    const [saving, setSaving] = useState(false);
    const copiedTimer = useRef<number>(0);
    const formRef = useRef<HTMLFormElement>(null);

    // The note was deleted elsewhere.
    useEffect(() => {
        if (!vaultIdea) onClose();
    }, [vaultIdea, onClose, newIdeaSwitch]);

    // Does the account still have a vault (a reset on another device removes it)?
    useEffect(() => {
        let cancelled = false;
        loadVaultMeta().then((meta) => { if (!cancelled) setHasVault(meta !== null); }).catch(() => { if (!cancelled) setHasVault(true); });
        return () => { cancelled = true; };
    }, [unlocked]);

    const stored = vaultIdea?.noteTitle;
    useEffect(() => {
        if (!unlocked || !vaultIdea) {
            setText(null);
            setRevealed(false);
            setMode(initialMode);
            return;
        }
        let cancelled = false;
        setError(null);
        decryptVaultNote(vaultIdea)
            .then((decrypted) => {
                if (cancelled) return;
                setText(decrypted);
                setDraft(decrypted);
            })
            .catch((caught) => { if (!cancelled) setError(caught); });
        return () => { cancelled = true; };
        // vaultIdea changes identity on every read; the stored ciphertext is what matters.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unlocked, keyId, ideaId, stored, vaultIdea?.content, vaultIdea?.link]);

    useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

    const dirty = mode === 'edit' && text !== null
        && (draft.label !== text.label || draft.secret !== text.secret || draft.link !== text.link);
    useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

    if (!vaultIdea) return null;

    const unreadable = hasVault === false || (unlocked && vaultNoteKeyId(vaultIdea) !== keyId)
        || (error instanceof VaultError && (error.code === 'damaged' || error.code === 'other-vault'));

    if (unreadable) {
        const message = error instanceof VaultError && error.code === 'damaged'
            ? vaultErrorText(error)
            : "This vault note belongs to a vault that was reset, so it can't be opened.";
        return (
            <div className="vault-panel vault-panel--enter">
                <PanelHead eyebrow="Vault note" title="Can't open this note" open={false} tone="danger" />
                <p className="vault-sheet vault-sheet--message">{message}</p>
                <footer className="vault-actions">
                    <button className="vault-action vault-action--danger neobrutal-button" onClick={() => { onClose(); onDelete(ideaId); }}>Delete</button>
                    <button className="vault-action vault-action--back neobrutal-button" onClick={onClose}>Close</button>
                </footer>
            </div>
        );
    }

    if (!unlocked) {
        const label = resolveIdeaLabel(vaultIdea);
        return (
            <div className="vault-panel vault-panel--enter">
                <PanelHead eyebrow={label === VAULT_LABEL ? 'Vault note' : label} title="Your vault is locked" open={false} />
                <VaultUnlockForm
                    variant="panel"
                    onCancel={onClose}
                    onOpenSettings={() => { onClose(); onOpenVaultSettings(); }}
                />
            </div>
        );
    }

    if (!text) {
        return (
            <div className="vault-panel vault-panel--enter">
                <PanelHead eyebrow="Vault note" title={resolveIdeaLabel(vaultIdea)} open />
                {error !== null
                    ? <p className="vault-sheet vault-sheet--message vault-error" role="alert">{vaultErrorText(error)}</p>
                    : <p className="vault-sheet vault-sheet--message vault-opening" role="status">Opening…</p>}
                <footer className="vault-actions">
                    <button className="vault-action vault-action--back neobrutal-button" onClick={onClose}>Close</button>
                </footer>
            </div>
        );
    }

    function copy(which: 'secret' | 'link', value: string) {
        touchVault();
        navigator.clipboard.writeText(value).then(() => {
            setCopied(which);
            window.clearTimeout(copiedTimer.current);
            copiedTimer.current = window.setTimeout(() => setCopied(null), 1500);
        }).catch(() => setError(new Error("Couldn't copy to the clipboard")));
    }

    async function save() {
        if (!text || !draft.label.trim() || saving) return;
        setSaving(true);
        try {
            const next = { label: draft.label.trim(), secret: draft.secret, link: draft.link };
            await saveVaultNote(ideaId, next, text);
            setNewIdeaSwitch((prev) => !prev);
            setMode('view');
        } catch (caught) {
            setError(caught);
        } finally {
            setSaving(false);
        }
    }

    if (mode === 'edit') {
        return (
            <form ref={formRef} className="vault-panel vault-panel--enter" onSubmit={(e) => { e.preventDefault(); void save(); }}>
                <PanelHead eyebrow="Editing vault note" title={text.label} open />
                <div className="vault-sheet vault-sheet--form">
                    <VaultSecretFields
                        idPrefix="vault-edit"
                        draft={draft}
                        onChange={setDraft}
                        autoFocusName
                        onSubmitShortcut={() => formRef.current?.requestSubmit()}
                    />
                </div>
                {error !== null && <p className="vault-error" role="alert">{errorText(error)}</p>}
                <footer className="vault-actions">
                    <button type="button" className="vault-action vault-action--back neobrutal-button" onClick={() => { setDraft(text); setMode('view'); setError(null); }}>Cancel</button>
                    <button type="submit" className="vault-action vault-action--go neobrutal-button" disabled={!draft.label.trim() || saving}>
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </footer>
            </form>
        );
    }

    return (
        <div className="vault-panel vault-panel--enter">
            <PanelHead eyebrow="Vault note" title={text.label} open>
                <button className="vault-lock-btn neobrutal-button" onClick={() => lockVault('manual')} title="Lock the vault now">
                    <VaultLockGlyph open={false} size={18} />
                    Lock
                </button>
            </PanelHead>
            <div className="vault-sheet">
                {text.link && (
                    <div className="vault-sheet-row">
                        <span className="vault-label">Site</span>
                        <span className="vault-site" title={text.link}>{text.link}</span>
                        <div className="vault-mini-group">
                            <button className="vault-mini neobrutal-button" onClick={() => { touchVault(); openIdeaLink(text.link); }}>
                                Open <LinkOutIcon size={14} />
                            </button>
                            <button className={`vault-mini neobrutal-button${copied === 'link' ? ' vault-mini--done' : ''}`} onClick={() => copy('link', text.link)}>
                                {copied === 'link' ? 'Copied' : 'Copy'}
                            </button>
                        </div>
                    </div>
                )}
                <div className="vault-sheet-row">
                    <span className="vault-label">Secret</span>
                    <div className="vault-slot">
                        {!text.secret
                            ? <span className="vault-slot-empty">No secret saved</span>
                            : revealed
                                ? <pre className="vault-secret vault-reveal">{text.secret}</pre>
                                : <span className="vault-masked" role="img" aria-label="Secret hidden">••••••••••••</span>}
                    </div>
                    {text.secret && (
                        <div className="vault-mini-group">
                            <button className="vault-mini neobrutal-button" aria-pressed={revealed} onClick={() => { touchVault(); setRevealed((v) => !v); }}>
                                {revealed ? 'Hide' : 'Reveal'}
                            </button>
                            <button className={`vault-mini neobrutal-button${copied === 'secret' ? ' vault-mini--done' : ''}`} onClick={() => copy('secret', text.secret)}>
                                {copied === 'secret' ? 'Copied' : 'Copy'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <span className="vault-sr-only" role="status">{copied ? 'Copied to the clipboard' : ''}</span>
            {error !== null && <p className="vault-error" role="alert">{errorText(error)}</p>}
            <footer className="vault-actions">
                <button className="vault-action vault-action--edit neobrutal-button" onClick={() => { touchVault(); setDraft(text); setMode('edit'); }}>Edit</button>
                <button className="vault-action vault-action--go neobrutal-button" onClick={onClose}>Done</button>
            </footer>
        </div>
    );
}

export default VaultNotePanel;
