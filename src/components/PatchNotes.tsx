import React, { useEffect, useState } from 'react';
import changelog from '../../programmer-docs/CHANGELOG.md?raw';
import { parseChangelog } from '../utilities/parseChangelog';
import { containsProfanity } from '../utilities/profanityFilter';
import { submitFeatureRequest } from '../utilities/firebase/featureRequests';
import { openReport } from '../utilities/reportProblem';

interface PatchNotesProps {
    showPatchNotes: boolean;
}

const entries = parseChangelog(changelog);

type View = 'notes' | 'form' | 'submitting' | 'success' | 'error';

const PatchNotes: React.FC<PatchNotesProps> = ({ showPatchNotes }) => {
    const [view, setView] = useState<View>('notes');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [profanityError, setProfanityError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (!showPatchNotes) reset();
    }, [showPatchNotes]);

    function reset() {
        setView('notes');
        setTitle('');
        setBody('');
        setProfanityError(false);
        setErrorMessage('');
    }

    async function submit() {
        if (!title.trim()) return;
        if (containsProfanity(title) || containsProfanity(body)) {
            setProfanityError(true);
            return;
        }
        setProfanityError(false);
        setView('submitting');
        try {
            await submitFeatureRequest(title.trim(), body.trim() || undefined);
            setView('success');
        } catch (err) {
            setErrorMessage(err instanceof Error && err.message ? err.message : 'Something went wrong. Try again.');
            setView('error');
        }
    }

    return (
        <section className={`patchNotesPopup neutral ${showPatchNotes ? 'show' : ''}`}>
            <div className="patchNotes-header">
                <h2 className="header">{view === 'notes' ? "What's New" : 'Recommend a Feature'}</h2>
                {view === 'notes' && (
                    <div className="patchNotes-header-btns">
                        <button className="patchNotes-recommend-btn patchNotes-bug-btn neobrutal-button" onClick={() => openReport({ area: 'other' })} aria-label="Report a bug" title="Report a bug">
                            <svg viewBox="0 0 24 24" width="1.2em" height="1.2em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M9 8a3 3 0 0 1 6 0" />
                                <path d="M8 8h8v7a4 4 0 0 1-8 0z" />
                                <path d="M12 11v8M4 10l4 1.5M20 10l-4 1.5M4 18l4-2M20 18l-4-2M9.5 4.5L8 3M14.5 4.5L16 3" />
                            </svg>
                        </button>
                        <button className="patchNotes-recommend-btn neobrutal-button" onClick={() => setView('form')}>
                            + Recommend a feature
                        </button>
                    </div>
                )}
            </div>

            {view === 'notes' && (
                <div className="patchNotes-list">
                    {entries.map((entry, i) => (
                        <div key={i} className="patchNotes-entry">
                            <div className="patchNotes-tag-row">
                                <span className="patchNotes-tag">{entry.tag}</span>
                                {entry.image && (
                                    <span className="patchNotes-tag-icon-box">
                                        <img src={entry.image} alt="" className="patchNotes-tag-icon" />
                                    </span>
                                )}
                            </div>
                            <h3 className="patchNotes-title">{entry.title}</h3>
                            <p className="details">{entry.description}</p>
                        </div>
                    ))}
                </div>
            )}

            {(view === 'form' || view === 'submitting' || view === 'error') && (
                <div className="patchNotes-form">
                    <input
                        className="neobrutal-input patchNotes-input"
                        placeholder="Feature title"
                        value={title}
                        onChange={e => { setTitle(e.target.value); setProfanityError(false); }}
                        maxLength={100}
                        disabled={view === 'submitting'}
                        autoFocus
                    />
                    <textarea
                        className="neobrutal-input patchNotes-textarea"
                        placeholder="Describe your idea (optional)"
                        value={body}
                        onChange={e => { setBody(e.target.value); setProfanityError(false); }}
                        maxLength={1000}
                        disabled={view === 'submitting'}
                    />
                    {profanityError && <p className="patchNotes-msg patchNotes-msg--error">Please keep your request respectful.</p>}
                    {view === 'error' && !profanityError && <p className="patchNotes-msg patchNotes-msg--error">{errorMessage}</p>}
                    <div className="patchNotes-form-btns">
                        <button className="modalButton cancel neobrutal-button" onClick={reset} disabled={view === 'submitting'}>Cancel</button>
                        <button className="modalButton continue neobrutal-button" onClick={submit} disabled={!title.trim() || view === 'submitting'}>
                            {view === 'submitting' ? 'Sending…' : 'Submit'}
                        </button>
                    </div>
                </div>
            )}

            {view === 'success' && (
                <div className="patchNotes-form">
                    <p className="patchNotes-msg patchNotes-msg--success">Thanks! Your request has been submitted.</p>
                    <div className="patchNotes-form-btns">
                        <button className="modalButton continue neobrutal-button" onClick={reset}>Back to Notes</button>
                    </div>
                </div>
            )}
        </section>
    );
};

export default PatchNotes;
