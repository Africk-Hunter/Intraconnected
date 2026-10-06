// Minimal, lenient XML parser for the import formats (OPML, FreeMind .mm,
// legacy XMind content.xml). Pure, so the importers stay unit-testable in
// node (no DOMParser there), and no dependency added to the client bundle.
// Handles elements, attributes, self-closing tags, comments, CDATA,
// processing instructions, a DOCTYPE (with internal subset), and the XML
// character/entity references. Mismatched end tags are tolerated rather than
// fatal, since exports from other apps aren't always well-formed.

export interface XmlElement {
    name: string;
    attrs: Record<string, string>;
    children: XmlNode[];
}

export type XmlNode = XmlElement | string;

export class XmlParseError extends Error {}

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(text: string): string {
    return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, ref: string) => {
        if (ref[0] === '#') {
            const code = ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
            return Number.isFinite(code) && code >= 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : match;
        }
        return NAMED_ENTITIES[ref] ?? match;
    });
}

const NAME_RE = /[^\s/>=]+/y;
const ATTR_RE = /\s*([^\s/>=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/y;

export function parseXml(input: string): XmlElement {
    const text = input.charCodeAt(0) === 0xFEFF ? input.slice(1) : input;
    const root: XmlElement = { name: '#document', attrs: {}, children: [] };
    const stack: XmlElement[] = [root];
    let i = 0;

    const skipPast = (terminator: string) => {
        const end = text.indexOf(terminator, i);
        if (end === -1) throw new XmlParseError(`Unterminated markup (expected "${terminator}").`);
        const body = text.slice(i, end);
        i = end + terminator.length;
        return body;
    };

    while (i < text.length) {
        const lt = text.indexOf('<', i);
        if (lt === -1) {
            stack[stack.length - 1].children.push(decodeEntities(text.slice(i)));
            break;
        }
        if (lt > i) stack[stack.length - 1].children.push(decodeEntities(text.slice(i, lt)));
        i = lt;

        if (text.startsWith('<!--', i)) {
            i += 4;
            skipPast('-->');
        } else if (text.startsWith('<![CDATA[', i)) {
            i += 9;
            stack[stack.length - 1].children.push(skipPast(']]>'));
        } else if (text.startsWith('<?', i)) {
            i += 2;
            skipPast('?>');
        } else if (text.startsWith('<!', i)) {
            // DOCTYPE, possibly with an internal subset in [...].
            let depth = 0;
            i += 2;
            while (i < text.length) {
                const c = text[i++];
                if (c === '[') depth++;
                else if (c === ']') depth--;
                else if (c === '>' && depth <= 0) break;
            }
        } else if (text.startsWith('</', i)) {
            i += 2;
            const name = skipPast('>').trim();
            const index = stack.map((el) => el.name).lastIndexOf(name);
            if (index > 0) stack.length = index;
        } else {
            i += 1;
            NAME_RE.lastIndex = i;
            const nameMatch = NAME_RE.exec(text);
            if (!nameMatch) throw new XmlParseError('Malformed tag.');
            i = NAME_RE.lastIndex;
            const el: XmlElement = { name: nameMatch[0], attrs: {}, children: [] };
            for (;;) {
                ATTR_RE.lastIndex = i;
                const attr = ATTR_RE.exec(text);
                if (!attr) break;
                i = ATTR_RE.lastIndex;
                const raw = attr[2] ?? attr[3] ?? attr[4] ?? '';
                // XML attribute-value normalization: literal whitespace
                // becomes a space; &#10; etc. survive as real newlines.
                el.attrs[attr[1]] = decodeEntities(raw.replace(/[\t\n\r]/g, ' '));
            }
            while (i < text.length && /\s/.test(text[i])) i++;
            const selfClosing = text.startsWith('/>', i);
            if (selfClosing) i += 2;
            else if (text[i] === '>') i += 1;
            else throw new XmlParseError(`Malformed <${el.name}> tag.`);
            stack[stack.length - 1].children.push(el);
            if (!selfClosing) stack.push(el);
        }
    }

    const top = root.children.find((c): c is XmlElement => typeof c !== 'string');
    if (!top) throw new XmlParseError('No XML element found.');
    return top;
}

export function childElements(el: XmlElement, name?: string): XmlElement[] {
    return el.children.filter((c): c is XmlElement => typeof c !== 'string' && (!name || localName(c.name) === name));
}

export function firstChild(el: XmlElement, name: string): XmlElement | undefined {
    return childElements(el, name)[0];
}

// All descendant text, concatenated.
export function textContent(el: XmlElement): string {
    return el.children.map((c) => (typeof c === 'string' ? c : textContent(c))).join('');
}

// Drops a namespace prefix: "xhtml:p" → "p".
export function localName(name: string): string {
    const colon = name.indexOf(':');
    return colon === -1 ? name : name.slice(colon + 1);
}
