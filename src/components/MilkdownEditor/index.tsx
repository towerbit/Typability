import React, { forwardRef, useEffect, useRef } from 'react';
import { Editor, rootCtx, defaultValueCtx, commandsCtx, editorViewCtx, EditorStatus } from '@milkdown/core';
import { nord, nordDark } from '@milkdown/theme-nord';
import { ReactEditor, useEditor } from '@milkdown/react';
import { commonmark, heading as commonmarkHeading } from '@milkdown/preset-commonmark';
import { tooltip } from '@milkdown/plugin-tooltip';
import { gfm, heading as gfmHeading } from '@milkdown/preset-gfm';
import { menu } from '@milkdown/plugin-menu';
import { slash } from '@milkdown/plugin-slash';
import '@material-design-icons/font';
import { history } from '@milkdown/plugin-history';
import { replaceAll, switchTheme } from '@milkdown/utils';
import { prismPlugin } from '@milkdown/plugin-prism';
import { clipboard } from '@milkdown/plugin-clipboard';
import { tokyo } from '@milkdown/theme-tokyo';
import { diagram } from '@milkdown/plugin-diagram';
import { block } from '@milkdown/plugin-block';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { useUpdateEffect } from 'ahooks';
import { refractor } from 'refractor/lib/common';
import { math } from '@milkdown/plugin-math';
import { cursor } from '@milkdown/plugin-cursor';
import 'katex/dist/katex.min.css';
import { splitEditing, ToggleSplitEditing } from '@milkdown-lab/plugin-split-editing';
import enhanceLinkTooltip from '../../utils/linkTooltip';

interface MilkdownEditor {
    content: string;
    useMenu?: boolean;
    useSlash?: boolean;
    twoColumnEditor?: boolean;
    syntaxOption?: keyof typeof syntaxMap;
    theme?: keyof typeof themeMap;
    onMarkdownUpdated?: (markdown: string, prevMarkdown: string | null) => void;
    /** Called with the editor's markdown after the content was replaced programmatically(e.g. opening a file) */
    onContentLoaded?: (markdown: string) => void;
    ref?: React.LegacyRef<Editor>;
}

const syntaxMap = {
    'gfm': gfm.configure(gfmHeading, {
        className: (attrs) => `milkdownHeading h${attrs.level}`
    }),
    'commonmark': commonmark.configure(commonmarkHeading, {
        className: (attrs) => `milkdownHeading h${attrs.level}`
    })
};

const themeMap = {
    'nord': nord,
    'nordDark': nordDark,
    'tokyo': tokyo
};

let currentContent = '';
let currentTheme = '';
/*
 * Set while the content is being replaced programmatically, so that the
 * resulting markdown update isn't reported as a user modification.
 */
let pendingReplace = false;

const MilkdownEditor: React.FC<MilkdownEditor> = forwardRef<Editor, MilkdownEditor>(({
    content,
    useMenu = false,
    useSlash = false,
    syntaxOption = 'gfm',
    theme = 'nord',
    onMarkdownUpdated,
    onContentLoaded,
    twoColumnEditor = false
}, ref) => {
    // Keep the latest callbacks, the editor is created only once
    const callbacks = useRef({ onMarkdownUpdated, onContentLoaded });
    useEffect(() => {
        callbacks.current = { onMarkdownUpdated, onContentLoaded };
    });
    useEffect(() => {
        if (ref) {
            if (typeof ref === 'function') ref(getInstance() ?? null);
            else ref.current = getInstance() ?? null;
        }
    });

    useEffect(() => {
        setTimeout(() => {
            const instance = getInstance();
            if (!instance || instance.status !== EditorStatus.Created) return;
            instance.action((ctx) => {
                const commandManager = ctx.get(commandsCtx);
                commandManager.call(ToggleSplitEditing);
            });
        }, 1);
    }, [twoColumnEditor]);

    useUpdateEffect(() => {
        if (!loading) {
            const instance = getInstance();
            if (content !== currentContent) {
                /*
                 * Milkdown's replaceAll dispatches synchronously, so the markdown update
                 * it causes is the only one reported while this flag is set.
                 */
                pendingReplace = true;
                instance?.action(replaceAll(content));
                pendingReplace = false;
                currentContent = content;
            }
            if (theme !== currentTheme) {
                instance?.action(switchTheme(themeMap[theme]));
                currentTheme = theme;
            }
        }
    }, [content, theme, syntaxOption, useSlash]);

    const { editor, loading, getInstance } = useEditor((root) => {
        currentContent = content;
        currentTheme = theme;
        const instance = Editor.make()
            .config((ctx) => {
                ctx.set(defaultValueCtx, content);
                ctx.set(rootCtx, root);
                const listener = ctx.get(listenerCtx);
                listener.markdownUpdated((ctx, markdown, prevMarkdown) => {
                    if (markdown === prevMarkdown) return;
                    // Content was replaced by us(open a file, etc.), so it's not a user modification
                    if (pendingReplace) {
                        pendingReplace = false;
                        currentContent = markdown;
                        callbacks.current.onContentLoaded?.(markdown);
                        return;
                    }
                    // Don't trigger when editor is initializing
                    if (prevMarkdown !== null) callbacks.current.onMarkdownUpdated?.(markdown, prevMarkdown);
                    currentContent = markdown;
                });

            }).use(syntaxMap[syntaxOption])
            .use(listener)
            .use(prismPlugin({
                configureRefractor: () => refractor
            }))
            .use(clipboard)
            .use(history)
            .use(cursor)
            .use(math)
            .use(tooltip)
            .use(diagram)
            .use(themeMap[theme])
            .use(block)
            .use(splitEditing);

        if (useMenu) instance.use(menu);
        if (useSlash) instance.use(slash);

        return instance;
    });

    // Widen the link chip and add an "OPEN" button to it
    useEffect(() => {
        if (loading) return;

        const instance = getInstance();
        if (!instance) return;

        const container = instance.ctx.get(editorViewCtx).dom.parentElement;
        if (!container) return;

        return enhanceLinkTooltip(container);
    }, [loading]);

    return <ReactEditor editor={editor} />;
});

function areEqual (prevProps: Readonly<MilkdownEditor>, nextProps: Readonly<MilkdownEditor>) {
    if (prevProps !== nextProps) {
        for (const nextProp in nextProps) {
            if (nextProps[nextProp as keyof typeof nextProps] !== prevProps[nextProp as keyof typeof prevProps]) {
                // Don't refresh if content is equal
                if (nextProp === 'content' && nextProps.content === currentContent) continue;
                // Syntax cannot be removed as a plugin, ignore it before re-create editor.
                if (nextProp === 'syntaxOption') continue;
                // For Milkdown Editor, Function is a constant, don't update
                if (typeof nextProps[nextProp as keyof typeof nextProps] === 'function') continue;
                return false;
            }
        }
    }
    return true;
}

MilkdownEditor.displayName = 'MilkdownEditor';

export default React.memo(MilkdownEditor, areEqual);