export interface ChangelogEntry {
    tag: string;
    title: string;
    description: string;
    image?: string;
}

export function parseChangelog(raw: string): ChangelogEntry[] {
    return raw
        .split(/^## /m)
        .slice(1)
        .map(section => {
            const lines = section.trim().split('\n');
            const pipeIdx = lines[0].indexOf('|');
            if (pipeIdx === -1) return null;

            const bodyLines = lines.slice(1);
            const imageLineIdx = bodyLines.findIndex(l => l.startsWith('image:'));
            const image = imageLineIdx !== -1 ? bodyLines[imageLineIdx].slice('image:'.length).trim() : undefined;
            const descLines = imageLineIdx !== -1
                ? bodyLines.filter((_, i) => i !== imageLineIdx)
                : bodyLines;

            return {
                tag: lines[0].slice(0, pipeIdx).trim(),
                title: lines[0].slice(pipeIdx + 1).trim(),
                description: descLines.join('\n').trim(),
                image,
            };
        })
        .filter((e): e is ChangelogEntry => e !== null);
}
