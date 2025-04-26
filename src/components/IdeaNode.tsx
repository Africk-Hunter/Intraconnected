import React from 'react';

interface IdeaNodeProps {
    id: string;
    title: string;
    parentId?: string;
    isLeaf: boolean;
    onAddChild: (parentId: string) => void;
    onDelete: (id: string) => void;
}

const IdeaNode: React.FC<IdeaNodeProps> = ({ id, title, parentId, isLeaf, onAddChild, onDelete }) => {
    return (
        <div className={isLeaf ? 'ideaNode neobrutal-button leaf' : 'ideaNode neobrutal-button parent'}>{title}</div>
    );
};

export default IdeaNode;