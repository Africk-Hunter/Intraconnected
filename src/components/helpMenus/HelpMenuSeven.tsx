import React from 'react';
import KeyCaps from '../KeyCaps';

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

const SHORTCUTS: { keys: string; action: string }[] = [
    { keys: '← → ↑ ↓', action: 'Move between cards' },
    { keys: 'Enter', action: 'Open the selected card' },
    { keys: 'C', action: 'Create Shortcut' },
    { keys: 'F2', action: 'Rename the selected card' },
    { keys: 'M', action: 'Move the selected card' },
    { keys: 'Del', action: 'Delete the selected card' },
    { keys: `${MOD}+Z`, action: 'Undo a delete or move' },
    { keys: 'Backspace', action: 'Go up one level' },
    { keys: `${MOD}+K`, action: 'Search every idea' },
    { keys: '/ or ?', action: 'Show the full shortcut list' },
];

const HelpMenuSeven: React.FC = () => {
    return (
        <section className="textSection">
            <h1 className="header">Keyboard &amp; Search</h1>
            <p className="subHeader">Get around without the mouse</p>
            <p className="details">
                Press <strong>{MOD}+K</strong>, or click the magnifying glass on the left, to search every idea at every level. Pick a result and you land on its card.
            </p>
            <dl className="help-shortcuts">
                {SHORTCUTS.map((row) => (
                    <div key={row.keys} className="help-shortcut-row">
                        <dt><KeyCaps keys={row.keys} /></dt>
                        <dd>{row.action}</dd>
                    </div>
                ))}
            </dl>
            <p className="details">
                Tab onto a card, or press an arrow key, to select one. Esc closes any menu or dialog.
            </p>
        </section>
    );
};

export default HelpMenuSeven;
