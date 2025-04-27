import React, { createContext, useContext, useRef, useState } from "react";

interface IdeaContextType {
    ideas: { id: number; content: string; parentId: number }[];
    setIdeas: (ideas: any) => void
    rootId: number;
    setRootId: (id: number) => void;
    rootName: string;
    setRootName: (name: string) => void;
    rootIdStack: React.RefObject<number[]>;
    modalOpen: boolean;
    setModalOpen: (open: boolean) => void;
    modalContent: string;
    setModalContent: (content: string) => void;
    newIdeaSwitch: boolean;
    setNewIdeaSwitch: (value: (prev: boolean) => boolean) => void;
}

const IdeaContext = createContext<IdeaContextType | undefined>(undefined);

export const IdeaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

    const [ideas, setIdeas] = useState<any[]>([]);
    const [rootId, setRootId] = useState(1);
    const [rootName, setRootName] = useState("Ideas");
    const [modalOpen, setModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState("");
    const [newIdeaSwitch, setNewIdeaSwitch] = useState(false);
    const rootIdStack = useRef<number[]>([]);


    return (
        <IdeaContext.Provider
            value={{
                ideas,
                setIdeas,
                rootId,
                setRootId,
                rootName,
                setRootName,
                rootIdStack,
                modalOpen,
                setModalOpen,
                modalContent,
                setModalContent,
                newIdeaSwitch,
                setNewIdeaSwitch
            }}>
            {children}
        </IdeaContext.Provider>
    );
}

export const useIdeaContext = () => {
    const context = useContext(IdeaContext);
    if (!context) {
        throw new Error("useIdeaContext must be used within an IdeaProvider");
    }
    return context;
}