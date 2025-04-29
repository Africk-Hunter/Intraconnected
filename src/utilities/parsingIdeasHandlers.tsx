import { deleteIdeaFromFirebase } from "./firebaseHelpers";
import { deleteFromLocalStorage } from "./independentIdeaHandlers";
import { IdeaType } from "./types"

function getIdeas() {
    const ideas = localStorage.getItem("ideas");
    if (!ideas) {
        console.warn("No ideas found in localStorage.");
        return;
    }
    return ideas;
}

export function getIdeasByParentID(ideaID: number) {
    const ideas = getIdeas();
    return (ideas ? JSON.parse(ideas).filter((idea: IdeaType) => idea.parentID === ideaID) : []);
}

export function getChildrenToDelete(ideaID: number) {
    const ideas = getIdeas();

    const filteredStorage = ideas ? JSON.parse(ideas).filter((idea: IdeaType) => idea.parentID === ideaID) : [];
    return filteredStorage;
}

export function recursivelyDeleteChildren(ideaId: number) {
    const ideas = getIdeas();

    const ideasChildren = ideas ? JSON.parse(ideas).filter((idea: IdeaType) => idea.parentID === ideaId) : [];

    if (ideasChildren.length > 0) {
        ideasChildren.forEach((childIdea: IdeaType) => {
            recursivelyDeleteChildren(childIdea.id);
        });
    }
    deleteFromLocalStorage(ideaId);
    deleteIdeaFromFirebase(ideaId);
    console.log("Deleting idea with id:", ideaId);
}