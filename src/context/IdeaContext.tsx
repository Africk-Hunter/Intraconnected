import React, { createContext, useContext, useRef, useState } from "react";

interface IdeaContextType {
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
    const [rootId, setRootId] = useState(1);
    const [rootName, setRootName] = useState("Ideas");
    const rootIdStack = useRef<number[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState("");
    const [newIdeaSwitch, setNewIdeaSwitch] = useState(false);

    return (
        <IdeaContext.Provider
            value={{
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