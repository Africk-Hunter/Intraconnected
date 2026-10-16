import { useCallback, useEffect, useState } from 'react';
import { useIdeaContext } from '../../context/IdeaContext';
import { VaultError } from '../../utilities/vault/vaultError';
import { loadVaultMeta, peekVaultStatus } from '../../utilities/vault/vaultService';
import { useVaultState } from '../../utilities/vault/useVaultState';

// What a person reads when a vault action fails. Never shows a wrong-passphrase
// message for a module that failed to load (CLAUDE.md, Argon2id).
export function vaultErrorText(error: unknown): string {
    const code = error instanceof VaultError ? error.code : null;
    switch (code) {
        case 'wrong-passphrase': return "That passphrase doesn't match.";
        case 'wrong-code': return "That recovery code doesn't match.";
        case 'malformed-code': return "That doesn't look like a recovery code. It has 32 letters and numbers.";
        case 'argon2-unavailable': return "The vault's security module couldn't load. Reload the page and try again.";
        case 'offline': return "You're offline. Connect to the internet and try again.";
        case 'not-set-up': return "You haven't set up your vault yet.";
        case 'already-set-up': return 'This account already has a vault.';
        case 'locked': return 'Your vault locked. Unlock it and try again.';
        case 'other-vault': return 'This vault note was made with a vault that has since been reset, so it can\'t be opened.';
        case 'damaged': return "This vault note is damaged and can't be opened.";
        default: return 'Something went wrong. Please try again.';
    }
}

export type VaultSetupStatus = 'loading' | 'none' | 'ready' | 'offline';

// Whether this account has a vault. An unlocked vault obviously exists, so
// that case costs no read.
export function useVaultSetupStatus(): { status: VaultSetupStatus; refresh: () => void } {
    const { unlocked } = useVaultState();
    const [status, setStatus] = useState<VaultSetupStatus>(() => unlocked ? 'ready' : (peekVaultStatus() ?? 'loading'));
    const [tick, setTick] = useState(0);

    useEffect(() => {
        if (unlocked) { setStatus('ready'); return; }
        let cancelled = false;
        // A saved answer shows at once; the read below only corrects it.
        setStatus(peekVaultStatus() ?? 'loading');
        loadVaultMeta()
            .then((meta) => { if (!cancelled) setStatus(meta ? 'ready' : 'none'); })
            .catch(() => { if (!cancelled) setStatus('offline'); });
        return () => { cancelled = true; };
    }, [unlocked, tick]);

    const refresh = useCallback(() => setTick((t) => t + 1), []);
    return { status, refresh };
}

// Opens Profile on the Vault tab. Close whatever modal or sheet is open first.
// Pass `returnTo` from a Create UI to land back on its Vault tab when Profile closes.
export function useOpenVaultSettings(returnTo?: 'desktop' | 'mobile'): () => void {
    const { setProfileTabRequest, setProfileModalOpen, setCreateReturn } = useIdeaContext();
    return useCallback(() => {
        setCreateReturn(returnTo ?? null);
        setProfileTabRequest('vault');
        setProfileModalOpen(true);
    }, [setProfileTabRequest, setProfileModalOpen, setCreateReturn, returnTo]);
}

// Attributes that keep browsers and password managers from filling the
// account password into a vault field.
export const NO_AUTOFILL = {
    autoComplete: 'off',
    'data-1p-ignore': true,
    'data-lpignore': 'true',
} as const;
