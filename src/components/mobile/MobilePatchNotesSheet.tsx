import React, { useState } from 'react';
import changelog from '../../../programmer-docs/CHANGELOG.md?raw';
import { parseChangelog } from '../../utilities/parseChangelog';
import { containsProfanity } from '../../utilities/profanityFilter';
import { submitFeatureRequest } from '../../utilities/firebase/featureRequests';
import { openReport } from '../../utilities/reportProblem';
import { useSheetSwipeDown } from './useSheetSwipeDown';

const entries = parseChangelog(changelog);

type View = 'notes' | 'form' | 'submitting' | 'success' | 'error';

function MobilePatchNotesSheet({ onClose, style }: { onClose: () => void; style?: React.CSSProperties }) {
    const [view, setView] = useState<View>('notes');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [profanityError, setProfanityError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const swipe = useSheetSwipeDown(onClose);

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
                <div ref={swipe.sheetRef} className="mmobile-help-sheet mmobile-patchnotes-sheet" style={style} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="What's new">
                    <div className="mmobile-sheet-grab mmobile-sheet-grab--panel" aria-hidden="true" {...swipe.dragProps} />
                    <div className="mmobile-help-header" {...swipe.dragProps}>
                        <span className="mmobile-help-pager mmobile-patchnotes-heading">{view === 'notes' ? "What's New" : 'Recommend a Feature'}</span>
                        <button className="mmobile-help-close" onClick={view === 'notes' ? onClose : view === 'submitting' ? undefined : reset} aria-label={view === 'notes' ? 'Close' : 'Back to notes'}>✕</button>
                    </div>

                    <div className="mmobile-help-content">
                        {view === 'notes' && (
                            <>
                                {entries.map((entry, i) => (
                                    <article key={i} className="mmobile-patchnotes-entry">
                                        <div className="mmobile-patchnotes-head">
                                            <span className="mmobile-patchnotes-tag">{entry.tag}</span>
                                            <h3 className="mmobile-patchnotes-title">{entry.title}</h3>
                                        </div>
                                        <p className="mmobile-help-text mmobile-patchnotes-desc">{entry.description}</p>
                                    </article>
                                ))}
                                <div className="mmobile-patchnotes-feedback">
                                    <button className="mmobile-patchnotes-recommend-btn" onClick={() => setView('form')}>Recommend a feature</button>
                                    <button className="mmobile-patchnotes-recommend-btn mmobile-patchnotes-bug-btn" onClick={() => openReport({ area: 'other' })}>
                                        <svg viewBox="0 0 24 24" width="1.1em" height="1.1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <path d="M9 8a3 3 0 0 1 6 0" />
                                            <path d="M8 8h8v7a4 4 0 0 1-8 0z" />
                                            <path d="M12 11v8M4 10l4 1.5M20 10l-4 1.5M4 18l4-2M20 18l-4-2M9.5 4.5L8 3M14.5 4.5L16 3" />
                                        </svg>
                                        Report a bug
                                    </button>
                                </div>
                            </>
                        )}

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
