import { Fragment } from 'react';
import { useIdeaContext } from '../context/IdeaContext';
import { getNameFromID } from '../utilities';

// Longer paths show the first level and the last two, with the middle folded.
const MAX_SHOWN = 4;

// Where you are: the ideas above this one, each a button that jumps straight
// there. The idea you are inside is the big title below, so it is not repeated
// (and not a link) here. Hidden at the top level, where there is nothing above.
function Breadcrumb() {
    const { rootIdStack, rootId, navigateToId } = useIdeaContext();

    // The stack runs from the top level down to the current idea.
    const ancestors = rootIdStack.current.slice(0, -1);
    if (rootId === 1 || ancestors.length === 0) return null;

    const label = (id: number) => (id === 1 ? 'Ideas' : getNameFromID(id).replace(/\s+/g, ' ').trim() || 'Untitled');
    const folded = ancestors.length > MAX_SHOWN;
    const visible = folded ? [ancestors[0], ...ancestors.slice(-2)] : ancestors;
    const hidden = folded ? ancestors.slice(1, -2) : [];

    return (
        <nav className="breadcrumb" aria-label="Breadcrumb">
            <ol>
                {visible.map((id, i) => (
                    <Fragment key={id}>
                        {folded && i === 1 && (
                            <li><span className="breadcrumb-fold" title={hidden.map(label).join(' › ')}>…</span></li>
                        )}
                        <li>
                            <button type="button" className="breadcrumb-link" onClick={() => navigateToId(id)} title={label(id)}>
                                {label(id)}
                            </button>
                        </li>
                    </Fragment>
                ))}
            </ol>
        </nav>
    );
}

export default Breadcrumb;
