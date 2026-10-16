import { getIdeaLink, getNameFromID, isNoteMode, isVaultIdea } from './helpers';
import { getIdeasByParentID } from './parsing';
import type { IdeaType } from '../types';

// The text the Copy actions put on the clipboard, shared by the desktop card
// menu and the mobile actions sheet so both copy exactly the same thing.

const oneLine = (s: string) => s.replace(/\s*\n\s*/g, ' ').trim();

function childLine(child: IdeaType): string {
    if (isVaultIdea(child)) return '[Vault note]';
    const body = isNoteMode(child)
        ? [oneLine((child as { noteTitle?: string }).noteTitle ?? ''), oneLine(child.content)].filter(Boolean).join(' - ')
        : oneLine(child.content);
    const link = getIdeaLink(child);
    return link !== '' ? `${body} (${link})` : body;
}

// A checklist's items, one line each, indented under its own line.
function itemLines(child: IdeaType, indent: string): string[] {
    if (child.type !== 'checklist') return [];
    return child.items.map((item) => {
        const text = oneLine(item.text);
        return `${indent}${item.checked ? '[x]' : '[ ]'} ${item.link ? `${text} (${item.link})` : text}`;
    });
}

// One idea: its link if it has one, a checklist with its items, otherwise its text.
export function ideaCopyText(idea: IdeaType): string {
    if (isVaultIdea(idea)) return '';
    const link = getIdeaLink(idea);
    if (idea.type === 'checklist') {
        return [idea.content, ...idea.items.map((item) => `${item.checked ? '[x]' : '[ ]'} ${item.text}`)].join('\n');
    }
    return link !== '' ? link : idea.content;
}

// Every idea directly inside this one, a line each (a link idea keeps its address after the text).
export function childrenCopyText(id: number): { text: string; count: number } | null {
    const children = getIdeasByParentID(id);
    if (children.length === 0) return null;
    const list = children.flatMap((child, i) => [`${i + 1}. ${childLine(child)}`, ...itemLines(child, '   ')]).join('\n');
    return { text: `${oneLine(getNameFromID(id)) || 'Untitled'}\n-----------\n${list}\n########`, count: children.length };
}

// The whole branch under this idea, nested ideas indented with 1.1-style numbers.
export function branchCopyText(id: number): { text: string; count: number } | null {
    if (getIdeasByParentID(id).length === 0) return null;
    const seen = new Set<number>([id]);
    const lines: string[] = [];
    let count = 0;
    const walk = (parentId: number, prefix: string, depth: number) => {
        getIdeasByParentID(parentId).forEach((child, i) => {
            if (seen.has(child.id)) return;
            seen.add(child.id);
            count++;
            const num = `${prefix}${i + 1}`;
            lines.push(`${'   '.repeat(depth)}${num}. ${childLine(child)}`);
            lines.push(...itemLines(child, '   '.repeat(depth + 1)));
            walk(child.id, `${num}.`, depth + 1);
        });
    };
    walk(id, '', 0);
    return { text: `${oneLine(getNameFromID(id)) || 'Untitled'}\n-----------\n${lines.join('\n')}\n########`, count };
}
