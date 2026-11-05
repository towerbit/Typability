import { atom } from "jotai";
import { invoke } from '@tauri-apps/api/tauri';
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

export const defaultSettings: Setting = {
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
};

type SettingUpdate = Setting | ((previous: Setting) => Setting);

const baseAtom = atom<Setting>(defaultSettings);

/*
 * Settings live in app_config_dir/settings.json on the rust side, so they can
 * be read before the webview is created and are easy to back up.
 */
export const settingsJotai = atom(
    (get) => get(baseAtom),
    (get, set, update: SettingUpdate) => {
        const next = typeof update === 'function'
            ? (update as (previous: Setting) => Setting)(get(baseAtom))
            : update;

        set(baseAtom, next);
        invoke('save_settings', { settings: JSON.stringify(next) }).catch(() => undefined);
    }
);
