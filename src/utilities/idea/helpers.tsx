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

export function buildAncestorPath(targetId: number, allIdeas: IdeaType[]): number[] {
    const path: number[] = [];
    let id = targetId;
    while (true) {
        path.unshift(id);
        if (id === 1) break;
        const node = allIdeas.find((idea: IdeaType) => idea.id === id);
        if (!node || !node.parentID) break;
        const parentExists = allIdeas.some((idea: IdeaType) => idea.id === node.parentID) || node.parentID === 1;
        if (!parentExists) break;
        id = node.parentID;
    }
    return path;
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
