import changelog from '../CHANGELOG.md?raw';
import { parseChangelog } from '../utilities/parseChangelog';

const entries = parseChangelog(changelog);

function MobilePatchNotesSheet({ onClose }: { onClose: () => void }) {
    return (
        <>
            <div className="mmobile-scrim" onClick={onClose} />
            <div className="mmobile-help-sheet">
                <div className="mmobile-help-header">
                    <span className="mmobile-help-pager">What's New</span>
                    <button className="mmobile-help-close" onClick={onClose}>✕</button>
                </div>
                <div className="mmobile-help-content">
                    {entries.map((entry, i) => (
                        <div key={i} className="mmobile-patchnotes-entry">
                            <span className="mmobile-patchnotes-tag">{entry.tag}</span>
                            <h3 className="mmobile-patchnotes-title">{entry.title}</h3>
                            <p className="mmobile-help-text">{entry.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}

export default MobilePatchNotesSheet;
