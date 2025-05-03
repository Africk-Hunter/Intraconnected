import { useState } from "react";
import { useIdeaContext } from "../../context/IdeaContext";

interface CreationModalProps {
    handleIdeaCreation: (content: string, parentId: number, link: string) => void;
}

function CreationModal({ handleIdeaCreation }: CreationModalProps) {

    const { rootId, creationModalOpen, setCreationModalOpen, modalContent, setModalContent, setNewIdeaSwitch } = useIdeaContext();
    const [isLinkBoxShown, setisLinkBoxShown] = useState(false);
    const [link, setLink] = useState('');

    function toggleLinkBox() {
        setisLinkBoxShown(prev => !prev);
    }

    function cleanLink(linkToClean: string = link) {
        let cleanedLink = linkToClean;

        console.log('linkToClean: ' + linkToClean);
        if (!cleanedLink.startsWith('https://') && cleanedLink !== '') {
            cleanedLink = 'https://' + cleanedLink;
        }
        return cleanedLink;
    }

    function handleCreationWithLink() {
        setisLinkBoxShown(false);
        console.log('da link ' + cleanLink(link));
        handleIdeaCreation(modalContent, rootId, cleanLink(link));
        setCreationModalOpen(false);
        setLink('');
        setNewIdeaSwitch(prev => !prev)
    }

    return (
        <>
            {creationModalOpen &&
                <section className="overlay">
                    <div className="modal neobrutal">
                        <section className="contentHolder">
                            <textarea autoFocus={true} maxLength={200} className="ideaContent" placeholder='Whats your idea?' onChange={(e) => setModalContent(e.target.value)}></textarea>
                            <button className="linkButton" onClick={toggleLinkBox}><img src="/images/Link.svg" alt="Add Link" />
                                <input type="text" className={`linkInput neobrutal-input ${isLinkBoxShown && 'show'}`} placeholder='Add a link' onClick={(e) => e.stopPropagation()} onChange={(e) => setLink(e.target.value)} />
                            </button>
                        </section>

                        <section className="modalButtons">
                            <button className="modalButton cancel neobrutal-button" onClick={() => setCreationModalOpen(false)}>Cancel</button>
                            <button className="modalButton continue neobrutal-button" onClick={handleCreationWithLink}>Continue</button>
                        </section>
                    </div>
                </section>
            }
        </>
    );
}

export default CreationModal;
