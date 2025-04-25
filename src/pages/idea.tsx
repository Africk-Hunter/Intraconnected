import React from 'react';

function Idea() {
  return (
    <section className="ideaPage">
        <nav className="navbar">
            <button className="logoButton neobrutal-button navButton"><img src="/images/Logo.svg" alt="" className="logoImg" /></button>
            <button className="createIdea neobrutal-button navButton"><img src="/images/Plus.svg" alt="" className="navImg" /></button>
            <button className="help neobrutal-button navButton"><img src="/images/QuestionMark.svg" alt="" className="navImg" /></button>
        </nav>
        <main className="ideaSpace">
            <section className="ideaRoot neobrutal-button">Songs</section>
            <section className='ideaNodes'>
                <div className="ideaNode neobrutal-button parent">Re:Genesis</div>
                <div className="ideaNode neobrutal-button leaf">An instrumental track that changes tempo mid song. The BPM and drum style change</div>
                <div className="ideaNode neobrutal-button leaf">An idea </div>
                <div className="ideaNode neobrutal-button leaf">A more medium length idea goes here</div>
                <div className="ideaNode neobrutal-button parent">Even parent nodes can have longer ideas, though it isnt as intuitive</div>
                <div className="ideaNode neobrutal-button leaf">A two length line idea</div>
                <div className="ideaNode neobrutal-button parent">The Jupiter EP</div>
                <div className="ideaNode neobrutal-button leaf">Having an interlude track talking about something random</div>
            </section>
        </main>
    </section>
  );
}

export default Idea;