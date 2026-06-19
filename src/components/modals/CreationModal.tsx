import { useRef, useState } from "react";
import { useIdeaContext } from "../../context/IdeaContext";
import { cleanLink } from "../../utilities";

interface CreationModalProps {
    handleIdeaCreation: (content: string, parentId: number, link: string) => void;
}

function CreationModal({ handleIdeaCreation }: CreationModalProps) {

    const { rootId, creationModalOpen, setCreationModalOpen, modalContent, setModalContent, setNewIdeaSwitch } = useIdeaContext();
    const [isLinkBoxShown, setisLinkBoxShown] = useState(false);
    const [link, setLink] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    function autoResize() {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    }

    function toggleLinkBox() {
        setisLinkBoxShown(prev => !prev);
    }

    function handleCreationWithLink() {
        setisLinkBoxShown(false);
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
                            <textarea ref={textareaRef} autoFocus={true} maxLength={200} className="ideaContent" placeholder='Whats your idea?' onChange={(e) => { setModalContent(e.target.value); autoResize(); }}></textarea>
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
