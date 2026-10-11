import { describe, it, expect } from "vitest";
import { corsHeaders, preflightResponse } from "./cors";

function request(origin: string | null, method = "POST"): Request {
    return new Request("https://intraconnected.app/.netlify/functions/delete-account", {
        method,
        headers: origin ? { origin } : {},
    });
}

describe("corsHeaders", () => {
    it.each(["capacitor://localhost", "https://localhost"])("allows the native app origin %s", (origin) => {
        expect(corsHeaders(request(origin))).toEqual({
            "Access-Control-Allow-Origin": origin,
            Vary: "Origin",
        });
    });

    it("allows the local dev server", () => {
        expect(corsHeaders(request("http://localhost:8888"))["Access-Control-Allow-Origin"]).toBe("http://localhost:8888");
    });

    it.each(["https://evil.example", "http://localhost", "capacitor://evil", "null"])("grants nothing to %s", (origin) => {
        expect(corsHeaders(request(origin))).toEqual({});
    });

    it("grants nothing without an Origin header", () => {
        expect(corsHeaders(request(null))).toEqual({});
    });
});

describe("preflightResponse", () => {
    it("answers a native app preflight with the policy", () => {
        const res = preflightResponse(request("capacitor://localhost", "OPTIONS"));
        expect(res?.status).toBe(204);
        expect(res?.headers.get("Access-Control-Allow-Origin")).toBe("capacitor://localhost");
        expect(res?.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
    });

    it("ignores non-OPTIONS requests", () => {
        expect(preflightResponse(request("capacitor://localhost"))).toBeNull();
    });
});
