use std::sync::mpsc;
use std::time::Duration;
use tauri::AppHandle;

/// Render the given html document to a pdf with the chromium print pipeline,
/// which keeps the text selectable(no rasterization).
#[cfg(target_os = "windows")]
pub fn render_pdf (app: &AppHandle, html: &str, path: &str) -> Result<(), String> {
    use base64::{engine::general_purpose::STANDARD, Engine};
    use tauri::{Url, WindowUrl};
    use webview2_com::CallDevToolsProtocolMethodCompletedHandler;
    use windows::core::HSTRING;

    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    let temp = std::env::temp_dir().join(format!("typability-export-{stamp}.html"));
    std::fs::write(&temp, html).map_err(|e| e.to_string())?;

    let url = Url::from_file_path(&temp).map_err(|_| "invalid temp file path".to_string())?;
    let label = format!("pdf-export-{stamp}");

    let window = tauri::WindowBuilder::new(app, &label, WindowUrl::External(url))
        .visible(false)
        .inner_size(794.0, 1123.0)
        .build()
        .map_err(|e| e.to_string())?;

    // Give the webview some time to load the local document before printing
    std::thread::sleep(Duration::from_millis(900));

    let (sender, receiver) = mpsc::channel::<Result<String, String>>();
    let handler_sender = sender.clone();

    let result = window.with_webview(move |webview| unsafe {
        let core = match webview.controller().CoreWebView2() {
            Ok(core) => core,
            Err(error) => {
                let _ = sender.send(Err(error.to_string()));
                return;
            }
        };

        let callback_sender = handler_sender.clone();
        let handler = CallDevToolsProtocolMethodCompletedHandler::create(Box::new(
            move |_result, json| {
                if json.is_empty() {
                    let _ = callback_sender.send(Err("empty print result".to_string()));
                } else {
                    let _ = callback_sender.send(Ok(json));
                }
                Ok(())
            }
        ));

        let method = HSTRING::from("Page.printToPDF");
        let params = HSTRING::from(r#"{"printBackground":true,"preferCSSPageSize":true}"#);

        if let Err(error) = core.CallDevToolsProtocolMethod(&method, &params, &handler) {
            let _ = handler_sender.send(Err(error.to_string()));
        }
    });

    if let Err(error) = result {
        let _ = std::fs::remove_file(&temp);
        return Err(error.to_string());
    }

    let printed = receiver.recv_timeout(Duration::from_secs(20));

    let _ = window.close();
    let _ = std::fs::remove_file(&temp);

    let payload = printed.map_err(|_| "printing timed out".to_string())??;

    let data = serde_json::from_str::<serde_json::Value>(&payload)
        .map_err(|e| e.to_string())?
        .get("data")
        .and_then(|value| value.as_str())
        .map(str::to_owned)
        .ok_or_else(|| "unexpected print result".to_string())?;

    let bytes = STANDARD.decode(data).map_err(|e| e.to_string())?;
    std::fs::write(path, bytes).map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn render_pdf (_app: &AppHandle, _html: &str, _path: &str) -> Result<(), String> {
    Err("pdf export is only supported on Windows for now".to_string())
}

#[tauri::command]
pub async fn export_pdf (app: AppHandle, html: String, path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || render_pdf(&app, &html, &path))
        .await
        .map_err(|e| e.to_string())?
}
