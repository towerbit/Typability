import { useEffect } from 'react';
import { appWindow } from '@tauri-apps/api/window';
import { TauriEvent } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';
import { useDebounceFn } from 'ahooks';
import { useAtom } from 'jotai';
import { settingsJotai } from '../jotais/settings';

/*
 * Persist the size and position of the window(only when it's neither maximized
 * nor minimized), the rust side restores them on the next launch if the user
 * enabled that in preferences.
 */
export default function useRememberWindowState () {
    const [settings] = useAtom(settingsJotai);
    const { run: persist } = useDebounceFn(async () => {
        try {
            if (await appWindow.isMinimized() || await appWindow.isMaximized()) return;
            const position = await appWindow.outerPosition();
            const size = await appWindow.outerSize();
            if (size.width <= 0 || size.height <= 0) return;

            await invoke('save_window_state', {
                x: position.x,
                y: position.y,
                width: size.width,
                height: size.height,
                enabled: settings.rememberWindowState
            });
        } catch {
            // Remembering the window state is optional, give up silently
        }
    }, { wait: 500 });

    useEffect(() => {
        const unlisteners = [
            appWindow.listen(TauriEvent.WINDOW_MOVED, () => persist()),
            appWindow.listen(TauriEvent.WINDOW_RESIZED, () => persist())
        ];

        return () => {
            unlisteners.forEach((unlisten) => unlisten.then((fn) => fn()).catch(() => undefined));
        };
    }, []);

    // Persist the option itself, so disabling it also stops restoring next time
    useEffect(() => {
        persist();
    }, [settings.rememberWindowState]);
}
