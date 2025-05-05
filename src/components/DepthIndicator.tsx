import React from 'react';
import { returnToRootOfID } from '../utilities/index';
import { useIdeaContext } from '../context/IdeaContext';

interface DepthIndicatorProps {
    index: number;
    rootId: number;
    rootName: string;
}

const DepthIndicator: React.FC<DepthIndicatorProps> = ({ index, rootId, rootName }) => {
    const { setRootId, setRootName, rootIdStack } = useIdeaContext();

    const handleClick = () => {
        returnToRootOfID({
            setRootId,
            setRootName,
            rootIdStack,
            rootToGoTo: rootId,
            newRootName: rootName,
        });
    };

    return (
        <div key={index} className="depthIndicator" onClick={handleClick}>
            <div className="depthText">{rootName}</div>
        </div>
    );
};

export default DepthIndicator;