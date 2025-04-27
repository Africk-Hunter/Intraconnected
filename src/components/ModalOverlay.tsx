interface ModalOverlayProps {
    setModalOpen: (open: boolean) => void;
    modalOpen: boolean;
    handleIdeaCreation: (content: string, parentId: number) => void;
    rootId: number;
    setNewIdeaSwitch: (value: (prev: boolean) => boolean) => void;
    modalContent: string;
    setModalContent: (content: string) => void;
}

function ModalOverlay({ setModalOpen, modalOpen, handleIdeaCreation, rootId, setNewIdeaSwitch, modalContent, setModalContent }: ModalOverlayProps) {

    

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
