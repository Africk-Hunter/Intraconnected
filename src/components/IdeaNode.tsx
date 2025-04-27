import React from 'react';

interface IdeaNodeProps {
    id: number;
    title: string;
    parentId: number;
    isLeaf: boolean;
    setRootId: (id: number) => void;
    setRootName: (name: string) => void;
    rootIdStack: React.RefObject<number[]>;
}


const IdeaNode: React.FC<IdeaNodeProps> = ({ id, title, parentId, isLeaf, setRootId, setRootName, rootIdStack }) => {

    function makeRoot() {
        setRootId(id);
        setRootName(title);

        console.log("Root ID: " + id);
        console.log("Root Name: " + title);
        console.log("parentID Name: " + parentId);
        rootIdStack.current?.push(id);
    }

    return (
        <div className={isLeaf ? 'ideaNode neobrutal-button leaf' : 'ideaNode neobrutal-button parent'} onClick={makeRoot}>{title}</div>
    );
};

export default IdeaNode;