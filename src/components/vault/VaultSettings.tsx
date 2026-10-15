import { useEffect, useRef, useState } from 'react';
import { useIdeaContext } from '../../context/IdeaContext';
import { fetchFullIdeaList, isVaultIdea } from '../../utilities/idea/helpers';
import { downloadFile } from '../../utilities/download';
import {
    AUTO_LOCK_CHOICES,
    getAutoLockMinutes,
    lockVault,
    setAutoLockMinutes,
    type AutoLockMinutes,
} from '../../utilities/vault/vaultSession';
import { useVaultState } from '../../utilities/vault/useVaultState';
import {
    buildVaultExport,
    changeVaultPassphrase,
    commitRewrap,
    commitVaultSetup,
    discardPending,
    prepareNewRecoveryCode,
    prepareRecoveredVault,
    prepareVaultSetup,
    resetVault,
    verifyRecoveryCode,
    type PendingRewrap,
    type PendingVault,
    type VerifiedRecovery,
} from '../../utilities/vault/vaultService';
import RecoveryCodeCard from './RecoveryCodeCard';
import VaultUnlockForm from './VaultUnlockForm';
import { NO_AUTOFILL, useVaultSetupStatus, vaultErrorText } from './vaultUi';

type Flow =
    | { kind: 'idle' }
    | { kind: 'setup-pass' }
    | { kind: 'setup-code'; pending: PendingVault }
    | { kind: 'change-pass' }
    | { kind: 'new-code-pass' }
    | { kind: 'new-code'; pending: PendingRewrap }
    | { kind: 'forgot-code' }
    | { kind: 'forgot-pass'; verified: VerifiedRecovery }
    | { kind: 'forgot-new-code'; pending: PendingRewrap };

function PasswordField(props: { value: string; onChange: (v: string) => void; label: string; fresh?: boolean }) {
    return (
        <input
            className="profile-input neobrutal-input"
            type="password"
            placeholder={props.label}
            aria-label={props.label}
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
            {...NO_AUTOFILL}
            autoComplete={props.fresh ? 'new-password' : 'off'}
            name="vault-passphrase"
        />
    );
}

