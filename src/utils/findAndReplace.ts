import { TextSelection, Transaction } from '@milkdown/prose/state';

function makeSafeRegExpStr (str: string) {
    const modifiedStr = str.split('');
    const indices = [...str.matchAll(/[|\\{}()[\]^$+*?.]/g)].map(a => a.index);
    if (!indices) return str;
    for (const index of indices as number[]) {
        modifiedStr[index] = `\\${modifiedStr[index]}`;
    }
    return modifiedStr.join('');
}

// @todo make it a milkdown plugin
export class Finder {
    tr: Transaction;
    caseSensitive: boolean;
    /**
     * Finder to find string in Milkdown/ ProseMirror.
     * @param tr the transaction of the state. You can use ``getInstance().ctx.get(editorViewCtx).state.tr`` to get it.
     */
    constructor (tr: Transaction, caseSensitive: boolean) {
        this.tr = tr;
        this.caseSensitive = caseSensitive;
    }

    /**
     * Find a string in transaction's doc.
     * @param findStr the string need to be found
     * @returns ``TextSelection[] | undefined`` All matched text selections
     */
    find (findStr: string) {
        const { doc } = this.tr;
        const pattern = new RegExp(makeSafeRegExpStr(findStr), this.caseSensitive ? '' : 'i');
        const ret: TextSelection[] = [];

        /*
         * Walk the document to get the real position of every text block, the text of a
         * block starts right after the block position(node positions are 1-based offsets).
         */
        doc.descendants((node, pos) => {
            if (!node.isTextblock) return true;

            const text = node.textContent;
            let index = 0;
            let foundAt: number;
            while ((foundAt = text.slice(index).search(pattern)) > -1) {
                const from = pos + 1 + index + foundAt;
                ret.push(TextSelection.create(doc, from, from + findStr.length));
                index = index + foundAt + findStr.length;
            }

            // Text blocks can't be nested, no need to walk into them
            return false;
        });

        return ret;
    }
}
