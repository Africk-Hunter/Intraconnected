import { getIdeaLink, getNameFromID, isNoteMode } from './helpers';
import { getIdeasByParentID } from './parsing';
import type { IdeaType } from '../types';

// The text the Copy actions put on the clipboard, shared by the desktop card
// menu and the mobile actions sheet so both copy exactly the same thing.

const oneLine = (s: string) => s.replace(/\s*\n\s*/g, ' ').trim();

function childLine(child: IdeaType): string {
    const body = isNoteMode(child)
        ? [oneLine((child as { noteTitle?: string }).noteTitle ?? ''), oneLine(child.content)].filter(Boolean).join(' - ')
        : oneLine(child.content);
    const link = getIdeaLink(child);
    return link !== '' ? `${body} (${link})` : body;
}

// One idea: its link if it has one, a checklist with its items, otherwise its text.
export function ideaCopyText(idea: IdeaType): string {
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
    const list = children.map((child, i) => `${i + 1}. ${childLine(child)}`).join('\n');
    return { text: `${oneLine(getNameFromID(id)) || 'Untitled'}\n-----------\n${list}\n########`, count: children.length };
}

// The whole branch under this idea, nested ideas indented with 1.1-style numbers.
export function branchCopyText(id: number): { text: string; count: number } | null {
    if (getIdeasByParentID(id).length === 0) return null;
    const seen = new Set<number>([id]);
    const lines: string[] = [];
    const walk = (parentId: number, prefix: string, depth: number) => {
        getIdeasByParentID(parentId).forEach((child, i) => {
            if (seen.has(child.id)) return;
            seen.add(child.id);
            const num = `${prefix}${i + 1}`;
            lines.push(`${'   '.repeat(depth)}${num}. ${childLine(child)}`);
            walk(child.id, `${num}.`, depth + 1);
        });
    };
    walk(id, '', 0);
    return { text: `${oneLine(getNameFromID(id)) || 'Untitled'}\n-----------\n${lines.join('\n')}\n########`, count: lines.length };
}
