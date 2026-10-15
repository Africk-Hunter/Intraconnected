import { describe, expect, it } from "vitest";
import { WRITE_ENC2, WRITE_PASSWORD_WRAP_V3 } from "./cryptoConfig";

describe("encryption write switches", () => {
    it("writes the new formats", () => {
        expect(WRITE_ENC2).toBe(true);
        expect(WRITE_PASSWORD_WRAP_V3).toBe(true);
    });
});
