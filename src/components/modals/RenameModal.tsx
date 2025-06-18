import { useIdeaContext } from "../../context/IdeaContext";
import { updateIdeaName, updateIdeaNameInFirebase } from "../../utilities";
import { useEffect as reactUseEffect, useEffect } from "react";


function RenameModal() {

    const { rootId, rootName, setRootName, renameModalOpen, setRenameModalOpen, modalContent, setModalContent, setNewIdeaSwitch } = useIdeaContext();

    useEffect(() => {
        if (renameModalOpen) {
            setModalContent(rootName);
        }
    }, [renameModalOpen, rootName, setModalContent]);
    
    function handleIdeaRename(rootID: number, newName: string) {
        updateIdeaNameInFirebase(rootID, newName).then(() => {
            setRootName(newName);
            updateIdeaName(rootID, newName);
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
                            <button className="modalButton cancel neobrutal-button" onClick={() => setRenameModalOpen(false)}>Cancel</button>
                            <button className="modalButton continue neobrutal-button" onClick={() => { handleIdeaRename(rootId, modalContent); setRenameModalOpen(false); setNewIdeaSwitch(prev => !prev) }}>Rename</button>
                        </section>
                    </div>
                </section> : <></>
            }
        </>
    );
}

export default RenameModal