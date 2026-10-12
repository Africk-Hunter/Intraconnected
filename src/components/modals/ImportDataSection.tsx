import ReportLink from '../ReportLink';
import { useEffect, useRef, useState } from 'react';
import { useIdeaContext } from '../../context/IdeaContext';
import { ImportError, parseImportFiles, SUPPORTED_IMPORT_EXTENSIONS } from '../../utilities/idea/importers';
import { applyImport, ImportPlan, MAX_IMPORT_IDEAS, planImport } from '../../utilities/idea/importIdeas';
import { usePurchaseMode } from '../../utilities/billing/purchaseMode';

// The File System Access picker (Chrome/Edge). Not in TypeScript's DOM lib yet.
type OpenFilePicker = (options: {
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
    types?: { description: string; accept: Record<string, string[]> }[];
}) => Promise<{ getFile: () => Promise<File> }[]>;

const PICKER_TYPES = [{
    description: 'Mind maps, outlines & notes',
    // Chrome filters on the extensions; the MIME key just has to be valid.
    accept: { 'application/octet-stream': SUPPORTED_IMPORT_EXTENSIONS },
}];

// Handed to an AI along with the user's notes; the answer is a Markdown outline
// that the Markdown importer in importers.ts reads directly.
const AI_PROMPT = `Turn the notes I give you into a nested Markdown bullet list for import into a mind-mapping app.

Rules:
- Output only the list, in one code block, with no commentary.
- One idea per line, starting with "- ".
- Indent a child idea by 2 spaces under its parent. Group related ideas under a short parent idea.
- Keep each idea short, a phrase or one sentence, and keep my wording where you can.
- If an idea has a web link, write it as [text](https://example.com).
- No headings, tables, bold, italics or emojis.
- Do not invent ideas that are not in my notes.

My notes:
`;

const FORMAT_CHIPS = ['OPML', 'Markdown', 'Notion .zip', 'Plain text', 'FreeMind', 'XMind', 'CSV', 'JSON'];

type ImportState =
    | { step: 'idle' }
    | { step: 'reading' }
    | { step: 'preview'; plan: ImportPlan; title: string; format: string; skipped: number }
    | { step: 'done'; count: number; title: string }
    | { step: 'error'; message: string };

