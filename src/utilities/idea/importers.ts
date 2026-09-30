import { ChecklistItem, IdeaType } from "../types";
import { buildIdeaTree } from "./exporters";
import { childElements, decodeEntities, firstChild, localName, parseXml, textContent, XmlElement, XmlParseError } from "./xml";
import { isZip, readZip, ZipError } from "./zip";

// Pure importers for Profile → Import Data: turn another app's export into
// ideas. Every format is parsed into the same ImportNode tree first, then
// importToIdeas() maps that onto the app's idea shapes. No localStorage or
// Firestore here (see importIdeas.ts for the write side).
//
// Supported: OPML (Workflowy, Dynalist, MindNode, OmniOutliner, MindMeister,
// our own export), Markdown (Obsidian, Logseq, Bear, our own export),
// Notion's zipped Markdown export, indented plain text, FreeMind/Freeplane
// .mm (also MindMeister/Coggle), XMind (.xmind, new and legacy), and our own
// JSON backup.

export interface ImportNode {
    text: string;
    link?: string;
    note?: string;
    priority?: 1 | 2 | 3;
    // A to-do line ("- [ ]", "☐"). A node whose children are all tasks
    // becomes a checklist idea.
    task?: { checked: boolean };
    // An explicit checklist (from our own JSON backup).
    items?: { text: string; checked: boolean; link?: string }[];
    children: ImportNode[];
}

export interface ImportDoc {
    title?: string;
    nodes: ImportNode[];
}

export interface ImportFile {
    name: string;
    bytes: Uint8Array;
}

export interface ParsedImport extends ImportDoc {
    title: string;
    format: string;
    // Files inside a zip that were skipped (images, CSVs, ...).
    skipped: string[];
}

export class ImportError extends Error {}

export const SUPPORTED_IMPORT_EXTENSIONS = ['.opml', '.md', '.markdown', '.txt', '.mm', '.xmind', '.zip', '.json', '.xml'];

// ── Shared text helpers ─────────────────────────────────────────────────────

function normalizeNewlines(text: string): string {
    return text.replace(/\r\n?/g, '\n');
}

const PRIORITY_SUFFIX = /\s*\(P([123])\)\s*$/;
const WEB_URL = /^(https?:\/\/|mailto:|www\.)\S+$/i;

function takePriority(text: string): { text: string; priority?: 1 | 2 | 3 } {
    const match = PRIORITY_SUFFIX.exec(text);
    if (!match) return { text };
    return { text: text.slice(0, match.index), priority: Number(match[1]) as 1 | 2 | 3 };
}

function isWebLink(url: string | undefined): url is string {
    return !!url && /^(https?:\/\/|mailto:|www\.)/i.test(url.trim());
}

function node(text: string, extra: Partial<ImportNode> = {}): ImportNode {
    return { text, children: [], ...extra };
}

// Formatting tags outliners put inside OPML text (Workflowy: <b>, <i>,
// <a href>, <span class="colored">...). Only these are treated as markup, so
// literal text like "<more>" survives.
const FORMAT_TAGS = 'a|b|i|u|s|em|strong|span|br|p|div|del|strike|code|mark|font|sup|sub|ul|ol|li|h[1-6]';
const HTML_TAG = new RegExp(`<\\/?(?:${FORMAT_TAGS})\\b[^>]*>`, 'i');
const HTML_TAGS = new RegExp(HTML_TAG.source, 'gi');

// Strips that formatting, keeping line breaks and returning the first link.
function htmlToText(html: string): { text: string; link?: string } {
    const href = /<a\s[^>]*href\s*=\s*["']([^"']+)["']/i.exec(html);
    const text = decodeEntities(
        html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
            .replace(HTML_TAGS, ''),
    );
    return { text: text.replace(/\n{3,}/g, '\n\n').trim(), link: href ? decodeEntities(href[1]) : undefined };
}

// ── OPML ────────────────────────────────────────────────────────────────────

const TASK_PREFIX = /^([☐☑])\s*/;

