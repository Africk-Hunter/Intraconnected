function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Marks each searched word where it appears, so the eye finds why a row matched.
function Highlighted({ text, words }: { text: string; words: string[] }) {
    if (words.length === 0) return <>{text}</>;
    const parts = text.split(new RegExp(`(${words.map(escapeRegExp).join('|')})`, 'gi'));
    return <>{parts.map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part))}</>;
}

export default Highlighted;