// Profile → Import Data. Reads another app's export entirely in the browser
// (see importers.ts for the formats) and adds it under one new top-level
// idea, so an import never mixes into existing ideas and is one drag to undo.
function ImportDataSection({ onUpgrade }: { onUpgrade: () => void }) {
    const { profileModalOpen, setNewIdeaSwitch } = useIdeaContext();
    const canUpgrade = usePurchaseMode() !== 'none';
    const [state, setState] = useState<ImportState>({ step: 'idle' });
    const [promptCopied, setPromptCopied] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!profileModalOpen) setState({ step: 'idle' });
    }, [profileModalOpen]);

    // Chrome and Edge build the Windows dialog's filter from an <input accept>
    // list on their own terms (it came up showing only .opml), so there the
    // picker API is used instead: one named filter with every supported type,
    // selected by default, plus "All files". Firefox and Safari don't have the
    // API and fall back to the input's accept list.
    async function chooseFiles() {
        const picker = (window as unknown as { showOpenFilePicker?: OpenFilePicker }).showOpenFilePicker;
        if (!picker) {
            inputRef.current?.click();
            return;
        }
        let handles;
        try {
            handles = await picker({ multiple: true, excludeAcceptAllOption: false, types: PICKER_TYPES });
        } catch (error) {
            if ((error as DOMException).name === 'AbortError') return; // dialog closed
            inputRef.current?.click(); // e.g. blocked inside an iframe
            return;
        }
        await handleFiles(await Promise.all(handles.map((handle) => handle.getFile())));
    }

    async function handleFiles(files: File[]) {
        if (inputRef.current) inputRef.current.value = '';
        if (files.length === 0) return;
        setState({ step: 'reading' });
        try {
            const parsed = await parseImportFiles(
                await Promise.all(files.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }))),
            );
            const plan = planImport(parsed);
            if (plan.ideas.length <= 1) throw new ImportError('No ideas were found in that file.');
            setState({ step: 'preview', plan, title: parsed.title, format: parsed.format, skipped: parsed.skipped.length });
        } catch (error) {
            console.error('Import failed:', error);
            setState({ step: 'error', message: error instanceof ImportError ? error.message : 'That file couldn’t be read.' });
        }
    }

    function handleConfirm() {
        if (state.step !== 'preview') return;
        try {
            applyImport(state.plan);
            setNewIdeaSwitch((prev: boolean) => !prev);
            setState({ step: 'done', count: state.plan.ideas.length, title: state.title });
        } catch (error) {
            setState({ step: 'error', message: error instanceof ImportError ? error.message : 'The import couldn’t be saved.' });
        }
    }

    async function copyPrompt() {
        try {
            await navigator.clipboard.writeText(AI_PROMPT);
            setPromptCopied(true);
            window.setTimeout(() => setPromptCopied(false), 2000);
        } catch {
            // Clipboard blocked: nothing useful to do, the button just stays as is.
        }
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        setDragOver(false);
        void handleFiles([...e.dataTransfer.files]);
    }

    const chooseButton = (label: string) => (
        <button className="profile-action-btn neobrutal-button" onClick={chooseFiles}>
            {label}
        </button>
    );

    // A touch screen has nothing to drop from, so it gets the short label.
    const dropzone = (pointerLabel: string, touchLabel: string) => (
        <button
            type="button"
            className={`profile-dropzone${dragOver ? ' profile-dropzone--over' : ''}`}
            onClick={chooseFiles}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            // Moving onto the zone's own children fires dragleave too; only clear on a real exit.
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false); }}
            onDrop={handleDrop}
        >
            <svg className="profile-dropzone-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 16V4M7 9l5-5 5 5M5 20h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="profile-dropzone-text">
                <span className="profile-dropzone-title">
                    <span className="profile-dropzone-pointer">{pointerLabel}</span>
                    <span className="profile-dropzone-touch">{touchLabel}</span>
                </span>
                <span className="profile-dropzone-hint">Up to {MAX_IMPORT_IDEAS.toLocaleString()} ideas per import</span>
            </span>
        </button>
    );

    let body: React.ReactNode;
    if (state.step === 'reading') {
        body = <p className="profile-import-status" role="status">Reading…</p>;
    } else if (state.step === 'preview') {
        const count = state.plan.ideas.length;
        const room = state.plan.freeRoom;
        const summary = (
            <p className="profile-import-status" role="status">
                Found <strong>{count} {count === 1 ? 'idea' : 'ideas'}</strong> ({state.format}). They’ll be added under a new
                top-level idea, “{state.title}”.
                {state.skipped > 0 && ` ${state.skipped} other ${state.skipped === 1 ? 'file' : 'files'} (images, tables, etc.) will be skipped.`}
            </p>
        );
        if (count > MAX_IMPORT_IDEAS) {
            body = (
                <>
                    {summary}
                    <p className="profile-import-error">
                        That’s more than the {MAX_IMPORT_IDEAS} ideas one import can hold. Try exporting a smaller part of your map.
                    </p>
                    <div className="profile-export-buttons">{chooseButton('Choose another file')}</div>
                </>
            );
        } else if (room !== null && count > room) {
            body = (
                <>
                    {summary}
                    <p className="profile-import-error">
                        The Free plan has room for {room} more {room === 1 ? 'idea' : 'ideas'}.{' '}
                        {canUpgrade ? 'Upgrade for unlimited ideas to bring everything over.' : 'Import fewer ideas, or delete some first.'}
                    </p>
                    <div className="profile-export-buttons">
                        {canUpgrade && <button className="profile-action-btn neobrutal-button" onClick={onUpgrade}>Upgrade</button>}
                        <button className="profile-action-btn neutral neobrutal-button" onClick={() => setState({ step: 'idle' })}>Cancel</button>
                    </div>
                </>
            );
        } else {
            body = (
                <>
                    {summary}
                    <div className="profile-export-buttons">
                        <button className="profile-action-btn neobrutal-button" onClick={handleConfirm}>Import {count} {count === 1 ? 'idea' : 'ideas'}</button>
                        <button className="profile-action-btn neutral neobrutal-button" onClick={() => setState({ step: 'idle' })}>Cancel</button>
                    </div>
                </>
            );
        }
    } else if (state.step === 'done') {
        body = (
            <>
                <div className="profile-import-success" role="status">
                    <svg className="profile-import-success-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" fill="currentColor" />
                        <path d="M7 12.5l3.2 3.2L17 8.8" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div>
                        <p className="profile-import-success-title">Import complete</p>
                        <p className="profile-import-success-text">
                            Added {state.count} {state.count === 1 ? 'idea' : 'ideas'} under “{state.title}” on your home screen.
                        </p>
                    </div>
                </div>
                {dropzone('Drop another file or click to choose', 'Import another file')}
            </>
        );
    } else {
        body = (
            <>
                {state.step === 'error' && <p className="profile-import-error" role="alert">{state.message} <ReportLink area="import" error={state.message} /></p>}
                {dropzone('Drop files here or click to choose', 'Choose files')}
            </>
        );
    }

    return (
        <section className="profile-section profile-section--import">
            <h3 className="profile-section-title">Import Data</h3>
            <p className="profile-section-desc">
                Bring ideas over from Workflowy, Notion, Obsidian, XMind and more. They’re added under one new top-level idea.
            </p>
            <ul className="profile-format-chips" aria-label="Supported formats">
                {FORMAT_CHIPS.map((chip, i) => <li key={chip} className={`profile-format-chip--${i % 4}`}>{chip}</li>)}
            </ul>
            <div className="profile-import-body" key={state.step}>{body}</div>
            <p className="profile-import-ai">
                Have unstructured notes?{' '}
                <button type="button" className="profile-link-btn" onClick={copyPrompt}>
                    {promptCopied ? 'Copied' : 'Copy an AI prompt'}
                </button>
                {' '}to turn them into an outline, save its answer as a .md file and import it above.
            </p>
            <input
                ref={inputRef}
                type="file"
                multiple
                accept={SUPPORTED_IMPORT_EXTENSIONS.join(',')}
                className="profile-import-input"
                onChange={(e) => handleFiles(e.target.files ? [...e.target.files] : [])}
            />
        </section>
    );
}

export default ImportDataSection;
