import { forwardRef, useImperativeHandle, useRef } from 'react';
import { useAtom } from 'jotai';
import { contentJotai } from '../../jotais/file';
import styles from './source-editor.module.scss';

export interface SourceEditorHandle {
    /** Move the caret to the given offset and scroll it into view */
    scrollToOffset: (offset: number) => void;
}

/** Plain markdown source editing, like the source code mode of Typora */
const SourceEditor = forwardRef<SourceEditorHandle>((_, ref) => {
    const [content, setContent] = useAtom(contentJotai);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    /*
     * Height of the text before the offset, measured with a hidden mirror element.
     * A textarea doesn't expose the caret position, and setting the selection
     * doesn't always scroll while the editor doesn't have the focus.
     */
    const measureOffset = (element: HTMLTextAreaElement, offset: number) => {
        const style = window.getComputedStyle(element);
        const mirror = document.createElement('textarea');
        mirror.value = element.value.slice(0, offset);
        mirror.setAttribute('readonly', '');
        mirror.style.cssText = [
            'position: fixed',
            'top: -9999px',
            'left: -9999px',
            `width: ${element.clientWidth}px`,
            'height: 0',
            'overflow: hidden',
            `white-space: ${style.whiteSpace}`,
            `word-break: ${style.wordBreak}`,
            `font: ${style.font}`,
            `line-height: ${style.lineHeight}`,
            `padding: ${style.padding}`,
            `border: ${style.border}`,
            `box-sizing: ${style.boxSizing}`
        ].join(';');

        document.body.appendChild(mirror);
        const height = mirror.scrollHeight;
        mirror.remove();
        return height;
    };

    useImperativeHandle(ref, () => ({
        scrollToOffset: (offset: number) => {
            const element = textareaRef.current;
            if (!element) return;

            element.focus();
            element.setSelectionRange(offset, offset);

            const top = measureOffset(element, offset);
            element.scrollTop = Math.max(0, top - element.clientHeight / 3);
        }
    }));

    return (
        <textarea
            ref={textareaRef}
            className={styles.editor}
            spellCheck={false}
            value={content}
            onChange={(e) => setContent(e.target.value)}
        />
    );
});

SourceEditor.displayName = 'SourceEditor';

export default SourceEditor;
