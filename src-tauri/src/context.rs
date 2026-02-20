use serde::{Deserialize, Serialize};

/// Context captured at the moment the launcher is invoked.
/// Includes clipboard text, selected text, and info about the previously focused window.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LaunchContext {
    /// Text currently on the clipboard (if any).
    pub clipboard_text: Option<String>,
    /// Text that was selected in the source application (if any).
    pub selected_text: Option<String>,
    /// Title of the window that had focus before the launcher appeared.
    pub source_window_title: Option<String>,
    /// Process name of the source application (e.g. "Code.exe", "chrome.exe").
    pub source_process_name: Option<String>,
}

/// Capture the full launch context from the OS.
/// Must be called *before* the launcher window takes focus.
pub fn capture_launch_context() -> LaunchContext {
    let source_window_title = get_foreground_window_title();
    let source_process_name = get_foreground_process_name();
    let clipboard_text = get_clipboard_text();
    let selected_text = capture_selected_text(&clipboard_text);

    LaunchContext {
        clipboard_text,
        selected_text,
        source_window_title,
        source_process_name,
    }
}

/// Read text from the system clipboard.
fn get_clipboard_text() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        win32::get_clipboard_text()
    }
    #[cfg(not(target_os = "windows"))]
    {
        None
    }
}

/// Get the title of the foreground window.
fn get_foreground_window_title() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        win32::get_foreground_window_title()
    }
    #[cfg(not(target_os = "windows"))]
    {
        None
    }
}

/// Get the process name of the foreground window.
fn get_foreground_process_name() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        win32::get_foreground_process_name()
    }
    #[cfg(not(target_os = "windows"))]
    {
        None
    }
}

/// Capture the currently selected text by simulating Ctrl+C and reading clipboard.
/// Compares against the previous clipboard contents to detect whether something was copied.
fn capture_selected_text(previous_clipboard: &Option<String>) -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        win32::capture_selected_text(previous_clipboard)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = previous_clipboard;
        None
    }
}

/// Simulate typing text into the currently focused application via SendInput,
/// then restore focus so the text lands in the right window.
pub fn type_text(text: &str) -> Result<(), String> {
    use enigo::{Enigo, Keyboard, Settings};

    let mut enigo =
        Enigo::new(&Settings::default()).map_err(|e| format!("Failed to init enigo: {e}"))?;

    enigo
        .text(text)
        .map_err(|e| format!("Failed to type text: {e}"))?;

    Ok(())
}

/// Simulate replacing the current selection: select-all in the selection region, then type over it.
/// This works by first doing Ctrl+V with the new text on the clipboard.
pub fn replace_selection(text: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // Put the replacement text on the clipboard
        win32::set_clipboard_text(text)?;

        // Simulate Ctrl+V to paste over the selection
        use enigo::{Direction, Enigo, Key, Keyboard, Settings};

        let mut enigo =
            Enigo::new(&Settings::default()).map_err(|e| format!("Failed to init enigo: {e}"))?;

        enigo
            .key(Key::Control, Direction::Press)
            .map_err(|e| format!("Failed to press Ctrl: {e}"))?;
        enigo
            .key(Key::Unicode('v'), Direction::Click)
            .map_err(|e| format!("Failed to press V: {e}"))?;
        enigo
            .key(Key::Control, Direction::Release)
            .map_err(|e| format!("Failed to release Ctrl: {e}"))?;

        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = text;
        Err("replace_selection is only supported on Windows".to_string())
    }
}

// ── Windows-specific implementations ──

