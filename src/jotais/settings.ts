import { atomWithStorage } from "jotai/utils";
import availableLanguage from '../../locale';

interface Setting {
    language: keyof typeof availableLanguage;
    appearance: 'system' | 'light' | 'dark';
    theme: 'nord' | 'nordDark' | 'tokyo' | 'github' | 'newsprint' | 'night' | 'pixyll' | 'whitey';
    syntax: 'gfm' | 'commonmark';
    autoSave: boolean;
    saveBlur: boolean;
    slash: boolean;
    saveInterval: number;
    defaultPath: string;
    vibrancy: 'mica' | 'arcylic' | 'none';
    rememberWindowState: boolean;
    rememberView: boolean;
    viewTwoColumn: boolean;
    viewSource: boolean;
    viewOutline: boolean;
    outlineWidth: number;
}

export const settingsJotai = atomWithStorage<Setting>('settings', {
    language: navigator.language.toLocaleLowerCase() as keyof typeof availableLanguage,
    appearance: 'system',
    theme: 'nord',
    syntax: 'gfm',
    autoSave: false,
    saveBlur: false,
    slash: false,
    saveInterval: 120,
    defaultPath: '',
    vibrancy: 'none',
    rememberWindowState: false,
    rememberView: false,
    viewTwoColumn: false,
    viewSource: false,
    viewOutline: false,
    outlineWidth: 240
}, undefined, { getOnInit: true });