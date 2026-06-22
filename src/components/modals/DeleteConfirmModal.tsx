import { useIdeaContext } from "../../context/IdeaContext";
import { getChildrenToDelete, recursivelyDeleteChildren, getNameFromID, getIdeasByParentID } from "../../utilities";
import { IdeaType } from "../../utilities";
import AnimatedOverlay from "../AnimatedOverlay";

function DeleteConfirmModal() {
    const { deleteConfirmModalOpen, setDeleteConfirmModalOpen, pendingDeleteId, setPendingDeleteId, setIdeas, deleteModalOrigin } = useIdeaContext();

    function handleConfirm() {
        if (pendingDeleteId === null) return;
        const childrenToDelete = getChildrenToDelete(pendingDeleteId);
        recursivelyDeleteChildren(pendingDeleteId);
        setIdeas((prevIdeas: IdeaType[]) =>
            prevIdeas.filter(
                (idea: IdeaType) =>
                    idea.id !== pendingDeleteId &&
                    !childrenToDelete.some((child: IdeaType) => child.id === idea.id)
            )
        );
        setDeleteConfirmModalOpen(false);
        setPendingDeleteId(null);
    }

    function handleCancel() {
        setDeleteConfirmModalOpen(false);
        setPendingDeleteId(null);
    }

    const ideaName = pendingDeleteId !== null ? getNameFromID(pendingDeleteId) : '';
    const hasChildren = pendingDeleteId !== null && getIdeasByParentID(pendingDeleteId).length > 0;

    return (
        <AnimatedOverlay open={deleteConfirmModalOpen} origin={deleteModalOrigin ?? undefined}>
            <div className="modal neobrutal confirmModal">
                <p className="confirmText">Delete "<strong className="confirmName">{ideaName}</strong>"{hasChildren ? ' and all of its children' : ''}?</p>
                <section className="modalButtons">
                    <button className="modalButton cancel neobrutal-button" onClick={handleCancel}>Cancel</button>
                    <button className="modalButton delete neobrutal-button" onClick={handleConfirm}>Delete</button>
                </section>
            </div>
        </AnimatedOverlay>
    );
}

export default DeleteConfirmModal;
