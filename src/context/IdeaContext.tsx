import React, { createContext, useContext, useRef, useState } from "react";
import type { IdeaType } from "../utilities/types";
import { buildAncestorPath, fetchFullIdeaList } from "../utilities/idea/helpers";
import { writeIdeaToUrl } from "../utilities/idea/ideaUrl";
import { recordVisit } from "../utilities/idea/recentVisits";
// Type-only: this context wraps every route, so a value import here would
// pull Firebase into the marketing pages' initial bundle.
import type { BillingPlan } from "../utilities/billing/billingCache";
import type { CheckoutPlan } from "../utilities/billing/billing";

// Where the card menu is open: which idea, and the screen position it opened at.
export interface CardMenuState {
    id: number;
    x: number;
    y: number;
}

interface IdeaContextType {
    ideas: IdeaType[];
    setIdeas: React.Dispatch<React.SetStateAction<IdeaType[]>>;
    rootId: number;
    setRootId: (id: number) => void;
    rootName: string;
    setRootName: (name: string) => void;
    rootIdStack: React.RefObject<number[]>;
    nodesVisible: boolean;
    setNodesVisible: (visible: boolean) => void;
    // history: 'push' adds a browser history entry (the default), 'replace' swaps the current one,
    // 'none' is for when the browser itself just moved (Back/Forward) and the address is already right.
    navigateToId: (id: number, options?: { history?: 'push' | 'replace' | 'none' }) => void;
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
    profileModalOpen: boolean;
    setProfileModalOpen: (open: boolean) => void;
    billingPlan: BillingPlan;
    setBillingPlan: (plan: BillingPlan) => void;
    upgradeModalOpen: boolean;
    setUpgradeModalOpen: (open: boolean) => void;
    upgradeModalReason: 'limit' | null;
    setUpgradeModalReason: (reason: 'limit' | null) => void;
    checkoutPlan: CheckoutPlan | null;
    setCheckoutPlan: (plan: CheckoutPlan | null) => void;
    celebrationPlan: CheckoutPlan | null;
    setCelebrationPlan: (plan: CheckoutPlan | null) => void;
    cardMenu: CardMenuState | null;
    setCardMenu: (menu: CardMenuState | null) => void;
    moveIdeaId: number | null;
    setMoveIdeaId: (id: number | null) => void;
    // The phone layout keeps its own current level, so "open this idea" requests from elsewhere (an import) go through here.
    pendingOpenId: number | null;
    setPendingOpenId: (id: number | null) => void;
}

const IdeaContext = createContext<IdeaContextType | undefined>(undefined);

export const IdeaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

    const [ideas, setIdeas] = useState<IdeaType[]>([]);
    const [rootId, setRootId] = useState(1);
    const [rootName, setRootName] = useState("Ideas");
    const [nodesVisible, setNodesVisible] = useState(true);
    const navTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
    const navGeneration = useRef(0);
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
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [billingPlan, setBillingPlan] = useState<BillingPlan>('free');
    const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
    const [upgradeModalReason, setUpgradeModalReason] = useState<'limit' | null>(null);
    const [checkoutPlan, setCheckoutPlan] = useState<CheckoutPlan | null>(null);
    const [celebrationPlan, setCelebrationPlan] = useState<CheckoutPlan | null>(null);
    const [cardMenu, setCardMenu] = useState<CardMenuState | null>(null);
    const [moveIdeaId, setMoveIdeaId] = useState<number | null>(null);
    const [pendingOpenId, setPendingOpenId] = useState<number | null>(null);

    const rootIdStack = useRef<number[]>([]);

    function navigateToId(targetId: number, options?: { history?: 'push' | 'replace' | 'none' }) {
        recordVisit(targetId);
        const navToken = ++navGeneration.current;
        navTimeouts.current.forEach(clearTimeout);
        setNodesVisible(false);
        navTimeouts.current = [
            setTimeout(() => {
                if (navGeneration.current !== navToken) return;
                const allIdeas: IdeaType[] = fetchFullIdeaList();
                rootIdStack.current = buildAncestorPath(targetId, allIdeas);
                setRootId(targetId);
                const historyMode = options?.history ?? 'push';
                if (historyMode !== 'none') writeIdeaToUrl(targetId, historyMode);
                const targetIdea = allIdeas.find(i => i.id === targetId);
                setRootName(targetIdea ? targetIdea.content : "Ideas");
            }, 65),
            setTimeout(() => {
                if (navGeneration.current === navToken) setNodesVisible(true);
            }, 90),
        ];
    }

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
                nodesVisible,
                setNodesVisible,
                navigateToId,
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
                profileModalOpen,
                setProfileModalOpen,
                billingPlan,
                setBillingPlan,
                upgradeModalOpen,
                setUpgradeModalOpen,
                upgradeModalReason,
                setUpgradeModalReason,
                checkoutPlan,
                setCheckoutPlan,
                celebrationPlan,
                setCelebrationPlan,
                cardMenu,
                setCardMenu,
                moveIdeaId,
                setMoveIdeaId,
                pendingOpenId,
                setPendingOpenId,
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