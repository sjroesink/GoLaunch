mod acp;
mod commands;

use commands::*;
use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
use tokio::sync::Mutex;

use acp::manager::AcpManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            search_items,
            get_all_items,
            execute_item,
            get_categories,
            hide_window,
            get_setting,
            set_setting,
            get_agent_config,
            save_agent_config,
            acp_connect,
            acp_disconnect,
            acp_get_status,
            acp_prompt,
            acp_cancel,
            acp_resolve_permission,
            acp_fetch_registry,
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            // Initialize ACP manager state
            app.manage(AcpState(Arc::new(Mutex::new(AcpManager::new()))));

            // Register global shortcut: Ctrl+Space (or Cmd+Space on macOS)
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::Space);
            app.handle()
                .plugin(tauri_plugin_global_shortcut::Builder::new().build())
                .unwrap_or(());

            let handle_clone = handle.clone();
            app.global_shortcut()
                .on_shortcut(shortcut, move |_app, _shortcut, _event| {
                    if let Some(window) = handle_clone.get_webview_window("main") {
                        if window.is_visible().unwrap_or(false) {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.center();
                        }
                    }
                })?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running GoLaunch");
}
