import { IdeaType } from "../types";
import { fetchFullIdeaList } from "./helpers";

export { sortIdeas } from "./sorting";
export type { SortMode } from "./sorting";

export function getIdeasByParentID(parentID: number): IdeaType[] {
    const ideas = fetchFullIdeaList();
    return ideas.filter((idea: IdeaType) => idea.parentID === parentID);
}
