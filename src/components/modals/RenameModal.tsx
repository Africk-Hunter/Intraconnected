import { useIdeaContext } from "../../context/IdeaContext";
import { updateIdeaName, updateIdeaNameInFirebase, getIdeasByParentID } from "../../utilities";

interface RenameModalProps {

}

function RenameModal({ }: RenameModalProps) {

    const { rootId, setRootName, renameModalOpen, setRenameModalOpen, modalContent, setModalContent, setNewIdeaSwitch, setIdeas } = useIdeaContext();

    function handleIdeaRename(rootID: number, newName: string) {
        updateIdeaNameInFirebase(rootID, newName).then(() => {
            setRootName(newName);
            updateIdeaName(rootID, newName);
        }).catch((error) => {
            console.error("Error renaming idea:", error);
        });
    }

    return (
        <>
            {renameModalOpen ?
                <section className="overlay">
                    <div className="modal neobrutal">
                        <textarea autoFocus={true} maxLength={100} className="ideaContent neobrutal-input" placeholder='Rename Idea...' onChange={(e) => setModalContent(e.target.value)}></textarea>
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

export default RenameModal;
