use std::path::PathBuf;
use std::sync::mpsc;
use std::time::Duration;
use tauri::{AppHandle, Url, Window, WindowBuilder, WindowUrl};

/// Load the html into an invisible window; both the window and the temp file
/// have to be cleaned up by the caller.
fn create_print_window (app: &AppHandle, html: &str) -> Result<(Window, PathBuf), String> {
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();

    let temp = std::env::temp_dir().join(format!("typability-export-{stamp}.html"));
    std::fs::write(&temp, html).map_err(|e| e.to_string())?;

    let url = Url::from_file_path(&temp).map_err(|_| "invalid temp file path".to_string())?;
    let label = format!("pdf-export-{stamp}");

    let window = WindowBuilder::new(app, &label, WindowUrl::External(url))
        .visible(false)
        .inner_size(794.0, 1123.0)
        .build()
        .map_err(|e| e.to_string())?;

    // Give the webview some time to load the local document before printing
    std::thread::sleep(Duration::from_millis(900));

    Ok((window, temp))
}

fn cleanup (window: &Window, temp: &PathBuf) {
    let _ = window.close();
    let _ = std::fs::remove_file(temp);
}

/// Chromium/WebView2: run Page.printToPDF over the devtools protocol.
#[cfg(target_os = "windows")]
pub fn render_pdf (app: &AppHandle, html: &str, path: &str) -> Result<(), String> {
    use base64::{engine::general_purpose::STANDARD, Engine};
    use webview2_com::CallDevToolsProtocolMethodCompletedHandler;
    use windows::core::HSTRING;

    let (window, temp) = create_print_window(app, html)?;
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
        // generateDocumentOutline builds the pdf bookmarks from h1-h6 elements
        let params = HSTRING::from(
            r#"{"printBackground":true,"preferCSSPageSize":true,"generateDocumentOutline":true,"marginTop":0,"marginBottom":0,"marginLeft":0,"marginRight":0}"#
        );

        if let Err(error) = core.CallDevToolsProtocolMethod(&method, &params, &handler) {
            let _ = handler_sender.send(Err(error.to_string()));
        }
    });

    if let Err(error) = result {
        cleanup(&window, &temp);
        return Err(error.to_string());
    }

    let printed = receiver.recv_timeout(Duration::from_secs(20));
    cleanup(&window, &temp);

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

/// WKWebView: createPDFWithConfiguration, available since macOS 11.
#[cfg(target_os = "macos")]
pub fn render_pdf (app: &AppHandle, html: &str, path: &str) -> Result<(), String> {
    use block::ConcreteBlock;
    use cocoa::base::{id, nil};
    use objc::{class, msg_send, sel, sel_impl};

    let (window, temp) = create_print_window(app, html)?;
    let (sender, receiver) = mpsc::channel::<Result<Vec<u8>, String>>();

    let result = window.with_webview(move |webview| unsafe {
        let webview: id = webview.inner();
        let selector = sel!(createPDFWithConfiguration:completionHandler:);
        let responds: bool = msg_send![webview, respondsToSelector: selector];
        if !responds {
            let _ = sender.send(Err("WKWebView PDF export requires macOS 11 or newer".to_string()));
            return;
        }

        let config: id = msg_send![class!(WKPDFConfiguration), new];
        let callback_sender = sender.clone();
        let block = ConcreteBlock::new(move |data: id, _error: id| {
            if data == nil {
                let _ = callback_sender.send(Err("empty pdf data".to_string()));
                return;
            }

            let length: usize = msg_send![data, length];
            let pointer: *const std::os::raw::c_void = msg_send![data, bytes];
            let bytes = std::slice::from_raw_parts(pointer as *const u8, length).to_vec();
            let _ = callback_sender.send(Ok(bytes));
        });
        let block = block.copy();

        let _: () = msg_send![webview, createPDFWithConfiguration:config completionHandler:&*block];
    });

    if let Err(error) = result {
        cleanup(&window, &temp);
        return Err(error.to_string());
    }

    let bytes = receiver.recv_timeout(Duration::from_secs(20));
    cleanup(&window, &temp);

    let bytes = bytes.map_err(|_| "printing timed out".to_string())??;
    std::fs::write(path, bytes).map_err(|e| e.to_string())?;

    Ok(())
}

/// WebKitGTK: print with GtkPrintSettings pointing at a pdf file.
#[cfg(all(unix, not(target_os = "macos")))]
pub fn render_pdf (app: &AppHandle, html: &str, path: &str) -> Result<(), String> {
    use webkit2gtk::{PrintOperation, PrintOperationExt};

    let (window, temp) = create_print_window(app, html)?;
    let (sender, receiver) = mpsc::channel::<Result<(), String>>();

    let result = window.with_webview(move |webview| {
        let uri = match Url::from_file_path(path) {
            Ok(uri) => uri.to_string(),
            Err(_) => {
                let _ = sender.send(Err("invalid export path".to_string()));
                return;
            }
        };

        let settings = gtk::PrintSettings::new();
        settings.set("output-uri", Some(uri.as_str()));
        settings.set("output-file-format", Some("pdf"));

        let view = webview.inner();
        let operation = PrintOperation::new(&*view);
        operation.set_print_settings(&settings);
        operation.print();

        let _ = sender.send(Ok(()));
    });

    if let Err(error) = result {
        cleanup(&window, &temp);
        return Err(error.to_string());
    }

    let _ = receiver.recv_timeout(Duration::from_secs(20));
    cleanup(&window, &temp);

    if std::fs::metadata(path).is_err() {
        return Err("webkit did not create the pdf file, use the system print dialog instead".to_string());
    }

    Ok(())
}

#[tauri::command]
pub async fn export_pdf (app: AppHandle, html: String, path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || render_pdf(&app, &html, &path))
        .await
        .map_err(|e| e.to_string())?
}
