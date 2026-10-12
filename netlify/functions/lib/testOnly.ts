// The *-test.ts endpoints change billing state without a payment. They run
// only with ALLOW_TEST_RESET=true (a local .env value) AND never on a real
// Netlify deploy: CONTEXT is production / deploy-preview / branch-deploy there
// (and "dev" under `netlify dev`), so one wrong site env var isn't enough.
export function testEndpointsEnabled(): boolean {
    if (process.env.ALLOW_TEST_RESET !== "true") return false;
    const context = process.env.CONTEXT;
    return context !== "production" && context !== "deploy-preview" && context !== "branch-deploy";
}