function outlineToNode(el: XmlElement): ImportNode {
    let text = el.attrs.text ?? el.attrs.title ?? '';
    let link: string | undefined = el.attrs.url ?? el.attrs.htmlUrl ?? el.attrs.xmlUrl;
    if (HTML_TAG.test(text)) {
        const cleaned = htmlToText(text);
        text = cleaned.text;
        link = link || cleaned.link;
    }
    let note = el.attrs._note;
    if (note && HTML_TAG.test(note)) note = htmlToText(note).text;

    const out = node('');
    const task = TASK_PREFIX.exec(text);
    if (task) {
        out.task = { checked: task[1] === '☑' };
        text = text.slice(task[0].length);
    }
    const { text: withoutPriority, priority } = takePriority(text);
    out.text = withoutPriority.trim();
    if (priority) out.priority = priority;
    if (isWebLink(link)) out.link = link.trim();
    if (note?.trim()) out.note = normalizeNewlines(note).trim();
    out.children = childElements(el, 'outline').map(outlineToNode);
    return out;
}

// A document whose body is a single plain topic (a mind map's central topic,
// or our own export's root) is imported with that topic as the title.
function unwrapSingleRoot(nodes: ImportNode[], fallbackTitle?: string): ImportDoc {
    if (nodes.length === 1) {
        const only = nodes[0];
        if (only.text && !only.link && !only.note && !only.task && !only.items && !only.priority) {
            return { title: only.text, nodes: only.children };
        }
    }
    return { title: fallbackTitle, nodes };
}

export function parseOpml(xml: string): ImportDoc {
    const root = parseXml(xml);
    if (localName(root.name).toLowerCase() !== 'opml') throw new ImportError('This file isn’t OPML.');
    const head = firstChild(root, 'head');
    const titleEl = head && firstChild(head, 'title');
    const headTitle = titleEl ? textContent(titleEl).replace(/\s+—\s+Intraconnected export .*$/, '').trim() : undefined;
    const body = firstChild(root, 'body');
    const nodes = body ? childElements(body, 'outline').map(outlineToNode) : [];
    return unwrapSingleRoot(nodes, headTitle || undefined);
}

// ── FreeMind / Freeplane (.mm) ──────────────────────────────────────────────

