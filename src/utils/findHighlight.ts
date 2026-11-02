import { Plugin, PluginKey } from '@milkdown/prose/state';
import { Decoration, DecorationSet } from '@milkdown/prose/view';
import type { EditorView } from '@milkdown/prose/view';

interface Match {
    from: number;
    to: number;
}

interface HighlightMeta {
    matches: Match[];
    /** Index of the current match, -1 means no current one */
    current: number;
}

export const findHighlightKey = new PluginKey<DecorationSet>('find-highlight');

/*
 * Find/replace only changes the editor selection, and ProseMirror doesn't paint the
 * selection while the editor isn't focused(the focus is in the find input), so the
 * matches were invisible. Highlight them with decorations instead.
 */
export const findHighlightPlugin = new Plugin<DecorationSet>({
    key: findHighlightKey,
    state: {
        init: () => DecorationSet.empty,
        apply (tr, value) {
            const meta = tr.getMeta(findHighlightKey) as HighlightMeta | undefined;
            if (meta) {
                return DecorationSet.create(
                    tr.doc,
                    meta.matches.map((match, index) => Decoration.inline(match.from, match.to, {
                        class: index === meta.current ? 'find-match find-match-current' : 'find-match'
                    }))
                );
            }

            if (tr.docChanged) return DecorationSet.empty;
            return value.map(tr.mapping, tr.doc);
        }
    },
    props: {
        decorations (state) {
            return findHighlightKey.getState(state);
        }
    }
});

export function highlightMatches (view: EditorView, matches: Match[], current: number) {
    view.dispatch(view.state.tr.setMeta(findHighlightKey, { matches, current }));
}

export function clearFindHighlights (view: EditorView) {
    view.dispatch(view.state.tr.setMeta(findHighlightKey, { matches: [], current: -1 }));
}
