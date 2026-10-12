import { useCallback, useEffect, useRef, useState } from 'react';
import { closeReport, submitReport, useReportContext } from '../../utilities/reportProblem';
import { REPORT_CONTACT_MAX, REPORT_MESSAGE_MAX } from '../../../shared/bugReports';

const CLOSE_MS = 150;
const COUNTER_FROM = Math.floor(REPORT_MESSAGE_MAX * 0.8);
const FOCUSABLE = 'button:not(:disabled), textarea:not(:disabled), input:not(:disabled)';

// Mounted once in Index.tsx, outside the ErrorBoundary, so it still works when
// the app underneath has crashed. Deliberately plain markup (no AnimatedOverlay,
// no IdeaContext) for the same reason, so the Esc / Tab trap / focus return
// are done here.
function ReportModal() {
    const context = useReportContext();
    const [message, setMessage] = useState('');
    const [contact, setContact] = useState('');
    const [state, setState] = useState<'form' | 'sending' | 'sent'>('form');
    const [error, setError] = useState('');
    const [closing, setClosing] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);
    const returnFocusTo = useRef<HTMLElement | null>(null);

    // A fresh form each time it opens; remember what to give focus back to.
    useEffect(() => {
        if (context) {
            returnFocusTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            setMessage('');
            setError('');
            setState('form');
            setClosing(false);
        }
    }, [context]);

    const close = useCallback(() => {
        setClosing(true);
        window.setTimeout(() => {
            closeReport();
            returnFocusTo.current?.focus?.();
        }, CLOSE_MS);
    }, []);

    const busy = state === 'sending' || closing;

    useEffect(() => {
        if (!context) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !busy) {
                event.preventDefault();
                close();
                return;
            }
            if (event.key !== 'Tab' || !modalRef.current) return;
            const items = Array.from(modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
            if (items.length === 0) return;
            const first = items[0];
            const last = items[items.length - 1];
            const active = document.activeElement;
            if (event.shiftKey && (active === first || !modalRef.current.contains(active))) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (active === last || !modalRef.current.contains(active))) {
                event.preventDefault();
                first.focus();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [context, busy, close]);

    if (!context) return null;

    const canSend = message.trim().length > 0 && !busy;

    async function send() {
        if (!context || !canSend) return;
        setState('sending');
        setError('');
        try {
            await submitReport(context, message.trim(), contact.trim());
            setState('sent');
        } catch (err) {
            setError(err instanceof Error && err.message ? err.message : 'Couldn’t send your report. Try again.');
            setState('form');
        }
    }

    return (
        <section
            className={`overlay report-overlay${closing ? ' overlay--closing' : ''}`}
            onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) close(); }}
        >
            <div
                ref={modalRef}
                className="modal neobrutal confirmModal report-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="report-title"
            >
                {state === 'sent' ? (
                    <div className="report-sent">
                        <svg className="report-sent-icon" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M7.5 12.5l3 3 6-6.5" />
                        </svg>
                        <h2 className="report-title" id="report-title">Report sent</h2>
                        <p className="report-text">Thanks. We read every report and will look into it.</p>
                        <section className="modalButtons">
                            <button className="modalButton continue neobrutal-button" autoFocus onClick={close}>Done</button>
                        </section>
                    </div>
                ) : (
                    <form
                        className="report-form"
                        onSubmit={(e) => { e.preventDefault(); send(); }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault();
                                send();
                            }
                        }}
                    >
                        <h2 className="report-title" id="report-title">Send a report</h2>
                        <p className="report-text">What happened? What were you doing when it went wrong?</p>

                        <div className="report-field">
                            <textarea
                                className="neobrutal-input report-textarea"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                maxLength={REPORT_MESSAGE_MAX}
                                disabled={busy}
                                aria-label="What happened"
                                autoFocus
                            />
                            <span
                                className={`report-count${message.length >= COUNTER_FROM ? ' report-count--shown' : ''}`}
                                aria-hidden={message.length < COUNTER_FROM}
                            >
                                {message.length}/{REPORT_MESSAGE_MAX}
                            </span>
                        </div>

                        <input
                            className="neobrutal-input report-contact"
                            type="email"
                            value={contact}
                            onChange={(e) => setContact(e.target.value)}
                            maxLength={REPORT_CONTACT_MAX}
                            disabled={busy}
                            placeholder="Email, if you'd like a reply (optional)"
                            aria-label="Email for a reply (optional)"
                        />

                        <p className="report-attached">
                            Sent with it: the error shown, the page you are on, and your device and app version. Never your ideas or your password.
                        </p>

                        <div className="report-error-slot" data-open={error ? 'true' : 'false'}>
                            <p className="report-error" role="alert">{error}</p>
                        </div>

                        <section className="modalButtons">
                            <button type="button" className="modalButton cancel neobrutal-button" onClick={close} disabled={busy}>Cancel</button>
                            <button type="submit" className="modalButton continue neobrutal-button" disabled={!canSend}>
                                {state === 'sending' ? 'Sending…' : 'Send'}
                            </button>
                        </section>
                    </form>
                )}
            </div>
        </section>
    );
}

export default ReportModal;
