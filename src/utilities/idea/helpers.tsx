import { updateIdeaParentIdInFirebase } from "../firebase/firebaseHelpers";
import { IdeaType } from "../types";

export function fetchFullIdeaList() {
    var ideas = localStorage.getItem("ideas");

    if (!ideas) {
        console.warn("No ideas found in localStorage.");
        return [];
    }

    const parsedIdeas = JSON.parse(ideas);
    return parsedIdeas;
}
/**
 * Checks if an idea is a leaf (i.e., has no children).
 * @param ideaID The ID of the idea to check.
 * @returns True if the idea is a leaf, false otherwise.
 */
export function checkIfIdeaIsLeaf(ideaID: number): boolean {
    const ideas = fetchFullIdeaList();
    return !ideas.some((idea: IdeaType) => idea.parentID === ideaID);
}

/**
 * Handles navigating back to the previous root idea.
 * @param params The parameters for handling back navigation.
 */
export function handleBackClick(params: {
    setRootId: (id: number) => void;
    setRootName: (name: string) => void;
    rootIdStack: React.RefObject<number[]>;
    ideas: IdeaType[];
}): void {
    const { setRootId, setRootName, rootIdStack, ideas } = params;

    if (rootIdStack.current.length > 0) {
        rootIdStack.current.pop();
        const newRootId = rootIdStack.current[rootIdStack.current.length - 1] || 1;
        setRootId(newRootId);

        const newRoot = ideas.find((idea: IdeaType) => idea.id === newRootId);
        if (newRoot) {
            setRootName(newRoot.content);
        } else {
            setRootName("Ideas");
        }
    }
}

/**
 * Resets the root idea to the default root.
 * @param params The parameters for resetting the root.
 */
export function returnToRoot(params: {
    setRootId: (id: number) => void;
    setRootName: (name: string) => void;
    rootIdStack: React.RefObject<number[]>;
}) {
    const { setRootId, setRootName, rootIdStack } = params;

    setRootId(1);
    setRootName("Ideas");
    while (rootIdStack.current.length > 0) {
        rootIdStack.current.pop();
    }
}

/* export function updateIdeaParentId(id: number, newParentId: number) {
    const ideas = JSON.parse(fetchFullIdeaList());

    const updatedIdeas = ideas.map((idea: IdeaType) => {
        if (idea.id === id) {
            return { ...idea, parentID: newParentId };
        }
        return idea;
    });
    localStorage.setItem("ideas", JSON.stringify(updatedIdeas));
    updateIdeaParentIdInFirebase(id, newParentId);
} */