import React, { useState } from 'react';
import changelog from '../CHANGELOG.md?raw';
import { parseChangelog } from '../utilities/parseChangelog';
import { containsProfanity } from '../utilities/profanityFilter';
import { saveTrackedIssue } from '../utilities/firebase/featureRequests';

const entries = parseChangelog(changelog);

type View = 'notes' | 'form' | 'submitting' | 'success' | 'error';

function MobilePatchNotesSheet({ onClose, style }: { onClose: () => void; style?: React.CSSProperties }) {
    const [view, setView] = useState<View>('notes');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [profanityError, setProfanityError] = useState(false);

    function reset() {
        setView('notes');
        setTitle('');
        setBody('');
        setProfanityError(false);
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
            const token = import.meta.env.VITE_GITHUB_TOKEN;
            const repo = import.meta.env.VITE_GITHUB_REPO;
            const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/vnd.github+json',
                },
                body: JSON.stringify({
                    title: `[Feature Request] ${title.trim()}`,
                    body: body.trim() || undefined,
                }),
            });
            if (!res.ok) throw new Error();
            const data = await res.json();
            saveTrackedIssue(data.number, title.trim());
            setView('success');
        } catch {
            setView('error');
        }
    }

    return (
        <>
            <div className="mmobile-scrim" onClick={onClose} />
            <div className="mmobile-help-sheet" style={style}>
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
                            {view === 'error' && !profanityError && <p className="mmobile-patchnotes-msg mmobile-patchnotes-msg--error">Something went wrong. Try again.</p>}
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
        </>
    );
}

export default MobilePatchNotesSheet;
