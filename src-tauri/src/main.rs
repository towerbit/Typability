#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod pdf;
mod setup;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command

fn main() {
    tauri::Builder::default()
        .setup(setup::init)
        .on_window_event(|event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event.event() {
                setup::save_window_state_on_close(event.window());
            }
        })
        .invoke_handler(tauri::generate_handler![setup::get_args, setup::apply_mica, setup::clear_mica, setup::apply_arcylic, setup::clear_arcylic, setup::apply_tabbed, setup::clear_tabbed, setup::save_window_state, pdf::export_pdf])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
