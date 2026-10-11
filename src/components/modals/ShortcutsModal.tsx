import AnimatedOverlay from '../AnimatedOverlay';
import KeyCaps from '../KeyCaps';

interface Props {
    open: boolean;
    onClose: () => void;
}

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

const GROUPS: { title: string; rows: { keys: string; action: string }[] }[] = [
    {
        title: 'Move around',
        rows: [
            { keys: '← → ↑ ↓', action: 'Move between cards' },
            { keys: 'Enter', action: 'Open the selected card' },
            { keys: 'Backspace', action: 'Go up one level' },
            { keys: `${MOD}+K`, action: 'Search all ideas' },
        ],
    },
    {
        title: 'Change things',
        rows: [
            { keys: 'N', action: 'New idea' },
            { keys: 'F2', action: 'Rename the card under the pointer or selected (or the idea you are in)' },
            { keys: 'M', action: 'Move the card under the pointer or selected' },
            { keys: 'Del', action: 'Delete the card under the pointer or selected' },
            { keys: `${MOD}+C`, action: 'Copy the card under the pointer or selected' },
            { keys: `${MOD}+Z`, action: 'Undo a delete or move' },
            { keys: 'Shift+F10', action: 'Open the card menu (or right-click)' },
        ],
    },
    {
        title: 'Anywhere',
        rows: [
            { keys: 'Esc', action: 'Close a menu, dialog or the mind map' },
            { keys: '?', action: 'Show this list' },
        ],
    },
    {
        title: 'In the mind map',
        rows: [
            { keys: '+ / −', action: 'Zoom in / out' },
            { keys: '0', action: 'Center on the current idea' },
            { keys: '← → ↑ ↓', action: 'Pan' },
        ],
    },
];

function ShortcutsModal({ open, onClose }: Props) {
    return (
        <AnimatedOverlay open={open} scrollable onClick={onClose} onEscape={onClose}>
            <div className="modal neobrutal shortcuts-modal" role="dialog" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
                <h2 className="shortcuts-title">Keyboard shortcuts</h2>
                <div className="shortcuts-groups">
                    {GROUPS.map((group) => (
                        <section key={group.title} className="shortcuts-group">
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
                <section className="modalButtons">
                    <button className="modalButton continue neobrutal-button" onClick={onClose} autoFocus>Close</button>
                </section>
            </div>
        </AnimatedOverlay>
    );
}

export default ShortcutsModal;
