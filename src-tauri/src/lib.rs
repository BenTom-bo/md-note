use serde_json::Value;
use std::{fs, path::PathBuf};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WindowEvent,
};

const PROG_ID: &str = "MDNoteMarkdown";
const RUN_KEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const CONTEXT_KEY: &str = "Software\\Classes\\*\\shell\\MDNote.Open";

fn app_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn read_text(path: &PathBuf) -> String {
    fs::read_to_string(path).unwrap_or_default()
}

fn write_text(path: &PathBuf, content: &str) -> Result<(), String> {
    fs::write(path, content).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------- files

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("读取失败 {}: {}", path, e))
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = PathBuf::from(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, content).map_err(|e| format!("保存失败 {}: {}", path, e))
}

#[tauri::command]
fn path_exists(path: String) -> bool {
    PathBuf::from(path).exists()
}

/// 把本地图片读成 data URI，避免依赖 asset:// 协议与 convertFileSrc。
/// 手写 base64，不引入新依赖，保持安装包体积。
fn base64_encode(data: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((data.len() + 2) / 3 * 4);
    let mut i = 0;
    while i + 3 <= data.len() {
        let n = ((data[i] as u32) << 16) | ((data[i + 1] as u32) << 8) | (data[i + 2] as u32);
        out.push(TABLE[((n >> 18) & 63) as usize] as char);
        out.push(TABLE[((n >> 12) & 63) as usize] as char);
        out.push(TABLE[((n >> 6) & 63) as usize] as char);
        out.push(TABLE[(n & 63) as usize] as char);
        i += 3;
    }
    let rest = data.len() - i;
    if rest > 0 {
        let n = ((data[i] as u32) << 16)
            | (if rest > 1 { (data[i + 1] as u32) << 8 } else { 0 });
        out.push(TABLE[((n >> 18) & 63) as usize] as char);
        out.push(TABLE[((n >> 12) & 63) as usize] as char);
        if rest > 1 {
            out.push(TABLE[((n >> 6) & 63) as usize] as char);
        } else {
            out.push('=');
        }
        out.push('=');
    }
    out
}

#[tauri::command]
fn read_image(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| format!("读取图片失败 {}: {}", path, e))?;
    let ext = PathBuf::from(&path)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "avif" => "image/avif",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        _ => "image/png",
    };
    Ok(format!("data:{};base64,{}", mime, base64_encode(&bytes)))
}

// 图片统一以 data URI 内联在 Markdown 中，不需要在磁盘上另建 assets/ 目录，
// 也不需要文档先保存；编辑器里由 CodeMirror 折叠成长度很短的缩略图标签。

#[tauri::command]
fn get_recent(app: AppHandle) -> Result<Vec<String>, String> {
    let p = app_dir(&app)?.join("recent.json");
    let list: Vec<String> = serde_json::from_str(&read_text(&p)).unwrap_or_default();
    Ok(list.into_iter().filter(|f| PathBuf::from(f).exists()).collect())
}

#[tauri::command]
fn add_recent(app: AppHandle, path: String) -> Result<Vec<String>, String> {
    let p = app_dir(&app)?.join("recent.json");
    let mut list: Vec<String> = serde_json::from_str(&read_text(&p)).unwrap_or_default();
    list.retain(|f| f != &path);
    list.insert(0, path);
    list.truncate(15);
    write_text(&p, &serde_json::to_string_pretty(&list).unwrap_or_default())?;
    Ok(list.into_iter().filter(|f| PathBuf::from(f).exists()).collect())
}

#[tauri::command]
fn clear_recent(app: AppHandle) -> Result<(), String> {
    write_text(&app_dir(&app)?.join("recent.json"), "[]")
}

// ---------------------------------------------------------------- config / components

#[tauri::command]
fn get_config(app: AppHandle) -> Result<String, String> {
    Ok(read_text(&app_dir(&app)?.join("config.json")))
}

#[tauri::command]
fn save_config(app: AppHandle, config: String) -> Result<(), String> {
    write_text(&app_dir(&app)?.join("config.json"), &config)
}

