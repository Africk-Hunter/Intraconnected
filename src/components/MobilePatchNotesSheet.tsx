import React, { useState } from 'react';
import changelog from '../../programmer-docs/CHANGELOG.md?raw';
import { parseChangelog } from '../utilities/parseChangelog';
import { containsProfanity } from '../utilities/profanityFilter';
import { submitFeatureRequest } from '../utilities/firebase/featureRequests';

const entries = parseChangelog(changelog);

type View = 'notes' | 'form' | 'submitting' | 'success' | 'error';

function MobilePatchNotesSheet({ onClose, style }: { onClose: () => void; style?: React.CSSProperties }) {
    const [view, setView] = useState<View>('notes');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [profanityError, setProfanityError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

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
        <>
            <div className="mmobile-scrim mmobile-patchnotes-scrim" onClick={onClose}>
                <div className="mmobile-help-sheet mmobile-patchnotes-sheet" style={style} onClick={e => e.stopPropagation()}>
                    <div className="mmobile-help-header">
                        <span className="mmobile-help-pager">{view === 'notes' ? "What's New" : 'Recommend a Feature'}</span>
                        {view === 'notes'
                            ? <button className="mmobile-patchnotes-recommend-btn" onClick={() => setView('form')}>+ Recommend a feature</button>
                            : <button className="mmobile-help-close" onClick={view === 'submitting' ? undefined : reset}>✕</button>
                        }
                    </div>

                    <div className="mmobile-help-content">
                        {view === 'notes' && entries.map((entry, i) => (
                            <div key={i} className="mmobile-patchnotes-entry">
                                <div className="mmobile-patchnotes-tag-row">
                                    <span className="mmobile-patchnotes-tag">{entry.tag}</span>
                                </div>
                                <h3 className="mmobile-patchnotes-title">{entry.title}</h3>
                                <p className="mmobile-help-text">{entry.description}</p>
                            </div>
                        ))}

                        {(view === 'form' || view === 'submitting' || view === 'error') && (
                            <div className="mmobile-patchnotes-form">
                                <input
                                    className="mmobile-rename-input"
                                    placeholder="Feature title"
                                    value={title}
                                    onChange={e => { setTitle(e.target.value); setProfanityError(false); }}
                                    maxLength={100}
                                    disabled={view === 'submitting'}
                                    autoFocus
                                />
                                <textarea
                                    className="mmobile-rename-input mmobile-patchnotes-textarea"
                                    placeholder="Describe your idea (optional)"
                                    value={body}
                                    onChange={e => { setBody(e.target.value); setProfanityError(false); }}
                                    maxLength={1000}
                                    disabled={view === 'submitting'}
                                />
                                {profanityError && <p className="mmobile-patchnotes-msg mmobile-patchnotes-msg--error">Please keep your request respectful.</p>}
                                {view === 'error' && !profanityError && <p className="mmobile-patchnotes-msg mmobile-patchnotes-msg--error">{errorMessage}</p>}
                                <div className="mmobile-sheet-btns">
                                    <button className="mmobile-sheet-btn mmobile-sheet-btn--cancel" onClick={reset} disabled={view === 'submitting'}>Cancel</button>
                                    <button className="mmobile-sheet-btn mmobile-sheet-btn--save" onClick={submit} disabled={!title.trim() || view === 'submitting'}>
                                        {view === 'submitting' ? 'Sending…' : 'Submit'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {view === 'success' && (
                            <div className="mmobile-patchnotes-form">
                                <p className="mmobile-patchnotes-msg mmobile-patchnotes-msg--success">Thanks! Your request has been submitted.</p>
                                <div className="mmobile-sheet-btns">
                                    <button className="mmobile-sheet-btn mmobile-sheet-btn--save" onClick={reset}>Back to Notes</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

export default MobilePatchNotesSheet;
