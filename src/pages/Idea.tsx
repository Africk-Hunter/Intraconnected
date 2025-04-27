import Navbar from '../components/Navbar';
import { auth } from '../firebaseConfig';
import IdeaNode from '../components/IdeaNode';
import { fetchFullIdeaList, checkIfIdeaIsLeaf,  } from '../utilities/independentIdeaHandlers';
import { handleIdeaCreation } from '../utilities/ideaCreationHandlers';
import { fetchFromFirebaseAndOrganizeIdeas } from '../utilities/FromFirebaseIdeaHandlers';
import { getIdeasChildren } from '../utilities/parsingIdeasHandlers';
import { useEffect, useRef, useState } from 'react';

function Idea() {

    const [initalFetch, setInitialFetch] = useState(false);
    const [ideas, setIdeas] = useState<any[]>([]);
    const [rootName, setRootName] = useState("Ideas");
    const [rootId, setRootId] = useState(1);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState("");
    const [newIdeaSwitch, setNewIdeaSwitch] = useState(false);

    const rootIdStack = useRef<number[]>([]);

    useEffect(() => {

        setTimeout(() => {
            if (auth.currentUser) {
                if (!initalFetch) {
                    fetchFromFirebaseAndOrganizeIdeas().then(() => {
                        setInitialFetch(true);
                    });
                }
                setTimeout(() => {
                    const loadedIdeas = getIdeasChildren(rootId);
                    rootIdStack.current.push(rootId);
                    setIdeas(loadedIdeas);
                }, 500)
            }
        }, 500);

    }, []);

    useEffect(() => {
        const loadedIdeas = getIdeasChildren(rootId);
        setIdeas(loadedIdeas);
    
        const currentRoot = fetchFullIdeaList().find((idea: { id: number, content: string, parentId: number }) => idea.id === rootId);
        
        if (currentRoot) {
            setRootName(currentRoot.content);
        }
    
        console.log("Root ID Stack: " + rootIdStack.current);
    }, [rootId]);

    useEffect(() => {
        setIdeas(getIdeasChildren(rootId));
    } , [newIdeaSwitch]);

    function handleBackClick() {
        if (rootIdStack.current.length > 0) {
            rootIdStack.current.pop();
            const newRootId = rootIdStack.current[rootIdStack.current.length - 1] || 1;
            setRootId(newRootId);
    
            const newRoot = ideas.find(idea => idea.id === newRootId);
            if (newRoot) {
                setRootName(newRoot.content); 
            } else {
                setRootName("Ideas"); 
            }
        }
    }

    return (
        <>
            <section className="ideaPage">
                <section className="top">
                    <Navbar setModalOpen={setModalOpen} />
                    <section className="rootHolder">
                        <div className="ideaRoot neobrutal-button">{rootName}</div>
                        <button className="back neobrutal-button" onClick={() => handleBackClick()}>Back <img src="/images/Arrow.svg" alt="Back" className="backImg" /></button>
                    </section>
                </section>
                <section className="bottom">
                    <main className="ideaSpace">
                        <section className='ideaNodes'>
                            {ideas?.map(idea => (
                                <IdeaNode
                                    key={idea.id}
                                    id={idea.id}
                                    title={idea.content}
                                    parentId={idea.parentID}
                                    isLeaf={checkIfIdeaIsLeaf(idea.id)}
                                    setRootId={setRootId}
                                    setRootName={setRootName}
                                    rootIdStack={rootIdStack}
                                />
                            ))}
                        </section>
                    </main>
                </section>
            </section>

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

export default Idea;
