import { ChecklistItem, IdeaType } from "../types";
import { getIdeaLink, isNoteMode, resolveIdeaLabel } from "./helpers";
import { sortIdeas, SortMode } from "./sorting";

// Pure serializers for the Profile → Export Your Data formats. No DOM, no
// localStorage: the caller passes in fetchFullIdeaList() and the user's
// idea_sort_mode, so siblings come out in the order they see in the app.

const ROOT_ID = 1;
const DEFAULT_ROOT_TITLE = 'Ideas';
const UNTITLED = 'Untitled';

export interface ExportOptions {
    sortMode?: SortMode;
    exportedAt?: Date;
}

export interface ExportTree {
    title: string;
    hasStoredRoot: boolean;
    topLevel: IdeaType[];
    childrenOf: (id: number) => IdeaType[];
}

// The root (id 1) may or may not be stored in the list. When it is, its
// (renamable) label becomes the document title. Every other idea hangs off its
// parent; one whose parent is missing (orphan) or itself goes to the top level,
// same as syncEngine does. Ideas caught in a parent cycle are unreachable from
// the root, so they're appended to the top level too, rather than dropped.
export function buildIdeaTree(ideas: IdeaType[], sortMode: SortMode): ExportTree {
    const root = ideas.find((i) => i.id === ROOT_ID);
    const rest = ideas.filter((i) => i.id !== ROOT_ID);
    const ids = new Set(rest.map((i) => i.id));

    const byParent = new Map<number, IdeaType[]>();
    for (const idea of rest) {
        const parent = idea.parentID !== idea.id && ids.has(idea.parentID) ? idea.parentID : ROOT_ID;
        const siblings = byParent.get(parent) ?? [];
        siblings.push(idea);
        byParent.set(parent, siblings);
    }
    const childrenOf = (id: number) => sortIdeas(byParent.get(id) ?? [], sortMode);

    const reachable = new Set<number>();
    const visit = (id: number) => {
        for (const child of byParent.get(id) ?? []) {
            if (reachable.has(child.id)) continue;
            reachable.add(child.id);
            visit(child.id);
        }
    };
    visit(ROOT_ID);
    const unreachable = sortIdeas(rest.filter((i) => !reachable.has(i.id)), sortMode);

    const rootLabel = root ? resolveIdeaLabel(root).trim() : '';
    return {
        title: rootLabel || DEFAULT_ROOT_TITLE,
        hasStoredRoot: !!root,
        topLevel: [...childrenOf(ROOT_ID), ...unreachable],
        childrenOf,
    };
}

function normalizeNewlines(text: string): string {
    return text.replace(/\r\n?/g, '\n');
}

function labelOf(idea: IdeaType): string {
    return normalizeNewlines(resolveIdeaLabel(idea)).trim() || UNTITLED;
}

// A note's label is its title; its full text is the body underneath.
function noteBodyOf(idea: IdeaType): string {
    return isNoteMode(idea) ? normalizeNewlines(idea.content).trim() : '';
}

function priorityTag(idea: IdeaType): string {
    return idea.priority ? ` (P${idea.priority})` : '';
}

function itemsOf(idea: IdeaType): ChecklistItem[] {
    return idea.type === 'checklist' ? idea.items ?? [] : [];
}

// Guards against a corrupt tree walking the same idea twice (cycle-proofing
// only; buildTree already gives each idea exactly one parent).
function walker() {
    const seen = new Set<number>();
    return (idea: IdeaType) => {
        if (seen.has(idea.id)) return false;
        seen.add(idea.id);
        return true;
    };
}

// ── Markdown ────────────────────────────────────────────────────────────────