#[cfg(target_os = "windows")]
mod win32 {
    use windows::Win32::Foundation::{HANDLE, HGLOBAL, HWND};
    use windows::Win32::System::DataExchange::{
        CloseClipboard, EmptyClipboard, GetClipboardData, OpenClipboard, SetClipboardData,
    };
    use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};
    use windows::Win32::System::Ole::CF_UNICODETEXT;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId,
    };

    /// Convert a HANDLE (from GetClipboardData) to HGLOBAL for GlobalLock/GlobalUnlock.
    fn handle_to_hglobal(h: HANDLE) -> HGLOBAL {
        HGLOBAL(h.0)
    }

    pub fn get_clipboard_text() -> Option<String> {
        unsafe {
            if OpenClipboard(None).is_err() {
                return None;
            }

            let result = (|| {
                let handle = GetClipboardData(CF_UNICODETEXT.0 as u32).ok()?;
                let hglobal = handle_to_hglobal(handle);
                let ptr = GlobalLock(hglobal) as *const u16;
                if ptr.is_null() {
                    return None;
                }

                let mut len = 0;
                while *ptr.add(len) != 0 {
                    len += 1;
                }

                let slice = std::slice::from_raw_parts(ptr, len);
                let text = String::from_utf16_lossy(slice);
                let _ = GlobalUnlock(hglobal);

                if text.is_empty() {
                    None
                } else {
                    Some(text)
                }
            })();

            let _ = CloseClipboard();
            result
        }
    }

    pub fn set_clipboard_text(text: &str) -> Result<(), String> {
        unsafe {
            // Convert UTF-8 to UTF-16
            let wide: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
            let byte_len = wide.len() * 2;

            let hmem = GlobalAlloc(GMEM_MOVEABLE, byte_len)
                .map_err(|e| format!("GlobalAlloc failed: {e}"))?;
            let ptr = GlobalLock(hmem) as *mut u16;
            if ptr.is_null() {
                return Err("GlobalLock failed".to_string());
            }

            std::ptr::copy_nonoverlapping(wide.as_ptr(), ptr, wide.len());
            let _ = GlobalUnlock(hmem);

            OpenClipboard(None).map_err(|e| format!("OpenClipboard failed: {e}"))?;
            let _ = EmptyClipboard();

            // HGLOBAL → HANDLE for SetClipboardData
            let handle = HANDLE(hmem.0);
            SetClipboardData(CF_UNICODETEXT.0 as u32, Some(handle))
                .map_err(|e| format!("SetClipboardData failed: {e}"))?;

            let _ = CloseClipboard();
            Ok(())
        }
    }

    pub fn get_foreground_window_title() -> Option<String> {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd == HWND::default() {
                return None;
            }

            let mut title = vec![0u16; 512];
            let len = GetWindowTextW(hwnd, &mut title);

            if len > 0 {
                let text = String::from_utf16_lossy(&title[..len as usize]);
                Some(text)
            } else {
                None
            }
        }
    }

    pub fn get_foreground_process_name() -> Option<String> {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd == HWND::default() {
                return None;
            }

            let mut process_id: u32 = 0;
            GetWindowThreadProcessId(hwnd, Some(&mut process_id));

            if process_id == 0 {
                return None;
            }

            // Use QueryFullProcessImageNameW instead of GetModuleBaseNameW
            // to avoid needing the ProcessStatus feature
            use windows::Win32::System::Threading::{
                OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT,
                PROCESS_QUERY_LIMITED_INFORMATION,
            };

            let process =
                OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, process_id).ok()?;

            let mut name_buf = vec![0u16; 1024];
            let mut size = name_buf.len() as u32;
            let ok = QueryFullProcessImageNameW(
                process,
                PROCESS_NAME_FORMAT(0),
                windows::core::PWSTR(name_buf.as_mut_ptr()),
                &mut size,
            );

            let _ = windows::Win32::Foundation::CloseHandle(process);

            if ok.is_ok() && size > 0 {
                let full_path = String::from_utf16_lossy(&name_buf[..size as usize]);
                // Extract just the filename from the full path
                let name = full_path
                    .rsplit('\\')
                    .next()
                    .unwrap_or(&full_path)
                    .to_string();
                Some(name)
            } else {
                None
            }
        }
    }

    pub fn capture_selected_text(previous_clipboard: &Option<String>) -> Option<String> {
        use enigo::{Direction, Enigo, Key, Keyboard, Settings};

        // Simulate Ctrl+C to copy any selection
        let mut enigo = Enigo::new(&Settings::default()).ok()?;

        enigo.key(Key::Control, Direction::Press).ok()?;
        enigo.key(Key::Unicode('c'), Direction::Click).ok()?;
        enigo.key(Key::Control, Direction::Release).ok()?;

        // Give the target app time to update the clipboard
        std::thread::sleep(std::time::Duration::from_millis(80));

        // Read the clipboard now
        let new_clipboard = get_clipboard_text();

        // If clipboard changed, we captured a selection
        match (&new_clipboard, previous_clipboard) {
            (Some(new), Some(old)) if new != old => Some(new.clone()),
            (Some(new), None) => Some(new.clone()),
            _ => None,
        }
    }
}
