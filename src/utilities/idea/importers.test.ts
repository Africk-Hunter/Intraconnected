import { describe, it, expect } from "vitest";
import { deflateRawSync } from "node:zlib";
import type { ChecklistIdea, IdeaType, StandardIdea } from "../types";
import { ideasToMarkdown, ideasToOpml } from "./exporters";
import {
    ImportError,
    importToIdeas,
    parseFreeMind,
    parseImportFiles,
    parseIndentedText,
    parseMarkdown,
    parseOpml,
    parseXmindJson,
    parseXmindXml,
    type ImportDoc,
    type ImportNode,
} from "./importers";
import { parseXml, textContent } from "./xml";
import { readZip } from "./zip";

const encoder = new TextEncoder();
const file = (name: string, text: string) => ({ name, bytes: encoder.encode(text) });

// Builds a zip in memory (deflated entries unless `stored`).
function makeZip(entries: Record<string, string | Uint8Array>, stored = false): Uint8Array {
    const locals: Uint8Array[] = [];
    const centrals: Uint8Array[] = [];
    let offset = 0;
    for (const [name, content] of Object.entries(entries)) {
        const raw = typeof content === "string" ? encoder.encode(content) : content;
        const data = stored ? raw : new Uint8Array(deflateRawSync(raw));
        const nameBytes = encoder.encode(name);
        const local = new Uint8Array(30 + nameBytes.length + data.length);
        const lv = new DataView(local.buffer);
        lv.setUint32(0, 0x04034b50, true);
        lv.setUint16(8, stored ? 0 : 8, true);
        lv.setUint32(18, data.length, true);
        lv.setUint32(22, raw.length, true);
        lv.setUint16(26, nameBytes.length, true);
        local.set(nameBytes, 30);
        local.set(data, 30 + nameBytes.length);
        const central = new Uint8Array(46 + nameBytes.length);
        const cv = new DataView(central.buffer);
        cv.setUint32(0, 0x02014b50, true);
        cv.setUint16(10, stored ? 0 : 8, true);
        cv.setUint32(20, data.length, true);
        cv.setUint32(24, raw.length, true);
        cv.setUint16(28, nameBytes.length, true);
        cv.setUint32(42, offset, true);
        central.set(nameBytes, 46);
        locals.push(local);
        centrals.push(central);
        offset += local.length;
    }
    const centralSize = centrals.reduce((n, c) => n + c.length, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, centrals.length, true);
    ev.setUint16(10, centrals.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    const out = new Uint8Array(offset + centralSize + 22);
    let p = 0;
    for (const part of [...locals, ...centrals, eocd]) {
        out.set(part, p);
        p += part.length;
    }
    return out;
}

// Compact shape of a node tree for assertions: "text" or "text > [children]".
type Shape = string | [string, Shape[]];
const shape = (nodes: ImportNode[]): Shape[] => nodes.map((n) => (n.children.length ? [n.text, shape(n.children)] : n.text));

describe("parseXml", () => {
    it("parses attributes, entities, CDATA and comments, and survives a mismatched end tag", () => {
        const root = parseXml(`<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "b">]><!-- c --><a x='1 &amp; 2' y="&#10;&#x41;"><b>t&lt;<![CDATA[<raw>]]></b><c/></oops></a>`);
        expect(root.name).toBe("a");
        expect(root.attrs).toEqual({ x: "1 & 2", y: "\nA" });
        expect(textContent(root)).toBe("t<<raw>");
    });

    it("normalizes literal newlines in attributes to spaces", () => {
        expect(parseXml(`<a t="x\ny"/>`).attrs.t).toBe("x y");
    });
});

describe("readZip", () => {
    it("reads stored and deflated entries, filtering by name", async () => {
        const deflated = await readZip(makeZip({ "a.md": "# A", "dir/b.md": "- b" }));
        expect(deflated.map((e) => [e.name, new TextDecoder().decode(e.data)])).toEqual([["a.md", "# A"], ["dir/b.md", "- b"]]);
        const stored = await readZip(makeZip({ "a.md": "x", "b.png": "y" }, true), (n) => n.endsWith(".md"));
        expect(stored.map((e) => e.name)).toEqual(["a.md"]);
    });
});

describe("parseMarkdown", () => {
    it("nests bullets by indentation and bullets under headings", () => {
        const doc = parseMarkdown("## Work\n- a\n  - b\n    - c\n- d\n## Home\n1. e\n2. f\n");
        expect(shape(doc.nodes)).toEqual([["Work", [["a", [["b", ["c"]]]], "d"]], ["Home", ["e", "f"]]]);
    });

    it("uses a lone leading H1 as the title", () => {
        const doc = parseMarkdown("# My Map\n\n- a\n- b\n");
        expect(doc.title).toBe("My Map");
        expect(shape(doc.nodes)).toEqual(["a", "b"]);
    });

    it("keeps content before multiple H1s as-is, with no title", () => {
        const doc = parseMarkdown("# One\n- a\n# Two\n- b\n");
        expect(doc.title).toBeUndefined();
        expect(shape(doc.nodes)).toEqual([["One", ["a"]], ["Two", ["b"]]]);
    });

    it("extracts links, priority, and strips inline formatting", () => {
        const [a, b, c] = parseMarkdown("- [Docs](https://x.com/a%20b) (P1)\n- **bold** and `code` [[Wiki Page|alias]]\n- https://plain.url/x\n").nodes;
        expect(a).toMatchObject({ text: "Docs", link: "https://x.com/a%20b", priority: 1 });
        expect(b.text).toBe("bold and code alias");
        expect(c).toMatchObject({ text: "https://plain.url/x", link: "https://plain.url/x" });
    });

    it("reads task lists, and keeps escaped brackets as text", () => {
        const [list] = parseMarkdown("- Groceries\n  - [x] Milk\n  - [ ] \\[Draft\\] eggs\n").nodes;
        expect(list.children.map((c) => [c.text, c.task])).toEqual([["Milk", { checked: true }], ["[Draft] eggs", { checked: false }]]);
    });

    it("joins continuation lines and keeps an indented paragraph after a blank line as a note", () => {
        const [item] = parseMarkdown("- line one\n  line two\n\n  a note\n  more note\n  - child\n").nodes;
        expect(item.text).toBe("line one\nline two");
        expect(item.note).toBe("a note\nmore note");
        expect(shape(item.children)).toEqual(["child"]);
    });

    it("turns paragraphs into ideas and skips front matter, rules and Logseq properties", () => {
        const doc = parseMarkdown("---\ntags: [x]\n---\nFirst para\nstill first\n\n***\n\nSecond\n- id:: 123\n- real\n  collapsed:: true\n");
        expect(shape(doc.nodes)).toEqual(["First para\nstill first", "Second", "id:: 123", "real"]);
    });

    it("keeps fenced code as one idea", () => {
        expect(shape(parseMarkdown("```js\nconst a = 1;\n- not a list\n```\n").nodes)).toEqual(["const a = 1;\n- not a list"]);
    });
});

describe("parseIndentedText", () => {
    it("nests lines by tabs or spaces, stripping bullets", () => {
        expect(shape(parseIndentedText("Root\n\tA\n\t\tB\n\tC\n• D\n").nodes)).toEqual([["Root", [["A", ["B"]], "C"]], "D"]);
    });
});

describe("parseOpml", () => {
    it("reads nested outlines with notes, links and HTML text (Workflowy)", () => {
        const doc = parseOpml(`<?xml version="1.0"?><opml version="2.0"><head><title>WF</title></head><body>
            <outline text="&lt;b&gt;Bold&lt;/b&gt; &lt;a href=&quot;https://a.io&quot;&gt;link&lt;/a&gt;" _note="n1"><outline text="kid"/></outline>
            <outline text="Two" type="link" url="https://b.io"/></body></opml>`);
        expect(doc.title).toBe("WF");
        expect(doc.nodes[0]).toMatchObject({ text: "Bold link", link: "https://a.io", note: "n1" });
        expect(doc.nodes[1]).toMatchObject({ text: "Two", link: "https://b.io" });
    });

    it("unwraps a single central topic (MindNode, XMind) into the title", () => {
        const doc = parseOpml(`<opml version="2.0"><head/><body><outline text="Center"><outline text="a"/><outline text="b"/></outline></body></opml>`);
        expect(doc.title).toBe("Center");
        expect(shape(doc.nodes)).toEqual(["a", "b"]);
    });

    it("rejects XML that isn't OPML", () => {
        expect(() => parseOpml("<map/>")).toThrow(ImportError);
    });
});

describe("parseFreeMind", () => {
    it("reads TEXT, rich-content text and notes, links and priority icons", () => {
        const doc = parseFreeMind(`<map version="1.0.1"><node TEXT="Center">
            <node TEXT="Line 1&#10;Line 2" LINK="https://a.io"><icon BUILTIN="full-2"/></node>
            <node><richcontent TYPE="NODE"><html><body><p>Rich</p></body></html></richcontent>
                <richcontent TYPE="NOTE"><html><body><p>Para 1</p><p>Para 2</p></body></html></richcontent>
                <node TEXT="kid" LINK="#ID_123"/></node>
            </node></map>`);
        expect(doc.title).toBe("Center");
        expect(doc.nodes[0]).toMatchObject({ text: "Line 1\nLine 2", link: "https://a.io", priority: 2 });
        expect(doc.nodes[1]).toMatchObject({ text: "Rich", note: "Para 1\nPara 2" });
        expect(doc.nodes[1].children[0].link).toBeUndefined();
    });
});

describe("XMind", () => {
    it("reads content.json with attached and detached topics, notes, links and priority markers", () => {
        const doc = parseXmindJson(JSON.stringify([{ rootTopic: {
            title: "Center",
            children: {
                attached: [{ title: "A", href: "https://a.io", markers: [{ markerId: "priority-1" }], notes: { plain: { content: "n" } } }],
                detached: [{ title: "Floating" }],
            },
        } }]));
        expect(doc.title).toBe("Center");
        expect(doc.nodes[0]).toMatchObject({ text: "A", link: "https://a.io", priority: 1, note: "n" });
        expect(shape(doc.nodes)).toEqual(["A", "Floating"]);
    });

    it("reads legacy content.xml", () => {
        const doc = parseXmindXml(`<xmap-content xmlns:xlink="http://www.w3.org/1999/xlink"><sheet><topic><title>Center</title><children><topics type="attached">
            <topic xlink:href="https://a.io"><title>A</title><marker-refs><marker-ref marker-id="priority-3"/></marker-refs></topic>
            <topic><title>B</title><notes><plain>note</plain></notes></topic></topics></children></topic></sheet></xmap-content>`);
        expect(doc.title).toBe("Center");
        expect(doc.nodes[0]).toMatchObject({ text: "A", link: "https://a.io", priority: 3 });
        expect(doc.nodes[1]).toMatchObject({ text: "B", note: "note" });
    });

    it("opens a .xmind zip", async () => {
        const xmind = makeZip({ "content.json": JSON.stringify([{ rootTopic: { title: "Center", children: { attached: [{ title: "A" }] } } }]), "metadata.json": "{}" });
        const parsed = await parseImportFiles([{ name: "plan.xmind", bytes: xmind }]);
        expect(parsed).toMatchObject({ title: "Center", format: "XMind" });
        expect(shape(parsed.nodes)).toEqual(["A"]);
    });
});

describe("parseImportFiles", () => {
    it("rebuilds a Notion export: pages with same-named subpage folders, ids stripped, nested zip unwrapped", async () => {
        const id = "0123456789abcdef0123456789abcdef";
        const inner = makeZip({
            [`Export/Work ${id}.md`]: `# Work\n\n- task`,
            [`Export/Work ${id}/Meeting ${id}.md`]: `# Meeting\n\nNotes here`,
            [`Export/Work ${id}/diagram.png`]: "png",
            [`Export/Home ${id}.md`]: `# Home\n`,
            "__MACOSX/._junk.md": "x",
        });
        const outer = makeZip({ "Export-Part-1.zip": inner });
        const parsed = await parseImportFiles([{ name: "Notion export.zip", bytes: outer }]);
        expect(parsed.title).toBe("Notion export");
        expect(shape(parsed.nodes)).toEqual(["Home", ["Work", ["task", ["Meeting", ["Notes here"]]]]]);
        expect(parsed.skipped).toEqual([`Export/Work ${id}/diagram.png`]);
    });

    it("titles a single file by its heading or file name, and groups multiple files", async () => {
        expect((await parseImportFiles([file("Ideas.md", "- a")])).title).toBe("Ideas");
        const multi = await parseImportFiles([file("one.md", "# One\n- a"), file("two.txt", "b\n\tc")]);
        expect(multi.title).toBe("Imported ideas");
        expect(shape(multi.nodes)).toEqual([["One", ["a"]], ["two", [["b", ["c"]]]]]);
    });

    it("sniffs XML in a .xml file, and rejects unsupported files with a readable message", async () => {
        expect((await parseImportFiles([file("x.xml", "<opml><body><outline text='a'/></body></opml>")])).format).toBe("OPML");
        await expect(parseImportFiles([file("doc.pdf", "%PDF")])).rejects.toThrow("isn’t a supported file type");
        await expect(parseImportFiles([file("bad.opml", "<opml><body><outline text=")])).rejects.toThrow(ImportError);
    });
});

describe("importToIdeas", () => {
    const now = 1_800_000_000_000;
    const place = (doc: ImportDoc & { title: string }, existingIds: number[] = []) => importToIdeas(doc, { existingIds: new Set(existingIds), now });

    it("creates one top-level import idea, parents before children, with unique ascending ids", () => {
        const ideas = place({ title: "Imported", nodes: [{ text: "a", children: [{ text: "b", children: [] }] }, { text: "c", children: [] }] }, [now, now - 2]);
        expect(ideas.map((i) => [i.content, i.parentID === 1 ? "root" : ideas.find((p) => p.id === i.parentID)?.content])).toEqual([
            ["Imported", "root"], ["a", "Imported"], ["b", "a"], ["c", "Imported"],
        ]);
        const ids = ideas.map((i) => i.id);
        expect(ids).toEqual([...ids].sort((x, y) => x - y));
        expect(ids).not.toContain(now);
        expect(ids).not.toContain(now - 2);
        expect(Math.max(...ids)).toBeLessThanOrEqual(now);
    });

    it("turns a node whose children are all tasks into a checklist", () => {
        const [, list] = place({ title: "T", nodes: [{ text: "Groceries", priority: 2, children: [
            { text: "Milk", task: { checked: true }, children: [] },
            { text: "Recipe", task: { checked: false }, link: "https://r.io", children: [] },
        ] }] });
        expect(list).toMatchObject({ type: "checklist", content: "Groceries", priority: 2 });
        expect((list as ChecklistIdea).items.map((i) => [i.text, i.checked, i.link])).toEqual([["Milk", true, undefined], ["Recipe", false, "https://r.io"]]);
    });

    it("makes a note idea from a noted leaf, and a 'Note' child for a noted parent", () => {
        const ideas = place({ title: "T", nodes: [
            { text: "Journal", note: "body", children: [] },
            { text: "Parent", note: "about", children: [{ text: "kid", children: [] }] },
        ] });
        expect(ideas[1]).toMatchObject({ isNote: true, noteTitle: "Journal", content: "body" });
        expect(ideas.slice(2).map((i) => [i.content, (i as StandardIdea).isNote ?? false])).toEqual([["Parent", false], ["about", true], ["kid", false]]);
    });

    it("keeps a link on a leaf, but moves it to a first child when the node has children", () => {
        const ideas = place({ title: "T", nodes: [
            { text: "Leaf", link: "https://a.io", children: [] },
            { text: "Parent", link: "https://b.io", children: [{ text: "kid", children: [] }] },
        ] });
        expect(ideas.map((i) => [i.content, (i as StandardIdea).link])).toEqual([
            ["T", ""], ["Leaf", "https://a.io"], ["Parent", ""], ["Parent", "https://b.io"], ["kid", ""],
        ]);
    });

    it("drops empty leaves but keeps empty parents as 'Untitled'", () => {
        const ideas = place({ title: "T", nodes: [{ text: " ", children: [] }, { text: "", children: [{ text: "kid", children: [] }] }] });
        expect(ideas.map((i) => i.content)).toEqual(["T", "Untitled", "kid"]);
    });
});

describe("round-trips through our own exports", () => {
    const original = [
        { id: 1, content: "My Brain", parentID: 0, link: "" },
        { id: 2, content: "Projects", parentID: 1, link: "", priority: 1 },
        { id: 3, content: "Site [v2] & <more>", parentID: 2, link: "" },
        { id: 4, content: "Figma", parentID: 3, link: "https://figma.com/f?a=1&b=(2)" },
        { type: "checklist", id: 5, content: "Launch", parentID: 3, items: [
            { id: "a", text: "Copy", checked: true },
            { id: "b", text: "Review", checked: false, link: "https://r.io" },
        ] },
        { id: 6, content: "Journal body\nline 2", parentID: 1, link: "", isNote: true, noteTitle: "Journal" },
    ] as IdeaType[];

    // Each imported idea as "content < parent", plus whatever it carries.
    const summarize = (ideas: IdeaType[]) => {
        const byId = new Map(ideas.map((i) => [i.id, i]));
        return ideas.slice(1).map((i) => {
            const parent = byId.get(i.parentID)!.content;
            if (i.type === "checklist") return `${i.content} < ${parent} [${i.items.map((it) => `${it.checked ? "x" : " "} ${it.text}${it.link ? ` ${it.link}` : ""}`).join(", ")}]`;
            const extras = [i.link, i.priority && `P${i.priority}`, i.isNote && `note "${i.noteTitle}"`].filter(Boolean);
            return `${JSON.stringify(i.content)} < ${parent}${extras.length ? ` (${extras.join(", ")})` : ""}`;
        }).sort();
    };

    const expected = [
        `"Figma" < Site [v2] & <more> (https://figma.com/f?a=1&b=(2))`,
        `"Journal body\\nline 2" < My Brain (note "Journal")`,
        `"Projects" < My Brain (P1)`,
        `"Site [v2] & <more>" < Projects`,
        `Launch < Site [v2] & <more> [x Copy,   Review https://r.io]`,
    ].sort();

    for (const [name, text] of [
        ["map.md", ideasToMarkdown(original, { sortMode: "recent" })],
        ["map.opml", ideasToOpml(original, { sortMode: "recent" })],
        ["map.json", JSON.stringify({ ideas: original })],
    ] as const) {
        it(`preserves structure, links, checklists, notes and priority from ${name}`, async () => {
            const parsed = await parseImportFiles([file(name, text)]);
            expect(parsed.title).toBe("My Brain");
            expect(summarize(importToIdeas(parsed, { existingIds: new Set(), now: 1_800_000_000_000 }))).toEqual(expected);
        });
    }
});

describe("Intraconnected JSON import links", () => {
    const json = (ideas: unknown[]) => JSON.stringify({ ideas });

    it("keeps web links but drops anything that could run script", async () => {
        const parsed = await parseImportFiles([
            file("backup.json", json([
                { id: 2, content: "good", parentID: 1, link: "https://example.com" },
                { id: 3, content: "bad", parentID: 1, link: "javascript:alert(document.domain)" },
                { id: 4, content: "data", parentID: 1, link: "data:text/html,<script>alert(1)</script>" },
                { id: 5, type: "checklist", content: "list", parentID: 1, items: [
                    { id: "a", text: "ok", checked: false, link: "http://example.com/x" },
                    { id: "b", text: "evil", checked: false, link: "javascript:alert(1)" },
                ] },
            ])),
        ]);
        const links = (n: ImportNode): (string | undefined)[] => [n.link, ...(n.items ?? []).map((i) => i.link), ...n.children.flatMap(links)];
        const all = parsed.nodes.flatMap(links).filter(Boolean);
        expect(all).toEqual(["https://example.com", "http://example.com/x"]);
    });
});