/// 读取安装器写入的 components.ini（与可执行文件同目录）。
#[tauri::command]
fn read_install_components() -> Result<String, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let dir = exe.parent().unwrap_or(&exe);
    let ini = read_text(&dir.join("components.ini"));
    if !ini.is_empty() {
        return Ok(ini);
    }
    Ok(read_text(&dir.join("components.json")))
}

#[tauri::command]
fn app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

// ---------------------------------------------------------------- crash recovery

#[tauri::command]
fn write_recovery(app: AppHandle, snapshot: String) -> Result<(), String> {
    write_text(&app_dir(&app)?.join("recovery.json"), &snapshot)
}

#[tauri::command]
fn read_recovery(app: AppHandle) -> Result<String, String> {
    Ok(read_text(&app_dir(&app)?.join("recovery.json")))
}

#[tauri::command]
fn clear_recovery(app: AppHandle) -> Result<(), String> {
    write_text(&app_dir(&app)?.join("recovery.json"), "")
}

// ---------------------------------------------------------------- CLI / file association

fn is_markdown(p: &str) -> bool {
    let lower = p.to_ascii_lowercase();
    lower.ends_with(".md") || lower.ends_with(".markdown") || lower.ends_with(".txt")
}

#[tauri::command]
fn get_open_paths() -> Vec<String> {
    std::env::args()
        .skip(1)
        .filter(|p| !p.starts_with("--") && is_markdown(p))
        .collect()
}

// ---------------------------------------------------------------- registry (HKCU)

#[cfg(windows)]
fn exe_path() -> Result<String, String> {
    Ok(std::env::current_exe()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string())
}

#[cfg(windows)]
fn open_or_create(
    root: &winreg::RegKey,
    path: &str,
) -> Result<winreg::RegKey, String> {
    use winreg::enums::KEY_WRITE;
    if let Ok(k) = root.open_subkey_with_flags(path, KEY_WRITE) {
        return Ok(k);
    }
    let _ = root.create_subkey(path);
    root.open_subkey_with_flags(path, KEY_WRITE)
        .map_err(|e| format!("注册表写入失败 {}: {}", path, e))
}

#[cfg(windows)]
fn set_file_association(enable: bool) -> Result<(), String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let exe = exe_path()?;
    if !enable {
        for ext in [".md", ".markdown"] {
            let _ = hkcu.delete_subkey_all(format!("Software\\Classes\\{}", ext));
        }
        let _ = hkcu.delete_subkey_all(format!("Software\\Classes\\{}", PROG_ID));
        return Ok(());
    }
    for ext in [".md", ".markdown"] {
        let key = open_or_create(&hkcu, &format!("Software\\Classes\\{}", ext))?;
        key.set_value("", &PROG_ID).map_err(|e| e.to_string())?;
    }
    let prog = open_or_create(&hkcu, &format!("Software\\Classes\\{}", PROG_ID))?;
    prog.set_value("", &"Markdown 文档").map_err(|e| e.to_string())?;
    let icon = open_or_create(
        &hkcu,
        &format!("Software\\Classes\\{}\\DefaultIcon", PROG_ID),
    )?;
    icon.set_value("", &format!("\"{}\",0", exe))
        .map_err(|e| e.to_string())?;
    let cmd = open_or_create(
        &hkcu,
        &format!("Software\\Classes\\{}\\shell\\open\\command", PROG_ID),
    )?;
    cmd.set_value("", &format!("\"{}\" \"%1\"", exe))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(not(windows))]
fn set_file_association(_enable: bool) -> Result<(), String> {
    Ok(())
}

#[cfg(windows)]
fn set_context_menu(enable: bool) -> Result<(), String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if !enable {
        let _ = hkcu.delete_subkey_all(CONTEXT_KEY);
        return Ok(());
    }
    let exe = exe_path()?;
    let key = open_or_create(&hkcu, CONTEXT_KEY)?;
    key.set_value("", &"用 MDNote 打开").map_err(|e| e.to_string())?;
    key.set_value("Icon", &format!("\"{}\",0", exe))
        .map_err(|e| e.to_string())?;
    let cmd = open_or_create(&hkcu, &format!("{}\\command", CONTEXT_KEY))?;
    cmd.set_value("", &format!("\"{}\" \"%1\"", exe))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(not(windows))]
