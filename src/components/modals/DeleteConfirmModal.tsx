import { useIdeaContext } from "../../context/IdeaContext";
import { getNameFromID, fetchFullIdeaList } from "../../utilities";
import { countSubtree, useIdeaActions } from "../../utilities/idea/useIdeaActions";
import AnimatedOverlay from "../AnimatedOverlay";

// Only reached for an idea that has others under it; a single idea is deleted
// at once and offered an Undo instead (see Idea.tsx and useIdeaActions).
function DeleteConfirmModal() {
    const { deleteConfirmModalOpen, setDeleteConfirmModalOpen, pendingDeleteId, setPendingDeleteId, deleteModalOrigin } = useIdeaContext();
    const { deleteIdea } = useIdeaActions();

    function handleConfirm() {
        if (pendingDeleteId === null) return;
        deleteIdea(pendingDeleteId);
        setDeleteConfirmModalOpen(false);
        setPendingDeleteId(null);
    }

    function handleCancel() {
        setDeleteConfirmModalOpen(false);
        setPendingDeleteId(null);
    }

    // Arrows / Tab-free switching between the two buttons; Enter/Space press the focused one.
    function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('.modalButtons button'));
        const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (buttons.length === 0) return;
        e.preventDefault();
        const step = e.key === 'ArrowRight' ? 1 : -1;
        buttons[(at + step + buttons.length) % buttons.length].focus();
    }

    const ideaName =pendingDeleteId !== null ? getNameFromID(pendingDeleteId) : '';
    // Counted only while open: it reads the whole list from storage.
    const total = deleteConfirmModalOpen && pendingDeleteId !== null ? countSubtree(fetchFullIdeaList(), pendingDeleteId) : 0;
    const others = Math.max(total - 1, 0);

    return (
        <AnimatedOverlay open={deleteConfirmModalOpen} origin={deleteModalOrigin ?? undefined} onEscape={handleCancel}>
            <div className="modal neobrutal confirmModal deleteModal" role="alertdialog" aria-labelledby="deleteModalTitle" aria-describedby={others > 0 ? "deleteModalDetail" : undefined} onKeyDown={handleKeyDown}>
                <span className="deleteModalIcon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" />
                        <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                    </svg>
                </span>
                <h2 className="deleteModalTitle" id="deleteModalTitle">Delete this idea?</h2>
                <div className="deleteModalName">
                    <span className="deleteModalNameText">{ideaName}</span>
                </div>
                {others > 0 && (
                    <p className="deleteModalDetail" id="deleteModalDetail">
                        <span className="deleteModalCount">
                            + {others} {others === 1 ? 'idea' : 'ideas'} inside it
                        </span>
                    </p>
                )}
                <section className="modalButtons">
                    <button className="modalButton cancel neobrutal-button" onClick={handleCancel} autoFocus>Cancel</button>
                    <button className="modalButton delete neobrutal-button" onClick={handleConfirm}>
                        {total > 1 ? `Delete ${total} ideas` : 'Delete'}
                    </button>
                </section>
            </div>
        </AnimatedOverlay>
    );
}

export default DeleteConfirmModal;
