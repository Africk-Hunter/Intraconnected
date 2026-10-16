// Shared by the report form (src/) and submit-bug-report (netlify/functions).
export const REPORT_MESSAGE_MAX = 1000;
export const REPORT_CONTACT_MAX = 200;
export const REPORT_FIELD_MAX = 300;

// Where the person was when they hit "Send a report". Free text would let a
// client label an issue anything, so the server accepts only these.
const REPORT_AREAS = [
    "crash",
    "sync",
    "sign-in",
    "email-link",
    "checkout",
    "account",
    "import",
    "other",
] as const;

export type ReportArea = (typeof REPORT_AREAS)[number];

export function isReportArea(value: unknown): value is ReportArea {
    return typeof value === "string" && (REPORT_AREAS as readonly string[]).includes(value);
}

// What the client attaches automatically. Never idea text, links, the uid or
// the email: the error line has already been through describeError.
export interface ReportDiagnostics {
    error?: string;
    route?: string;
    platform?: string;
    userAgent?: string;
    plan?: string;
    pendingChanges?: number;
    syncFailure?: string;
    online?: boolean;
}
