import { IdeaType } from "../types";

export function isNoteMode(idea: IdeaType | undefined): boolean {
    if (!idea || idea.type === 'checklist') return false;
    return idea.isNote === true;
}

export function isNoteWide(idea: IdeaType | undefined): boolean {
    return isNoteMode(idea);
}

export function resolveIdeaLabel(idea: IdeaType | undefined): string {
    if (!idea) return 'Idea';
    if (isNoteMode(idea)) {
        const noteTitle = (idea as { noteTitle?: string }).noteTitle;
        return noteTitle && noteTitle.trim() ? noteTitle : 'Untitled';
    }
    return idea.content;
}

export function fetchFullIdeaList(): IdeaType[] {
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
    return resolveIdeaLabel(idea);
}

export function getIdeaLink(idea: IdeaType | undefined): string {
    if (!idea || idea.type === 'checklist') return '';
    return idea.link ?? '';
}

// Links open in a new tab from a click, so anything but a web (or mail)
// address — javascript:, data:, file: … — must never get that far, however it
// got into the data (typed, imported, or edited on another device).
const OPENABLE_PROTOCOLS = ['http:', 'https:', 'mailto:'];

export function isOpenableLink(url: string): boolean {
    try {
        return OPENABLE_PROTOCOLS.includes(new URL(url.trim()).protocol);
    } catch {
        return false;
    }
}

// Opens an idea's link in a new tab, if it is a web or mail address.
export function openIdeaLink(url: string): void {
    const target = /^www\./i.test(url.trim()) ? 'https://' + url.trim() : url.trim();
    if (!isOpenableLink(target)) return;
    window.open(target, '_blank', 'noopener,noreferrer');
}

export function cleanLink(userLink: string): string {
    if (userLink === '') return '';

    userLink = userLink.trim();
    if (userLink === '') return '';

    const protocolMatch = userLink.match(/^([a-zA-Z][a-zA-Z0-9+\-.]*):\/\//);
    if (protocolMatch) {
        const proto = protocolMatch[1].toLowerCase();
        // Only web addresses are kept as typed. Any other scheme (ftp://,
        // javascript://…) isn't something the app can open, so it's not
        // stored as a link rather than stored as a trap.
        if (proto !== 'http' && proto !== 'https') return '';
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
