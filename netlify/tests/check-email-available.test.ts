import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeRequest } from "../functions/lib/testUtils";

const { verifyIdToken, getUserByEmail } = vi.hoisted(() => ({
    verifyIdToken: vi.fn(),
    getUserByEmail: vi.fn(),
}));
vi.mock("../functions/lib/firebaseAdmin", () => ({
    verifyIdToken,
    adminAuth: () => ({ getUserByEmail }),
}));

const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
vi.mock("../functions/lib/rateLimit", () => ({ checkRateLimit }));

import handler from "../functions/check-email-available";

const call = (body: unknown) => handler(fakeRequest(body), {} as never);

describe("check-email-available", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        verifyIdToken.mockResolvedValue("uid-1");
        checkRateLimit.mockResolvedValue(true);
    });

    it("rejects callers who aren't signed in", async () => {
        verifyIdToken.mockResolvedValue(null);
        expect((await call({ email: "a@b.co" })).status).toBe(401);
    });

    it("rejects a missing or malformed email", async () => {
        expect((await call({})).status).toBe(400);
        expect((await call({ email: "nope" })).status).toBe(400);
        expect(getUserByEmail).not.toHaveBeenCalled();
    });

    it("reports an address with no account as available, looked up normalized", async () => {
        getUserByEmail.mockRejectedValue({ code: "auth/user-not-found" });
        const res = await call({ email: "  New@Example.com " });
        expect(await res.json()).toEqual({ available: true });
        expect(getUserByEmail).toHaveBeenCalledWith("new@example.com");
    });

    it("reports an address that belongs to another account as taken", async () => {
        getUserByEmail.mockResolvedValue({ uid: "someone-else" });
        expect(await (await call({ email: "a@b.co" })).json()).toEqual({ available: false });
    });

    it("does not call the caller's own address taken", async () => {
        getUserByEmail.mockResolvedValue({ uid: "uid-1" });
        expect(await (await call({ email: "a@b.co" })).json()).toEqual({ available: true });
    });

    it("answers 429 when rate limited, without looking anything up", async () => {
        checkRateLimit.mockResolvedValue(false);
        expect((await call({ email: "a@b.co" })).status).toBe(429);
        expect(getUserByEmail).not.toHaveBeenCalled();
    });

    it("answers 502 on an unexpected lookup failure", async () => {
        getUserByEmail.mockRejectedValue(new Error("boom"));
        expect((await call({ email: "a@b.co" })).status).toBe(502);
    });
});
