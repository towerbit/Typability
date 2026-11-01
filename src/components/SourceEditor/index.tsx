import React from 'react';
import { useAtom } from 'jotai';
import { contentJotai } from '../../jotais/file';
import styles from './source-editor.module.scss';

/** Plain markdown source editing, like the source code mode of Typora */
const SourceEditor: React.FC = () => {
    const [content, setContent] = useAtom(contentJotai);

    return (
        <textarea
            className={styles.editor}
            spellCheck={false}
            value={content}
            onChange={(e) => setContent(e.target.value)}
        />
    );
};

export default SourceEditor;
