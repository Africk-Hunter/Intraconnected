import { deleteIdeaFromFirebase } from "../firebase/firebaseHelpers";
import { deleteFromLocalStorage } from "./storage";
import { IdeaType } from "../types";
import { fetchFullIdeaList } from "./helpers";


export function getIdeasByParentID(parentID: number): IdeaType[] {
    const ideas = fetchFullIdeaList();
    return ideas.filter((idea: IdeaType) => idea.parentID === parentID);
}


export function getChildrenToDelete(ideaID: number) {
    const ideas = fetchFullIdeaList();

    const filteredStorage = ideas ? ideas.filter((idea: IdeaType) => idea.parentID === ideaID) : [];
    return filteredStorage;
}

export function recursivelyDeleteChildren(ideaId: number) {
    const children = getIdeasByParentID(ideaId);

    if (children.length > 0) {
        children.forEach((child: IdeaType) => {
            recursivelyDeleteChildren(child.id);
        });
    }
    deleteFromLocalStorage(ideaId);
    deleteIdeaFromFirebase(ideaId);
    console.log("Deleting idea with id:", ideaId);
}