// Escapes brackets/backslashes anywhere (they'd form links), `<` (it would
// start raw inline HTML, e.g. "<with>" vanishes when rendered), and a
// line-leading character that would start a heading, list, quote or ordered list.
function escapeMarkdownLine(line: string): string {
    const escaped = line.replace(/[\\[\]<]/g, (c) => `\\${c}`);
    return escaped
        .replace(/^(\s*)([#>+*-])/, '$1\\$2')
        .replace(/^(\s*\d+)([.)])/, '$1\\$2');
}

function escapeMarkdownUrl(url: string): string {
    // encodeURIComponent leaves ( and ) alone, so encode by char code instead.
    return url.trim().replace(/[\s()<>]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`);
}

// One list item: the first line after the marker, every further line indented
// under it so multi-line text stays inside the item instead of breaking out.
function markdownItem(depth: number, marker: string, text: string, link: string, suffix: string): string[] {
    const indent = '  '.repeat(depth);
    const continuation = indent + '  ';
    const [first, ...rest] = text.split('\n').map(escapeMarkdownLine);
    const head = link ? `[${first}](${escapeMarkdownUrl(link)})` : first;
    return [
        `${indent}${marker}${head}${suffix}`,
        ...rest.map((line) => (line.trim() ? continuation + line : '')),
    ];
}

export function ideasToMarkdown(ideas: IdeaType[], options: ExportOptions = {}): string {
    const tree = buildIdeaTree(ideas, options.sortMode ?? 'priority');
    const firstVisit = walker();
    const lines: string[] = [`# ${escapeMarkdownLine(tree.title.split('\n').join(' '))}`, ''];

    const writeIdea = (idea: IdeaType, depth: number) => {
        if (!firstVisit(idea)) return;
        const label = labelOf(idea);
        const link = getIdeaLink(idea).trim();
        lines.push(...markdownItem(depth, '- ', label, link, priorityTag(idea)));

        const body = noteBodyOf(idea);
        if (body) {
            const continuation = '  '.repeat(depth + 1);
            lines.push('', ...body.split('\n').map((l) => (l.trim() ? continuation + escapeMarkdownLine(l) : '')), '');
        }

        for (const item of itemsOf(idea)) {
            const text = normalizeNewlines(item.text ?? '').trim() || UNTITLED;
            lines.push(...markdownItem(depth + 1, item.checked ? '- [x] ' : '- [ ] ', text, item.link?.trim() ?? '', ''));
        }
        for (const child of tree.childrenOf(idea.id)) writeIdea(child, depth + 1);
    };

    for (const idea of tree.topLevel) writeIdea(idea, 0);
    // Collapse the blank-line padding around note bodies so it never doubles up.
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

// ── OPML ────────────────────────────────────────────────────────────────────

const CHECKED_PREFIX = '☑ ';
const UNCHECKED_PREFIX = '☐ ';

// Escapes for use inside a double-quoted XML attribute. Newlines and tabs are
// encoded as character references, since XML attribute-value normalization
// would otherwise turn them into spaces. Characters XML 1.0 forbids outright
// (most C0 controls, lone surrogates, U+FFFE/U+FFFF) are dropped, because a
// single one makes the whole file unparseable.
export function escapeXmlAttribute(value: string): string {
    return normalizeNewlines(value)
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
        .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
        .replace(/\n/g, '&#10;')
        .replace(/\t/g, '&#9;');
}

function outlineAttributes(text: string, link: string, note: string): string {
    let attrs = ` text="${escapeXmlAttribute(text)}"`;
    if (link) attrs += ` type="link" url="${escapeXmlAttribute(link)}"`;
    if (note) attrs += ` _note="${escapeXmlAttribute(note)}"`;
    return attrs;
}

export function ideasToOpml(ideas: IdeaType[], options: ExportOptions = {}): string {
    const tree = buildIdeaTree(ideas, options.sortMode ?? 'priority');
    const exportedAt = options.exportedAt ?? new Date();
    const firstVisit = walker();
    const lines: string[] = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<opml version="2.0">',
        '  <head>',
        `    <title>${escapeXmlAttribute(`${tree.title} - Intraconnected export ${exportedAt.toISOString().slice(0, 10)}`)}</title>`,
        `    <dateCreated>${exportedAt.toUTCString()}</dateCreated>`,
        '  </head>',
        '  <body>',
    ];

    const writeIdea = (idea: IdeaType, depth: number) => {
        if (!firstVisit(idea)) return;
        const indent = '  '.repeat(depth);
        const attrs = outlineAttributes(labelOf(idea) + priorityTag(idea), getIdeaLink(idea).trim(), noteBodyOf(idea));
        const items = itemsOf(idea);
        const children = tree.childrenOf(idea.id);
        if (items.length === 0 && children.length === 0) {
            lines.push(`${indent}<outline${attrs}/>`);
            return;
        }
        lines.push(`${indent}<outline${attrs}>`);
        for (const item of items) {
            const text = (item.checked ? CHECKED_PREFIX : UNCHECKED_PREFIX) + (normalizeNewlines(item.text ?? '').trim() || UNTITLED);
            lines.push(`${indent}  <outline${outlineAttributes(text, item.link?.trim() ?? '', '')}/>`);
        }
        for (const child of children) writeIdea(child, depth + 1);
        lines.push(`${indent}</outline>`);
    };

    // One top-level outline for the root, so mind-map apps (XMind, MindNode)
    // import it as the central topic with the user's ideas branching off it.
    if (tree.topLevel.length === 0) {
        lines.push(`    <outline${outlineAttributes(tree.title, '', '')}/>`);
    } else {
        lines.push(`    <outline${outlineAttributes(tree.title, '', '')}>`);
        for (const idea of tree.topLevel) writeIdea(idea, 3);
        lines.push('    </outline>');
    }

    lines.push('  </body>', '</opml>');
    return lines.join('\n') + '\n';
}
