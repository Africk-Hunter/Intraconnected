// Saves text as a file via a Blob/object URL. The URL is revoked on the next
// tick rather than right after click(), since some browsers (Safari) start the
// download asynchronously and would otherwise get a dead URL.
export function downloadFile(contents: string, mimeType: string, filename: string): void {
    const blob = new Blob([contents], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
