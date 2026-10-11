import { useEffect, useRef } from 'react';
import type { ChecklistItem } from '../types';

// Ids that appeared since the last render, so only newly added checklist rows play the enter
// animation (the rows already there when the list mounts, or after a pull, stay still).
export function useEnteringIds(items: ChecklistItem[]): Set<string> {
    const known = useRef<Set<string> | null>(null);
    const entering = new Set<string>();
    if (known.current === null) {
        known.current = new Set(items.map(i => i.id));
    } else {
        for (const item of items) if (!known.current.has(item.id)) entering.add(item.id);
    }
    useEffect(() => { known.current = new Set(items.map(i => i.id)); });
    return entering;
}