function richText(el: XmlElement): string {
    const parts: string[] = [];
    const walk = (n: XmlElement) => {
        for (const child of n.children) {
            if (typeof child === 'string') parts.push(child.replace(/\s+/g, ' '));
            else {
                const name = localName(child.name).toLowerCase();
                if (name === 'br') parts.push('\n');
                walk(child);
                if (['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'tr'].includes(name)) parts.push('\n');
            }
        }
    };
    walk(el);
    return parts.join('').split('\n').map((l) => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function freeMindToNode(el: XmlElement): ImportNode {
    const out = node('');
    let text = el.attrs.TEXT ?? '';
    const notes: string[] = [];
    for (const rich of childElements(el, 'richcontent')) {
        const type = (rich.attrs.TYPE ?? 'NODE').toUpperCase();
        if (type === 'NODE' && !text) text = richText(rich);
        else if (type === 'NOTE' || type === 'DETAILS') notes.push(richText(rich));
    }
    const { text: withoutPriority, priority } = takePriority(normalizeNewlines(text));
    out.text = withoutPriority.trim();
    if (priority) out.priority = priority;
    for (const icon of childElements(el, 'icon')) {
        const level = /^full-([123])$/.exec(icon.attrs.BUILTIN ?? '');
        if (level && !out.priority) out.priority = Number(level[1]) as 1 | 2 | 3;
    }
    if (isWebLink(el.attrs.LINK)) out.link = el.attrs.LINK.trim();
    const note = notes.filter(Boolean).join('\n\n');
    if (note) out.note = note;
    out.children = childElements(el, 'node').map(freeMindToNode);
    return out;
}

export function parseFreeMind(xml: string): ImportDoc {
    const root = parseXml(xml);
    if (root.name !== 'map') throw new ImportError('This file isn’t a FreeMind/Freeplane map.');
    return unwrapSingleRoot(childElements(root, 'node').map(freeMindToNode));
}

// ── XMind ───────────────────────────────────────────────────────────────────

function xmindPriority(markerIds: string[]): 1 | 2 | 3 | undefined {
    for (const id of markerIds) {
        const match = /^priority-(\d+)$/.exec(id);
        if (match) return Math.min(Math.max(Number(match[1]), 1), 3) as 1 | 2 | 3;
    }
    return undefined;
}

interface XmindJsonTopic {
    title?: string;
    href?: string;
    notes?: { plain?: { content?: string } };
    markers?: { markerId?: string }[];
    children?: { attached?: XmindJsonTopic[]; detached?: XmindJsonTopic[] };
}

function xmindJsonToNode(topic: XmindJsonTopic): ImportNode {
    const out = node(normalizeNewlines(topic.title ?? '').trim());
    if (isWebLink(topic.href)) out.link = topic.href.trim();
    const note = topic.notes?.plain?.content?.trim();
    if (note) out.note = normalizeNewlines(note);
    const priority = xmindPriority((topic.markers ?? []).map((m) => m.markerId ?? ''));
    if (priority) out.priority = priority;
    out.children = [...(topic.children?.attached ?? []), ...(topic.children?.detached ?? [])].map(xmindJsonToNode);
    return out;
}

export function parseXmindJson(json: string): ImportDoc {
    let sheets: { title?: string; rootTopic?: XmindJsonTopic }[];
    try {
        sheets = JSON.parse(json);
    } catch {
        throw new ImportError('This XMind file is damaged.');
    }
    if (!Array.isArray(sheets)) throw new ImportError('This XMind file isn’t in a format we recognise.');
    const roots = sheets.filter((s) => s?.rootTopic).map((s) => xmindJsonToNode(s.rootTopic!));
    return unwrapSingleRoot(roots);
}

function xmindXmlToNode(topic: XmlElement): ImportNode {
    const titleEl = firstChild(topic, 'title');
    const out = node(titleEl ? normalizeNewlines(textContent(titleEl)).trim() : '');
    const href = topic.attrs['xlink:href'];
    if (isWebLink(href)) out.link = href.trim();
    const notes = firstChild(topic, 'notes');
    const plain = notes && firstChild(notes, 'plain');
    if (plain && textContent(plain).trim()) out.note = normalizeNewlines(textContent(plain)).trim();
    const markers = firstChild(topic, 'marker-refs');
    const priority = markers && xmindPriority(childElements(markers, 'marker-ref').map((m) => m.attrs['marker-id'] ?? ''));
    if (priority) out.priority = priority;
    const children = firstChild(topic, 'children');
    out.children = children
        ? childElements(children, 'topics').flatMap((group) => childElements(group, 'topic').map(xmindXmlToNode))
        : [];
    return out;
}

export function parseXmindXml(xml: string): ImportDoc {
    const root = parseXml(xml);
    if (localName(root.name) !== 'xmap-content') throw new ImportError('This XMind file isn’t in a format we recognise.');
    const roots = childElements(root, 'sheet').flatMap((sheet) => childElements(sheet, 'topic').map(xmindXmlToNode));
    return unwrapSingleRoot(roots);
}

// ── Markdown ────────────────────────────────────────────────────────────────

const MD_LINK = /(?<![\\!])\[((?:\\.|[^\]\\])*)\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g;

// Inline Markdown → plain text, returning the first link found. The app
// stores plain text, so formatting is dropped rather than shown as symbols.
function cleanInline(raw: string): { text: string; link?: string } {
    let link: string | undefined;
    let text = raw
        .replace(/!\[((?:\\.|[^\]\\])*)\]\([^)]*\)/g, '$1')
        .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, page: string, alias?: string) => alias ?? page)
        .replace(MD_LINK, (_, label: string, url: string) => {
            // Our own exporter percent-encodes parentheses so they can't end
            // the URL early; they mean the same thing decoded.
            if (!link && isWebLink(url)) link = url.replace(/%28/gi, '(').replace(/%29/gi, ')');
            return label || url;
        })
        .replace(/<((?:https?:\/\/|mailto:)[^>\s]+)>/g, (_, url: string) => {
            link ??= url;
            return url;
        })
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/__(.+?)__/g, '$1')
        .replace(/~~(.+?)~~/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/(^|[\s(])\*(\S(?:[^*]*\S)?)\*(?=$|[\s).,!?:;])/g, '$1$2')
        .replace(/\\([\\`*_{}[\]()#+\-.!|<>~])/g, '$1');
    text = text.trim();
    if (!link && WEB_URL.test(text)) link = text;
    return { text, link };
}

function markdownNode(raw: string): ImportNode {
    const { text: withoutPriority, priority } = takePriority(raw);
    const { text, link } = cleanInline(withoutPriority);
    const out = node(text);
    if (priority) out.priority = priority;
    if (link) out.link = link;
    return out;
}

function appendLine(target: ImportNode, raw: string): void {
    const { text, link } = cleanInline(raw);
    target.text = target.text ? `${target.text}\n${text}` : text;
    if (link && !target.link) target.link = link;
}

const LIST_ITEM = /^([-*+]|\d{1,9}[.)])(?:\s+(.*))?$/;
const HEADING = /^(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
const THEMATIC_BREAK = /^([-*_])(\s*\1){2,}$/;
const LOGSEQ_PROPERTY = /^[A-Za-z][\w-]*:: /;

export function parseMarkdown(markdown: string): ImportDoc {
    let lines = normalizeNewlines(markdown).split('\n');
    // YAML front matter (Obsidian, Jekyll, Bear) isn't content.
    if (lines[0]?.trim() === '---') {
        const end = lines.findIndex((l, n) => n > 0 && l.trim() === '---');
        if (end > 0) lines = lines.slice(end + 1);
    }

    const top: ImportNode[] = [];
    const headings: { level: number; node: ImportNode }[] = [];
    let list: { indent: number; node: ImportNode }[] = [];
    let last: { indent: number; node: ImportNode; inNote: boolean } | null = null;
    let paragraph: ImportNode | null = null;
    let blank = false;
    let h1Count = 0;
    let firstIsH1 = false;

    const container = () => (headings.length ? headings[headings.length - 1].node.children : top);
    const endBlock = () => {
        list = [];
        last = null;
        paragraph = null;
    };

    for (let k = 0; k < lines.length; k++) {
        const line = lines[k].replace(/\t/g, '    ').trimEnd();
        const trimmed = line.trim();
        if (!trimmed) {
            blank = true;
            paragraph = null;
            continue;
        }
        const indent = line.length - line.trimStart().length;

        const fence = /^(`{3,}|~{3,})/.exec(trimmed);
        if (fence) {
            const body: string[] = [];
            while (++k < lines.length && !lines[k].trim().startsWith(fence[1])) body.push(lines[k]);
            const code = node(body.join('\n').trim() || 'Code');
            const owner: { node: ImportNode } | null = last;
            (owner && indent > 0 ? owner.node.children : container()).push(code);
            paragraph = null;
            blank = false;
            continue;
        }
        if (indent < 4 && THEMATIC_BREAK.test(trimmed)) {
            endBlock();
            blank = false;
            continue;
        }
        if (LOGSEQ_PROPERTY.test(trimmed)) continue;

        const heading = indent < 4 ? HEADING.exec(trimmed) : null;
        if (heading) {
            const level = heading[1].length;
            const h = markdownNode(heading[2]);
            if (level === 1) {
                if (top.length === 0 && headings.length === 0) firstIsH1 = true;
                h1Count++;
            }
            while (headings.length && headings[headings.length - 1].level >= level) headings.pop();
            container().push(h);
            headings.push({ level, node: h });
            endBlock();
            blank = false;
            continue;
        }

        const item = LIST_ITEM.exec(trimmed);
        if (item) {
            let body = item[2] ?? '';
            const task = /^\[([ xX])\](?:\s+|$)(.*)$/.exec(body);
            if (task) body = task[2];
            const li = markdownNode(body);
            if (task) li.task = { checked: task[1] !== ' ' };
            while (list.length && list[list.length - 1].indent >= indent) list.pop();
            (list.length ? list[list.length - 1].node.children : container()).push(li);
            list.push({ indent, node: li });
            last = { indent, node: li, inNote: false };
            paragraph = null;
            blank = false;
            continue;
        }

        const content = trimmed.replace(/^(>\s?)+/, '');
        const current = last as { indent: number; node: ImportNode; inNote: boolean } | null;
        if (current && !blank) {
            // Lazy continuation of the item's text, or of its note paragraph.
            if (current.inNote) current.node.note += `\n${cleanInline(content).text}`;
            else appendLine(current.node, content);
            continue;
        }
        if (current && blank && indent > current.indent) {
            // An indented paragraph after a blank line belongs to the
            // deepest open item it's indented under — kept as that item's note.
            const owner = [...list].reverse().find((entry) => entry.indent < indent) ?? current;
            const text = cleanInline(content).text;
            owner.node.note = owner.node.note ? `${owner.node.note}\n\n${text}` : text;
            last = { indent: owner.indent, node: owner.node, inNote: true };
            blank = false;
            continue;
        }

        list = [];
        last = null;
        const open = paragraph as ImportNode | null;
        if (open && !blank) {
            appendLine(open, content);
        } else {
            paragraph = markdownNode(content);
            container().push(paragraph);
        }
        blank = false;
    }

    if (firstIsH1 && h1Count === 1 && top.length === 1) return { title: top[0].text, nodes: top[0].children };
    return { nodes: top };
}

