// A feature request this account opened as a GitHub issue, tracked at
// users/{uid}/meta/featureRequests so the app can tell them when it ships.
export interface TrackedIssue {
    issueNumber: number;
    title: string;
    seenClosed: boolean;
    createdAt: number;
}
