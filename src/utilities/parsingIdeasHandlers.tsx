export function getIdeasChildren(ideaID: number) {
    const ideas = localStorage.getItem("ideas");

    if (!ideas) {
        console.warn("No ideas found in localStorage.");
        return;
    }
    return findAllIdeasWithParentID(ideaID);
}

function findAllIdeasWithParentID(parentID: number) {
    const ideas = localStorage.getItem("ideas");

    if (!ideas) {
        console.warn("No ideas found in localStorage.");
        return;
    }

    const filteredStorage = JSON.parse(ideas).filter((idea: { id: number; content: string; parentID: number; }) => idea.parentID === parentID);
    return filteredStorage;
}
