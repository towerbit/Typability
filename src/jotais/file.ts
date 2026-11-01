import { atom } from "jotai";
import { save as saveFilePicker } from '@tauri-apps/api/dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/api/fs';
import { documentDir } from '@tauri-apps/api/path';
import { settingsJotai } from "./settings";
import messages from '../../locale';
import { confirm } from '@tauri-apps/api/dialog';

// File extensions that can be opened by Typability
export const availbleExts = [{
    name: 'Markdown',
    extensions: ['md']
}, {
    name: 'Text file',
    extensions: ['txt']
}];

/** Path of the current file, null means the document wasn't saved yet. */
export const filePathJotai = atom<string | null>(null);

const UNTITLED_PREFIX = 'Untitled';
let untitledCount = 1;

/** Name of the document while it has no path yet, e.g. Untitled-2 */
export const untitledNameJotai = atom(`${UNTITLED_PREFIX}-1`);

export const savedJotai = atom(true);

/**
 * Whether editor is saving a file.
 * If you change this, Editor will save content to your file(Means 'Save' or 'Save as')
 */
export const savingJotai = atom(false, async (get, set, value: boolean) => {
    set(savingJotai, value);
    if (!value) return;

    let path: string | null = get(filePathJotai);
    if (path === null) {
        path = await saveFilePicker({
            defaultPath: await documentDir(),
            filters: availbleExts
        });
        if (path === null) {
            set(savingJotai, false);
            return;
        }
    }

    try {
        await writeTextFile({ path, contents: get(contentJotai) });
        set(filePathJotai, path);
        set(savedJotai, true);
        set(originalContentJotai, get(contentJotai));
    } catch (e) {
        alert(`Error occurred while saving file:\n${(e as Error).message}`);
    }
    set(savingJotai, false);
});

/**
 * Open a file, or start a blank document when the path is null.
 * Unsaved changes are saved before switching, the same way closing the app does.
 */
export const openFileJotai = atom(null, async (get, set, path: string | null) => {
    if (get(dirtyJotai)) {
        const result = await confirm(
            messages[get(settingsJotai).language].message['closeDialog.title'],
            {
                title: messages[get(settingsJotai).language].message['closeDialog.content'],
                type: 'warning'
            }
        );

        if (result) await set(savingJotai, true);
    }

    if (path === null) {
        untitledCount += 1;
        set(untitledNameJotai, `${UNTITLED_PREFIX}-${untitledCount}`);
        set(filePathJotai, null);
        set(contentJotai, '');
        set(originalContentJotai, '');
        set(savedJotai, true);
        return;
    }

    try {
        const textContent = await readTextFile(path);
        set(filePathJotai, path);
        set(contentJotai, textContent);
        set(originalContentJotai, textContent);
        set(savedJotai, true);
    } catch (e) {
        alert(`Error occurred while opening file:\n${(e as Error).message}`);
    }
});

/**
 * Save the content to another file and keep editing it there.
 * Unlike saving, this never asks anything about the previous file.
 */
export const saveAsJotai = atom(null, async (get, set) => {
    const path = await saveFilePicker({
        defaultPath: await documentDir(),
        filters: availbleExts
    });
    if (path === null) return;

    try {
        await writeTextFile({ path, contents: get(contentJotai) });
        set(filePathJotai, path);
        set(originalContentJotai, get(contentJotai));
        set(savedJotai, true);
    } catch (e) {
        alert(`Error occurred while saving file:\n${(e as Error).message}`);
    }
});

const defaultContent = `
# 🗒️ Typability
> **Typability** is a WYSIWYG markdown editor based on [Milkdown](https://milkdown.dev/).
> Here is the [repo](https://github.com/SimonShiki/typability)
*   Features
    *   [x] 📝 **WYSIWYG Markdown**
    *   [x] 🎨 **Fluent Design**
    *   [x] 🚀 **Lightweight**
`;

/**
 * Content of the file as it was when opened or last saved.
 * Used to tell whether the document was really modified by the user.
 */
export const originalContentJotai = atom(defaultContent);

export const contentJotai = atom(defaultContent, (get, set, value: string) => {
    if (value.trim() !== get(contentJotai).trim()) {
        set(contentJotai, value);
        set(savedJotai, false);
    }
});

/** Whether the content differs from the state it was opened/last saved with. */
export const dirtyJotai = atom((get) => get(contentJotai).trim() !== get(originalContentJotai).trim());