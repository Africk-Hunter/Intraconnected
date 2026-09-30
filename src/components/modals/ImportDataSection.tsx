import { useEffect, useRef, useState } from 'react';
import { useIdeaContext } from '../../context/IdeaContext';
import { ImportError, parseImportFiles, SUPPORTED_IMPORT_EXTENSIONS } from '../../utilities/idea/importers';
import { applyImport, ImportPlan, MAX_IMPORT_IDEAS, planImport } from '../../utilities/idea/importIdeas';

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
    const [state, setState] = useState<ImportState>({ step: 'idle' });
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

    const chooseButton = (label: string) => (
        <button className="profile-action-btn neobrutal-button" onClick={chooseFiles}>
            {label}
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
                        The Free plan has room for {room} more {room === 1 ? 'idea' : 'ideas'}. Upgrade for unlimited ideas to bring
                        everything over.
                    </p>
                    <div className="profile-export-buttons">
                        <button className="profile-action-btn neobrutal-button" onClick={onUpgrade}>Upgrade</button>
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
                <p className="profile-import-status" role="status">
                    Imported {state.count} {state.count === 1 ? 'idea' : 'ideas'} into “{state.title}” on your home screen.
                </p>
                <div className="profile-export-buttons">{chooseButton('Import another file')}</div>
            </>
        );
    } else {
        body = (
            <>
                {state.step === 'error' && <p className="profile-import-error" role="alert">{state.message}</p>}
                <div className="profile-export-buttons">{chooseButton('Choose file…')}</div>
            </>
        );
    }

    return (
        <section className="profile-section profile-section--import">
            <h3 className="profile-section-title">Import Data</h3>
            <p className="profile-section-desc">
                Bring your ideas over from Workflowy, XMind, MindNode, MindMeister, Obsidian, Notion and more. Accepts OPML,
                Markdown, Notion’s .zip export, plain text, FreeMind (.mm), XMind (.xmind) and Intraconnected JSON.
            </p>
            <input
                ref={inputRef}
                type="file"
                multiple
                accept={SUPPORTED_IMPORT_EXTENSIONS.join(',')}
                className="profile-import-input"
                onChange={(e) => handleFiles(e.target.files ? [...e.target.files] : [])}
            />
            {body}
        </section>
    );
}

export default ImportDataSection;
