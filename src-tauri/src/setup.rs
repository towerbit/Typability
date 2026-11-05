use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{App, AppHandle, Manager};
use window_vibrancy::{self};

use window_shadows::set_shadow;

/// Size and position of the last normal(neither maximized nor minimized) window.
/// It's stored per user, in the app config directory.
#[derive(Serialize, Deserialize, Clone, Copy)]
pub struct WindowState {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    /// Whether the user asked to restore this state on the next launch
    pub enabled: bool,
}

fn window_state_path(app: &AppHandle) -> Option<PathBuf> {
    tauri::api::path::app_config_dir(&app.config()).map(|dir| dir.join("window-state.json"))
}

fn settings_path (app: &AppHandle) -> Option<PathBuf> {
    tauri::api::path::app_config_dir(&app.config()).map(|dir| dir.join("settings.json"))
}

/// One writer at a time: window move/resize and preference changes both touch settings.json
static SETTINGS_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

fn lock_settings () -> std::sync::MutexGuard<'static, ()> {
    SETTINGS_LOCK.lock().unwrap_or_else(|error| error.into_inner())
}

fn read_settings_value (app: &AppHandle) -> serde_json::Value {
    let value = settings_path(app)
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|content| serde_json::from_str(&content).ok());

    match value {
        Some(value @ serde_json::Value::Object(_)) => value,
        _ => serde_json::Value::Object(serde_json::Map::new())
    }
}

fn write_settings_value (app: &AppHandle, value: &serde_json::Value) -> Result<(), String> {
    let path = settings_path(app).ok_or_else(|| "missing config directory".to_string())?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    fs::write(path, serde_json::to_string_pretty(value).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())
}

/// Move the old window-state.json into settings.json on the first launch
fn migrate_legacy_window_state (app: &AppHandle, value: &mut serde_json::Value) -> bool {
    if value.get("windowState").is_some() {
        return false;
    }

    let legacy = window_state_path(app)
        .and_then(|path| fs::read(path).ok())
        .and_then(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).ok());

    match (legacy, value.as_object_mut()) {
        (Some(legacy), Some(object)) => {
            object.insert("windowState".to_string(), legacy);
            true
        }
        _ => false
    }
}

fn remove_legacy_window_state (app: &AppHandle) {
    if let Some(path) = window_state_path(app) {
        let _ = fs::remove_file(path);
    }
}

#[tauri::command]
pub fn load_settings (app: AppHandle) -> String {
    let _guard = lock_settings();
    let mut value = read_settings_value(&app);
    let migrated = migrate_legacy_window_state(&app, &mut value);

    if migrated && write_settings_value(&app, &value).is_ok() {
        remove_legacy_window_state(&app);
    }

    serde_json::to_string(&value).unwrap_or_default()
}

#[tauri::command]
pub fn save_settings (app: AppHandle, settings: String) -> Result<(), String> {
    let _guard = lock_settings();
    let mut value = read_settings_value(&app);
    migrate_legacy_window_state(&app, &mut value);

    // Never let a preference write drop the window geometry
    let window = value.get("windowState").cloned();
    let incoming: serde_json::Value = serde_json::from_str(&settings).map_err(|e| e.to_string())?;

    if let (Some(object), Some(target)) = (incoming.as_object(), value.as_object_mut()) {
        for (key, item) in object {
            target.insert(key.clone(), item.clone());
        }
    }

    if let Some(window) = window {
        if let Some(target) = value.as_object_mut() {
            target.insert("windowState".to_string(), window);
        }
    }

    write_settings_value(&app, &value)
}

fn load_window_state(app: &AppHandle) -> Option<WindowState> {
    let _guard = lock_settings();
    let mut value = read_settings_value(app);
    migrate_legacy_window_state(app, &mut value);

    value.get("windowState")
        .and_then(|state| serde_json::from_value::<WindowState>(state.clone()).ok())
}

/// How much of the window has to stay on screen to consider its position usable
const MIN_VISIBLE_WIDTH: i64 = 100;
const MIN_VISIBLE_HEIGHT: i64 = 50;

/// Whether the size fits in at least one of the connected monitors
fn fits_in_any_monitor(monitors: &[tauri::Monitor], width: u32, height: u32) -> bool {
    if monitors.is_empty() {
        return true;
    }

    monitors.iter().any(|monitor| {
        let size = monitor.size();
        width <= size.width && height <= size.height
    })
}

/// Whether enough of the window would be visible on one of the connected monitors
fn is_area_visible(monitors: &[tauri::Monitor], x: i32, y: i32, width: u32, height: u32) -> bool {
    if monitors.is_empty() {
        return true;
    }

    let required_width = MIN_VISIBLE_WIDTH.min(width as i64);
    let required_height = MIN_VISIBLE_HEIGHT.min(height as i64);

    monitors.iter().any(|monitor| {
        let position = monitor.position();
        let size = monitor.size();
        let left = (x as i64).max(position.x as i64);
        let top = (y as i64).max(position.y as i64);
        let right = (x as i64 + width as i64).min(position.x as i64 + size.width as i64);
        let bottom = (y as i64 + height as i64).min(position.y as i64 + size.height as i64);

        right - left >= required_width && bottom - top >= required_height
    })
}

