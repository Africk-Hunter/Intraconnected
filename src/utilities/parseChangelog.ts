export interface ChangelogEntry {
    tag: string;
    title: string;
    description: string;
}

export function parseChangelog(raw: string): ChangelogEntry[] {
    return raw
        .split(/^## /m)
        .slice(1)
        .map(section => {
            const lines = section.trim().split('\n');
            const pipeIdx = lines[0].indexOf('|');
            if (pipeIdx === -1) return null;
            return {
                tag: lines[0].slice(0, pipeIdx).trim(),
                title: lines[0].slice(pipeIdx + 1).trim(),
                description: lines.slice(1).join('\n').trim(),
            };
        })
        .filter((e): e is ChangelogEntry => e !== null);
}
