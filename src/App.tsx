import MilkdownEditor from "./components/MilkdownEditor";
import styles from './App.module.scss';
import TitleBar from "./components/TitleBar";
import { useAtom } from "jotai";
import { contentJotai, filePathJotai, openFileJotai, originalContentJotai, savedJotai, savingJotai } from "./jotais/file";
import { aboutJotai, loadingJotai, outlineJotai, preferenceJotai, sourceViewJotai, toolbarJotai, twoColumnJotai, vibrancyJotai } from "./jotais/ui";
import classNames from "classnames";
import { Spinner } from "@fluentui/react-components";
import { useEffect, useRef } from "react";
import { FluentProvider, webLightTheme, webDarkTheme } from '@fluentui/react-components';
import useIsDarkMode from "./hooks/dark";
import useRememberWindowState from "./hooks/windowState";
import Preferences from "./components/Preferences";
import { settingsJotai } from "./jotais/settings";
import { useKeyPress, useInterval, useEventListener, useAsyncEffect } from "ahooks";
import { version as getVersion, type as getType } from '@tauri-apps/api/os';
import About from "./components/About";
import { invoke } from '@tauri-apps/api/tauri';
import { appWindow } from '@tauri-apps/api/window';
import { TauriEvent } from '@tauri-apps/api/event';
import FloatingToolbar from "./components/FloatingToolbar";
import SourceEditor, { SourceEditorHandle } from "./components/SourceEditor";
import Outline from "./components/Outline";
import Toast from "./components/Toast";
import { Editor } from "@milkdown/core";
import { IntlProvider } from 'react-intl';
import localeData from '../locale';