fn restore_window_state(app: &mut App, label: &str) {
    let state = match load_window_state(&app.handle()) {
        Some(state) if state.enabled => state,
        _ => return,
    };
    let win = match app.get_window(label) {
        Some(win) => win,
        None => return,
    };

    let monitors = win.available_monitors().unwrap_or_default();

    // Ignore a size that doesn't fit any monitor, keep the default one in that case
    let size_applied = fits_in_any_monitor(&monitors, state.width, state.height);
    if size_applied {
        let _ = win.set_size(tauri::PhysicalSize::new(state.width, state.height));
    }

    // Check the position against the size the window will actually have
    let size = win
        .outer_size()
        .unwrap_or(tauri::PhysicalSize::new(state.width, state.height));
    if is_area_visible(&monitors, state.x, state.y, size.width, size.height) {
        let _ = win.set_position(tauri::PhysicalPosition::new(state.x, state.y));
    }
}

fn write_window_state(app: &AppHandle, state: WindowState) {
    let _guard = lock_settings();
    let mut value = read_settings_value(app);
    migrate_legacy_window_state(app, &mut value);

    if let Ok(window) = serde_json::to_value(state) {
        if let Some(object) = value.as_object_mut() {
            object.insert("windowState".to_string(), window);
        }
        let _ = write_settings_value(app, &value);
    }
}

/// Keep the geometry of the last normal window when the app is closing.
/// The flag is taken from the stored state, so it always follows the preference.
pub fn save_window_state_on_close(window: &tauri::Window) {
    if window.is_maximized().unwrap_or(false) || window.is_minimized().unwrap_or(false) {
        return;
    }

    let (position, size) = match (window.outer_position(), window.outer_size()) {
        (Ok(position), Ok(size)) => (position, size),
        _ => return,
    };
    if size.width == 0 || size.height == 0 {
        return;
    }

    let app = window.app_handle();
    let enabled = load_window_state(&app).map(|state| state.enabled).unwrap_or(false);
    write_window_state(
        &app,
        WindowState {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
            enabled,
        },
    );
}

#[tauri::command]
pub fn save_window_state(
    app: AppHandle,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    enabled: bool,
) -> Result<(), String> {
    write_window_state(
        &app,
        WindowState {
            x,
            y,
            width,
            height,
            enabled,
        },
    );

    Ok(())
}

#[cfg(target_os = "macos")]
pub fn init(app: &mut App) -> std::result::Result<(), Box<dyn std::error::Error>> {
    let win = app.get_window("main").unwrap();
    set_shadow(&win, true).unwrap();

    Ok(())
}

#[tauri::command]
pub fn apply_mica(window: tauri::Window, dark: Option<bool>) {
    #[cfg(target_os = "windows")]
    window_vibrancy::apply_mica(&window, dark)
        .expect("Unsupported platform! 'apply_mica' is only supported on Windows 10.0.21996");
}

#[tauri::command]
pub fn clear_mica(window: tauri::Window) {
    #[cfg(target_os = "windows")]
    window_vibrancy::clear_mica(&window)
        .expect("Unsupported platform! 'clear_mica' is only supported on Windows 10.0.21996");
}

#[tauri::command]
pub fn apply_tabbed(window: tauri::Window, dark: Option<bool>) {
    #[cfg(target_os = "windows")]
    window_vibrancy::apply_tabbed(&window, dark)
        .expect("Unsupported platform! 'apply_tabbed' is only supported on Windows 10.0.21996");
}

#[tauri::command]
pub fn clear_tabbed(window: tauri::Window) {
    #[cfg(target_os = "windows")]
    window_vibrancy::clear_tabbed(&window)
        .expect("Unsupported platform! 'clear_mica' is only supported on Windows 10.0.21996");
}

#[tauri::command]
pub fn apply_arcylic(window: tauri::Window) {
    #[cfg(target_os = "windows")]
    window_vibrancy::apply_acrylic(&window, Some((18, 18, 18, 125)))
        .expect("Unsupported platform! 'apply_arcylic' is only supported on Windows 10.0.17134");
}

#[tauri::command]
pub fn clear_arcylic(window: tauri::Window) {
    #[cfg(target_os = "windows")]
    window_vibrancy::clear_acrylic(&window)
        .expect("Unsupported platform! 'clear_arcylic' is only supported on Windows 10.0.17134");
}

#[tauri::command]
pub fn get_args() -> Result<Vec<String>, ()> {
  let system_args: Vec<String> = std::env::args().collect();
  Ok(system_args)
}

#[cfg(target_os = "windows")]
pub fn init(app: &mut App) -> std::result::Result<(), Box<dyn std::error::Error>> {
    restore_window_state(app, "typability");

    let win = app.get_window("typability").unwrap();
    set_shadow(&win, true).unwrap();

    Ok(())
}

#[cfg(target_os = "linux")]
pub fn init(app: &mut App) -> std::result::Result<(), Box<dyn std::error::Error>> {
    restore_window_state(app, "typability");

    Ok(())
}