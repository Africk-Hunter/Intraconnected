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
import { signUserOut } from '../utilities/firebaseHelpers'


function Idea() {

    const [initalFetch, setInitialFetch] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

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
                    <div className="largeSideButton neobrutal-button danger trashCan"><img src="/images/Trash.svg" alt="Trash Can" className="buttonImg" /></div>
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
                        <button className="mediumSideButton neutral neobrutal-button navButton" onClick={ () => signUserOut()}><img src="/images/LogOut.svg" alt="" className="buttonImg" /></button>
                        <button className="smallSideButton neutral neobrutal-button navButton" onClick={() => setShowHelp(prev => !prev)}><img src="/images/QuestionMark.svg" alt="Help" className="buttonImg" /></button>
                    </nav>
                    <section className={`howToUsePopup neutral ${showHelp ? 'show' : ''}`}>
                        <h1 className="header">So How Do I Use <br/>This?</h1>
                        <p className="details">Intraconnected is pretty simple. You're looking at the root node 
                            <span className="detailsBox roots"> {rootName} </span><br/>
                            You can create a related idea by clicking <span className="detailsBox leaf square"><img src="/images/Plus.svg" alt="" className="detailsImg" /></span><br/>

                            Clicking any idea will turn it into the new root node. You can navigate back to the previous root node by clicking <span className="detailsBox backColor">Back</span> <br/>

                            Oh, you can also delete ideas by clicking and dragging them in to the <span className="detailsBox danger square"><img src="/images/Trash.svg" alt="" className="detailsImg" /></span><br/> 
                            
                            
                            </p>
                    </section>
                </section>
            </section>
            
            <ModalOverlay handleIdeaCreation={handleIdeaCreation} />
        </>

    );
}

export default Idea;
