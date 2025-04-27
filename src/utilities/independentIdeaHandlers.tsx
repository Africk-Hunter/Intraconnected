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


interface handleBackClickParams {
    setRootId: (id: number) => void;
    setRootName: (name: string) => void;
    rootIdStack: React.RefObject<number[]>;
    ideas: { id: number; content: string; parentId: number }[];
}
export function handleBackClick({ setRootId, setRootName, rootIdStack, ideas }: handleBackClickParams): void {

    interface Idea {
        id: number;
        content: string;
        parentId: number;
    }

    if (rootIdStack.current.length > 0) {
        rootIdStack.current.pop();
        const newRootId = rootIdStack.current[rootIdStack.current.length - 1] || 1;
        setRootId(newRootId);

        const newRoot = ideas.find((idea: Idea) => idea.id === newRootId);
        if (newRoot) {
            setRootName(newRoot.content);
        } else {
            setRootName("Ideas");
        }
    }
}

interface returnToRootParams{
    setRootId: (id: number) => void;
    setRootName: (name: string) => void;
    rootIdStack: React.RefObject<number[]>;
}
export function returnToRoot( { setRootId, setRootName, rootIdStack }: returnToRootParams) {
    setRootId(1);
    setRootName("Ideas");
    while (rootIdStack.current.length > 0) {
        rootIdStack.current.pop();
    }
}
