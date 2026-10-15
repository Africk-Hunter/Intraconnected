import { useEffect, useRef } from "react";
import { fetchFullIdeaList } from "../idea/helpers";
import { decryptMissingLabels } from "./vaultService";
import { useVaultState } from "./useVaultState";

// Mounted once (Idea.tsx): while the vault is unlocked, decrypts the label of
// every vault note that isn't in memory yet (after an unlock, a sync or an
// edit elsewhere), then asks the views to re-read. Locking clears the labels,
// and the views re-read so they show "Vault note" again.
export function useVaultLabels(newIdeaSwitch: boolean, setNewIdeaSwitch: (value: (prev: boolean) => boolean) => void): void {
    const { unlocked } = useVaultState();
    const wasUnlocked = useRef(unlocked);

    useEffect(() => {
        if (wasUnlocked.current && !unlocked) setNewIdeaSwitch((prev) => !prev);
        wasUnlocked.current = unlocked;
        if (!unlocked) return;
        let cancelled = false;
        decryptMissingLabels(fetchFullIdeaList()).then((added) => {
            if (added && !cancelled) setNewIdeaSwitch((prev) => !prev);
        });
        return () => { cancelled = true; };
    }, [unlocked, newIdeaSwitch, setNewIdeaSwitch]);
}
