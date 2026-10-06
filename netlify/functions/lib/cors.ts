// Every browser call these functions receive is a same-origin fetch to
// "/.netlify/functions/..." (see billing.tsx, authFirebase.tsx, etc.) and
// every one of them requires an Authorization header, which forces the
// browser to preflight — so a cross-origin caller was already blocked by
// the browser with zero CORS headers set at all. This makes that implicit
// behavior an explicit, intentional policy instead of "no stated policy
// either way": only the site's own deploy origins are ever granted access,
// nothing is reflected blindly, and there's no wildcard.
const allowedOrigins = new Set(
    [process.env.URL, process.env.DEPLOY_PRIME_URL, process.env.DEPLOY_URL, "http://localhost:8888"].filter(
        (value): value is string => Boolean(value)
    )
);

export function corsHeaders(req: Request): Record<string, string> {
    const origin = req.headers.get("origin");
    if (!origin || !allowedOrigins.has(origin)) return {};
    return {
        "Access-Control-Allow-Origin": origin,
        Vary: "Origin",
    };
}

// Call first, before touching the body or doing any auth check — a
// preflight OPTIONS request carries neither and just wants the policy.
export function preflightResponse(req: Request): Response | null {
    if (req.method !== "OPTIONS") return null;
    return new Response(null, {
        status: 204,
        headers: {
            ...corsHeaders(req),
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Authorization, Content-Type",
            "Access-Control-Max-Age": "86400",
        },
    });
}

export function jsonResponse(req: Request, data: unknown, status = 200): Response {
    return Response.json(data, { status, headers: corsHeaders(req) });
}
