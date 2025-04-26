import { fetchIdeasFromFirebase, addIdeaToFirebase } from "./firebaseHelpers";
import IdeaNode from "../components/IdeaNode";

function organizeIdeas(ideas: { id: number; content: string; parentID: number }[]) {

    if (ideas) {
        ideas.forEach(idea => {
            appendToLocalStorage("ideas", idea);
        });
    }
}

function appendToLocalStorage(name: string, data: any) {
    var currentData = localStorage.getItem(name);
    if (currentData === null) {
        localStorage.setItem(name, JSON.stringify([data]));
    } else {
        currentData = JSON.parse(currentData);
        if (Array.isArray(currentData)) {
            currentData.push(data);
        }
    }
}

export async function fetchAndOrganizeIdeas() {
    const ideas = await fetchIdeasFromFirebase();
    if (ideas) {
        organizeIdeas(ideas);
    }
}

function checkIfIdeaIsLeaf(ideaID: number) {
    const ideas = localStorage.getItem("ideas");
    if (!ideas) {
        console.warn("No ideas found in localStorage.");
        return true;
    }

    const parsedIdeas = JSON.parse(ideas);
    const idea = parsedIdeas.some(idea => idea.parentID === ideaID);
    return idea ? idea.isLeaf : true;
}

export function convertLocalStorageToDOM() {
    const ideas = localStorage.getItem("ideas");
    if (!ideas) {
        console.warn("No ideas found in localStorage.");
        return [];
    }

    const parsedIdeas = JSON.parse(ideas);
    console.log(parsedIdeas);
    const nodes = parsedIdeas.map((idea: { id: number; content: string; parentID: number; isLeaf: boolean }) => (
        <IdeaNode
            key={idea.id}
            id={idea.id}
            title={idea.content}
            parentId={idea.parentID}
            isLeaf={checkIfIdeaIsLeaf(idea.id)}
            onAddChild={() => { }}
            onDelete={() => { }}
        />
    ));

    return nodes;
}