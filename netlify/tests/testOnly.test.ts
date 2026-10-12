import { describe, it, expect, afterEach } from "vitest";
import { testEndpointsEnabled } from "../functions/lib/testOnly";

describe("testEndpointsEnabled", () => {
    const saved = { allow: process.env.ALLOW_TEST_RESET, context: process.env.CONTEXT };
    afterEach(() => {
        for (const [key, value] of [["ALLOW_TEST_RESET", saved.allow], ["CONTEXT", saved.context]] as const) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });

    it("is off unless ALLOW_TEST_RESET is true", () => {
        delete process.env.ALLOW_TEST_RESET;
        delete process.env.CONTEXT;
        expect(testEndpointsEnabled()).toBe(false);
    });

    it("is on locally and under netlify dev", () => {
        process.env.ALLOW_TEST_RESET = "true";
        delete process.env.CONTEXT;
        expect(testEndpointsEnabled()).toBe(true);
        process.env.CONTEXT = "dev";
        expect(testEndpointsEnabled()).toBe(true);
    });

    it.each(["production", "deploy-preview", "branch-deploy"])("stays off on a %s deploy even with the variable set", (context) => {
        process.env.ALLOW_TEST_RESET = "true";
        process.env.CONTEXT = context;
        expect(testEndpointsEnabled()).toBe(false);
    });
});
