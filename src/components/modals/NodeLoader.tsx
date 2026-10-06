// Three bouncing mini-nodes in the app's node colors (leaf / parent / link),
// used for the checkout and payment-confirmation waits. Decorative — the
// accompanying text carries the meaning, so it's hidden from screen readers.
function NodeLoader({ className = "" }: { className?: string }) {
    return (
        <span className={`nodeLoader ${className}`.trim()} aria-hidden="true">
            <span className="nodeLoader-node leaf" />
            <span className="nodeLoader-node parent" />
            <span className="nodeLoader-node link" />
        </span>
    );
}

export default NodeLoader;
