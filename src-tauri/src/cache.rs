use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// Sum the size of every file below `path`. Unreadable entries are skipped, so
/// measuring never fails while the browser still has files open.
fn dir_size(path: &Path) -> u64 {
    let mut total = 0;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                total += dir_size(&path);
            } else if let Ok(metadata) = entry.metadata() {
                total += metadata.len();
            }
        }
    }
    total
}

/// Directory the webview keeps its caches in. Tauri points the webview at the
/// app's local data dir; WebView2 creates an `EBWebView` child inside it.
fn webview_data_dir(app: &AppHandle) -> Option<PathBuf> {
    let base = tauri::api::path::app_local_data_dir(&app.config())?;
    #[cfg(target_os = "windows")]
    {
        Some(base.join("EBWebView"))
    }
    #[cfg(not(target_os = "windows"))]
    {
        Some(base)
    }
}

fn cache_size(app: &AppHandle) -> u64 {
    webview_data_dir(app).map(|dir| dir_size(&dir)).unwrap_or(0)
}

/// Chromium/WebView2: clear every browsing data kind of the current profile.
/// This runs against the live webview, so no restart is needed.
#[cfg(target_os = "windows")]
fn clear_now(app: &AppHandle) -> Result<(), String> {
    use std::sync::mpsc;
    use std::time::Duration;
    use webview2_com::ClearBrowsingDataCompletedHandler;
    use webview2_com::Microsoft::Web::WebView2::Win32::{ICoreWebView2_13, ICoreWebView2Profile2};
    use windows::core::Interface;

    let window = app
        .get_window("typability")
        .ok_or_else(|| "main window not found".to_string())?;
    let (sender, receiver) = mpsc::channel::<Result<(), String>>();
    let on_error = sender.clone();
    let on_complete = sender.clone();

    let dispatched = window.with_webview(move |webview| unsafe {
        let core = match webview.controller().CoreWebView2() {
            Ok(core) => core,
            Err(error) => {
                let _ = on_error.send(Err(error.to_string()));
                return;
            }
        };
        let core13: ICoreWebView2_13 = match core.cast() {
            Ok(value) => value,
            Err(error) => {
                let _ = on_error.send(Err(error.to_string()));
                return;
            }
        };
        let profile = match core13.Profile() {
            Ok(profile) => profile,
            Err(error) => {
                let _ = on_error.send(Err(error.to_string()));
                return;
            }
        };
        let profile2: ICoreWebView2Profile2 = match profile.cast() {
            Ok(value) => value,
            Err(error) => {
                let _ = on_error.send(Err(error.to_string()));
                return;
            }
        };

        let handler = ClearBrowsingDataCompletedHandler::create(Box::new(move |result| {
            let _ = on_complete.send(result.map_err(|error| error.to_string()));
            Ok(())
        }));

        if let Err(error) = profile2.ClearBrowsingDataAll(&handler) {
            let _ = on_error.send(Err(error.to_string()));
        }
    });

    if let Err(error) = dispatched {
        return Err(error.to_string());
    }

    receiver
        .recv_timeout(Duration::from_secs(20))
        .map_err(|_| "clearing the cache timed out".to_string())?
}

#[cfg(not(target_os = "windows"))]
fn clear_now(_app: &AppHandle) -> Result<(), String> {
    Err("browser cache clearing is only available on Windows".to_string())
}

/// Clear the browser cache and report how large the cache directory was before
/// clearing, so the UI can show roughly how much space was reclaimed.
#[tauri::command]
pub async fn clear_webview_cache(app: AppHandle) -> Result<u64, String> {
    let size = cache_size(&app);
    tauri::async_runtime::spawn_blocking(move || clear_now(&app))
        .await
        .map_err(|error| error.to_string())??;
    Ok(size)
}
