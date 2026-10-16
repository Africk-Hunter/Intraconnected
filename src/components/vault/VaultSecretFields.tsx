import { useRef, useState } from 'react';
import { touchVault } from '../../utilities/vault/vaultSession';
import { NO_AUTOFILL } from './vaultUi';

export interface VaultDraft {
    label: string;
    secret: string;
    link: string;
}

interface VaultSecretFieldsProps {
    // Keeps label ids unique when the create tab and the note editor are both mounted.
    idPrefix: string;
    draft: VaultDraft;
    onChange: (draft: VaultDraft) => void;
    // Runs on Ctrl/Cmd+Enter, and on Enter in the last field.
    onSubmitShortcut?: () => void;
    autoFocusName?: boolean;
    // The phone's create sheet folds the site address behind a link button
    // beside the name, like the Idea tab does.
    foldLink?: boolean;
}

// The three fields of a vault note. Shared by the Create tab and the note editor
// so both have the same visible labels, limits and shortcut. Enter moves to the
// next field, then submits from the last one (Shift+Enter is a newline in Secret).
function VaultSecretFields({ idPrefix, draft, onChange, onSubmitShortcut, autoFocusName = false, foldLink = false }: VaultSecretFieldsProps) {
    const nameId = `${idPrefix}-name`;
    const secretId = `${idPrefix}-secret`;
    const linkId = `${idPrefix}-link`;
    const nameRef = useRef<HTMLInputElement>(null);
    const secretRef = useRef<HTMLTextAreaElement>(null);
    const linkRef = useRef<HTMLInputElement>(null);
    const [linkOpen, setLinkOpen] = useState(false);
    const linkShown = !foldLink || linkOpen || draft.link.trim() !== '';

    function toggleLink() {
        if (linkShown && !draft.link.trim()) {
            setLinkOpen(false);
            nameRef.current?.focus();
            return;
        }
        setLinkOpen(true);
        requestAnimationFrame(() => linkRef.current?.focus());
    }

    function onSecretKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
        e.preventDefault();
        onSubmitShortcut?.();
    }

    const nameInput = (
        <input
            ref={nameRef}
            id={nameId}
            className="vault-input neobrutal-input"
            placeholder="e.g. Bank login"
            maxLength={100}
            value={draft.label}
            autoFocus={autoFocusName}
            enterKeyHint="next"
            onChange={(e) => { touchVault(); onChange({ ...draft, label: e.target.value }); }}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    (linkShown ? linkRef : secretRef).current?.focus();
                }
            }}
            {...NO_AUTOFILL}
        />
    );

    return (
        <div className="vault-fields">
            <div className="vault-field">
                <label className="vault-label" htmlFor={nameId}>Name</label>
                {foldLink ? (
                    <div className="vault-name-row">
                        {nameInput}
                        <button
                            type="button"
                            className={`mmobile-create-link-btn${draft.link.trim() ? ' mmobile-create-link-btn--filled' : ''}`}
                            aria-label={linkShown ? 'Site address' : 'Add a site address'}
                            aria-expanded={linkShown}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={toggleLink}
                        >
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" />
                            </svg>
                        </button>
                    </div>
                ) : nameInput}
            </div>
            {linkShown && (
                <div className="vault-field">
                    <label className="vault-label" htmlFor={linkId}>
                        Site address <span className="vault-optional">optional</span>
                    </label>
                    <input
                        ref={linkRef}
                        id={linkId}
                        className="vault-input neobrutal-input"
                        placeholder="e.g. bank.example.com"
                        enterKeyHint="next"
                        value={draft.link}
                        onChange={(e) => { touchVault(); onChange({ ...draft, link: e.target.value }); }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); secretRef.current?.focus(); }
                        }}
                        {...NO_AUTOFILL}
                    />
                </div>
            )}
            <div className="vault-field">
                <label className="vault-label" htmlFor={secretId}>Secret</label>
                <textarea
                    ref={secretRef}
                    id={secretId}
                    className="vault-input vault-secret-input neobrutal-input"
                    placeholder="Password or secret"
                    maxLength={20000}
                    rows={foldLink ? 2 : 4}
                    spellCheck={false}
                    enterKeyHint="done"
                    value={draft.secret}
                    onChange={(e) => { touchVault(); onChange({ ...draft, secret: e.target.value }); }}
                    onKeyDown={onSecretKey}
                    {...NO_AUTOFILL}
                />
            </div>
        </div>
    );
}

export default VaultSecretFields;
