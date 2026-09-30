import { describe, it, expect } from "vitest";
import type { ChecklistItem, IdeaType } from "../types";
import { escapeXmlAttribute, ideasToMarkdown, ideasToOpml } from "./exporters";

const idea = (id: number, parentID = 1, extra: Partial<IdeaType> = {}): IdeaType =>
    ({ id, content: `idea ${id}`, parentID, link: "", ...extra }) as IdeaType;

const checklist = (id: number, parentID: number, content: string, items: ChecklistItem[]): IdeaType =>
    ({ type: "checklist", id, content, parentID, items }) as IdeaType;

const item = (text: string, checked = false, link?: string): ChecklistItem => ({ id: text, text, checked, link });

const exportedAt = new Date("2026-09-29T12:00:00Z");

// Every <outline ...> tag's text attribute, in document order, with its depth.
const outlines = (opml: string) =>
    [...opml.matchAll(/^( *)<outline text="([^"]*)"/gm)].map((m) => `${m[1].length / 2 - 2}:${m[2]}`);

describe("ideasToMarkdown", () => {
    it("nests children as 2-space-indented bullets under a title heading", () => {
        const md = ideasToMarkdown([idea(2), idea(3, 2), idea(4, 3), idea(5)]);
        expect(md).toBe("# Ideas\n\n- idea 2\n  - idea 3\n    - idea 4\n- idea 5\n");
    });

    it("uses a stored root's name as the title, and never lists the root as a bullet", () => {
        const md = ideasToMarkdown([idea(1, 0, { content: "My Brain" }), idea(2)]);
        expect(md).toBe("# My Brain\n\n- idea 2\n");
    });

    it("orders siblings by the given sort mode", () => {
        const ideas = [idea(2), idea(3, 1, { priority: 1 }), idea(4, 1, { priority: 3 })];
        expect(ideasToMarkdown(ideas, { sortMode: "priority" })).toContain("- idea 3 (P1)\n- idea 4 (P3)\n- idea 2\n");
        expect(ideasToMarkdown(ideas, { sortMode: "recent" })).toContain("- idea 2\n- idea 3 (P1)\n- idea 4 (P3)\n");
    });

    it("renders links as [content](url), encoding characters that would end the URL", () => {
        const md = ideasToMarkdown([idea(2, 1, { content: "Docs", link: "https://x.com/a (b)" })]);
        expect(md).toContain("- [Docs](https://x.com/a%20%28b%29)\n");
    });

    it("renders checklist items as task-list children, with item links", () => {
        const md = ideasToMarkdown([
            checklist(2, 1, "Groceries", [item("Milk", true), item("Eggs"), item("Recipe", false, "https://r.io")]),
        ]);
        expect(md).toContain("- Groceries\n  - [x] Milk\n  - [ ] Eggs\n  - [ ] [Recipe](https://r.io)\n");
    });

    it("escapes line-leading block markers and brackets", () => {
        const md = ideasToMarkdown([
            idea(2, 1, { content: "# not a heading" }),
            idea(3, 1, { content: "- not a list" }),
            idea(4, 1, { content: "[not](a link)" }),
            idea(5, 1, { content: "1. not ordered" }),
            idea(6, 1, { content: "a <b>tag</b>" }),
        ], { sortMode: "recent" });
        expect(md).toContain("- a \\<b>tag\\</b>\n");
        expect(md).toContain("- \\# not a heading\n");
        expect(md).toContain("- \\- not a list\n");
        expect(md).toContain("- \\[not\\](a link)\n");
        expect(md).toContain("- 1\\. not ordered\n");
    });

    it("indents continuation lines of multi-line content so the list doesn't break", () => {
        const md = ideasToMarkdown([idea(2, 1, { content: "line one\r\n- line two\n\nline three", priority: 2 }), idea(3, 2)]);
        expect(md).toBe("# Ideas\n\n- line one (P2)\n  \\- line two\n\n  line three\n  - idea 3\n");
    });

    it("writes a note's title as the bullet and its body underneath", () => {
        const md = ideasToMarkdown([idea(2, 1, { isNote: true, noteTitle: "Journal", content: "Dear diary\nmore" })]);
        expect(md).toBe("# Ideas\n\n- Journal\n\n  Dear diary\n  more\n");
    });

    it("keeps orphans and parent cycles at the top level instead of dropping them", () => {
        const md = ideasToMarkdown([idea(2), idea(3, 999), idea(4, 5), idea(5, 4), idea(6, 6)], { sortMode: "recent" });
        for (const id of [2, 3, 4, 5, 6]) expect(md).toContain(`idea ${id}`);
        expect(md).toContain("- idea 3\n");
        expect(md).toContain("- idea 6\n");
    });

    it("exports an empty map as just the title", () => {
        expect(ideasToMarkdown([])).toBe("# Ideas\n");
    });
});

