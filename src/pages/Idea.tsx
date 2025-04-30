//Components
import Navbar from '../components/Navbar';
import IdeaNode from '../components/IdeaNode';
import ModalOverlay from '../components/ModalOverlay';
import Help from '../components/Help';
import Trash from '../components/Trash';
// 3rd Party Libraries
import { useEffect, useState } from 'react';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
// Custom Libraries
import { auth } from '../firebaseConfig';
import { useIdeaContext } from '../context/IdeaContext';
import {
    fetchFullIdeaList,
    checkIfIdeaIsLeaf,
    handleBackClick,
    handleIdeaCreation,
    fetchFromFirebaseAndOrganizeIdeas,
    getIdeasByParentID,
    signUserOut,
    IdeaType,
    getChildrenToDelete,
    recursivelyDeleteChildren,
    updateIdeaParentId
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
            const loadedIdeas = getIdeasByParentID(rootId);
            setIdeas(loadedIdeas);

            const currentRoot = fetchFullIdeaList().find((idea: IdeaType) => idea.id === rootId);
            if (currentRoot) setRootName(currentRoot.content);
        };

        loadIdeas();
    }, [rootId, newIdeaSwitch]);

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (!active || !over) return;

        const activeId = Number(active.id.split('-')[1]);
        const overId = Number(over.id.split('-')[1]);

        if (over.id === 'trash') {
            console.log('Deleting idea with id:', activeId);
            recursivelyDeleteChildren(activeId);

            const childrenToDelete = getChildrenToDelete(activeId);
            recursivelyDeleteChildren(activeId);
            setIdeas((prevIdeas: IdeaType[]) =>
                prevIdeas.filter(
                    (idea: IdeaType) =>
                        idea.id !== activeId &&
                        !childrenToDelete.some((child: IdeaType) => child.id === idea.id)
                )
            );
        } else {
            if (activeId === overId){
                console.log('Dropping idea on itself, no action taken.');
                return;
            };
            const newParentId = Number(over.id.split('-')[1]);
            updateIdeaParentId(activeId, newParentId);
            console.log('Moving idea with id:', activeId, 'to parent with id:', overId);
            const loadedIdeas = getIdeasByParentID(rootId);
            setIdeas(loadedIdeas);

        }
    };

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
                    <Navbar side='left' signUserOut={signUserOut} setShowHelp={setShowHelp} />
                    <Trash />
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
                                        parentID={idea.parentID}
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
        </DndContext>
    );
}

export default Idea;
