import React from 'react';
import { useIdeaContext } from '../context/IdeaContext';

interface IdeaNodeProps {
    id: number;
    title: string;
    parentId: number;
    isLeaf: boolean;
}


const IdeaNode: React.FC<IdeaNodeProps> = ({ id, title, isLeaf }) => {

    const { setRootId, setRootName, rootIdStack } = useIdeaContext();

    function makeRoot() {
        setRootId(id);
        setRootName(title);
        rootIdStack.current?.push(id);
    }

    return (
        <div className={isLeaf ? 'ideaNode neobrutal-button leaf' : 'ideaNode neobrutal-button parent'} onClick={makeRoot}>{title}</div>
    );
};

export default IdeaNode;