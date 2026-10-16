import { TAG_HINT, type SearchTag } from '../utilities/idea/search';

interface Props {
    tags: SearchTag[];
    suggestions: SearchTag[];
    onPick: (tag: SearchTag) => void;
    onRemove: (tag: SearchTag) => void;
    // The box the next Backspace will delete.
    armed?: SearchTag | null;
}

// The finished "is:" filters as little boxes, and the tags on offer while one is being typed.
function SearchTagBar({ tags, suggestions, onPick, onRemove, armed }: Props) {
    if (tags.length === 0 && suggestions.length === 0) return null;
    return (
        <div className="search-tags">
            {tags.length > 0 && (
                <ul className="search-tags-chips" aria-label="Filters">
                    {tags.map((tag) => (
                        <li key={tag} className={`search-tag search-tag--${tag}${armed === tag ? ' search-tag--armed' : ''}`}>
                            <span>is:{tag}</span>
                            <button
                                type="button"
                                tabIndex={-1}
                                // mousedown is cancelled so the field keeps focus.
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => onRemove(tag)}
                                aria-label={`Remove filter is:${tag}`}
                            ><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg></button>
                        </li>
                    ))}
                </ul>
            )}
            {suggestions.length > 0 && (
                <ul className="search-tags-suggest" aria-label="Filters to add">
                    {suggestions.map((tag) => (
                        <li key={tag}>
                            <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(tag)}>
                                <strong>is:{tag}</strong>
                                <span>{TAG_HINT[tag]}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default SearchTagBar;
