import { Editor, editorViewCtx } from '@milkdown/core';
import { EditorView } from '@codemirror/view';
import parseHeadings from './headings';

interface Anchor {
    editor: number;
    source: number;
}

interface Point {
    a: number;
    b: number;
}

/** Ignore scroll events we caused ourselves while syncing */
const LOCK_MS = 150;
/** Rebuild the anchors at most this often while scrolling */
const REBUILD_MS = 500;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * Map a scroll position to the other side by interpolating between anchors(headings).
 * Headings always line up exactly, the text between two of them is interpolated linearly.
 */
function interpolate (top: number, points: Point[]) {
    if (points.length < 2) return null;

    const first = points[0];
    const last = points[points.length - 1];

    if (top <= first.a) {
        const slope = (points[1].b - first.b) / Math.max(1, points[1].a - first.a);
        return Math.max(0, first.b + (top - first.a) * slope);
    }

    for (let i = 0; i < points.length - 1; i += 1) {
        const from = points[i];
        const to = points[i + 1];
        if (top <= to.a) {
            const span = to.a - from.a;
            if (span <= 0) return to.b;
            return from.b + ((top - from.a) / span) * (to.b - from.b);
        }
    }

    const slope = (last.b - points[points.length - 2].b) / Math.max(1, last.a - points[points.length - 2].a);
    return last.b + (top - last.a) * slope;
}

/**
 * Keep the WYSIWYG pane and the source pane of the two-column editor in sync.
 * Returns a disposer.
 */
export default function attachSplitScrollSync (
    container: HTMLElement,
    getEditor: () => Editor | null
) {
    const editorScroller = container.querySelector<HTMLElement>('.milkdown');
    const sourceRoot = container.querySelector<HTMLElement>('.milkdown-split-editor');
    if (!editorScroller || !sourceRoot) return () => undefined;

    const cmRoot = sourceRoot.querySelector<HTMLElement>('.cm-editor') ?? sourceRoot;
    const cmView = EditorView.findFromDOM(cmRoot);
    if (!cmView) return () => undefined;

    const sourceScroller = cmView.scrollDOM;
    let anchors: Anchor[] = [];
    let lastBuild = 0;
    let editorLock = 0;
    let sourceLock = 0;

    const build = () => {
        lastBuild = Date.now();

        const instance = getEditor();
        if (!instance) return;

        const view = instance.ctx.get(editorViewCtx);
        // Use the code mirror document, it can differ from the markdown of the editor
        const headings = parseHeadings(cmView.state.doc.toString());
        const positions: number[] = [];

        view.state.doc.descendants((node, pos) => {
            if (node.type.name !== 'heading') return true;
            positions.push(pos);
            return false;
        });

        const scrollerTop = editorScroller.getBoundingClientRect().top;
        const next: Anchor[] = [];
        const count = Math.min(headings.length, positions.length);

        for (let i = 0; i < count; i += 1) {
            const dom = view.nodeDOM(positions[i]);
            if (!(dom instanceof HTMLElement)) continue;

            const offset = Math.min(headings[i].offset, cmView.state.doc.length);
            next.push({
                editor: dom.getBoundingClientRect().top - scrollerTop + editorScroller.scrollTop,
                source: cmView.lineBlockAt(offset).top
            });
        }

        anchors = next;
    };

    const ratioTarget = (from: HTMLElement, to: HTMLElement) => {
        const fromMax = from.scrollHeight - from.clientHeight;
        const toMax = to.scrollHeight - to.clientHeight;
        if (fromMax <= 0 || toMax <= 0) return null;
        return (from.scrollTop / fromMax) * toMax;
    };

    const sync = (from: HTMLElement, to: HTMLElement, key: 'editor' | 'source') => {
        if (Date.now() - lastBuild > REBUILD_MS) build();

        const points = key === 'editor'
            ? anchors.map((anchor) => ({ a: anchor.editor, b: anchor.source }))
            : anchors.map((anchor) => ({ a: anchor.source, b: anchor.editor }));

        const target = interpolate(from.scrollTop, points) ?? ratioTarget(from, to);
        if (target === null) return;

        return clamp(target, 0, to.scrollHeight - to.clientHeight);
    };

    const handleEditorScroll = () => {
        if (Date.now() - editorLock < LOCK_MS) return;

        const target = sync(editorScroller, sourceScroller, 'editor');
        if (target === undefined) return;

        sourceLock = Date.now();
        sourceScroller.scrollTop = target;
    };

    const handleSourceScroll = () => {
        if (Date.now() - sourceLock < LOCK_MS) return;

        const target = sync(sourceScroller, editorScroller, 'source');
        if (target === undefined) return;

        editorLock = Date.now();
        editorScroller.scrollTop = target;
    };

    editorScroller.addEventListener('scroll', handleEditorScroll, { passive: true });
    sourceScroller.addEventListener('scroll', handleSourceScroll, { passive: true });

    const observer = new ResizeObserver(() => build());
    observer.observe(editorScroller);
    observer.observe(sourceScroller);

    build();

    return () => {
        editorScroller.removeEventListener('scroll', handleEditorScroll);
        sourceScroller.removeEventListener('scroll', handleSourceScroll);
        observer.disconnect();
    };
}
