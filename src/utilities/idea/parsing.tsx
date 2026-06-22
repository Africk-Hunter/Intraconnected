import { batchDeleteIdeasFromFirebase } from "../firebase/firebaseHelpers";
import { deleteFromLocalStorage } from "./storage";
import { IdeaType } from "../types";
import { fetchFullIdeaList } from "./helpers";


export function getIdeasByParentID(parentID: number): IdeaType[] {
    const ideas = fetchFullIdeaList();
    return ideas.filter((idea: IdeaType) => idea.parentID === parentID);
}


export function getChildrenToDelete(ideaID: number) {
    return getIdeasByParentID(ideaID);
}

function collectDeleteIds(ideaId: number, ids: number[]): void {
    const children = getIdeasByParentID(ideaId);
    children.forEach(child => collectDeleteIds(child.id, ids));
    deleteFromLocalStorage(ideaId);
    ids.push(ideaId);
}

export function recursivelyDeleteChildren(ideaId: number): void {
    const ids: number[] = [];
    collectDeleteIds(ideaId, ids);
    batchDeleteIdeasFromFirebase(ids);
}
