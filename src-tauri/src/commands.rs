use golaunch_core::{Database, Item};
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tokio::sync::Mutex;

use crate::acp::manager::AcpManager;
use crate::acp::registry::fetch_registry;
use crate::acp::types::{AgentConfig, AgentStatus, RegistryAgent};

pub struct AcpState(pub Arc<Mutex<AcpManager>>);

// --- Existing item commands ---

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
        let _: () = window
            .hide()
            .map_err(|e| format!("Failed to hide window: {e}"))?;
    }
    Ok(())
}

// --- Settings commands ---

#[tauri::command]
pub fn get_setting(key: String) -> Result<Option<String>, String> {
    let db = Database::new()?;
    db.get_setting(&key)
}

#[tauri::command]
pub fn set_setting(key: String, value: String) -> Result<(), String> {
    let db = Database::new()?;
    db.set_setting(&key, &value)
}

#[tauri::command]
pub fn get_agent_config() -> Result<AgentConfig, String> {
    let db = Database::new()?;
    load_agent_config(&db)
}

#[tauri::command]
pub fn save_agent_config(config: AgentConfig) -> Result<(), String> {
    let db = Database::new()?;
    db.set_setting("acp.source", &config.source)?;
    db.set_setting("acp.agent_id", &config.agent_id)?;
    db.set_setting("acp.binary_path", &config.binary_path)?;
    db.set_setting("acp.args", &config.args)?;
    db.set_setting("acp.env", &config.env)?;
    db.set_setting(
        "acp.auto_fallback",
        if config.auto_fallback { "true" } else { "false" },
    )?;
    Ok(())
}

fn load_agent_config(db: &Database) -> Result<AgentConfig, String> {
    Ok(AgentConfig {
        source: db.get_setting("acp.source")?.unwrap_or_default(),
        agent_id: db.get_setting("acp.agent_id")?.unwrap_or_default(),
        binary_path: db.get_setting("acp.binary_path")?.unwrap_or_default(),
        args: db.get_setting("acp.args")?.unwrap_or_default(),
        env: db.get_setting("acp.env")?.unwrap_or_default(),
        auto_fallback: db
            .get_setting("acp.auto_fallback")?
            .map(|v| v == "true")
            .unwrap_or(false),
    })
}

// --- ACP lifecycle commands ---

#[tauri::command]
pub async fn acp_connect(
    app: AppHandle,
    state: tauri::State<'_, AcpState>,
    config: AgentConfig,
) -> Result<(), String> {
    let mut manager = state.inner().0.lock().await;
    manager.connect(app.clone(), config).await
}

#[tauri::command]
pub async fn acp_disconnect(state: tauri::State<'_, AcpState>) -> Result<(), String> {
    let mut manager = state.inner().0.lock().await;
    manager.disconnect().await
}

#[tauri::command]
pub async fn acp_get_status(state: tauri::State<'_, AcpState>) -> Result<AgentStatus, String> {
    let manager = state.inner().0.lock().await;
    Ok(manager.status())
}

// --- ACP prompting commands ---

#[tauri::command]
pub async fn acp_prompt(
    state: tauri::State<'_, AcpState>,
    query: String,
    context_items: Vec<Item>,
) -> Result<(), String> {
    let mut manager = state.inner().0.lock().await;
    manager.prompt(&query, &context_items).await
}

#[tauri::command]
pub async fn acp_cancel(state: tauri::State<'_, AcpState>) -> Result<(), String> {
    let mut manager = state.inner().0.lock().await;
    manager.cancel().await
}

// --- ACP permission commands ---

#[tauri::command]
pub async fn acp_resolve_permission(
    state: tauri::State<'_, AcpState>,
    request_id: String,
    option_id: String,
) -> Result<(), String> {
    let mut manager = state.inner().0.lock().await;
    manager.resolve_permission(&request_id, &option_id).await
}

// --- ACP registry commands ---

#[tauri::command]
pub async fn acp_fetch_registry() -> Result<Vec<RegistryAgent>, String> {
    fetch_registry().await
}
