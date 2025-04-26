import Navbar from '../components/Navbar';
import IdeaNode from '../components/IdeaNode';
import { auth } from '../firebaseConfig';
import { fetchAndOrganizeIdeas, convertLocalStorageToDOM } from '../utilities/ideaHandlers';
import { use, useEffect, useState } from 'react';

const nodes = [
    { id: "1", title: "A loooooooooooooooooooooooooooooooooong title", parentId: undefined, isLeaf: true },
    { id: "2", title: "Re:Genesis", parentId: undefined, isLeaf: false },
    { id: "3", title: "An instrumental track that changes tempo mid song. The BPM and drum style change", parentId: "2", isLeaf: true },
    { id: "4", title: "An idea", parentId: "2", isLeaf: true },
    { id: "5", title: "A more medium length idea goes here", parentId: "2", isLeaf: true },
    { id: "6", title: "Even parent nodes can have longer ideas, though it isnt as intuitive", parentId: undefined, isLeaf: false },
    { id: "7", title: "A two length line idea", parentId: "6", isLeaf: true },
    { id: "8", title: "The Jupiter EP", parentId: undefined, isLeaf: false },
    { id: "9", title: "Having an interlude track talking about something random", parentId: "8", isLeaf: true },
];



function Idea() {

    const [initalFetch, setInitialFetch] = useState(false);
    const [ideas, setIdeas] = useState<any[]>([]);
    const [rootName, setRootName] = useState("Ideas");

    useEffect(() => {
        setTimeout(() => {
            if (auth.currentUser) {
                if (!initalFetch) {
                    fetchAndOrganizeIdeas().then(() => {
                        setInitialFetch(true);
                    });
                }
                setIdeas((prevIdeas) => [...prevIdeas, ...convertLocalStorageToDOM()]);
            }
        }, 500);

    }, []);

    return (
        <section className="ideaPage">
            <section className="top">
                <Navbar />
                <section className="rootHolder">
                    <div className="ideaRoot neobrutal-button">{rootName}</div>
                    <button className="back neobrutal-button">Back <img src="/images/Arrow.svg" alt="Back" className="backImg" /></button>
                </section>
            </section>
            <section className="bottom">
                <main className="ideaSpace">
                    <section className='ideaNodes'>
                        {ideas}
                    </section>
                </main>
            </section>
        </section>
    );
}

export default Idea;