describe("ideasToOpml", () => {
    it("is an OPML 2.0 document with a dated title and one root outline", () => {
        const opml = ideasToOpml([idea(2)], { exportedAt });
        expect(opml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head>\n')).toBe(true);
        expect(opml).toContain("<title>Ideas — Intraconnected export 2026-09-29</title>");
        expect(opml).toContain("<dateCreated>Tue, 29 Sep 2026 12:00:00 GMT</dateCreated>");
        expect(opml.trimEnd().endsWith("</body>\n</opml>")).toBe(true);
        expect(outlines(opml)).toEqual(["0:Ideas", "1:idea 2"]);
    });

    it("nests outlines by parentID and closes every open tag", () => {
        const opml = ideasToOpml([idea(2), idea(3, 2), idea(4, 3), idea(5)], { exportedAt });
        expect(outlines(opml)).toEqual(["0:Ideas", "1:idea 2", "2:idea 3", "3:idea 4", "1:idea 5"]);
        const opened = (opml.match(/<outline[^>]*[^/]>/g) ?? []).length;
        expect((opml.match(/<\/outline>/g) ?? []).length).toBe(opened);
    });

    it("puts links in a url attribute with type=\"link\", and priority as a text suffix", () => {
        const opml = ideasToOpml([idea(2, 1, { content: "Docs", link: "https://x.com/?a=1&b=2", priority: 1 })], { exportedAt });
        expect(opml).toContain('<outline text="Docs (P1)" type="link" url="https://x.com/?a=1&amp;b=2"/>');
    });

    it("writes checklist items as child outlines prefixed with their checked state", () => {
        const opml = ideasToOpml([checklist(2, 1, "Groceries", [item("Milk", true), item("Recipe", false, "https://r.io")])], { exportedAt });
        expect(opml).toContain('<outline text="☑ Milk"/>');
        expect(opml).toContain('<outline text="☐ Recipe" type="link" url="https://r.io"/>');
        expect(outlines(opml)).toEqual(["0:Ideas", "1:Groceries", "2:☑ Milk", "2:☐ Recipe"]);
    });

    it("XML-escapes special characters and encodes newlines as &#10;", () => {
        const opml = ideasToOpml([idea(2, 1, { content: `Tom & "Jerry" <'s>\nsecond line` })], { exportedAt });
        expect(opml).toContain('text="Tom &amp; &quot;Jerry&quot; &lt;&apos;s&gt;&#10;second line"');
    });

    it("puts a note's body in _note", () => {
        const opml = ideasToOpml([idea(2, 1, { isNote: true, noteTitle: "Journal", content: "a\nb" })], { exportedAt });
        expect(opml).toContain('<outline text="Journal" _note="a&#10;b"/>');
    });

    it("uses a stored root's name for the root outline and keeps orphans under it", () => {
        const opml = ideasToOpml([idea(1, 0, { content: "My Brain" }), idea(2), idea(3, 999)], { exportedAt });
        expect(outlines(opml)).toEqual(["0:My Brain", "1:idea 2", "1:idea 3"]);
    });

    it("exports an empty map as a single empty root outline", () => {
        const opml = ideasToOpml([], { exportedAt });
        expect(outlines(opml)).toEqual(["0:Ideas"]);
        expect(opml).toContain('<outline text="Ideas"/>');
    });
});

describe("escapeXmlAttribute", () => {
    it("drops characters XML 1.0 forbids, keeping valid astral characters", () => {
        expect(escapeXmlAttribute("a\u0000b\u0007c\tdo😀\uD800")).toBe("abc&#9;do😀");
    });
});
