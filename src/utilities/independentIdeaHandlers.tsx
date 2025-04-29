import { IdeaType } from './types'

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
    ideas: IdeaType[];
}
export function handleBackClick({ setRootId, setRootName, rootIdStack, ideas }: handleBackClickParams): void {

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

export function deleteFromLocalStorage(id: number) {
    const ideas = localStorage.getItem("ideas");
    if (!ideas) {
        console.warn("No ideas found in localStorage.");
        return;
    }

    const parsedIdeas = JSON.parse(ideas);
    const updatedIdeas = parsedIdeas.filter((idea: { id: number; }) => idea.id !== id);
    localStorage.setItem("ideas", JSON.stringify(updatedIdeas));
}

