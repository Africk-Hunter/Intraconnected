import { useIdeaContext } from "../../context/IdeaContext";
import { updateIdeaName, updateIdeaNameInFirebase, fetchFullIdeaList } from "../../utilities";
import { useEffect, useState } from "react";
import AnimatedOverlay from "../AnimatedOverlay";


function RenameModal() {

    const { rootId, rootName, setRootName, renameModalOpen, setRenameModalOpen, modalContent, setModalContent, setNewIdeaSwitch, setCurrentNameChangeId, currentNameChangeId, selectedIdeaName, setSelectedIdeaName } = useIdeaContext();

    function closeModal() {
        setRenameModalOpen(false);
        setCurrentNameChangeId(-1);
        setModalContent('');
    }

    const [editRootOrNot, setEditRootOrNot] = useState(true);

    useEffect(() => {
        if (renameModalOpen) {
            if (currentNameChangeId === -1) {
                setModalContent(rootName);
                setEditRootOrNot(true);
            }
            else {
                setModalContent(selectedIdeaName);
                setEditRootOrNot(false);
            }
        }
    }, [renameModalOpen, rootName, setModalContent]);


    function pickID(){
        if (editRootOrNot){
            return rootId;
        }
        return currentNameChangeId;
    }

    function handleIdeaRename(newName: string) {
        setSelectedIdeaName(newName);
        updateIdeaNameInFirebase(pickID(), newName).then(() => {
            if (editRootOrNot) setRootName(newName);
            updateIdeaName(pickID(), newName);
            setNewIdeaSwitch(prev => !prev);
        }).catch((error) => {
            console.error("Error renaming idea: ", error);
        });
    }

    const targetId = editRootOrNot ? rootId : currentNameChangeId;
    const allIdeas = fetchFullIdeaList();
    const targetIdea = allIdeas.find((idea: any) => idea.id === targetId);
    const isChecklist = targetIdea?.type === 'checklist';
    const hasChildren = allIdeas.some((idea: any) => idea.parentID === targetId);
    const actionLabel = isChecklist ? 'Rename Checklist' : hasChildren ? 'Rename Idea' : 'Rewrite Idea';

    return (
        <AnimatedOverlay open={renameModalOpen}>
            <div className="modal neobrutal">
                <textarea
                    autoFocus={true}
                    maxLength={100}
                    className="ideaContent neobrutal-input"
                    placeholder={`${actionLabel}...`}
                    value={modalContent}
                    onChange={(e) => setModalContent(e.target.value)}
                ></textarea>
                <section className="modalButtons">
                    <button className="modalButton cancel neobrutal-button" onClick={closeModal}>Cancel</button>
                    <button className="modalButton continue neobrutal-button" onClick={() => { handleIdeaRename(modalContent); closeModal(); }}>{isChecklist ? 'Rename' : hasChildren ? 'Rename' : 'Rewrite'}</button>
                </section>
            </div>
        </AnimatedOverlay>
    );
}

export default RenameModal