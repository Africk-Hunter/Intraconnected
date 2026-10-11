import { useEffect } from "react";
import { useIdeaContext } from "../../context/IdeaContext";
import { updateIdeaLink, cleanLink } from "../../utilities";
import AnimatedOverlay from "../AnimatedOverlay";


function LinkChangeModal() {

    const { modalContent, linkChangeModalOpen, setModalContent, setLinkChangeModalOpen, currentLinkID, setNewIdeaSwitch, currentLink } = useIdeaContext();

    // Start from the card's current link. Without this the field shows the link
    // but saving untouched would store whatever modalContent was left over
    // (usually an empty string), erasing the link.
    useEffect(() => {
        if (linkChangeModalOpen) setModalContent(currentLink);
    }, [linkChangeModalOpen, currentLink, setModalContent]);

    function closeModal() {
        setLinkChangeModalOpen(false);
        setModalContent('');
    }

    function handleLinkChange(ideaID: number, newLink: string) {
        updateIdeaLink(ideaID, newLink).then(() => {
            setNewIdeaSwitch(prev => !prev);
        }).catch((error) => {
            console.error("Error updating link: ", error);
        });
    }

    function submit() {
        handleLinkChange(currentLinkID, cleanLink(modalContent));
        closeModal();
    }

    return (
        <AnimatedOverlay open={linkChangeModalOpen} onEscape={closeModal}>
            <div className="modal neobrutal">
                <textarea autoFocus={true} className="ideaContent neobrutal-input" placeholder='Change Link...' value={modalContent} onChange={(e) => setModalContent(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}></textarea>
                <section className="modalButtons">
                    <button className="modalButton cancel neobrutal-button" onClick={closeModal}>Cancel</button>
                    <button className="modalButton continue neobrutal-button" onClick={submit}>Change</button>
                </section>
            </div>
        </AnimatedOverlay>
    );
}

export default LinkChangeModal;