// Everything in Profile → Vault.
function VaultSettings() {
    const { setNewIdeaSwitch, createReturn, setProfileModalOpen } = useIdeaContext();
    const { unlocked } = useVaultState();
    const { status, refresh } = useVaultSetupStatus();
    const [flow, setFlow] = useState<Flow>({ kind: 'idle' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [autoLock, setAutoLock] = useState<AutoLockMinutes>(getAutoLockMinutes());
    const [a, setA] = useState('');
    const [b, setB] = useState('');
    const [c, setC] = useState('');
    const [resetText, setResetText] = useState('');
    const flowRef = useRef<Flow>(flow);
    flowRef.current = flow;

    // Pending key material is wiped if the tab is left mid-flow.
    useEffect(() => () => {
        const f = flowRef.current;
        if ('pending' in f) discardPending(f.pending);
        if ('verified' in f) discardPending(f.verified);
    }, []);

    function go(next: Flow) {
        const f = flowRef.current;
        if ('pending' in f && !('pending' in next && next.pending === f.pending)) discardPending(f.pending);
        if ('verified' in f && !('verified' in next && next.verified === f.verified)) {
            // the verified key carries over into the rewrap; only wipe when abandoned
            if (!('pending' in next)) discardPending(f.verified);
        }
        setFlow(next);
        setError('');
        setA(''); setB(''); setC('');
    }

    async function run(action: () => Promise<void>) {
        setBusy(true);
        setError('');
        try {
            await action();
        } catch (caught) {
            setError(vaultErrorText(caught));
        } finally {
            setBusy(false);
        }
    }

    const vaultNoteCount = fetchFullIdeaList().filter(isVaultIdea).length;

    if (status === 'loading') return <div className="profile-account-content"><p className="profile-section-desc">Checking your vault…</p></div>;
    if (status === 'offline' && !unlocked) {
        return <div className="profile-account-content"><p className="profile-error">You're offline. Connect to the internet to manage your vault.</p></div>;
    }

    // ── Setup flow ──
    if (flow.kind === 'setup-pass') {
        return (
            <div className="profile-account-content">
                <section className="profile-section">
                    <h3 className="profile-section-title">Choose a vault passphrase</h3>
                    <p className="profile-section-desc">It's separate from your account password. There's no way for us to reset it, so pick something you'll remember.</p>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        if (!a || a !== b) return;
                        void run(async () => { go({ kind: 'setup-code', pending: await prepareVaultSetup(a) }); });
                    }}>
                        <PasswordField value={a} onChange={setA} label="Vault passphrase" fresh />
                        <PasswordField value={b} onChange={setB} label="Type it again" fresh />
                        {b && a !== b && <p className="profile-error">The two passphrases don't match.</p>}
                        {error && <p className="profile-error" role="alert">{error}</p>}
                        <div className="vault-row">
                            <button type="button" className="profile-action-btn neutral neobrutal-button" onClick={() => go({ kind: 'idle' })}>Cancel</button>
                            <button type="submit" className="profile-action-btn neobrutal-button" disabled={!a || a !== b || busy}>
                                {busy ? 'Working…' : 'Continue'}
                            </button>
                        </div>
                    </form>
                </section>
            </div>
        );
    }
    if (flow.kind === 'setup-code') {
        const { pending } = flow;
        return (
            <div className="profile-account-content">
                <section className="profile-section">
                    <h3 className="profile-section-title">Save your recovery code</h3>
                    <RecoveryCodeCard
                        code={pending.recoveryCode}
                        confirmLabel="Finish setup"
                        busy={busy}
                        error={error}
                        onBack={() => go({ kind: 'setup-pass' })}
                        onConfirm={() => void run(async () => {
                            await commitVaultSetup(pending);
                            setFlow({ kind: 'idle' });
                            setNotice('Your vault is set up and unlocked.');
                            refresh();
                            if (createReturn) setProfileModalOpen(false);
                        })}
                    />
                </section>
            </div>
        );
    }

    // ── Not set up ──
    if (status === 'none') {
        return (
            <div className="profile-account-content">
                <section className="profile-section">
                    <h3 className="profile-section-title">Vault</h3>
                    <p className="profile-section-desc">
                        Vault notes are for passwords and other secrets. They get a second lock: a vault passphrase that only you know. We never receive it, so we can't read your vault notes, and we can't help you back in if you forget it.
                    </p>
                    {notice && <p className="profile-section-desc">{notice}</p>}
                    <button className="profile-action-btn neobrutal-button" onClick={() => go({ kind: 'setup-pass' })}>Set up vault</button>
                </section>
                {vaultNoteCount > 0 && (
                    <section className="profile-section">
                        <p className="profile-section-desc">You have {vaultNoteCount} vault {vaultNoteCount === 1 ? 'note' : 'notes'} from an old vault. {vaultNoteCount === 1 ? "It" : "They"} can't be opened. Reset vault removes {vaultNoteCount === 1 ? 'it' : 'them'}.</p>
                        <button className="profile-action-btn danger neobrutal-button" disabled={busy} onClick={() => void run(async () => {
                            const removed = await resetVault();
                            setNewIdeaSwitch((prev) => !prev);
                            setNotice(`Removed ${removed} old vault ${removed === 1 ? 'note' : 'notes'}.`);
                            refresh();
                        })}>Remove old vault notes</button>
                        {error && <p className="profile-error" role="alert">{error}</p>}
                    </section>
                )}
            </div>
        );
    }

    // ── Other flows (vault exists) ──
    if (flow.kind === 'change-pass') {
        return (
            <div className="profile-account-content">
                <section className="profile-section">
                    <h3 className="profile-section-title">Change passphrase</h3>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        if (!a || !b || b !== c) return;
                        void run(async () => { await changeVaultPassphrase(a, b); go({ kind: 'idle' }); setNotice('Passphrase changed.'); });
                    }}>
                        <PasswordField value={a} onChange={setA} label="Current passphrase" />
                        <PasswordField value={b} onChange={setB} label="New passphrase" fresh />
                        <PasswordField value={c} onChange={setC} label="New passphrase again" fresh />
                        {c && b !== c && <p className="profile-error">The two passphrases don't match.</p>}
                        {error && <p className="profile-error" role="alert">{error}</p>}
                        <div className="vault-row">
                            <button type="button" className="profile-action-btn neutral neobrutal-button" onClick={() => go({ kind: 'idle' })}>Cancel</button>
                            <button type="submit" className="profile-action-btn neobrutal-button" disabled={!a || !b || b !== c || busy}>{busy ? 'Working…' : 'Change passphrase'}</button>
                        </div>
                    </form>
                </section>
            </div>
        );
    }
    if (flow.kind === 'new-code-pass') {
        return (
            <div className="profile-account-content">
                <section className="profile-section">
                    <h3 className="profile-section-title">New recovery code</h3>
                    <p className="profile-section-desc">Your old recovery code will stop working.</p>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        if (!a) return;
                        void run(async () => { go({ kind: 'new-code', pending: await prepareNewRecoveryCode(a) }); });
                    }}>
                        <PasswordField value={a} onChange={setA} label="Vault passphrase" />
                        {error && <p className="profile-error" role="alert">{error}</p>}
                        <div className="vault-row">
                            <button type="button" className="profile-action-btn neutral neobrutal-button" onClick={() => go({ kind: 'idle' })}>Cancel</button>
                            <button type="submit" className="profile-action-btn neobrutal-button" disabled={!a || busy}>{busy ? 'Working…' : 'Continue'}</button>
                        </div>
                    </form>
                </section>
            </div>
        );
    }
    if (flow.kind === 'new-code' || flow.kind === 'forgot-new-code') {
        const { pending } = flow;
        const forgot = flow.kind === 'forgot-new-code';
        return (
            <div className="profile-account-content">
                <section className="profile-section">
                    <h3 className="profile-section-title">{forgot ? 'Save your new recovery code' : 'Save your new recovery code'}</h3>
                    <RecoveryCodeCard
                        code={pending.recoveryCode ?? ''}
                        confirmLabel={forgot ? 'Finish' : 'Save new code'}
                        busy={busy}
                        error={error}
                        onBack={() => go({ kind: 'idle' })}
                        onConfirm={() => void run(async () => {
                            await commitRewrap(pending);
                            setFlow({ kind: 'idle' });
                            setNotice(forgot ? 'New passphrase set. Your vault is unlocked.' : 'New recovery code saved.');
                        })}
                    />
                </section>
            </div>
        );
    }
    if (flow.kind === 'forgot-code') {
        return (
            <div className="profile-account-content">
                <section className="profile-section">
                    <h3 className="profile-section-title">Forgot passphrase</h3>
                    <p className="profile-section-desc">Enter the recovery code you saved when you set up the vault.</p>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        if (!a) return;
                        void run(async () => { go({ kind: 'forgot-pass', verified: await verifyRecoveryCode(a) }); });
                    }}>
                        <input className="profile-input neobrutal-input" placeholder="Recovery code" aria-label="Recovery code" value={a}
                            onChange={(e) => setA(e.target.value)} spellCheck={false} {...NO_AUTOFILL} />
                        {error && <p className="profile-error" role="alert">{error}</p>}
                        <div className="vault-row">
                            <button type="button" className="profile-action-btn neutral neobrutal-button" onClick={() => go({ kind: 'idle' })}>Cancel</button>
                            <button type="submit" className="profile-action-btn neobrutal-button" disabled={!a || busy}>{busy ? 'Checking…' : 'Continue'}</button>
                        </div>
                    </form>
                </section>
            </div>
        );
    }
    if (flow.kind === 'forgot-pass') {
        const { verified } = flow;
        return (
            <div className="profile-account-content">
                <section className="profile-section">
                    <h3 className="profile-section-title">Choose a new passphrase</h3>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        if (!a || a !== b) return;
                        void run(async () => { go({ kind: 'forgot-new-code', pending: await prepareRecoveredVault(verified, a) }); });
                    }}>
                        <PasswordField value={a} onChange={setA} label="New passphrase" fresh />
                        <PasswordField value={b} onChange={setB} label="New passphrase again" fresh />
                        {b && a !== b && <p className="profile-error">The two passphrases don't match.</p>}
                        {error && <p className="profile-error" role="alert">{error}</p>}
                        <div className="vault-row">
                            <button type="button" className="profile-action-btn neutral neobrutal-button" onClick={() => go({ kind: 'idle' })}>Cancel</button>
                            <button type="submit" className="profile-action-btn neobrutal-button" disabled={!a || a !== b || busy}>{busy ? 'Working…' : 'Continue'}</button>
                        </div>
                    </form>
                </section>
            </div>
        );
    }

    // ── Main screen (vault exists) ──
    return (
        <div className="profile-account-content">
            <section className="profile-section">
                <h3 className="profile-section-title">Vault</h3>
                {notice && <p className="profile-section-desc" role="status">{notice}</p>}
                {unlocked ? (
                    <>
                        <p className="profile-section-desc">Your vault is unlocked.</p>
                        <button className="profile-action-btn neobrutal-button" onClick={() => { lockVault('manual'); setNotice(''); }}>Lock now</button>
                    </>
                ) : (
                    <VaultUnlockForm autoFocus={false} onUnlocked={() => setNotice('')} />
                )}
            </section>

            <section className="profile-section">
                <h3 className="profile-section-title">Auto-lock</h3>
                <p className="profile-section-desc">Locks after this long without using a vault note, and when the app is in the background for a minute. This setting is per device.</p>
                <div className="vault-row vault-row--tight">
                    {AUTO_LOCK_CHOICES.map((m) => (
                        <button key={m} className={`profile-action-btn neobrutal-button${autoLock === m ? '' : ' neutral'}`} aria-pressed={autoLock === m}
                            onClick={() => { setAutoLockMinutes(m); setAutoLock(m); }}>{m} min</button>
                    ))}
                </div>
            </section>

            <section className="profile-section">
                <h3 className="profile-section-title">Passphrase and recovery code</h3>
                <div className="vault-row vault-row--tight">
                    <button className="profile-action-btn neutral neobrutal-button" onClick={() => { setNotice(''); go({ kind: 'change-pass' }); }}>Change passphrase</button>
                    <button className="profile-action-btn neutral neobrutal-button" onClick={() => { setNotice(''); go({ kind: 'new-code-pass' }); }}>New recovery code</button>
                    <button className="profile-action-btn neutral neobrutal-button" onClick={() => { setNotice(''); go({ kind: 'forgot-code' }); }}>Forgot passphrase?</button>
                </div>
            </section>

            <section className="profile-section">
                <h3 className="profile-section-title">Export vault notes</h3>
                <p className="profile-section-desc">This downloads your vault notes as a file that is not encrypted. Anyone who opens the file can read them.</p>
                <button className="profile-action-btn neutral neobrutal-button" disabled={!unlocked || busy} onClick={() => void run(async () => {
                    const json = await buildVaultExport();
                    downloadFile(json, 'application/json', `intraconnected-vault-export-${new Date().toISOString().slice(0, 10)}.json`);
                })}>{unlocked ? 'Export vault notes' : 'Unlock to export'}</button>
                {error && <p className="profile-error" role="alert">{error}</p>}
            </section>

            <section className="profile-section profile-section--danger">
                <h3 className="profile-section-title profile-section-title--danger">Reset vault</h3>
                <p className="profile-section-desc">
                    Reset vault deletes all {vaultNoteCount} vault {vaultNoteCount === 1 ? 'note' : 'notes'} and lets you start over with a new passphrase. Only do this if you've lost both your passphrase and your recovery code. This can't be undone.
                </p>
                <input className="profile-input neobrutal-input" placeholder='Type "RESET" to confirm' aria-label="Type RESET to confirm" value={resetText}
                    onChange={(e) => setResetText(e.target.value)} {...NO_AUTOFILL} />
                <button className="profile-action-btn danger neobrutal-button" disabled={resetText !== 'RESET' || busy} onClick={() => void run(async () => {
                    const removed = await resetVault();
                    setNewIdeaSwitch((prev) => !prev);
                    setResetText('');
                    setNotice(`Vault reset. ${removed} vault ${removed === 1 ? 'note' : 'notes'} deleted.`);
                    refresh();
                })}>{busy ? 'Resetting…' : 'Reset vault'}</button>
            </section>
        </div>
    );
}

export default VaultSettings;
