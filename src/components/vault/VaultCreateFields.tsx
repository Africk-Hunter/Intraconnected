import { useVaultState } from '../../utilities/vault/useVaultState';
import VaultSecretFields, { type VaultDraft } from './VaultSecretFields';
import VaultUnlockForm from './VaultUnlockForm';
import VaultLockGlyph from './VaultLockGlyph';
import { useEffect } from 'react';
import { useVaultSetupStatus, type VaultSetupStatus } from './vaultUi';

export type { VaultDraft };

interface VaultCreateFieldsProps {
    draft: VaultDraft;
    onChange: (draft: VaultDraft) => void;
    // Close the creating UI, then open Profile → Vault.
    onOpenSettings: () => void;
    onSubmitShortcut?: () => void;
    // The phone's create sheet keeps the main button (Create / Unlock / Set up
    // vault) in its pinned footer. It reports the setup status up so the
    // footer can pick the right one, and the buttons here are left out.
    footerAction?: { unlockFormId: string; onStatus: (status: VaultSetupStatus) => void };
}

// The Vault tab of the Create modal and of the phone's create sheet.
function VaultCreateFields({ draft, onChange, onOpenSettings, onSubmitShortcut, footerAction }: VaultCreateFieldsProps) {
    const { unlocked } = useVaultState();
    const { status } = useVaultSetupStatus();
    const reportStatus = footerAction?.onStatus;
    useEffect(() => { reportStatus?.(status); }, [reportStatus, status]);

    if (!unlocked) {
        if (status === 'loading') return <p className="vault-hint">Checking your vault…</p>;
        if (status === 'none') {
            return (
                <div className="vault-create-note vault-setup-prompt">
                    <span className="vault-setup-badge"><VaultLockGlyph open={false} size="1.6rem" /></span>
                    <h3 className="vault-setup-title">Set up your vault first</h3>
                    <p className="vault-setup-text">Vault notes are for passwords and other secrets, locked with a passphrase only you know.</p>
                    {!footerAction && <button type="button" className="vault-btn vault-btn--primary neobrutal-button" onClick={onOpenSettings}>Set up vault</button>}
                </div>
            );
        }
        if (status === 'offline') return <p className="vault-error">You're offline. Connect to the internet to use your vault on this device for the first time.</p>;
        return <VaultUnlockForm onOpenSettings={onOpenSettings} autoFocus={false} formId={footerAction?.unlockFormId} hideSubmit={!!footerAction} />;
    }

    return (
        <div className="vault-fields">
            <VaultSecretFields
                idPrefix="vault-create"
                draft={draft}
                onChange={onChange}
                onSubmitShortcut={onSubmitShortcut}
                foldLink={!!footerAction}
            />
        </div>
    );
}

export default VaultCreateFields;
