import React from 'react';

const HelpMenuOne: React.FC = () => {
    return (
        <section className="textSection">
            <h1 className="header">So... How Do I Use This?</h1>
            <p className="subHeader">The buttons you'll use most</p>
            <section className="helpGrid">
                <div className="helpGridIcon helpRoot">Ideas</div><p className="details">This is the idea you're inside. New ideas you add go under it.</p>
                <div className="helpGridIcon helpPlus"><img src="/images/Plus.svg" className='helpImg' alt="" /></div><p className="details">Create a new idea. Shortcut: <strong>C</strong>.</p>
                <div className="helpGridIcon helpBack">Back</div><p className="details">Go up one level. Your browser's Back button works too.</p>
                <div className="helpGridIcon helpMore">⋯</div><p className="details">Every card has a <strong>⋯</strong> button (or right-click). It lets you rename, move, copy, set a priority or delete. You can also drag a card onto another to put it inside.</p>
                <div className="helpGridIcon helpTrash"><img src="/images/Trash.svg" className='helpImg trash' alt="" /></div><p className="details">Drag an idea here to delete it. Made a mistake? Click <strong>Undo</strong> (or press Ctrl+Z).</p>
            </section>
        </section>
    );
};

export default HelpMenuOne;
