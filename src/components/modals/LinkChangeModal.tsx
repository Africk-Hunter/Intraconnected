import { useIdeaContext } from "../../context/IdeaContext";
import { updateIdeaLinkInFirebase, updateIdeaLink, cleanLink } from "../../utilities";


function LinkChangeModal() {

    const { modalContent, linkChangeModalOpen, setModalContent, setLinkChangeModalOpen, currentLinkID, setNewIdeaSwitch, currentLink } = useIdeaContext();
    

    function handleLinkChange(ideaID: number, newLink: string) {
        updateIdeaLinkInFirebase(ideaID, newLink).then(() => {
            updateIdeaLink(ideaID, newLink);
            setNewIdeaSwitch(prev => !prev);
        }).catch((error) => {
            console.error("Error updating link: ", error);
        });
    }

    return (
        <>
            {linkChangeModalOpen ?
                <section className="overlay">
                    <div className="modal neobrutal">
                        <textarea autoFocus={true} maxLength={100} className="ideaContent neobrutal-input" placeholder='Change Link...' onChange={(e) => setModalContent(e.target.value)}>{currentLink}</textarea>
                        <section className="modalButtons">
                            <button className="modalButton cancel neobrutal-button" onClick={() => setLinkChangeModalOpen(false)}>Cancel</button>
                            <button className="modalButton continue neobrutal-button" onClick={() => { handleLinkChange(currentLinkID, cleanLink(modalContent)); setLinkChangeModalOpen(false); }}>Change</button>
                        </section>
                    </div>
                </section> : <></>
            }
        </>
    );
}

export default LinkChangeModal;
