import { useEffect, useState } from 'react';
import AnimatedOverlay from '../AnimatedOverlay';
import FeatureImplementedModal from './FeatureImplementedModal';
import UpgradeCelebrationModal from './UpgradeCelebrationModal';
import ShortcutsModal from './ShortcutsModal';
import SearchModal from './SearchModal';
import { useIdeaContext } from '../../context/IdeaContext';
import { fetchFullIdeaList, resolveIdeaLabel } from '../../utilities';
import { isVaultIdea } from '../../utilities/idea/helpers';
import { openReport } from '../../utilities/reportProblem';
import { requestDevModal } from '../../utilities/devModals';
import type { IdeaType } from '../../utilities/types';
import '../../styles/modalTester.scss';

// Modals this panel renders itself, with dummy props.
type Demo = 'feature-one' | 'feature-many' | 'celebrate-annual' | 'celebrate-lifetime' | 'shortcuts' | 'search';

interface Entry {
    title: string;
    run: () => void;
    // Opens on one of your real ideas, so saving or confirming changes it.
    realData?: boolean;
    // Why the button is off.
    unavailable?: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
}

const DUMMY_TITLES = ['Dark mode for the mind map', 'Keyboard shortcuts for moving ideas', 'Export to PDF'];

function firstIdea(pred: (idea: IdeaType, all: IdeaType[]) => boolean): IdeaType | undefined {
    const all = fetchFullIdeaList();
    return all.find(idea => idea.id !== 1 && pred(idea, all));
}

const label = (idea: IdeaType) => resolveIdeaLabel(idea).replace(/\s+/g, ' ').trim();