function App () {
    const [content, setContent] = useAtom(contentJotai);
    const [filePath] = useAtom(filePathJotai);
    const [, openFile] = useAtom(openFileJotai);
    const [loading] = useAtom(loadingJotai);
    const [, setToolbar] = useAtom(toolbarJotai);
    const [twoColumn] = useAtom(twoColumnJotai);
    const [sourceView] = useAtom(sourceViewJotai);
    const [outline] = useAtom(outlineJotai);
    const [saved, setSaved] = useAtom(savedJotai);
    const [, setOriginalContent] = useAtom(originalContentJotai);
    const [saving, setSaving] = useAtom(savingJotai);
    const [settings] = useAtom(settingsJotai);
    const [preference, setPreference] = useAtom(preferenceJotai);
    const [vibrancy, setVibrancy] = useAtom(vibrancyJotai);
    const [about, setAbout] = useAtom(aboutJotai);
    const systemIsDark = useIsDarkMode();
    // Older settings don't have the appearance field, keep following the system for them
    const appearance = settings.appearance ?? 'system';
    const isDarkMode = appearance === 'system' ? systemIsDark : appearance === 'dark';
    const activeTheme = isDarkMode ? settings.themeDark : settings.theme;
    // Typora themes are css overlays on top of the nord milkdown theme
    const typoraTheme = /^(github|newsprint|night|pixyll|whitey)$/.test(activeTheme) ? activeTheme : undefined;
    const editorTheme = (typoraTheme ? 'nord' : activeTheme) as 'nord' | 'nordDark' | 'tokyo';
    const editorInstance = useRef<Editor>(null);
    const sourceEditorRef = useRef<SourceEditorHandle>(null);
    useRememberWindowState();

    // Initialize
    useAsyncEffect(async () => {
        // Detect system type
        const type = await getType();
        if (type === 'Linux') return;

        const version = await getVersion();
        if (type === 'Windows_NT') {
            const buildNumber = parseInt(version.substring(version.lastIndexOf('.') + 1));
            if (buildNumber >= 21996) { // Windows 11
                setVibrancy({
                    arcylic: true,
                    mica: true,
                    vibrancy: false
                });
            } else if (buildNumber >= 17134) { // Windows 10 1803
                setVibrancy({
                    arcylic: true,
                    mica: false,
                    vibrancy: false
                });
            }
        } else {
            /*
             * FluentUI doesn't work on macOS 11.3 - (Safari 14.1 -)
             * For vibrancy feature(macOS 10.14 +), there's no need to detect version.
             */
            setVibrancy({
                arcylic: false,
                mica: false,
                vibrancy: true
            });
        }

        const args: string[] = await invoke('get_args');
        if (args.length > 1) await openFile(args[1]);
    }, []);

    // Open the markdown file dropped onto the window
    useEffect(() => {
        let unlisten: (() => void) | undefined;
        let disposed = false;

        appWindow.listen<string[]>(TauriEvent.WINDOW_FILE_DROP, (event) => {
            const dropped = event.payload.find((path) => /\.(md|txt)$/i.test(path));
            // OpenFile asks to save unsaved changes before switching
            if (dropped) openFile(dropped);
        }).then((fn) => {
            if (disposed) fn();
            else unlisten = fn;
        });

        return () => {
            disposed = true;
            unlisten?.();
        };
    }, []);

    // Auto save
    useInterval(async () => {
        if (filePath === null || saved || saving) return;
        setSaving(true);

    }, settings.autoSave ? settings.saveInterval * 1000 : -1);

    // Save when editor blurred
    useEventListener('blur', async () => {
        if (!settings.saveBlur || filePath === null || saved || saving) return;
        setSaving(true);
    });

    // Shortcuts
    useKeyPress('ctrl.s', async () => {
        setSaving(true);
    });
    useKeyPress('ctrl.f', (e) => {
        e.preventDefault();
        setToolbar('find');
    });
    useKeyPress(['f5', 'f7'], (e) => {
        e.preventDefault();
    });
    useKeyPress('ctrl.h', () => {
        setToolbar('replace');
    });

    useKeyPress('ctrl.alt.d', () => {
        alert(`filePath: ${filePath}\nsettings: ${JSON.stringify(settings)}\nsaved: ${saved}`);
    });

    useEffect(() => {
        if (settings.vibrancy !== 'none') invoke(`apply_${settings.vibrancy}`, {dark: isDarkMode});
    }, [settings.vibrancy, isDarkMode]);

    return (
        <FluentProvider theme={isDarkMode ? webDarkTheme : webLightTheme} className='provider'>
            <IntlProvider defaultLocale='en' locale={settings.language} messages={localeData[settings.language].message}>
                <div
                    data-theme={typoraTheme}
                    className={classNames(styles.container, {
                        [styles.window]: !settings.vibrancy || settings.vibrancy === 'none',
                        [styles.mac]: vibrancy.vibrancy
                    })}
                >
                    <TitleBar editorInstance={editorInstance} />
                    <div className={styles.body}>
                        {outline && <Outline
                            editorInstance={editorInstance}
                            onJumpSource={(offset) => sourceEditorRef.current?.scrollToOffset(offset)}
                        />}
                        <div className={styles.editor} spellCheck={false}>
                            {sourceView && <SourceEditor ref={sourceEditorRef} />}
                            {!sourceView && <MilkdownEditor
                                useMenu={false}
                                useSlash={settings.slash}
                                content={content}
                                onMarkdownUpdated={(markdown) => {
                                    setContent(markdown);
                                }}
                                onContentLoaded={(markdown) => {
                                    setOriginalContent(markdown);
                                    setContent(markdown);
                                    setSaved(true);
                                }}
                                twoColumnEditor={twoColumn}
                                syntaxOption={settings.syntax}
                                theme={editorTheme}
                                ref={editorInstance}
                            />}
                        </div>
                    </div>
                    <div
                        data-tauri-drag-region
                        className={classNames(styles.mask, {
                            [styles.white]: loading
                        })}
                    >
                        <Spinner />
                    </div>
                    <Preferences open={preference} onClose={() => {
                        setPreference(false);
                    }} />
                    <Toast />
                    <About open={about} onClose={() => {
                        setAbout(false);
                    }} />
                    <FloatingToolbar editorInstance={editorInstance} />
                </div>
            </IntlProvider>
        </FluentProvider>
    );
}

export default App;
