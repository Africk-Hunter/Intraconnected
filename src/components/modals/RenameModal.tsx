import { useIdeaContext } from "../../context/IdeaContext";
import { updateIdeaName, updateIdeaNameInFirebase } from "../../utilities";
import { useEffect as reactUseEffect, useEffect, useState } from "react";


function RenameModal() {

    const { rootId, rootName, setRootName, renameModalOpen, setRenameModalOpen, modalContent, setModalContent, setNewIdeaSwitch, setCurrentNameChangeId, currentNameChangeId, selectedIdeaName } = useIdeaContext();

    const [editRootOrNot, setEditRootOrNot] = useState(true);

    useEffect(() => {
        if (renameModalOpen) {
            if (currentNameChangeId == -1) {
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
        updateIdeaNameInFirebase(pickID(), newName).then(() => {
            setRootName(newName);
            updateIdeaName(pickID(), newName);
        }).catch((error) => {
            console.error("Error renaming idea: ", error);
        });
    }

    //setModalContent(rootName) neecd to call this function on instantiation. so its set to that when the user accesses it.
    return (
        <>
            {renameModalOpen ?
                <section className="overlay">
                    <div className="modal neobrutal">
                        <textarea
                            autoFocus={true}
                            maxLength={100}
                            className="ideaContent neobrutal-input"
                            placeholder='Rename Idea...'
                            value={modalContent} //This needs to be set to something called 'ranameIdeaName.' Doing just root wont work if a rename button is to be added.
                            onChange={(e) => setModalContent(e.target.value)}
                        ></textarea>
                        <section className="modalButtons">
                            <button className="modalButton cancel neobrutal-button" onClick={() => { setRenameModalOpen(false); setCurrentNameChangeId(-1); }}>Cancel</button>
                            <button className="modalButton continue neobrutal-button" onClick={() => { handleIdeaRename(modalContent); setRenameModalOpen(false); setNewIdeaSwitch(prev => !prev); }}>Rename</button>
                        </section>
                    </div>
                </section> : <></>
            }
        </>
    );
}

export default RenameModal