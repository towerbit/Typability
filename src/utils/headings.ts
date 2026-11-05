export interface HeadingInfo {
    level: number;
    text: string;
    /** Offset of the heading line in the markdown */
    offset: number;
}

/** Collect ATX headings, skipping fenced code blocks */
export default function parseHeadings (markdown: string) {
    const headings: HeadingInfo[] = [];
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