// Profile -> Developer Testing -> Modal testing. Every button opens its modal on
// top of this panel (see body.modal-tester-on in modalTester.scss), so closing
// the modal drops you back here instead of out of Profile.
function ModalTester({ open, onClose }: Props) {
    const ctx = useIdeaContext();
    const [demo, setDemo] = useState<Demo | null>(null);

    useEffect(() => {
        document.body.classList.toggle('modal-tester-on', open);
        return () => document.body.classList.remove('modal-tester-on');
    }, [open]);

    const closeDemo = () => setDemo(null);

    // Looked up when the panel opens; the tester does not stay open while ideas change.
    const entries: Entry[] = !open ? [] : (() => {
        const anyIdea = firstIdea(() => true);
        const branch = firstIdea((idea, all) => all.some(i => i.parentID === idea.id));
        const checklist = firstIdea(idea => idea.type === 'checklist');
        const vault = firstIdea(idea => isVaultIdea(idea));
        const leaf = firstIdea(idea => idea.type !== 'checklist' && !isVaultIdea(idea));
        const needIdea = anyIdea ? undefined : 'Needs at least one idea';

        return [
            { title: 'Feature implemented (one)', run: () => setDemo('feature-one') },
            { title: 'Feature implemented (several)', run: () => setDemo('feature-many') },
            { title: 'Upgrade celebration (Annual)', run: () => setDemo('celebrate-annual') },
            { title: 'Upgrade celebration (Lifetime)', run: () => setDemo('celebrate-lifetime') },
            { title: 'Keyboard shortcuts', run: () => setDemo('shortcuts') },
            { title: 'Search', run: () => setDemo('search') },
            { title: 'Onboarding', run: () => requestDevModal('onboarding') },
            { title: 'Signed out (session ended)', run: () => requestDevModal('session-ended') },
            { title: 'Report a problem', run: () => openReport({ area: 'other' }), realData: true },
            {
                title: 'Upgrade',
                run: () => { ctx.setUpgradeModalReason(null); ctx.setUpgradeModalOpen(true); },
            },
            {
                title: 'Upgrade (node limit reached)',
                run: () => { ctx.setUpgradeModalReason('limit'); ctx.setUpgradeModalOpen(true); },
            },
            { title: 'Checkout (Annual)', run: () => ctx.setCheckoutPlan('annual'), realData: true },
            { title: 'Checkout (Lifetime)', run: () => ctx.setCheckoutPlan('lifetime'), realData: true },
            { title: 'Create', run: () => ctx.setCreationModalOpen(true), realData: true },
            {
                title: 'Rename',
                realData: true,
                unavailable: leaf ? undefined : needIdea,
                run: () => {
                    if (!leaf) return;
                    ctx.setCurrentNameChangeId(leaf.id);
                    ctx.setSelectedIdeaName(label(leaf));
                    ctx.setRenameModalOpen(true);
                },
            },
            {
                title: 'Change link',
                realData: true,
                unavailable: leaf ? undefined : needIdea,
                run: () => {
                    if (!leaf) return;
                    ctx.setCurrentLinkID(leaf.id);
                    ctx.setCurrentLink('');
                    ctx.setLinkChangeModalOpen(true);
                },
            },
            {
                title: 'Move',
                realData: true,
                unavailable: anyIdea ? undefined : needIdea,
                run: () => { if (anyIdea) ctx.setMoveIdeaId(anyIdea.id); },
            },
            {
                title: 'Delete (with ideas inside)',
                realData: true,
                unavailable: branch ? undefined : 'Needs an idea with ideas inside it',
                run: () => {
                    if (!branch) return;
                    ctx.setPendingDeleteId(branch.id);
                    ctx.setDeleteConfirmModalOpen(true);
                },
            },
            {
                title: 'Checklist',
                realData: true,
                unavailable: checklist ? undefined : 'Needs a checklist',
                run: () => { if (checklist) ctx.setChecklistModalId(checklist.id); },
            },
            {
                title: 'Vault note',
                realData: true,
                unavailable: vault ? undefined : 'Needs a vault note',
                run: () => { if (vault) ctx.setVaultNote({ id: vault.id, mode: 'view' }); },
            },
        ];
    })();

    return (
        <>
            <AnimatedOverlay open={open} onEscape={onClose}>
                <div className="modal neobrutal modal-tester" role="dialog" aria-modal="true" aria-labelledby="modal-tester-title">
                    <header className="modal-tester-header">
                        <div>
                            <h2 className="modal-tester-title" id="modal-tester-title">Modal testing</h2>
                            <p className="modal-tester-desc">
                                Opens each modal on top of this panel. Close it to come back here.
                                Tagged ones use your real ideas or services.
                            </p>
                        </div>
                        <button className="profile-close neobrutal-button" onClick={onClose} aria-label="Close">✕</button>
                    </header>
                    <ul className="modal-tester-grid">
                        {entries.map(entry => (
                            <li key={entry.title} className="modal-tester-item">
                                <span className="modal-tester-name">
                                    {entry.title}
                                    {entry.realData && <small className="modal-tester-tag">real data</small>}
                                </span>
                                <button
                                    className="profile-action-btn neobrutal-button"
                                    onClick={entry.run}
                                    disabled={!!entry.unavailable}
                                    title={entry.unavailable}
                                >
                                    {entry.unavailable ?? 'Open'}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </AnimatedOverlay>

            {demo === 'feature-one' && <FeatureImplementedModal titles={DUMMY_TITLES.slice(0, 1)} onClose={closeDemo} />}
            {demo === 'feature-many' && <FeatureImplementedModal titles={DUMMY_TITLES} onClose={closeDemo} />}
            {demo === 'celebrate-annual' && <UpgradeCelebrationModal plan="annual" onClose={closeDemo} />}
            {demo === 'celebrate-lifetime' && <UpgradeCelebrationModal plan="lifetime" onClose={closeDemo} />}
            <ShortcutsModal open={demo === 'shortcuts'} onClose={closeDemo} />
            <SearchModal open={demo === 'search'} onClose={closeDemo} onPick={closeDemo} commands={[]} />
        </>
    );
}

export default ModalTester;
