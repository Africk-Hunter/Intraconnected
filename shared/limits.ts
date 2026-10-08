// Free-plan idea cap. firestore.rules can't import this, so it hard-codes the
// same number — shared/limits.test.ts fails if the two ever differ.
export const FREE_NODE_LIMIT = 50;
