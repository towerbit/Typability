import React, { useMemo } from 'react';
import { useAtom } from 'jotai';
import { Editor, editorViewCtx } from '@milkdown/core';
import { TextSelection } from '@milkdown/prose/state';
import { contentJotai } from '../../jotais/file';
import { outlineJumpJotai, sourceViewJotai } from '../../jotais/ui';
import styles from './outline.module.scss';

interface Heading {
    level: number;
    text: string;
    /** Offset of the heading line in the markdown, used by the source view */
    offset: number;
}

/** Collect ATX headings, skipping fenced code blocks */
function parseHeadings (markdown: string) {
    const headings: Heading[] = [];
    let offset = 0;
    let fence: string | null = null;

    for (const line of markdown.split('\n')) {
        const trimmed = line.trim();

        const fenceMatch = /^(`{3,}|~{3,})/.exec(trimmed);
        if (fenceMatch) {
            if (fence === null) fence = fenceMatch[1][0];
            else if (fenceMatch[1][0] === fence) fence = null;
        } else if (fence === null) {
            const match = /^(#{1,6})\s+(.*)$/.exec(trimmed);
            if (match) {
                headings.push({
                    level: match[1].length,
                    text: match[2].replace(/#+$/, '').trim(),
                    offset
                });
            }
        }

        offset += line.length + 1;
    }

    return headings;
}

interface OutlineProps {
    editorInstance: {
        current?: Editor | null;
    };
}

const Outline: React.FC<OutlineProps> = ({ editorInstance }) => {
    const [content] = useAtom(contentJotai);
    const [sourceView] = useAtom(sourceViewJotai);
    const [, setJump] = useAtom(outlineJumpJotai);
    const headings = useMemo(() => parseHeadings(content), [content]);

    const jumpInEditor = (index: number) => {
        const instance = editorInstance.current;
        if (!instance) return;

        const view = instance.ctx.get(editorViewCtx);
        let current = 0;
        let target = -1;

        view.state.doc.descendants((node, pos) => {
            if (node.type.name !== 'heading') return true;
            if (current === index) {
                target = pos;
                return false;
            }
            current += 1;
            return false;
        });

        if (target < 0) return;

        const selection = TextSelection.near(view.state.doc.resolve(target + 1));
        view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
        view.focus();
    };

    return (
        <div className={styles.outline}>
            {headings.length === 0 && (
                <div className={styles.empty}>—</div>
            )}
            {headings.map((heading, index) => (
                <div
                    key={`${heading.offset}-${heading.text}`}
                    className={styles.item}
                    style={{ paddingLeft: `${(heading.level - 1) * 14 + 8}px` }}
                    title={heading.text}
                    onClick={() => {
                        if (sourceView) setJump({ offset: heading.offset, key: Date.now() });
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
