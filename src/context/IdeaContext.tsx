import React, { createContext, useContext, useRef, useState } from "react";

interface IdeaContextType {
    ideas: { id: number; content: string; parentID: number; link: string }[];
    setIdeas: (ideas: any) => void;
    rootId: number;
    setRootId: (id: number) => void;
    rootName: string;
    setRootName: (name: string) => void;
    rootIdStack: React.RefObject<number[]>;
    creationModalOpen: boolean;
    setCreationModalOpen: (open: boolean) => void;
    renameModalOpen: boolean;
    setRenameModalOpen: (open: boolean) => void;
    linkChangeModalOpen: boolean;
    setLinkChangeModalOpen: (open: boolean) => void;
    currentLinkID: number;
    setCurrentLinkID: (id: number) => void;
    currentLink: string;
    setCurrentLink: (link: string) => void;
    modalContent: string;
    setModalContent: (content: string) => void;
    currentNameChangeId: number;
    setCurrentNameChangeId: (id: number) => void;
    selectedIdeaName: string;
    setSelectedIdeaName: (name: string) => void;
    newIdeaSwitch: boolean;
    setNewIdeaSwitch: (value: (prev: boolean) => boolean) => void;
    messageBoxMessage: string;
    setMessageBoxMessage: (message: string) => void;
    messageType: string;
    setMessageType: (type: string) => void;
}

const IdeaContext = createContext<IdeaContextType | undefined>(undefined);

export const IdeaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

    const [ideas, setIdeas] = useState<any[]>([]);
    const [rootId, setRootId] = useState(1);
    const [rootName, setRootName] = useState("Ideas");
    const [creationModalOpen, setCreationModalOpen] = useState(false);
    const [renameModalOpen, setRenameModalOpen] = useState(false);
    const [linkChangeModalOpen, setLinkChangeModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState("");
    const [newIdeaSwitch, setNewIdeaSwitch] = useState(false);
    const [messageBoxMessage, setMessageBoxMessage] = useState("");
    const [messageType, setMessageType] = useState("");
    const [currentLinkID, setCurrentLinkID] = useState<number>(0);
    const [currentLink, setCurrentLink] = useState<string>("");
    const [currentNameChangeId, setCurrentNameChangeId] = useState<number>(-1);
    const [selectedIdeaName, setSelectedIdeaName] = useState<string>("");

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
                creationModalOpen,
                setCreationModalOpen,
                renameModalOpen,
                setRenameModalOpen,
                linkChangeModalOpen,
                setLinkChangeModalOpen,
                currentLinkID,
                setCurrentLinkID,
                currentLink,
                setCurrentLink,
                modalContent,
                setModalContent,
                currentNameChangeId,
                setCurrentNameChangeId,
                selectedIdeaName,
                setSelectedIdeaName,
                newIdeaSwitch,
                setNewIdeaSwitch,
                messageBoxMessage,
                setMessageBoxMessage,
                messageType,
                setMessageType,
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