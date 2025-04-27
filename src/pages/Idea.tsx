import Navbar from '../components/Navbar';
import IdeaNode from '../components/IdeaNode';
import ModalOverlay from '../components/ModalOverlay';
import { useEffect, useState } from 'react';
import { auth } from '../firebaseConfig';
import { fetchFullIdeaList, checkIfIdeaIsLeaf, handleBackClick, returnToRoot } from '../utilities/independentIdeaHandlers';
import { handleIdeaCreation } from '../utilities/ideaCreationHandlers';
import { fetchFromFirebaseAndOrganizeIdeas } from '../utilities/FromFirebaseIdeaHandlers';
import { getIdeasChildren } from '../utilities/parsingIdeasHandlers';
import { useIdeaContext } from '../context/IdeaContext';


function Idea() {

    const [initalFetch, setInitialFetch] = useState(false);

    const { rootId, setRootId, rootName, setRootName, newIdeaSwitch, rootIdStack, ideas, setIdeas } = useIdeaContext();

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
    }, [rootId]);

    useEffect(() => {
        setIdeas(getIdeasChildren(rootId));
    }, [newIdeaSwitch]);

    interface Idea {
        id: number;
        content: string;
        parentId: number;
    }

    return (
        <>
            <section className="ideaPage">
                <section className="top">
                    <Navbar />
                    <section className="rootHolder">
                        <div className="ideaRoot neobrutal-button">{rootName}</div>
                        {rootId != 1 ? <button className="back neobrutal-button" onClick={() => handleBackClick( { setRootId, setRootName, rootIdStack, ideas } )}>Back <img src="/images/Arrow.svg" alt="Back" className="backImg" /></button> : <></>}
                    </section>
                </section>
                <section className="bottom">
                    <main className="ideaSpace">
                        <section className='ideaNodes'>
                            {ideas?.map((idea: Idea) => (
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

            <ModalOverlay handleIdeaCreation={handleIdeaCreation} />
        </>

    );
}

export default Idea;
