import { atom } from "jotai";
export const loadingJotai = atom<boolean>(false);
export const preferenceJotai = atom<boolean>(false);
export const aboutJotai = atom<boolean>(false);
export const toolbarJotai = atom<boolean | 'find' | 'replace'>(false);
export const editMenuJotai = atom<boolean>(false);

const defaultVibrancyConfig = {
    arcylic: false,
    mica: false,
    vibrancy: false
};

interface VibrancyConfig {
    arcylic: boolean;
    mica: boolean;
    vibrancy: boolean;
}

export const vibrancyJotai = atom<VibrancyConfig>(defaultVibrancyConfig);
export const twoColumnJotai = atom<boolean>(false);
/** Whether the editor shows the markdown source instead of the WYSIWYG view */
export const sourceViewJotai = atom<boolean>(false);
/** Whether the outline sidebar is shown */
export const outlineJotai = atom<boolean>(false);

export interface ToastState {
    id: number;
    text: string;
    kind: 'success' | 'error';
}

/** Transient message shown after actions such as exporting */
export const toastJotai = atom<ToastState | null>(null);
