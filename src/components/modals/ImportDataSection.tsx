import ReportLink from '../ReportLink';
import { useEffect, useRef, useState } from 'react';
import { useIdeaContext } from '../../context/IdeaContext';
import { ImportError, parseImportFiles, SUPPORTED_IMPORT_EXTENSIONS } from '../../utilities/idea/importers';
import { applyImport, DAILY_IMPORT_LIMIT, ImportPlan, planImport } from '../../utilities/idea/importIdeas';
import { SUPPORT_EMAIL } from '../../utilities/support';
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
const AI_PROMPT = `Turn the notes I give you into a nested Markdown outline for import into Intraconnected, a mind-mapping app. The app stores four kinds of item. Decide which kind each piece of my notes is, and write it in the matching form.

The four kinds:

1. IDEA. A short thought: a phrase or one sentence. It can have child ideas, and that is how the map gets its structure. Use it for topics, goals, questions, categories and anything that other things hang under.
   - Parent idea
     - Child idea

2. CHECKLIST. A set of to-do items that get ticked off. A checklist cannot contain ideas, only items, so use it only when every child is a task (shopping lists, steps, packing lists). Write the checklist's title as a bullet, then every item under it as "- [ ]" (open) or "- [x]" (already done). Do not make a checklist out of things that are not tasks.
   - Packing list
     - [ ] Passport
     - [x] Book flights

3. NOTE. A longer piece of text that is read, not ticked or expanded: a paragraph, a quote, meeting minutes, a description. A note cannot have children. Write a short title as a bullet, then a blank line, then the body indented under it by 4 spaces. Use it when the text is more than a sentence or two.
   - Meeting recap

       We agreed to ship the beta in March. Pricing still needs a decision.

4. LINK. An idea that points to a web page. Clicking it opens the address. A link cannot have children, so if the thing has sub-ideas, make it an ordinary idea and put the link as a child. Write it as [text](https://example.com) with a full http(s) address.
   - [Design reference](https://example.com)

Make full use of all four kinds. A map made only of ideas is a poor result. Go through my notes item by item and ask:
- Is it a list of things to do, buy, pack, check or finish? Make it a CHECKLIST, with items I have already done marked [x]. Never spread a to-do list across separate ideas.
- Is it a paragraph, a description, a quote, a rationale, meeting notes, or any text longer than about one sentence? Make it a NOTE. Never squeeze long text into an idea or split it into fragments.
- Does it mention a URL, a website, a document, a tool or a resource with an address? Make it a LINK (or a link child under its idea).
- Is it a short topic, goal, question or category that other things belong under? Make it an IDEA.
Most real notes mix all four, so expect a mix: ideas for the structure, with checklists, notes and links as the leaves under them. Keep structure shallow, 3 levels at most, and avoid parents that hold only one child.

Priority: add (P1) for high, (P2) for medium or (P3) for low at the end of an idea, checklist, note or link. Use it for anything my notes call urgent, important, blocking or time-sensitive, or that is clearly more or less important than its siblings. Leave it off the rest.

Rules:
- If you can create files, give me the outline as a downloadable file named intraconnected-import.md (plain Markdown text). If you can't, output it in one code block instead. Either way, add no commentary.
- Every line starts with "- ". Indent children by 2 spaces under their parent. No headings, tables, bold, italics or emojis.
- Group related items under a short parent idea so the map has a clear shape.
- Keep idea titles short and keep my wording where you can. Note bodies and checklist items can be as long as the content needs.
- Do not invent anything that is not in my notes, but do use every detail in them: nothing should be dropped just because it doesn't fit as an idea.

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
    const [showPaste, setShowPaste] = useState(false);
    const [pasteText, setPasteText] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!profileModalOpen) {
            setState({ step: 'idle' });
            setShowPaste(false);
            setPasteText('');
        }
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
        await readImport(() => Promise.all(files.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }))));
    }

    // Pasted text is read as a Markdown file, which also covers plain outlines.
    async function handlePaste() {
        const text = pasteText.trim();
        if (!text) return;
        await readImport(async () => [{ name: 'pasted.md', bytes: new TextEncoder().encode(text) }]);
    }

    async function readImport(load: () => Promise<{ name: string; bytes: Uint8Array }[]>) {
        setState({ step: 'reading' });
        try {
            const parsed = await parseImportFiles(await load());
            const plan = planImport(parsed);
            if (plan.ideas.length <= 1) throw new ImportError('No ideas were found in that file.');
            setState({ step: 'preview', plan, title: parsed.title, format: parsed.format, skipped: parsed.skipped.length });
        } catch (error) {
            console.error('Import failed:', error);
            setState({ step: 'error', message: error instanceof ImportError ? error.message : 'That file couldn’t be read.' });
        }
    }

    function handleConfirm(useException = false) {
        if (state.step !== 'preview') return;
        try {
            applyImport(state.plan, { useException });
            setNewIdeaSwitch((prev: boolean) => !prev);
            setPasteText('');
            setShowPaste(false);
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
                <span className="profile-dropzone-hint">Up to {DAILY_IMPORT_LIMIT.toLocaleString()} ideas per 24 hours</span>
            </span>
        </button>
    );

    const pasteArea = showPaste ? (
        <div className="profile-import-paste">
            <textarea
                className="profile-import-paste-input"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste an outline here, such as the AI's answer"
                aria-label="Pasted outline"
                rows={6}
            />
            <div className="profile-export-buttons">
                <button className="profile-action-btn neobrutal-button" onClick={handlePaste} disabled={!pasteText.trim()}>Read text</button>
                <button className="profile-action-btn neutral neobrutal-button" onClick={() => { setShowPaste(false); setPasteText(''); }}>Cancel</button>
            </div>
        </div>
    ) : (
        <p className="profile-import-ai">
            Or{' '}
            <button type="button" className="profile-link-btn" onClick={() => setShowPaste(true)}>paste text</button>
            {' '}instead of using a file.
        </p>
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
        if (count > state.plan.dailyRoom) {
            const { dailyRoom, exceptionsLeft } = state.plan;
            const roomText = dailyRoom > 0
                ? `You can import ${dailyRoom} more ${dailyRoom === 1 ? 'idea' : 'ideas'} in the next 24 hours.`
                : `You’ve reached the limit of ${DAILY_IMPORT_LIMIT.toLocaleString()} imported ideas per 24 hours.`;
            body = (
                <>
                    {summary}
                    <p className="profile-import-error">
                        {roomText}{' '}
                        {exceptionsLeft > 0
                            ? `You can make an exception ${exceptionsLeft === 1 ? 'one more time' : `${exceptionsLeft} more times`} on this account, or try a smaller file.`
                            : <>You’ve used all your exceptions. To import more, contact <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</>}
                    </p>
                    <div className="profile-export-buttons">
                        {exceptionsLeft > 0 && (
                            <button className="profile-action-btn neobrutal-button" onClick={() => handleConfirm(true)}>
                                Import anyway ({exceptionsLeft} left)
                            </button>
                        )}
                        {chooseButton('Choose another file')}
                    </div>
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
                        <button className="profile-action-btn neobrutal-button" onClick={() => handleConfirm()}>Import {count} {count === 1 ? 'idea' : 'ideas'}</button>
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
                {pasteArea}
            </>
        );
    } else {
        body = (
            <>
                {state.step === 'error' && <p className="profile-import-error" role="alert">{state.message} <ReportLink area="import" error={state.message} /></p>}
                {dropzone('Drop files here or click to choose', 'Choose files')}
                {pasteArea}
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
                {' '}to turn them into an outline, then paste its answer or save it as a .md file and import it.
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
