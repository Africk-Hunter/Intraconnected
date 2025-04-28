import Navbar from '../components/Navbar';
import IdeaNode from '../components/IdeaNode';
import ModalOverlay from '../components/ModalOverlay';
import Help from '../components/Help';
import { useEffect, useState } from 'react';
import { auth } from '../firebaseConfig';
import { useIdeaContext } from '../context/IdeaContext';
import {  fetchFullIdeaList, 
    checkIfIdeaIsLeaf, 
    handleBackClick, 
    handleIdeaCreation, 
    fetchFromFirebaseAndOrganizeIdeas, 
    getIdeasChildren, 
    signUserOut, 
    IdeaType 
  } from '../utilities/index';


function Idea() {

    const [initialFetch, setInitialFetch] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    const { rootId, setRootId, rootName, setRootName, newIdeaSwitch, rootIdStack, ideas, setIdeas } = useIdeaContext();


    useEffect(() => {

        async function init() {
            if (auth.currentUser && !initialFetch) {
                await fetchFromFirebaseAndOrganizeIdeas().then(() => {
                    setInitialFetch(true);
                });
            }
            const loadedIdeas = getIdeasChildren(rootId);
            rootIdStack.current.push(rootId);
            setIdeas(loadedIdeas);
        }

        const unsubscribe = auth.onAuthStateChanged((user) => {
            init();
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const loadIdeas = async () => {
            const loadedIdeas = getIdeasChildren(rootId);
            setIdeas(loadedIdeas);

            const currentRoot = fetchFullIdeaList().find((idea: IdeaType) => idea.id === rootId);
            if (currentRoot) setRootName(currentRoot.content);
        };

        loadIdeas();
    }, [rootId, newIdeaSwitch]);

    return (
        <>
            <section className="ideaPage">
                <section className="left">
                    <Navbar side='left' signUserOut={signUserOut} setShowHelp={setShowHelp} />
                    <div className="largeSideButton neobrutal-button danger trashCan"><img src="/images/Trash.svg" alt="Trash Can" className="buttonImg" /></div>
                </section>
                <section className="mid">
                    <section className="top">

                        <section className="rootHolder">
                            <div className="ideaRoot neobrutal-button">{rootName}</div>
                            <button className={`back neobrutal-button ${rootId === 1 ? 'layerZero' : ''}`} onClick={() => handleBackClick({ setRootId, setRootName, rootIdStack, ideas })}>Back <img src="/images/Arrow.svg" alt="Go Back To Previous Idea" className="backImg" /></button>
                        </section>
                    </section>
                    <section className="bottom">
                        <main className="ideaSpace">
                            <section className='ideaNodes'>
                                {ideas?.map((idea: IdeaType) => (
                                    <IdeaNode
                                        key={idea.id}
                                        id={idea.id}
                                        title={idea.content}
                                        parentId={idea.parentId}
                                        isLeaf={checkIfIdeaIsLeaf(idea.id)}
                                    />
                                ))}
                            </section>
                        </main>
                    </section>
                </section>
                <section className="right">
                    <Navbar side='right' signUserOut={signUserOut} setShowHelp={setShowHelp} />
                    <Help showHelp={showHelp} />
                </section>
            </section>

            <ModalOverlay handleIdeaCreation={handleIdeaCreation} />
        </>

    );
}

export default Idea;
