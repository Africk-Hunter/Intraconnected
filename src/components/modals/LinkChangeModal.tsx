import { useIdeaContext } from "../../context/IdeaContext";
import { updateIdeaLinkInFirebase, updateIdeaLink } from "../../utilities";


function LinkChangeModal() {

    const { modalContent, linkChangeModalOpen, setModalContent, setLinkChangeModalOpen, currentLinkID, setNewIdeaSwitch, currentLink } = useIdeaContext();
    

    function handleLinkChange(ideaID: number, newLink: string) {
        updateIdeaLinkInFirebase(ideaID, newLink).then(() => {
            updateIdeaLink(ideaID, newLink); // This should update local storage
            setNewIdeaSwitch(prev => !prev); // Now trigger the refresh
        }).catch((error) => {
            console.error("Error renaming idea: ", error);
        });
    }

    function cleanModalContent(userLink: string){
        if(!userLink.includes('https://')) {
            if(userLink === "") {
                return "";
            }
            userLink = 'https://' + userLink;
        }
        if(!userLink.includes('.')){
            userLink = userLink + '.com'
        }
        return userLink;
    }

    return (
        <>
            {linkChangeModalOpen ?
                <section className="overlay">
                    <div className="modal neobrutal">
                        <textarea autoFocus={true} maxLength={100} className="ideaContent neobrutal-input" placeholder='Change Link...' onChange={(e) => setModalContent(e.target.value)}>{currentLink}</textarea>
                        <section className="modalButtons">
                            <button className="modalButton cancel neobrutal-button" onClick={() => setLinkChangeModalOpen(false)}>Cancel</button>
                            <button className="modalButton continue neobrutal-button" onClick={() => { handleLinkChange(currentLinkID, cleanModalContent(modalContent)); setLinkChangeModalOpen(false); setNewIdeaSwitch(prev => !prev);}}>Change</button>
                        </section>
                    </div>
                </section> : <></>
            }
        </>
    );
}

export default LinkChangeModal;
