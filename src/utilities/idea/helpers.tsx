import { IdeaType } from "../types";

export function fetchFullIdeaList() {
    const ideas = localStorage.getItem("ideas");

    if (!ideas) {
        console.warn("No ideas found in localStorage.");
        return [];
    }

    return JSON.parse(ideas);
}

export function checkIfIdeaIsLeaf(ideaID: number): boolean {
    const ideas = fetchFullIdeaList();
    return !ideas.some((idea: IdeaType) => idea.parentID === ideaID);
}

export function handleBackClick(params: {
    setRootId: (id: number) => void;
    setRootName: (name: string) => void;
    rootIdStack: React.RefObject<number[]>;
    ideas: IdeaType[];
}): void {
    const { setRootId, setRootName, rootIdStack, ideas } = params;

    if (rootIdStack.current.length > 0) {
        rootIdStack.current.pop();
        const newRootId = rootIdStack.current[rootIdStack.current.length - 1] || 1;
        setRootId(newRootId);

        const newRoot = ideas.find((idea: IdeaType) => idea.id === newRootId);
        setRootName(newRoot ? newRoot.content : "Ideas");
    }
}

export function returnToRoot(params: {
    setRootId: (id: number) => void;
    setRootName: (name: string) => void;
    rootIdStack: React.RefObject<number[]>;
}) {
    const { setRootId, setRootName, rootIdStack } = params;

    setRootId(1);
    setRootName("Ideas");
    while (rootIdStack.current.length > 1) {
        rootIdStack.current.pop();
    }
}

export function returnToRootOfID(params: { setRootId: (id: number) => void; setRootName: (name: string) => void; rootIdStack: React.RefObject<number[]>; rootToGoTo: number; newRootName: string }) {
    const { setRootId, setRootName, rootIdStack, rootToGoTo, newRootName } = params;

    setRootId(rootToGoTo);
    setRootName(newRootName);
    while (rootIdStack.current[rootIdStack.current.length - 1] !== rootToGoTo) {
        rootIdStack.current.pop();
    }
}

export function getParentID(parentID: number): number {
    const ideas = fetchFullIdeaList();
    const idea = ideas.find((idea: IdeaType) => idea.id === parentID);
    return idea?.parentID ?? 1;
}

export function getNameFromID(id: number): string {
    const ideas = fetchFullIdeaList();
    const idea = ideas.find((idea: IdeaType) => idea.id === id);
    return idea ? idea.content : 'Idea';
}

export function getIdeaLink(idea: IdeaType | undefined): string {
    if (!idea || idea.type === 'checklist') return '';
    return idea.link ?? '';
}

export function cleanLink(userLink: string): string {
    if (userLink === '') return '';

    userLink = userLink.trim();
    if (userLink === '') return '';

    const protocolMatch = userLink.match(/^([a-zA-Z][a-zA-Z0-9+\-.]*):\/\//);
    if (protocolMatch) {
        const proto = protocolMatch[1].toLowerCase();
        if (proto === 'http') {
            userLink = 'https://' + userLink.slice(protocolMatch[0].length);
        }
        return userLink;
    }

    userLink = 'https://' + userLink;

    const afterProtocol = userLink.slice('https://'.length);
    const hostname = afterProtocol.split(/[/?#]/)[0].split(':')[0];
    if (hostname !== 'localhost' && !hostname.includes('.')) {
        const rest = afterProtocol.slice(hostname.length);
        userLink = 'https://' + hostname + '.com' + rest;
    }

    return userLink;
}