fn set_context_menu(_enable: bool) -> Result<(), String> {
    Ok(())
}

#[cfg(windows)]
fn set_autostart(enable: bool) -> Result<(), String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key = open_or_create(&hkcu, RUN_KEY)?;
    if enable {
        let exe = exe_path()?;
        key.set_value("MDNote", &format!("\"{}\"", exe))
            .map_err(|e| e.to_string())?;
    } else {
        let _ = key.delete_value("MDNote");
    }
    Ok(())
}

#[cfg(not(windows))]
fn set_autostart(_enable: bool) -> Result<(), String> {
    Ok(())
}

fn flag(v: &Value, key: &str) -> bool {
    match v.get(key) {
        Some(Value::Bool(b)) => *b,
        Some(Value::Number(n)) => n.as_u64() == Some(1),
        _ => false,
    }
}

/// 应用在设置/向导中修改组件后，同步系统注册表。
#[tauri::command]
fn apply_components(config: String) -> Result<(), String> {
    let v: Value = serde_json::from_str(&config).map_err(|e| e.to_string())?;
    set_file_association(flag(&v, "fileAssociation"))?;
    set_context_menu(flag(&v, "contextMenu"))?;
    set_autostart(flag(&v, "autostart"))?;
    Ok(())
}

// ---------------------------------------------------------------- config flag / tray

/// 读取 config.json 中的布尔开关；缺省值由调用方决定。
fn config_flag(app: &AppHandle, key: &str, default: bool) -> bool {
    let dir = match app.path().app_config_dir() {
        Ok(d) => d,
        Err(_) => return default,
    };
    let raw = read_text(&dir.join("config.json"));
    match serde_json::from_str::<Value>(&raw)
        .ok()
        .and_then(|v| v.get(key).cloned())
    {
        Some(Value::Bool(b)) => b,
        _ => default,
    }
}

// ---------------------------------------------------------------- tray

fn build_tray(app: &AppHandle) -> Result<(), String> {
    let show = MenuItem::with_id(app, "tray-show", "显示主窗口", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let open = MenuItem::with_id(app, "tray-open", "打开 Markdown 文件…", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let quit = MenuItem::with_id(app, "tray-quit", "退出 MDNote", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let sep = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let menu = Menu::with_items(app, &[&show, &open, &sep, &quit]).map_err(|e| e.to_string())?;

    let mut builder = TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("MDNote · Markdown 编辑器")
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let handle = tray.app_handle();
                if let Some(w) = handle.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
        })
        .on_menu_event(|app, event| match event.id.as_ref() {
            "tray-show" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "tray-open" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
                let _ = app.emit("tray-open-file", ());
            }
            "tray-quit" => app.exit(0),
            _ => {}
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }
    builder.build(app).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let paths: Vec<String> = argv
                .into_iter()
                .skip(1)
                .filter(|p| !p.starts_with("--") && is_markdown(p))
                .collect();
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
            if !paths.is_empty() {
                let _ = app.emit("open-paths", paths);
            }
        }))
        .setup(|app| {
            let handle = app.handle().clone();
            // 托盘默认不创建：用户要求关闭窗口即彻底退出、后台不驻留。
            // 仅在设置里显式开启（trayEnabled=true）且重启后创建。
            if config_flag(&handle, "trayEnabled", false) {
                if let Err(e) = build_tray(&handle) {
                    eprintln!("tray init failed: {}", e);
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // 点 × 直接结束进程：不拦截关闭、不隐藏到托盘。
            if let WindowEvent::CloseRequested { .. } = event {
                window.app_handle().exit(0);
            }
        })
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            read_image,
            path_exists,
            get_recent,
            add_recent,
            clear_recent,
            get_config,
            save_config,
            read_install_components,
            app_version,
            write_recovery,
            read_recovery,
            clear_recovery,
            get_open_paths,
            apply_components,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