// Plain text outlines (OmniOutliner, Workflowy "plain text"): one idea per
// line, nested by indentation.
export function parseIndentedText(text: string): ImportDoc {
    const top: ImportNode[] = [];
    const stack: { indent: number; node: ImportNode }[] = [];
    for (const rawLine of normalizeNewlines(text).split('\n')) {
        const line = rawLine.replace(/\t/g, '    ').trimEnd();
        if (!line.trim()) continue;
        const indent = line.length - line.trimStart().length;
        const body = line.trim().replace(/^([-*+•◦▪‣]|\d{1,9}[.)])\s+/, '');
        const { text: withoutPriority, priority } = takePriority(body);
        const n = node(withoutPriority.trim());
        if (priority) n.priority = priority;
        if (WEB_URL.test(n.text)) n.link = n.text;
        while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
        (stack.length ? stack[stack.length - 1].node.children : top).push(n);
        stack.push({ indent, node: n });
    }
    return { nodes: top };
}

function looksLikeMarkdown(text: string): boolean {
    return normalizeNewlines(text).split('\n').some((l) => HEADING.test(l.trim()) || LIST_ITEM.test(l.trim()));
}

// ── Intraconnected JSON backup ──────────────────────────────────────────────

function isIdeaLike(value: unknown): value is IdeaType {
    const v = value as IdeaType;
    return !!v && typeof v === 'object' && typeof v.id === 'number' && typeof v.parentID === 'number' && typeof v.content === 'string';
}

