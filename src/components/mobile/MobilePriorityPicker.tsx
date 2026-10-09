type Priority = 1 | 2 | 3 | undefined;

interface Props {
    value: Priority;
    onChange: (priority: Priority) => void;
}

const OPTIONS: { value: Priority; label: string; cls: string }[] = [
    { value: 1, label: 'High', cls: 'p1' },
    { value: 2, label: 'Med', cls: 'p2' },
    { value: 3, label: 'Low', cls: 'p3' },
    { value: undefined, label: 'None', cls: 'none' },
];

// High / Med / Low / None, coloured like the row ribbons. Used by the Create,
// Edit and action sheets so priority reads the same everywhere.
function MobilePriorityPicker({ value, onChange }: Props) {
    return (
        <div className="mmobile-priority-row">
            <span className="mmobile-priority-label" id="mmobile-priority-label">Priority</span>
            <div className="mmobile-priority-btns" role="radiogroup" aria-labelledby="mmobile-priority-label">
                {OPTIONS.map(option => {
                    const selected = value === option.value;
                    return (
                        <button
                            key={option.cls}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            className={`mmobile-priority-btn mmobile-priority-btn--${option.cls}${selected ? ' mmobile-priority-btn--active' : ''}`}
                            onClick={() => onChange(option.value)}
                        >
                            {option.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default MobilePriorityPicker;
