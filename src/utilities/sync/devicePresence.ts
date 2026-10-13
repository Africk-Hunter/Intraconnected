import { newDeviceIds, othersOnly, shouldBump, type DeviceCounters, type DevicePresence } from "./ops";

// What this device knows about the account's other devices, kept from the
// live meta/sync listener (syncEngine.ts) and read by the outbox to decide
// whether a write needs to bump this device's change counter. Imports nothing
// from Firebase, so outbox.ts and syncEngine.ts can both use it.
//
// Kill switch: false = every write bumps, exactly as before. (localStorage
// "sync_always_bump" = "1" does the same for one browser.)
const SOLO_SKIP = true;
const ALWAYS_BUMP_KEY = "sync_always_bump";

const presence: DevicePresence = { confirmed: false, healthy: true, hasOthers: true, catchUpNeeded: false };
let known: Set<string> | null = null;
let registerAttempted = false;

export function bumpNeeded(): boolean {
    if (!SOLO_SKIP) return true;
    try {
        if (localStorage.getItem(ALWAYS_BUMP_KEY) === "1") return true;
    } catch {
        return true;
    }
    return shouldBump(presence);
}

// Called by the outbox once a write that carried the bump was accepted: the
// other devices have been told about everything up to now.
export function bumpSent(): void {
    presence.catchUpNeeded = false;
}

export function setCatchUpNeeded(needed: boolean): void {
    presence.catchUpNeeded = needed;
}

export interface SnapshotOutcome {
    // Other devices that were not there before: this device must announce
    // whatever it changed while it believed it was alone.
    newDevices: string[];
    // This device is not in meta/sync yet and should register once.
    needsRegister: boolean;
}

export function recordSnapshot(devices: DeviceCounters, myDeviceId: string, fromCache: boolean): SnapshotOutcome {
    // A cached snapshot may be stale: stop trusting "alone" until the server answers.
    if (fromCache) {
        presence.confirmed = false;
        return { newDevices: [], needsRegister: false };
    }
    const newDevices = newDeviceIds(devices, myDeviceId, known);
    const others = Object.keys(othersOnly(devices, myDeviceId));
    known = new Set(others);
    presence.confirmed = true;
    presence.healthy = true;
    presence.hasOthers = others.length > 0;
    if (newDevices.length > 0) presence.catchUpNeeded = true;
    const needsRegister = !registerAttempted && !(myDeviceId in devices);
    if (needsRegister) registerAttempted = true;
    return { newDevices, needsRegister };
}

// The listener stopped on an error and won't restart: never skip a bump again this session.
export function recordListenerError(): void {
    presence.healthy = false;
    presence.confirmed = false;
}

// The listener was shut down (sign-out, unmount): forget everything.
export function resetPresence(): void {
    presence.confirmed = false;
    presence.healthy = true;
    presence.hasOthers = true;
    presence.catchUpNeeded = false;
    known = null;
    registerAttempted = false;
}
