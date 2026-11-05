import ReactDOM from "react-dom/client";
import { getDefaultStore } from "jotai";
import { invoke } from "@tauri-apps/api/tauri";
import App from "./App";
import "./style.scss";
import "./themes/typora.css";
import { defaultSettings, settingsJotai } from "./jotais/settings";

/*
 * Load the settings from the rust side before rendering anything. The first
 * launch also migrates the old webview localStorage value, if there is one.
 */
async function bootstrap () {
    try {
        const saved = await invoke<string>('load_settings');
        const raw = saved || window.localStorage.getItem('settings') || '';

        if (raw) {
            const parsed = JSON.parse(raw) as Partial<typeof defaultSettings> & { windowState?: unknown };
            // Window geometry is owned by the rust side, don't put it back into the atom
            delete parsed.windowState;

            const merged = { ...defaultSettings, ...parsed };
            getDefaultStore().set(settingsJotai, merged);
            await invoke('save_settings', { settings: JSON.stringify(merged) });
        }

        // The preferences now live in settings.json, drop the legacy copy
        window.localStorage.removeItem('settings');
    } catch {
        // Keep the defaults when the settings can't be read
    }

    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<App />);
}

bootstrap();
