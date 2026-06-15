import { useIdeaContext } from "../../context/IdeaContext";
import { getChildrenToDelete, recursivelyDeleteChildren, getNameFromID } from "../../utilities";
import { IdeaType } from "../../utilities";

function DeleteConfirmModal() {
    const { deleteConfirmModalOpen, setDeleteConfirmModalOpen, pendingDeleteId, setPendingDeleteId, setIdeas } = useIdeaContext();

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

    return (
        <>
            {deleteConfirmModalOpen &&
                <section className="overlay">
                    <div className="modal neobrutal confirmModal">
                        <p className="confirmText">Delete "<strong>{ideaName}</strong>"?</p>
                        <section className="modalButtons">
                            <button className="modalButton cancel neobrutal-button" onClick={handleCancel}>Cancel</button>
                            <button className="modalButton delete neobrutal-button" onClick={handleConfirm}>Delete</button>
                        </section>
                    </div>
                </section>
            }
        </>
    );
}

export default DeleteConfirmModal;
