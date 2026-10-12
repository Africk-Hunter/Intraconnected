import { openReport, type ReportContext } from '../utilities/reportProblem';

interface Props extends ReportContext {
    className?: string;
    label?: string;
}

// The "Send a report" affordance dropped next to any visible error. Reads as a
// text link inside a message; pass a className to style it as a button instead.
function ReportLink({ area, error, className = 'report-link', label = 'Send a report' }: Props) {
    return (
        <button type="button" className={className} onClick={() => openReport({ area, error })}>
            {label}
        </button>
    );
}

export default ReportLink;
