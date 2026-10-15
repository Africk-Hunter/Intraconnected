import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDocRef, fakeRequest } from "../functions/lib/testUtils";

const { verifyIdTokenWithAuthTime, firestoreMock, kmsDecrypt, checkRateLimit } = vi.hoisted(() => ({
    verifyIdTokenWithAuthTime: vi.fn(),
    firestoreMock: vi.fn(),
    kmsDecrypt: vi.fn(),
    checkRateLimit: vi.fn(),
}));

vi.mock("../functions/lib/firebaseAdmin", () => ({ verifyIdTokenWithAuthTime, firestore: firestoreMock }));
vi.mock("../functions/lib/rateLimit", () => ({ checkRateLimit }));
vi.mock("@google-cloud/kms", () => ({
    KeyManagementServiceClient: class {
        asymmetricDecrypt = kmsDecrypt;
    },
}));

import handler from "../functions/recover-key";

const uid = "uid-1";
const encryptedWrap = "kms1:k1:encrypted-payload";
const freshCaller = () => ({ uid, authTime: Math.floor(Date.now() / 1000) - 5 });

function payloadFor(accountUid = uid): Uint8Array {
    const rawKey = new Uint8Array(32).fill(7);
    const encodedUid = new TextEncoder().encode(accountUid);
    const payload = new Uint8Array(rawKey.length + encodedUid.length);
    payload.set(rawKey);
    payload.set(encodedUid, rawKey.length);
    return payload;
}

function mockDb(recoveryWrap: string | null = encryptedWrap) {
    const encryptionRef = fakeDocRef(recoveryWrap ? { recoveryWrap } : {});
    const auditAdd = vi.fn(async () => ({ id: "audit-1" }));
    firestoreMock.mockReturnValue({
        collection: vi.fn((name: string) => {
            if (name === "users") {
                return {
                    doc: vi.fn(() => ({
                        collection: vi.fn(() => ({
                            doc: vi.fn(() => encryptionRef),
                        })),
                    })),
                };
            }
            if (name === "recoveryAudit") return { add: auditAdd };
            throw new Error(`unexpected collection: ${name}`);
        }),
    });
    return { encryptionRef, auditAdd };
}

describe("recover-key", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.KMS_KEY_VERSION_NAME;
        delete process.env.KMS_KEY_VERSION_NAME_K2;
        verifyIdTokenWithAuthTime.mockResolvedValue(freshCaller());
        checkRateLimit.mockResolvedValue(true);
        kmsDecrypt.mockResolvedValue([{ plaintext: payloadFor() }]);
        process.env.KMS_KEY_VERSION_NAME_K1 = "projects/project/locations/global/keyRings/intraconnected/cryptoKeys/recovery/cryptoKeyVersions/1";
        process.env.KMS_SERVICE_ACCOUNT_JSON = Buffer.from(JSON.stringify({ project_id: "project" })).toString("base64");
    });

    it("rejects requests without a token", async () => {
        verifyIdTokenWithAuthTime.mockResolvedValue(null);
        const req = new Request("https://example.test/.netlify/functions/recover-key", { method: "POST" });
        const response = await handler(req, {} as never);
        expect(response.status).toBe(401);
        expect(response.headers.get("Cache-Control")).toBe("no-store");
        expect(kmsDecrypt).not.toHaveBeenCalled();
    });

    it("rejects an old sign-in", async () => {
        verifyIdTokenWithAuthTime.mockResolvedValue({ uid, authTime: Math.floor(Date.now() / 1000) - 3600 });
        mockDb();
        const response = await handler(fakeRequest(), {} as never);
        expect(response.status).toBe(403);
        expect(kmsDecrypt).not.toHaveBeenCalled();
    });

    it("enforces the recovery rate limit", async () => {
        checkRateLimit.mockResolvedValue(false);
        mockDb();
        const response = await handler(fakeRequest(), {} as never);
        expect(response.status).toBe(429);
        expect(kmsDecrypt).not.toHaveBeenCalled();
    });

    it("rejects accounts without a KMS recovery wrap", async () => {
        mockDb(null);
        const response = await handler(fakeRequest(), {} as never);
        expect(response.status).toBe(404);
        expect(kmsDecrypt).not.toHaveBeenCalled();
    });

    it("rejects a payload bound to another uid and does not audit it", async () => {
        const { auditAdd } = mockDb();
        kmsDecrypt.mockResolvedValue([{ plaintext: payloadFor("uid-2") }]);
        const response = await handler(fakeRequest(), {} as never);
        expect(response.status).toBe(403);
        expect(auditAdd).not.toHaveBeenCalled();
    });

    it("returns the key only after writing an audit record", async () => {
        const { auditAdd } = mockDb();
        const response = await handler(fakeRequest(), {} as never);
        expect(response.status).toBe(200);
        expect(response.headers.get("Cache-Control")).toBe("no-store");
        expect(await response.json()).toEqual({ dek: Buffer.from(new Uint8Array(32).fill(7)).toString("base64") });
        expect(kmsDecrypt).toHaveBeenCalledWith({
            name: process.env.KMS_KEY_VERSION_NAME_K1,
            ciphertext: "encrypted-payload",
        });
        expect(auditAdd).toHaveBeenCalledWith(expect.objectContaining({ uid, result: "success" }));
    });

    it("uses the key version named by the recovery wrap", async () => {
        process.env.KMS_KEY_VERSION_NAME_K2 = "projects/project/locations/global/keyRings/intraconnected/cryptoKeys/recovery-v2/cryptoKeyVersions/3";
        mockDb("kms1:k2:encrypted-with-v2");
        const response = await handler(fakeRequest(), {} as never);
        expect(response.status).toBe(200);
        expect(kmsDecrypt).toHaveBeenCalledWith({
            name: process.env.KMS_KEY_VERSION_NAME_K2,
            ciphertext: "encrypted-with-v2",
        });
    });

    it("rejects a wrap whose key ID has no configured key version", async () => {
        process.env.KMS_KEY_VERSION_NAME = "projects/project/locations/global/keyRings/intraconnected/cryptoKeys/recovery/cryptoKeyVersions/1";
        mockDb("kms1:k99:encrypted-payload");
        const response = await handler(fakeRequest(), {} as never);
        expect(response.status).toBe(503);
        expect(kmsDecrypt).not.toHaveBeenCalled();
    });

    it("continues to read legacy wraps through the original key-version setting", async () => {
        process.env.KMS_KEY_VERSION_NAME = "projects/project/locations/global/keyRings/intraconnected/cryptoKeys/recovery/cryptoKeyVersions/1";
        mockDb("kms1:legacy-encrypted-payload");
        const response = await handler(fakeRequest(), {} as never);
        expect(response.status).toBe(200);
        expect(kmsDecrypt).toHaveBeenCalledWith({
            name: process.env.KMS_KEY_VERSION_NAME,
            ciphertext: "legacy-encrypted-payload",
        });
    });
});
