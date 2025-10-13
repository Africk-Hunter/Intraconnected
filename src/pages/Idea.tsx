// Components
import Navbar from '../components/Navbar';
import IdeaNode from '../components/IdeaNode';
import CreationModal from '../components/modals/CreationModal';
import RenameModal from '../components/modals/RenameModal';
import Help from '../components/Help';
import Trash from '../components/Trash';
import LastIdea from '../components/LastIdea';

// 3rd Party Libraries
import { useEffect, useState } from 'react';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

// Custom Libraries
import { auth } from '../firebaseConfig';
import { useIdeaContext } from '../context/IdeaContext';
import {
    fetchFullIdeaList,
    handleBackClick,
    handleIdeaCreation,
    fetchFromFirebaseAndOrganizeIdeas,
    getIdeasByParentID,
    signUserOut,
    IdeaType,
    getChildrenToDelete,
    recursivelyDeleteChildren,
    updateIdeaParentId,
    getParentID,
    getNameFromID,
    checkIfIdeaIsLeaf,
    geLinkFromID
} from '../utilities/index';
import LinkChangeModal from '../components/modals/LinkChangeModal';

function Idea() {
    const [initialFetch, setInitialFetch] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [lastRootName, setLastRootName] = useState('');

    const { rootId, setRootId, rootName, setRootName, newIdeaSwitch, rootIdStack, ideas, setIdeas, setRenameModalOpen } = useIdeaContext();

    useEffect(() => {
        async function init() {
            if (auth.currentUser && !initialFetch) {
                await fetchFromFirebaseAndOrganizeIdeas().then(() => {
                    setInitialFetch(true);
                });
            }

            const loadedIdeas = getIdeasByParentID(rootId);
            rootIdStack.current.push(rootId);
            setIdeas(loadedIdeas);
        }

        const unsubscribe = auth.onAuthStateChanged(() => {
            init();
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const loadIdeas = async () => {
            setIdeasFromStorage();

            const currentRoot = fetchFullIdeaList().find((idea: IdeaType) => idea.id === rootId);
            if (currentRoot) setRootName(currentRoot.content);
        };

        loadIdeas();
        setLastRootName(getNameFromID(getParentID(rootId)));
    }, [rootId, newIdeaSwitch, rootName]);

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (!active || !over) return;

        const activeId = Number(active.id.split('-')[1]);
        const overId = Number(over.id.split('-')[1]);
        const overLink = geLinkFromID(overId);

        if (over.id === 'trash') {
            const childrenToDelete = getChildrenToDelete(activeId);
            recursivelyDeleteChildren(activeId);

            setIdeas((prevIdeas: IdeaType[]) =>
                prevIdeas.filter(
                    (idea: IdeaType) =>
                        idea.id !== activeId &&
                        !childrenToDelete.some((child: IdeaType) => child.id === idea.id)
                )
            );
        } else if (over.id === 'last-idea') {
            console.log('Moving idea with id:', activeId, 'to root with id:', rootId);
            updateIdeaParentId(activeId, getParentID(rootId));

            setIdeasFromStorage();
        } else {
            if (activeId === overId) {
                console.log('Dropping idea on itself, no action taken.');
                return;
            }
            if (overLink != ""){
                console.log('Dropping idea into link idea, no action taken.')
                return;
            }
            const newParentId = Number(over.id.split('-')[1]);
            updateIdeaParentId(activeId, newParentId);
            console.log('Moving idea with id:', activeId, 'to parent with id:', overId);

            setIdeasFromStorage();
        }
    };

    function setIdeasFromStorage() {
        const loadedIdeas = getIdeasByParentID(rootId);
        setIdeas(loadedIdeas);
    }

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 10,
            },
        })
    );


    return (
        <DndContext onDragEnd={handleDragEnd} modifiers={[restrictToWindowEdges]} sensors={sensors}>
            <section className="ideaPage">
                <section className="left">
                    <Navbar side="left" signUserOut={signUserOut} setShowHelp={setShowHelp} />
                    <Trash />
                </section>

                <section className="mid">
                    <section className="top">
                        <section className="rootHolder">
                            <div className="ideaRoot neobrutal-button" onClick={() => { rootId != 1 && setRenameModalOpen(true)}}>{rootName}</div>
                            <section className="rootAdditionalButtons">
                                <button className={`back neobrutal-button ${rootId === 1 ? 'layerZero' : ''}`} onClick={() => handleBackClick({ setRootId, setRootName, rootIdStack, ideas })}>Back <img src="/images/Arrow.svg" alt="Go Back To Previous Idea" className="backImg" /></button>
                                {(rootId != 1) && <LastIdea lastRootName={lastRootName} />}
                            </section>
                        </section>
                    </section>

                    <section className="bottom">
                        <main className="ideaSpace">
                            <section className="ideaNodes">
                                {ideas?.map((idea: IdeaType) => (
                                    <IdeaNode
                                        key={idea.id}
                                        id={idea.id}
                                        title={idea.content}
                                        parentID={idea.parentID}
                                        link={idea.link}
                                        isLeaf={checkIfIdeaIsLeaf(idea.id)}
                                    />
                                ))}
                            </section>
                        </main>
                    </section>
                </section>

                <section className="right">
                    <Navbar side="right" signUserOut={signUserOut} setShowHelp={setShowHelp} />
                    <Help showHelp={showHelp} />
                </section>
            </section>
            <RenameModal />
            <LinkChangeModal />
            <CreationModal handleIdeaCreation={handleIdeaCreation} />
        </DndContext>
    );
}

export default Idea;
