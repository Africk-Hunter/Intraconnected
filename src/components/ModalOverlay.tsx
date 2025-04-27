import { useIdeaContext } from "../context/IdeaContext";

interface ModalOverlayProps {
    handleIdeaCreation: (content: string, parentId: number) => void;
}

function ModalOverlay({ handleIdeaCreation }: ModalOverlayProps) {

    const { rootId, modalOpen, setModalOpen, modalContent, setModalContent, setNewIdeaSwitch } = useIdeaContext();

    return (
        <>
            {modalOpen ?
                <section className="overlay">
                    <div className="modal neobrutal">
                        <textarea className="ideaContent neobrutal-input" placeholder='Whats your idea?' onChange={(e) => setModalContent(e.target.value)}></textarea>
                        <section className="modalButtons">
                            <button className="modalButton cancel neobrutal-button" onClick={() => setModalOpen(false)}>Cancel</button>
                            <button className="modalButton continue neobrutal-button" onClick={() => { handleIdeaCreation(modalContent, rootId); setModalOpen(false); setNewIdeaSwitch(prev => !prev) }}>Continue</button>
                        </section>
                    </div>
                </section> : <></>
            }
        </>
    );
}

export default ModalOverlay;
