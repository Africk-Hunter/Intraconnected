// Kept apart from vaultCrypto.ts so vaultSession.ts (in every bundle) does not
// pull the crypto module in with it.

export type VaultErrorCode =
    | "wrong-passphrase"
    | "wrong-code"
    | "malformed-code"
    | "other-vault"
    | "damaged"
    | "argon2-unavailable"
    | "not-set-up"
    | "already-set-up"
    | "locked"
    | "offline";

export class VaultError extends Error {
    code: VaultErrorCode;
    constructor(code: VaultErrorCode, message?: string) {
        super(message ?? code);
        this.name = "VaultError";
        this.code = code;
    }
}
