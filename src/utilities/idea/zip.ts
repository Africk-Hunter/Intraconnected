// Minimal zip reader for the import formats that arrive zipped (.xmind,
// Notion's Markdown export). Reads the central directory and inflates with
// the platform's DecompressionStream, so no dependency is added. Supports
// stored and deflated entries; ZIP64 and encrypted archives are rejected.

export interface ZipEntry {
    name: string;
    data: Uint8Array;
}

export class ZipError extends Error {}

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function isZip(bytes: Uint8Array): boolean {
    return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

export async function readZip(bytes: Uint8Array, wanted: (name: string) => boolean = () => true): Promise<ZipEntry[]> {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    // The end-of-central-directory record sits in the last 22 bytes plus an
    // optional comment of up to 64 KiB.
    let eocd = -1;
    for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 22 - 0xFFFF); p--) {
        if (view.getUint32(p, true) === EOCD_SIG) {
            eocd = p;
            break;
        }
    }
    if (eocd === -1) throw new ZipError('Not a zip file, or it is damaged.');

    const count = view.getUint16(eocd + 10, true);
    let offset = view.getUint32(eocd + 16, true);
    if (count === 0xFFFF || offset === 0xFFFFFFFF) throw new ZipError('This zip is too large to import (ZIP64).');

    const decoder = new TextDecoder('utf-8');
    const entries: ZipEntry[] = [];
    for (let n = 0; n < count; n++) {
        if (offset + 46 > bytes.length || view.getUint32(offset, true) !== CENTRAL_SIG) throw new ZipError('The zip file is damaged.');
        const flags = view.getUint16(offset + 8, true);
        const method = view.getUint16(offset + 10, true);
        const compressedSize = view.getUint32(offset + 20, true);
        const nameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        const localOffset = view.getUint32(offset + 42, true);
        const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
        offset += 46 + nameLength + extraLength + commentLength;

        if (name.endsWith('/') || !wanted(name)) continue;
        if (flags & 0x1) throw new ZipError('Encrypted zip files can’t be imported.');
        if (view.getUint32(localOffset, true) !== LOCAL_SIG) throw new ZipError('The zip file is damaged.');
        const start = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
        const raw = bytes.subarray(start, start + compressedSize);
        if (method === 0) entries.push({ name, data: raw });
        else if (method === 8) entries.push({ name, data: await inflateRaw(raw) });
        else throw new ZipError(`Unsupported zip compression (method ${method}).`);
    }
    return entries;
}