export function parseIntraconnectedJson(json: string): ImportDoc {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        throw new ImportError('This JSON file is damaged.');
    }
    const list = Array.isArray(parsed) ? parsed : (parsed as { ideas?: unknown })?.ideas;
    if (!Array.isArray(list) || !list.every(isIdeaLike)) {
        throw new ImportError('This JSON file isn’t an Intraconnected export.');
    }
    const tree = buildIdeaTree(list, 'recent');
    const toNode = (idea: IdeaType): ImportNode => {
        const out = node('');
        if (idea.type === 'checklist') {
            out.text = idea.content;
            out.items = (idea.items ?? []).map((item) => ({ text: item.text, checked: !!item.checked, ...(item.link ? { link: item.link } : {}) }));
        } else if (idea.isNote) {
            out.text = idea.noteTitle ?? '';
            out.note = idea.content;
        } else {
            out.text = idea.content;
            if (idea.link) out.link = idea.link;
        }
        if (idea.priority) out.priority = idea.priority;
        out.children = tree.childrenOf(idea.id).map(toNode);
        return out;
    };
    return { title: tree.hasStoredRoot ? tree.title : undefined, nodes: tree.topLevel.map(toNode) };
}

// ── Files → document ────────────────────────────────────────────────────────

function extensionOf(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot === -1 ? '' : name.slice(dot).toLowerCase();
}

