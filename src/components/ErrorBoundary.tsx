import { Component, type ErrorInfo, type ReactNode } from 'react';
import { openReport } from '../utilities/reportProblem';
import { describeError,failedReloads, recordReload, RELOADS_BEFORE_DETAILS } from '../utilities/errorDetails';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: unknown;
    showDetails: boolean;
    copied: boolean;
}

// Catches render-time crashes anywhere below it so a bug in one screen shows
// a recoverable message instead of a blank white page. Reusing the existing
// .overlay/.modal.neobrutal markup (see Key Conventions in CLAUDE.md) rather
// than AnimatedOverlay — this has to render with no dependency on anything
// that could itself be mid-crash, so it's plain static markup, no motion.
class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null, showDetails: false, copied: false };

    static getDerivedStateFromError(error: unknown): Partial<State> {
        return { hasError: true, error };
    }

    reload = () => {
        recordReload();
        window.location.reload();
    };

    // Copies exactly what is on screen, which describeError has already vetted.
    copy = (text: string) => {
        navigator.clipboard?.writeText(text).then(
            () => {
                this.setState({ copied: true });
                setTimeout(() => this.setState({ copied: false }), 2000);
            },
            () => {},
        );
    };

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('Unhandled render error:', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <section className="overlay overlay--scroll">
                    <div className="modal neobrutal error-boundary" role="alertdialog" aria-labelledby="error-boundary-title" aria-describedby="error-boundary-desc">
                        <div className="error-boundary-header">
                            <span className="error-boundary-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 3 2 20h20L12 3Z" />
                                    <path d="M12 10v4.5M12 17.5v.01" />
                                </svg>
                            </span>
                            <h2 className="error-boundary-title" id="error-boundary-title">Something went wrong</h2>
                        </div>
                        <div className="error-boundary-body">
                            <p className="error-boundary-text" id="error-boundary-desc">Sorry about that. Reloading the page should get you back to your ideas.</p>
                            <p className="error-boundary-safe">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="m5 12.5 4.5 4.5L19 7.5" />
                                </svg>
                                Your ideas are saved and encrypted. Nothing was lost.
                            </p>
                            <button className="error-boundary-submit neobrutal-button continue" autoFocus onClick={this.reload}>
                                Reload
                            </button>
                            <button
                                className="error-boundary-toggle neobrutal-button"
                                onClick={() => openReport({ area: 'crash', error: this.state.error })}
                            >
                                Send a report
                            </button>
                            {failedReloads() >= RELOADS_BEFORE_DETAILS && (
                                <div className="error-boundary-details">
                                    <button
                                        className="error-boundary-toggle neobrutal-button"
                                        aria-expanded={this.state.showDetails}
                                        onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
                                    >
                                        {this.state.showDetails ? 'Hide error details' : 'Show error details'}
                                    </button>
                                    {(() => {
                                        const { text, withheld } = describeError(this.state.error);
                                        const open = this.state.showDetails;
                                        // Always mounted so it can animate open and closed; inert keeps
                                        // the hidden copy button out of the tab order.
                                        return (
                                            <div className={`error-boundary-panel${open ? ' is-open' : ''}`} inert={!open}>
                                                <div className="error-boundary-panel-clip">
                                                    <div className="error-boundary-panel-content">
                                                        <div className="error-boundary-message">
                                                            <span>{text}</span>
                                                            <button className="error-boundary-copy neobrutal-button" onClick={() => this.copy(text)}>
                                                                {this.state.copied ? 'Copied' : 'Copy'}
                                                            </button>
                                                        </div>
                                                        {withheld && (
                                                            <p className="error-boundary-withheld">
                                                                The rest of the message is hidden because it may contain private information.
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
