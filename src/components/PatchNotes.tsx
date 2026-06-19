import React from 'react';
import changelog from '../CHANGELOG.md?raw';
import { parseChangelog } from '../utilities/parseChangelog';

interface PatchNotesProps {
    showPatchNotes: boolean;
}

const entries = parseChangelog(changelog);

const PatchNotes: React.FC<PatchNotesProps> = ({ showPatchNotes }) => {
    return (
        <section className={`patchNotesPopup neutral ${showPatchNotes ? 'show' : ''}`}>
            <h2 className="header">What's New</h2>
            <div className="patchNotes-list">
                {entries.map((entry, i) => (
                    <div key={i} className="patchNotes-entry">
                        <span className="patchNotes-tag">{entry.tag}</span>
                        <h3 className="patchNotes-title">{entry.title}</h3>
                        <p className="details">{entry.description}</p>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default PatchNotes;
