import { useSyncExternalStore } from "react";
import { getVaultSnapshot, subscribeVault, type VaultSnapshot } from "./vaultSession";

// Re-renders on unlock, lock and newly decrypted labels.
export function useVaultState(): VaultSnapshot {
    return useSyncExternalStore(subscribeVault, getVaultSnapshot);
}
