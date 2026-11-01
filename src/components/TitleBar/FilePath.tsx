import React, { useEffect, useRef, useState } from 'react';
import styles from './title-bar.module.scss';

const ELLIPSIS = '...';

/** Only the file name is shown, the full path is available as a tooltip */
function baseName (path: string) {
    return path.split(/[\\/]/).pop() || path;
}

/** Shrink the text in the middle, e.g. "C:\\Users\\very\\long\\path.md" -> "C:\\Users\\...\\path.md" */
function truncateMiddle (text: string, maxWidth: number, measure: (text: string) => number) {
    if (maxWidth <= 0) return '';
    if (measure(text) <= maxWidth) return text;

    let best = ELLIPSIS;
    let low = 0;
    let high = text.length;

    while (low <= high) {
        const keep = Math.floor((low + high) / 2);
        const headLength = Math.ceil(keep * 0.6);
        const tailLength = keep - headLength;
        const candidate = text.slice(0, headLength)
            + ELLIPSIS
            + (tailLength > 0 ? text.slice(-tailLength) : '');

        if (measure(candidate) <= maxWidth) {
            best = candidate;
            low = keep + 1;
        } else {
            high = keep - 1;
        }
    }

    return best;
}

interface FilePathProps {
    path: string;
}

const FilePath: React.FC<FilePathProps> = ({ path }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [display, setDisplay] = useState(baseName(path));

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const name = baseName(path);
        const context = document.createElement('canvas').getContext('2d');
        const update = () => {
            if (!context) {
                setDisplay(name);
                return;
            }
            const style = window.getComputedStyle(element);
            context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
            setDisplay(truncateMiddle(name, element.clientWidth, (text) => context.measureText(text).width));
        };

        update();
        const observer = new ResizeObserver(update);
        observer.observe(element);

        return () => observer.disconnect();
    }, [path]);

    return (
        <div
            ref={containerRef}
            data-tauri-drag-region
            className={styles.path}
            title={path}
        >
            {display}
        </div>
    );
};

export default FilePath;
