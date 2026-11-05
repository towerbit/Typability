import React, { useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { contentJotai } from '../../jotais/file';
import { outlineJumpJotai } from '../../jotais/ui';
import styles from './source-editor.module.scss';

/** Plain markdown source editing, like the source code mode of Typora */
const SourceEditor: React.FC = () => {
    const [content, setContent] = useAtom(contentJotai);
    const [jump] = useAtom(outlineJumpJotai);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Move the caret to the heading picked in the outline
    useEffect(() => {
        const element = textareaRef.current;
        if (!jump || !element) return;

        element.focus();
        element.setSelectionRange(jump.offset, jump.offset);
    }, [jump]);

    return (
        <textarea
            ref={textareaRef}
            className={styles.editor}
            spellCheck={false}
            value={content}
            onChange={(e) => setContent(e.target.value)}
        />
    );
};

export default SourceEditor;
