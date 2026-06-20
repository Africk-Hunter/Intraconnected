import React, { useEffect, useState } from 'react';
import changelog from '../CHANGELOG.md?raw';
import { parseChangelog } from '../utilities/parseChangelog';
import { containsProfanity } from '../utilities/profanityFilter';

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

    useEffect(() => {
        if (!showPatchNotes) reset();
    }, [showPatchNotes]);

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
            setView('success');
        } catch {
            setView('error');
        }
    }

    return (
        <section className={`patchNotesPopup neutral ${showPatchNotes ? 'show' : ''}`}>
            <div className="patchNotes-header">
                <h2 className="header">{view === 'notes' ? "What's New" : 'Recommend a Feature'}</h2>
                {view === 'notes' && (
                    <button className="patchNotes-recommend-btn neobrutal-button" onClick={() => setView('form')}>
                        + Recommend
                    </button>
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
                    {view === 'error' && !profanityError && <p className="patchNotes-msg patchNotes-msg--error">Something went wrong. Try again.</p>}
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
