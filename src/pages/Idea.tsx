import Navbar from '../components/Navbar';
import IdeaNode from '../components/IdeaNode';
import ModalOverlay from '../components/ModalOverlay';
import { useEffect, useState } from 'react';
import { auth } from '../firebaseConfig';
import { fetchFullIdeaList, checkIfIdeaIsLeaf, handleBackClick } from '../utilities/independentIdeaHandlers';
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
                <section className="left">
                    <Navbar />
                    <div className="largeSideButton neobrutal-button danger trashCan"><img src="/images/Trash.svg" alt="Trash Can" className="trashI" /></div>
                </section>
                <section className="mid">
                    <section className="top">

                        <section className="rootHolder">
                            <div className="ideaRoot neobrutal-button">{rootName}</div>
                            <button className={`back neobrutal-button ${rootId === 1 ? 'layerZero' : ''}`} onClick={() => handleBackClick({ setRootId, setRootName, rootIdStack, ideas })}>Back <img src="/images/Arrow.svg" alt="Back" className="backImg" /></button>
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
                <section className="right">
                    <nav className="navbar rightSide">
                        <button className="mediumSideButton neutral neobrutal-button navButton" ><img src="/images/LogOut.svg" alt="" className="logoImg" /></button>
                        <button className="smallSideButton neutral neobrutal-button navButton"><img src="/images/QuestionMark.svg" alt="Help" className="navImg" /></button>
                    </nav>
                </section>
            </section>

            <ModalOverlay handleIdeaCreation={handleIdeaCreation} />
        </>

    );
}

export default Idea;
