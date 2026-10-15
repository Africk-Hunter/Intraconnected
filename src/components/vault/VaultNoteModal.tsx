import { useCallback } from 'react';
import { useIdeaContext } from '../../context/IdeaContext';
import { useIdeaActions } from '../../utilities/idea/useIdeaActions';
import AnimatedOverlay from '../AnimatedOverlay';
import VaultNotePanel from './VaultNotePanel';
import { useOpenVaultSettings } from './vaultUi';

// Desktop: one vault note in a modal. The phone layout uses a sheet instead.
function VaultNoteModal() {
    const { vaultNote, setVaultNote } = useIdeaContext();
    const { requestDelete } = useIdeaActions();
    const openSettings = useOpenVaultSettings();
    const close = useCallback(() => setVaultNote(null), [setVaultNote]);

    return (
        <AnimatedOverlay open={vaultNote !== null} onEscape={close}>
            <div className="modal neobrutal confirmModal vaultModal">
                {vaultNote && (
                    <VaultNotePanel
                        key={vaultNote.id}
                        ideaId={vaultNote.id}
                        initialMode={vaultNote.mode}
                        onClose={close}
                        onOpenVaultSettings={openSettings}
                        onDelete={(id) => requestDelete(id)}
                    />
                )}
            </div>
        </AnimatedOverlay>
    );
}

export default VaultNoteModal;
