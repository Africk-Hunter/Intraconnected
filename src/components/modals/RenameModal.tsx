import { useIdeaContext } from "../../context/IdeaContext";
import { updateIdeaName, updateIdeaNameInFirebase, fetchFullIdeaList } from "../../utilities";
import { useEffect, useState } from "react";


function RenameModal() {

    const { rootId, rootName, setRootName, renameModalOpen, setRenameModalOpen, modalContent, setModalContent, setNewIdeaSwitch, setCurrentNameChangeId, currentNameChangeId, selectedIdeaName, setSelectedIdeaName } = useIdeaContext();

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
    const hasChildren = fetchFullIdeaList().some((idea: any) => idea.parentID === targetId);
    const actionLabel = hasChildren ? 'Rename Idea' : 'Rewrite Idea';

    return (
        <>
            {renameModalOpen ?
                <section className="overlay">
                    <div className="modal neobrutal">
                        <textarea
                            autoFocus={true}
                            maxLength={100}
                            className="ideaContent neobrutal-input"
                            placeholder={`${actionLabel}...`}
                            value={modalContent} //This needs to be set to something called 'ranameIdeaName.' Doing just root wont work if a rename button is to be added.
                            onChange={(e) => setModalContent(e.target.value)}
                        ></textarea>
                        <section className="modalButtons">
                            <button className="modalButton cancel neobrutal-button" onClick={() => { setRenameModalOpen(false); setCurrentNameChangeId(-1); }}>Cancel</button>
                            <button className="modalButton continue neobrutal-button" onClick={() => { handleIdeaRename(modalContent); setRenameModalOpen(false); }}>{hasChildren ? 'Rename' : 'Rewrite'}</button>
                        </section>
                    </div>
                </section> : <></>
            }
        </>
    );
}

export default RenameModal