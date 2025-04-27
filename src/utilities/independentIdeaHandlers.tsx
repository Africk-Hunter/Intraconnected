export function checkIfIdeaIsLeaf(ideaID: number) {
    const ideas = localStorage.getItem("ideas");
    if (!ideas) {
        console.warn("No ideas found in localStorage.");
        return true;
    }

    const parsedIdeas = JSON.parse(ideas);
    const idea = parsedIdeas.some((idea: { id: number; content: string; parentID: number; }) => idea.parentID === ideaID);
    return idea ? idea.isLeaf : true;
}

export function fetchFullIdeaList() {
    var ideas = localStorage.getItem("ideas");

    if (!ideas) {
        console.warn("No ideas found in localStorage.");
        return [];
    }

    const parsedIdeas = JSON.parse(ideas);
    return parsedIdeas;
}


