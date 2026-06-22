import React, { createContext, useContext, useRef, useState } from "react";
import { IdeaType } from "../utilities/types";

interface IdeaContextType {
    ideas: IdeaType[];
    setIdeas: React.Dispatch<React.SetStateAction<IdeaType[]>>;
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
    deleteConfirmModalOpen: boolean;
    setDeleteConfirmModalOpen: (open: boolean) => void;
    pendingDeleteId: number | null;
    setPendingDeleteId: (id: number | null) => void;
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
    checklistModalId: number | null;
    setChecklistModalId: (id: number | null) => void;
    deleteModalOrigin: { x: number; y: number } | null;
    setDeleteModalOrigin: (origin: { x: number; y: number } | null) => void;
}

const IdeaContext = createContext<IdeaContextType | undefined>(undefined);

export const IdeaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

    const [ideas, setIdeas] = useState<IdeaType[]>([]);
    const [rootId, setRootId] = useState(1);
    const [rootName, setRootName] = useState("Ideas");
    const [creationModalOpen, setCreationModalOpen] = useState(false);
    const [renameModalOpen, setRenameModalOpen] = useState(false);
    const [linkChangeModalOpen, setLinkChangeModalOpen] = useState(false);
    const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
    const [modalContent, setModalContent] = useState("");
    const [newIdeaSwitch, setNewIdeaSwitch] = useState(false);
    const [messageBoxMessage, setMessageBoxMessage] = useState("");
    const [messageType, setMessageType] = useState("");
    const [currentLinkID, setCurrentLinkID] = useState<number>(0);
    const [currentLink, setCurrentLink] = useState<string>("");
    const [currentNameChangeId, setCurrentNameChangeId] = useState<number>(-1);
    const [selectedIdeaName, setSelectedIdeaName] = useState<string>("");
    const [checklistModalId, setChecklistModalId] = useState<number | null>(null);
    const [deleteModalOrigin, setDeleteModalOrigin] = useState<{ x: number; y: number } | null>(null);

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
                deleteConfirmModalOpen,
                setDeleteConfirmModalOpen,
                pendingDeleteId,
                setPendingDeleteId,
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
                checklistModalId,
                setChecklistModalId,
                deleteModalOrigin,
                setDeleteModalOrigin,
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