// "Meeting notes 1a2b…(32 hex).md" → "Meeting notes" (Notion appends page ids).
function displayName(fileName: string): string {
    const base = fileName.split('/').pop() ?? fileName;
    const ext = extensionOf(base);
    return (ext && SUPPORTED_IMPORT_EXTENSIONS.includes(ext) ? base.slice(0, -ext.length) : base)
        .replace(/\s+[0-9a-f]{32}$/i, '')
        .trim();
}

function decodeText(bytes: Uint8Array): string {
    if (bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
    if (bytes[0] === 0xFE && bytes[1] === 0xFF) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
    const text = new TextDecoder('utf-8').decode(bytes);
    return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

function parseXmlDocument(text: string): { doc: ImportDoc; format: string } {
    const head = text.slice(0, 2000);
    if (/<opml[\s>]/i.test(head)) return { doc: parseOpml(text), format: 'OPML' };
    if (/<map[\s>]/.test(head)) return { doc: parseFreeMind(text), format: 'FreeMind' };
    if (/<xmap-content[\s>]/.test(head)) return { doc: parseXmindXml(text), format: 'XMind' };
    throw new ImportError('This XML file isn’t OPML, FreeMind or XMind.');
}

function parseTextDocument(name: string, text: string): { doc: ImportDoc; format: string } {
    const ext = extensionOf(name);
    const start = text.trimStart();
    if (ext === '.opml' || ext === '.mm' || ext === '.xml' || start.startsWith('<?xml') || start.startsWith('<opml') || start.startsWith('<map')) {
        return parseXmlDocument(text);
    }
    if (ext === '.json' || start.startsWith('{') || start.startsWith('[')) {
        if (/"rootTopic"/.test(text.slice(0, 5000))) return { doc: parseXmindJson(text), format: 'XMind' };
        return { doc: parseIntraconnectedJson(text), format: 'Intraconnected JSON' };
    }
    if (ext === '.txt' && !looksLikeMarkdown(text)) return { doc: parseIndentedText(text), format: 'plain text' };
    if (ext === '.md' || ext === '.markdown' || ext === '.txt' || ext === '') return { doc: parseMarkdown(text), format: 'Markdown' };
    throw new ImportError(`“${name}” isn’t a supported file type.`);
}

const ZIPPED_TEXT_EXTENSIONS = ['.md', '.markdown', '.txt', '.opml'];

function isJunkPath(path: string): boolean {
    return path.split('/').some((segment) => segment.startsWith('.') || segment === '__MACOSX');
}

interface FolderNode {
    name: string;
    folders: Map<string, FolderNode>;
    files: { name: string; node: ImportNode }[];
}

// Notion (and zipped Obsidian vaults) export pages as files, with a page's
// subpages in a folder of the same name next to it. Rebuilds that as a tree,
// merging each folder into its page.
function folderToNodes(folder: FolderNode): ImportNode[] {
    const byName = new Map<string, ImportNode>();
    const nodes: ImportNode[] = [];
    const sortedFiles = [...folder.files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    for (const file of sortedFiles) {
        byName.set(file.name.slice(0, file.name.length - extensionOf(file.name).length), file.node);
        nodes.push(file.node);
    }
    const sortedFolders = [...folder.folders.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    for (const sub of sortedFolders) {
        const children = folderToNodes(sub);
        const page = byName.get(sub.name);
        if (page) page.children.push(...children);
        else if (children.length) nodes.push(node(displayName(sub.name) || 'Folder', { children }));
    }
    return nodes;
}

async function parseMarkdownZip(bytes: Uint8Array, skipped: string[], depth = 0): Promise<ImportDoc> {
    const root: FolderNode = { name: '', folders: new Map(), files: [] };
    const entries = (await readZip(bytes)).filter((entry) => !isJunkPath(entry.name));
    // Large Notion exports wrap the real export in "…-Part-1.zip"; a single
    // inner zip is opened as if it were the download itself.
    if (depth === 0 && entries.length === 1 && extensionOf(entries[0].name) === '.zip') {
        return parseMarkdownZip(entries[0].data, skipped, depth + 1);
    }
    for (const entry of entries) {
        if (isJunkPath(entry.name)) continue;
        const ext = extensionOf(entry.name);
        if (ext === '.zip' && depth === 0) {
            // Large Notion exports nest "Part-1.zip" etc. inside the download.
            const inner = await parseMarkdownZip(entry.data, skipped, depth + 1);
            root.files.push({ name: entry.name, node: node(inner.title ?? displayName(entry.name), { children: inner.nodes }) });
            continue;
        }
        if (!ZIPPED_TEXT_EXTENSIONS.includes(ext)) {
            skipped.push(entry.name);
            continue;
        }
        const segments = entry.name.split('/');
        const fileName = segments.pop()!;
        let folder = root;
        for (const segment of segments) {
            let next = folder.folders.get(segment);
            if (!next) {
                next = { name: segment, folders: new Map(), files: [] };
                folder.folders.set(segment, next);
            }
            folder = next;
        }
        const { doc } = parseTextDocument(fileName, decodeText(entry.data));
        folder.files.push({ name: fileName, node: node(doc.title ?? displayName(fileName), { children: doc.nodes }) });
    }
    let top = root;
    // Unwrap a single enclosing folder ("Export-abc123/").
    while (top.files.length === 0 && top.folders.size === 1) top = [...top.folders.values()][0];
    const nodes = folderToNodes(top);
    return nodes.length === 1 && !nodes[0].link ? { title: nodes[0].text, nodes: nodes[0].children } : { nodes };
}

async function parseFile(file: ImportFile, skipped: string[]): Promise<{ doc: ImportDoc; format: string }> {
    if (isZip(file.bytes)) {
        let entries;
        try {
            entries = await readZip(file.bytes, (name) => name === 'content.json' || name === 'content.xml');
        } catch (error) {
            throw new ImportError(error instanceof ZipError ? error.message : 'This zip file couldn’t be read.');
        }
        const json = entries.find((e) => e.name === 'content.json');
        if (json) return { doc: parseXmindJson(decodeText(json.data)), format: 'XMind' };
        const xml = entries.find((e) => e.name === 'content.xml');
        if (xml) return { doc: parseXmindXml(decodeText(xml.data)), format: 'XMind' };
        if (extensionOf(file.name) === '.xmind') throw new ImportError('This XMind file isn’t in a format we recognise.');
        try {
            return { doc: await parseMarkdownZip(file.bytes, skipped), format: 'Markdown (zip)' };
        } catch (error) {
            if (error instanceof ZipError) throw new ImportError(error.message);
            throw error;
        }
    }
    return parseTextDocument(file.name, decodeText(file.bytes));
}

export async function parseImportFiles(files: ImportFile[]): Promise<ParsedImport> {
    if (files.length === 0) throw new ImportError('Choose a file to import.');
    const skipped: string[] = [];
    const parsed: { name: string; doc: ImportDoc; format: string }[] = [];
    for (const file of files) {
        try {
            parsed.push({ name: file.name, ...(await parseFile(file, skipped)) });
        } catch (error) {
            if (error instanceof ImportError) throw files.length > 1 ? new ImportError(`${file.name}: ${error.message}`) : error;
            if (error instanceof XmlParseError) throw new ImportError(`${files.length > 1 ? `${file.name}: ` : ''}The file is damaged (${error.message})`);
            throw error;
        }
    }

    if (parsed.length === 1) {
        const [{ name, doc, format }] = parsed;
        return { title: doc.title || displayName(name) || 'Imported ideas', nodes: doc.nodes, format, skipped };
    }
    const formats = [...new Set(parsed.map((p) => p.format))];
    return {
        title: 'Imported ideas',
        nodes: parsed.map((p) => node(p.doc.title || displayName(p.name) || 'Untitled', { children: p.doc.nodes })),
        format: formats.length === 1 ? formats[0] : 'mixed files',
        skipped,
    };
}

// ── Document → ideas ────────────────────────────────────────────────────────

export interface ImportToIdeasOptions {
    // Ids already in use (the full idea list), so new ones never collide.
    existingIds: Set<number>;
    // Date.now() at import time.
    now: number;
    parentID?: number;
}

const UNTITLED = 'Untitled';

// Ids follow the app's Date.now() convention, allocated downward from `now`
// (skipping any in use) so they can't collide with ideas created after the
// import, and handed out in document order so 'recent' sort keeps the
// source's order. Returns ideas parents-first — the order they must be
// queued in.
export function importToIdeas(doc: ImportDoc & { title: string }, options: ImportToIdeasOptions): IdeaType[] {
    const ideas: IdeaType[] = [];
    const push = (idea: IdeaType) => ideas.push(idea);

    const itemsFrom = (source: { text: string; checked: boolean; link?: string }[], ideaIndex: number): ChecklistItem[] =>
        source
            .filter((item) => item.text.trim() || item.link)
            .map((item, k) => ({
                id: `${options.now}-${ideaIndex}-${k}`,
                text: item.text.trim() || item.link!,
                checked: item.checked,
                ...(isWebLink(item.link) ? { link: item.link.trim() } : {}),
            }));

    const place = (n: ImportNode, parentID: number) => {
        const text = n.text.trim();
        const priority = n.priority ? { priority: n.priority } : {};
        const isChecklist = !!n.items || (n.children.length > 0 && n.children.every((c) => c.task && c.children.length === 0));
        if (isChecklist) {
            const source = n.items ?? n.children.map((c) => ({ text: c.text, checked: c.task!.checked, link: c.link }));
            const id = ideas.length;
            push({ type: 'checklist', id, content: text || UNTITLED, parentID, items: itemsFrom(source, id), ...priority });
            // Checklists can't have children in the app; anything under an
            // explicit checklist goes beside it instead of disappearing.
            if (n.items) n.children.forEach((c) => place(c, parentID));
            return;
        }
        if (n.note && n.children.length === 0) {
            const body = n.link && !n.note.includes(n.link) ? `${n.note}\n\n${n.link}` : n.note;
            push({ id: ideas.length, content: body, parentID, link: '', isNote: true, noteTitle: text || UNTITLED, ...priority });
            return;
        }
        if (!text && !n.link && !n.note && n.children.length === 0) return;

        const id = ideas.length;
        // A link idea opens its URL when clicked instead of zooming in, so one
        // with children keeps the link as its first child instead.
        const keepLink = n.link && n.children.length === 0 && !n.note;
        push({ id, content: text || n.link || UNTITLED, parentID, link: keepLink ? n.link! : '', ...priority });
        if (n.note) push({ id: ideas.length, content: n.note, parentID: id, link: '', isNote: true, noteTitle: 'Note' });
        if (n.link && !keepLink) push({ id: ideas.length, content: text || n.link, parentID: id, link: n.link });
        n.children.forEach((c) => place(c, id));
    };

    push({ id: 0, content: doc.title.trim() || 'Imported ideas', parentID: options.parentID ?? 1, link: '' });
    doc.nodes.forEach((n) => place(n, 0));

    // Swap the placeholder indexes for real ids.
    const ids: number[] = [];
    for (let candidate = options.now; ids.length < ideas.length; candidate--) {
        if (!options.existingIds.has(candidate) && candidate !== 1) ids.push(candidate);
    }
    ids.reverse();
    const parentFallback = options.parentID ?? 1;
    return ideas.map((idea, index) => ({
        ...idea,
        id: ids[index],
        parentID: index === 0 ? parentFallback : ids[idea.parentID],
    }));
}
