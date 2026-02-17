use golaunch_core::{Database, Item};
use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn search_items(query: String) -> Result<Vec<Item>, String> {
    let db = Database::new()?;
    if query.is_empty() {
        db.list_items(None, false)
    } else {
        db.search_items(&query)
    }
}

#[tauri::command]
pub fn get_all_items() -> Result<Vec<Item>, String> {
    let db = Database::new()?;
    db.list_items(None, false)
}

#[tauri::command]
pub fn execute_item(id: String) -> Result<(), String> {
    let db = Database::new()?;
    let item = db.get_item(&id)?;
    db.increment_frequency(&id)?;

    match item.action_type.as_str() {
        "url" => {
            open::that(&item.action_value).map_err(|e| format!("Failed to open URL: {e}"))?;
        }
        "command" => {
            #[cfg(target_os = "windows")]
            {
                std::process::Command::new("cmd")
                    .args(["/C", &item.action_value])
                    .spawn()
                    .map_err(|e| format!("Failed to execute command: {e}"))?;
            }
            #[cfg(not(target_os = "windows"))]
            {
                std::process::Command::new("sh")
                    .args(["-c", &item.action_value])
                    .spawn()
                    .map_err(|e| format!("Failed to execute command: {e}"))?;
            }
        }
        "script" => {
            #[cfg(target_os = "windows")]
            {
                std::process::Command::new("cmd")
                    .args(["/C", &item.action_value])
                    .spawn()
                    .map_err(|e| format!("Failed to execute script: {e}"))?;
            }
            #[cfg(not(target_os = "windows"))]
            {
                std::process::Command::new("sh")
                    .args(["-c", &item.action_value])
                    .spawn()
                    .map_err(|e| format!("Failed to execute script: {e}"))?;
            }
        }
        other => {
            return Err(format!("Unknown action type: {other}"));
        }
    }

    Ok(())
}

#[tauri::command]
pub fn get_categories() -> Result<Vec<String>, String> {
    let db = Database::new()?;
    db.get_categories()
}

#[tauri::command]
pub fn hide_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window
            .hide()
            .map_err(|e| format!("Failed to hide window: {e}"))?;
    }
    Ok(())
}
