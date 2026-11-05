import { writeBinaryFile, writeTextFile } from '@tauri-apps/api/fs';
import showdown from 'showdown';
// Bundled as a plain asset, the library uses `with` statements that rollup can't parse
import docxScriptUrl from 'html-docx-js/dist/html-docx.js?url';

const converter = new showdown.Converter({ tables: true, strikethrough: true, tasklists: true });

/** Styles used by the exported pdf/docx, they can't rely on the app stylesheet */
const EXPORT_STYLE = `
    body, div { font-family: 'Segoe UI', 'Microsoft YaHei', Arial, sans-serif; color: #1f2328; }
    h1 { font-size: 28px; border-bottom: 1px solid #d8dee4; padding-bottom: 6px; }
    h2 { font-size: 22px; border-bottom: 1px solid #d8dee4; padding-bottom: 4px; }
    h3 { font-size: 18px; }
    h4 { font-size: 16px; }
    h5, h6 { font-size: 14px; }
    p, li { font-size: 14px; line-height: 1.7; }
    code { font-family: Consolas, 'Courier New', monospace; background: #f6f8fa; padding: 1px 4px; border-radius: 3px; }
    pre { background: #f6f8fa; padding: 12px; border-radius: 4px; overflow: hidden; }
    pre code { background: transparent; padding: 0; }
    blockquote { border-left: 4px solid #d0d7de; margin: 0; padding: 0 12px; color: #57606a; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d0d7de; padding: 6px 10px; font-size: 13px; }
    img { max-width: 100%; }
`;

function bodyHtml (markdown: string) {
    return converter.makeHtml(markdown);
}

function documentHtml (markdown: string) {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>${EXPORT_STYLE}</style>
</head>
<body>${bodyHtml(markdown)}</body>
</html>`;
}

export async function exportAsHtml (path: string, markdown: string) {
    await writeTextFile({ path, contents: documentHtml(markdown) });
}

export async function exportAsPdf (path: string, markdown: string) {
    // A4 at 96dpi, the element is kept out of sight while it's being rendered
    const container = document.createElement('div');
    container.style.cssText = 'position: fixed; left: -10000px; top: 0; width: 794px; background: #ffffff;';
    container.innerHTML = `<style>${EXPORT_STYLE}</style>${bodyHtml(markdown)}`;
    document.body.appendChild(container);

    try {
        // Loaded on demand, the library is heavy
        const { default: html2pdf } = await import('html2pdf.js');

        const pdf = await html2pdf()
            .set({
                margin: 10,
                image: { type: 'jpeg', quality: 0.95 },
                html2canvas: { scale: 2, backgroundColor: '#ffffff', useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            })
            .from(container)
            .outputPdf('arraybuffer');

        await writeBinaryFile({ path, contents: new Uint8Array(pdf as ArrayBuffer) });
    } finally {
        container.remove();
    }
}

interface DocxLibrary {
    asBlob: (html: string, options?: {
        orientation?: 'portrait' | 'landscape';
        margins?: { top?: number; right?: number; bottom?: number; left?: number };
    }) => Blob;
}

let docxLibrary: Promise<DocxLibrary> | null = null;

function loadDocxLibrary () {
    if (docxLibrary) return docxLibrary;

    docxLibrary = new Promise<DocxLibrary>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = docxScriptUrl;
        script.onload = () => {
            const library = (window as unknown as { htmlDocx?: DocxLibrary }).htmlDocx;
            if (library) resolve(library);
            else reject(new Error('html-docx is not available'));
        };
        script.onerror = () => reject(new Error('failed to load html-docx'));
        document.head.appendChild(script);
    });

    return docxLibrary;
}

export async function exportAsDocx (path: string, markdown: string) {
    const library = await loadDocxLibrary();

    const blob = library.asBlob(documentHtml(markdown), {
        orientation: 'portrait',
        margins: { top: 1080, right: 1080, bottom: 1080, left: 1080 }
    });

    await writeBinaryFile({ path, contents: new Uint8Array(await blob.arrayBuffer()) });
}
