import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import { Editor, editorViewCtx } from '@milkdown/core';
import { TextSelection } from '@milkdown/prose/state';
import { contentJotai } from '../../jotais/file';
import { settingsJotai } from '../../jotais/settings';
import { outlineJotai, sourceViewJotai } from '../../jotais/ui';
import parseHeadings from '../../utils/headings';
import styles from './outline.module.scss';

const MIN_WIDTH = 300;
/** Space that always stays for the editor */
const MIN_EDITOR_WIDTH = 300;
const DEFAULT_WIDTH = 300;

const maxWidth = () => Math.max(MIN_WIDTH, window.innerWidth - MIN_EDITOR_WIDTH);
const clampWidth = (value: number) => Math.min(Math.max(value, MIN_WIDTH), maxWidth());

interface OutlineProps {
    editorInstance: {
        current?: Editor | null;
    };
    /** Move the caret of the source editor, used in the source code view */
    onJumpSource: (offset: number) => void;
}

const Outline: React.FC<OutlineProps> = ({ editorInstance, onJumpSource }) => {
    const [content] = useAtom(contentJotai);
    const [sourceView] = useAtom(sourceViewJotai);
    const [settings, setSettings] = useAtom(settingsJotai);
    const [, setOutline] = useAtom(outlineJotai);
    const headings = useMemo(() => parseHeadings(content), [content]);

    const storedWidth = clampWidth(settings.outlineWidth > 0 ? settings.outlineWidth : DEFAULT_WIDTH);
    const [width, setWidth] = useState(storedWidth);
    const widthRef = useRef(storedWidth);
    const rootRef = useRef<HTMLDivElement>(null);

    // Keep the width in sync when the setting changes from outside
    useEffect(() => {
        widthRef.current = storedWidth;
        setWidth(storedWidth);
    }, [storedWidth]);

    // Don't let the sidebar push the editor out when the window shrinks
    useEffect(() => {
        const onResize = () => {
            const max = maxWidth();
            if (widthRef.current <= max) return;
            widthRef.current = max;
            setWidth(max);
        };

        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const startDrag = useCallback((event: React.MouseEvent) => {
        event.preventDefault();

        const left = rootRef.current?.getBoundingClientRect().left ?? 0;
        let finished = false;

        const finish = () => {
            if (finished) return;
            finished = true;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        const onMove = (moveEvent: MouseEvent) => {
            const next = Math.min(moveEvent.clientX - left, maxWidth());

            // Dragging below the minimum width means hiding the sidebar
            if (next < MIN_WIDTH) {
                finish();
                setOutline(false);
                return;
            }

            widthRef.current = next;
            setWidth(next);
        };

        const onUp = () => {
            finish();
            const value = widthRef.current;
            setSettings((previous) => ({ ...previous, outlineWidth: value }));
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [setOutline, setSettings]);

    const jumpInEditor = (index: number) => {
        const instance = editorInstance.current;
        if (!instance) return;

        const view = instance.ctx.get(editorViewCtx);
        const positions: number[] = [];

        view.state.doc.descendants((node, pos) => {
            if (node.type.name !== 'heading') return true;
            positions.push(pos);
            return false;
        });

        const target = positions[index];
        if (target === undefined) return;

        const selection = TextSelection.near(view.state.doc.resolve(target + 1));
        view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
        view.focus();
    };

    return (
        <div ref={rootRef} className={styles.outline} style={{ width, flexBasis: width }}>
            <div className={styles.resizer} onMouseDown={startDrag} />
            {headings.length === 0 && (
                <div className={styles.empty}>—</div>
            )}
            {headings.map((heading, index) => (
                <div
                    key={`${heading.offset}-${heading.text}`}
                    className={styles.item}
                    style={{ paddingLeft: `${(heading.level - 1) * 14 + 8}px` }}
                    title={heading.text}
                    // Keep the focus where it is, the click is handled below
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                        if (sourceView) onJumpSource(heading.offset);
                        else jumpInEditor(index);
                    }}
                >
                    {heading.text}
                </div>
            ))}
        </div>
    );
};

export default Outline;
