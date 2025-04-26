import React from 'react';

interface IdeaNodeManagerProps {
    nodes: Array<{ id: string; title: string; parentId?: string }>;
    onAddNode: (parentId?: string) => void;
    onDeleteNode: (id: string) => void;
}

const IdeaNodeManager: React.FC<IdeaNodeManagerProps> = ({ nodes, onAddNode, onDeleteNode }) => {
    return (
        <div className="ideaNodeManager">
            {nodes.map((node) => (
                <div key={node.id} className="ideaNode">
                    <span className="ideaNodeTitle">{node.title}</span>
                    <div className="ideaNodeActions">
                        <button onClick={() => onAddNode(node.id)} className="addNodeButton">Add</button>
                        <button onClick={() => onDeleteNode(node.id)} className="deleteNodeButton">Delete</button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default IdeaNodeManager;