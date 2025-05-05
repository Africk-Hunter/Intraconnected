import React from 'react';

const HelpMenuOne: React.FC = () => {
    return (
        <section className="textSection">
            <h1 className="header">So How Do I Use<br />This?</h1><br />
            <section className="helpGrid">
                <div className="helpGridIcon helpRoot">Ideas</div><p className="details">This is the root idea, any ideas you create here will become related to this idea.</p>
                <div className="helpGridIcon helpPlus"><img src="images/Plus.svg" className='helpImg' alt="" /></div><p className="details">You can create a new idea by clicking this icon on the left.</p>
                <div className="helpGridIcon helpBack">Back</div><p className="details">If you want to navigate back to a previous root, just click the back button.</p>
                <div className="helpGridIcon helpTrash"><img src="images/Trash.svg" className='helpImg trash' alt="" /></div><p className="details">If you want to delete an idea, just drag and drop it into the trash icon. Just be careful as this will delete all the ideas related to it as well!</p>
            </section>
        </section>
    );
};

export default HelpMenuOne;