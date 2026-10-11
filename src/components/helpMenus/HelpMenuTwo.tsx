import React from 'react';

const HelpMenuOne: React.FC = () => {
    return (
        <section className="textSection">
            <h1 className="header">So... How Do I Use This?</h1>
            <p className="subHeader">The controls you'll use the most</p>
            <section className="helpGrid">
                <div className="helpGridIcon helpRoot">Ideas</div><p className="details">This is the root idea, any ideas you create here will become related to this idea.</p>
                <div className="helpGridIcon helpPlus"><img src="/images/Plus.svg" className='helpImg' alt="" /></div><p className="details">Create a new idea by clicking this icon on the left, or just press <strong>N</strong>.</p>
                <div className="helpGridIcon helpBack">Back</div><p className="details">Click Back to go up one level. The browser's Back button works too, and refreshing keeps your place.</p>
                <div className="helpGridIcon helpMore">⋯</div><p className="details">Every card has a <strong>⋯</strong> button, and right-clicking a card opens the same menu. Use it to rename, change the link, copy, set a priority, <strong>move</strong> or delete the idea. You can also drag a card onto another one to nest it.</p>
                <div className="helpGridIcon helpTrash"><img src="/images/Trash.svg" className='helpImg trash' alt="" /></div><p className="details">Drag an idea onto the trash to delete it. If it has ideas inside, you'll be asked first. Either way, <strong>Undo</strong> (the button that appears, or Ctrl+Z) brings it all back.</p>
            </section>
        </section>
    );
};

export default HelpMenuOne;
