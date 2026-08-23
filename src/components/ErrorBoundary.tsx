import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
}

// Catches render-time crashes anywhere below it so a bug in one screen shows
// a recoverable message instead of a blank white page. Reusing the existing
// .overlay/.modal.neobrutal markup (see Key Conventions in CLAUDE.md) rather
// than AnimatedOverlay — this has to render with no dependency on anything
// that could itself be mid-crash, so it's plain static markup, no motion.
class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('Unhandled render error:', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <section className="overlay">
                    <div className="modal neobrutal confirmModal">
                        <h2>Something went wrong</h2>
                        <p>Sorry about that — please reload the page. Your ideas are saved and encrypted; nothing was lost.</p>
                        <section className="modalButtons">
                            <button className="modalButton continue neobrutal-button" onClick={() => window.location.reload()}>
                                Reload
                            </button>
                        </section>
                    </div>
                </section>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
