import { useIdeaContext } from "../../context/IdeaContext";

interface CreationModalProps {
    handleIdeaCreation: (content: string, parentId: number) => void;
}

function CreationModal({ handleIdeaCreation }: CreationModalProps) {

    const { rootId, creationModalOpen, setCreationModalOpen, modalContent, setModalContent, setNewIdeaSwitch } = useIdeaContext();

    return (
        <>
            {creationModalOpen ?
                <section className="overlay">
                    <div className="modal neobrutal">
                        <textarea autoFocus={true} maxLength={100} className="ideaContent neobrutal-input" placeholder='Whats your idea?' onChange={(e) => setModalContent(e.target.value)}></textarea>
                        <section className="modalButtons">
                            <button className="modalButton cancel neobrutal-button" onClick={() => setCreationModalOpen(false)}>Cancel</button>
                            <button className="modalButton continue neobrutal-button" onClick={() => { handleIdeaCreation(modalContent, rootId); setCreationModalOpen(false); setNewIdeaSwitch(prev => !prev) }}>Continue</button>
                        </section>
                    </div>
                </section> : <></>
            }
        </>
    );
}

export default CreationModal;
