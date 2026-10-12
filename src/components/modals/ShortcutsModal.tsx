import AnimatedOverlay from '../AnimatedOverlay';
import KeyCaps from '../KeyCaps';

interface Props {
    open: boolean;
    onClose: () => void;
}

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

const GROUPS: { title: string; accent: string; rows: { keys: string; action: string }[] }[] = [
    {
        title: 'Move around',
        accent: 'sky',
        rows: [
            { keys: '← → ↑ ↓', action: 'Move between cards' },
            { keys: 'Enter', action: 'Open the selected card' },
            { keys: 'Backspace', action: 'Go up one level' },
            { keys: `${MOD}+F`, action: 'Search all ideas' },
        ],
    },
    {
        title: 'Change things',
        accent: 'leaf',
        rows: [
            { keys: 'C', action: 'Create a new idea' },
            { keys: 'F2 / R', action: 'Rename the card (or this idea)' },
            { keys: 'M', action: 'Move the card' },
            { keys: 'D', action: 'Delete the card' },
            { keys: `${MOD}+C`, action: 'Copy the card' },
            { keys: `${MOD}+Z`, action: 'Undo a delete or move' },
            { keys: 'Shift+F10', action: 'Open the card menu' },
        ],
    },
    {
        title: 'Anywhere',
        accent: 'link',
        rows: [
            { keys: 'Esc', action: 'Close a menu or dialog' },
            { keys: 'G', action: 'Open or close the mind map' },
            { keys: '/ or ?', action: 'Show this list' },
        ],
    },
    {
        title: 'In the mind map',
        accent: 'pink',
        rows: [
            { keys: '+ / −', action: 'Zoom in / out' },
            { keys: '0', action: 'Center on the current idea' },
            { keys: '← → ↑ ↓', action: 'Pan' },
            { keys: 'Esc', action: 'Cancel a node drag' },
            { keys: 'P', action: 'Priority lens' },
            { keys: 'N', action: 'Newest lens (last 30 days)' },
        ],
    },
];

function ShortcutsModal({ open, onClose }: Props) {
    return (
        <AnimatedOverlay open={open} scrollable onClick={onClose} onEscape={onClose}>
            <div className="modal neobrutal shortcuts-modal" role="dialog" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
                <header className="shortcuts-head">
                    <h2 className="shortcuts-title">Keyboard shortcuts</h2>
                    <p className="shortcuts-sub">Card actions use the card under the pointer, or the selected one. Press <kbd>/</kbd> any time to bring this back.</p>
                </header>
                <div className="shortcuts-groups">
                    {GROUPS.map((group) => (
                        <section key={group.title} className={`shortcuts-group accent-${group.accent}`}>
                            <h3>{group.title}</h3>
                            <dl>
                                {group.rows.map((row) => (
                                    <div key={row.keys + row.action} className="shortcuts-row">
                                        <dt><KeyCaps keys={row.keys} /></dt>
                                        <dd>{row.action}</dd>
                                    </div>
                                ))}
                            </dl>
                        </section>
                    ))}
                </div>
                <footer className="move-modal-footer shortcuts-footer">
                    <button className="modalButton continue neobrutal-button" onClick={onClose} autoFocus>Close</button>
                </footer>
            </div>
        </AnimatedOverlay>
    );
}

export default ShortcutsModal;
