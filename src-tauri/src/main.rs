#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

// ==================== 数据结构 ====================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RSSSource {
    pub sid: i32,
    pub url: String,
    pub name: String,
    pub iconurl: Option<String>,
    pub open_target: i32,
    pub last_fetched: Option<String>,
    pub fetch_frequency: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RSSItem {
    pub _id: Option<i64>,
    pub source: i32,
    pub title: String,
    pub link: String,
    pub date: String,
    pub fetched_date: Option<String>,
    pub thumb: Option<String>,
    pub content: Option<String>,
    pub snippet: Option<String>,
    pub creator: Option<String>,
    pub has_read: bool,
    pub starred: bool,
    pub hidden: bool,
    pub notify: bool,
}

// 应用设置状态
pub struct AppState {
    pub settings: Mutex<HashMap<String, serde_json::Value>>,
}

// ==================== RSS 抓取命令 ====================

#[tauri::command]
async fn fetch_rss_feed(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent("FluentReader/1.1.4")
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch RSS: {}", e))?;

    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    Ok(body)
}

#[tauri::command]
async fn fetch_multiple_feeds(urls: Vec<String>) -> Result<Vec<(String, Result<String, String>)>, String> {
    let client = reqwest::Client::builder()
        .user_agent("FluentReader/1.1.4")
        .build()
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();

    for url in urls {
        let result = async {
            let response = client
                .get(&url)
                .send()
                .await
                .map_err(|e| e.to_string())?;
            
            response
                .text()
                .await
                .map_err(|e| e.to_string())
        }.await;

        match result {
            Ok(body) => results.push((url.clone(), Ok(body))),
            Err(e) => results.push((url.clone(), Err(e))),
        }
    }

    Ok(results)
}

// ==================== 文件操作命令 ====================

#[tauri::command]
async fn read_file_content(path: String) -> Result<String, String> {
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
async fn save_file_content(path: String, content: String) -> Result<bool, String> {
    fs::write(&path, content)
        .map(|_| true)
        .map_err(|e| format!("Failed to save file: {}", e))
}

// ==================== 设置管理命令 ====================

#[tauri::command]
fn set_setting(key: String, value: serde_json::Value, state: State<AppState>) -> Result<(), String> {
    let mut settings = state.settings.lock().map_err(|e| e.to_string())?;
    settings.insert(key, value);
    
    // 保存到文件
    let settings_path = get_settings_path()?;
    let settings_json = serde_json::to_string_pretty(&*settings).map_err(|e| e.to_string())?;
    fs::write(settings_path, settings_json).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
fn get_setting(key: String, state: State<AppState>) -> Result<Option<serde_json::Value>, String> {
    let settings = state.settings.lock().map_err(|e| e.to_string())?;
    Ok(settings.get(&key).cloned())
}

#[tauri::command]
fn get_all_settings(state: State<AppState>) -> Result<HashMap<String, serde_json::Value>, String> {
    let settings = state.settings.lock().map_err(|e| e.to_string())?;
    Ok(settings.clone())
}

#[tauri::command]
fn import_all_settings(configs: HashMap<String, serde_json::Value>, state: State<AppState>) -> Result<(), String> {
    let mut settings = state.settings.lock().map_err(|e| e.to_string())?;
    *settings = configs;
    
    // 保存到文件
    let settings_path = get_settings_path()?;
    let settings_json = serde_json::to_string_pretty(&*settings).map_err(|e| e.to_string())?;
    fs::write(settings_path, settings_json).map_err(|e| e.to_string())?;
    
    Ok(())
}

fn get_settings_path() -> Result<PathBuf, String> {
    let config_dir = dirs::config_dir()
        .ok_or("Failed to get config directory")?;
    Ok(config_dir.join("fluent-reader").join("settings.json"))
}

fn load_settings() -> HashMap<String, serde_json::Value> {
    let settings_path = get_settings_path().ok();
    if let Some(path) = settings_path {
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(settings) = serde_json::from_str(&content) {
                    return settings;
                }
            }
        }
    }
    HashMap::new()
}

// ==================== 系统命令 ====================

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn get_app_data_dir() -> String {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("fluent-reader")
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
async fn write_clipboard(_text: String) -> Result<(), String> {
    // Tauri 1.x 没有内置剪贴板 API，需要使用第三方 crate
    // 这里暂时返回成功，实际实现需要使用 clipboard-win 等 crate
    Ok(())
}

#[tauri::command]
fn show_error_box(title: String, content: String) -> Result<(), String> {
    // 使用系统默认对话框显示错误信息
    #[cfg(target_os = "windows")]
    {
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;
        use winapi::um::winuser::{MessageBoxW, MB_OK, MB_ICONERROR};
        
        let title_wide: Vec<u16> = OsStr::new(&title).encode_wide().chain(Some(0)).collect();
        let content_wide: Vec<u16> = OsStr::new(&content).encode_wide().chain(Some(0)).collect();
        
        unsafe {
            MessageBoxW(
                std::ptr::null_mut(),
                content_wide.as_ptr(),
                title_wide.as_ptr(),
                MB_OK | MB_ICONERROR,
            );
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        // 其他平台使用 rfd crate
        // 这里暂时使用简单的错误返回
        return Err("Platform not supported".to_string());
    }
    
    Ok(())
}

#[tauri::command]
async fn show_message_box(
    _title: String,
    _message: String,
    _confirm: String,
    _cancel: String,
    _default_cancel: bool,
    _message_type: String,
) -> Result<bool, String> {
    // 使用 Tauri 的对话框 API
    // 这个需要在前端调用，这里返回错误
    Err("Use frontend dialog API".to_string())
}

// ==================== 缓存命令 ====================

#[tauri::command]
async fn get_cache_item(key: String) -> Result<Option<serde_json::Value>, String> {
    let cache_dir = dirs::cache_dir()
        .ok_or("Failed to get cache directory")?
        .join("fluent-reader");
    
    if !cache_dir.exists() {
        fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;
    }
    
    let cache_file = cache_dir.join(format!("{}.json", key));
    
    if cache_file.exists() {
        let content = fs::read_to_string(&cache_file).map_err(|e| e.to_string())?;
        let value: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        Ok(Some(value))
    } else {
        Ok(None)
    }
}

#[tauri::command]
async fn set_cache_item(key: String, value: serde_json::Value, _ttl: Option<u64>) -> Result<(), String> {
    let cache_dir = dirs::cache_dir()
        .ok_or("Failed to get cache directory")?
        .join("fluent-reader");
    
    if !cache_dir.exists() {
        fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;
    }
    
    let cache_file = cache_dir.join(format!("{}.json", key));
    let content = serde_json::to_string_pretty(&value).map_err(|e| e.to_string())?;
    fs::write(cache_file, content).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
async fn clear_cache() -> Result<(), String> {
    let cache_dir = dirs::cache_dir()
        .ok_or("Failed to get cache directory")?
        .join("fluent-reader");
    
    if cache_dir.exists() {
        fs::remove_dir_all(&cache_dir).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
async fn get_cache_size() -> Result<u64, String> {
    let cache_dir = dirs::cache_dir()
        .ok_or("Failed to get cache directory")?
        .join("fluent-reader");
    
    if !cache_dir.exists() {
        return Ok(0);
    }
    
    let mut total_size = 0u64;
    for entry in fs::read_dir(&cache_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.file_type().map_err(|e| e.to_string())?.is_file() {
            total_size += entry.metadata().map_err(|e| e.to_string())?.len();
        }
    }
    
    Ok(total_size)
}

// ==================== 窗口控制命令 ====================

#[tauri::command]
async fn close_window(window: tauri::Window) {
    window.close().ok();
}

#[tauri::command]
async fn minimize_window(window: tauri::Window) {
    window.minimize().ok();
}

#[tauri::command]
async fn maximize_window(window: tauri::Window) {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().ok();
    } else {
        window.maximize().ok();
    }
}

#[tauri::command]
async fn is_maximized(window: tauri::Window) -> Result<bool, String> {
    window.is_maximized().map_err(|e| e.to_string())
}

#[tauri::command]
async fn is_fullscreen(window: tauri::Window) -> Result<bool, String> {
    window.is_fullscreen().map_err(|e| e.to_string())
}

#[tauri::command]
async fn is_focused(window: tauri::Window) -> Result<bool, String> {
    window.is_focused().map_err(|e| e.to_string())
}

#[tauri::command]
async fn request_focus(window: tauri::Window) {
    window.set_focus().ok();
}

#[tauri::command]
async fn request_attention(window: tauri::Window) {
    window.set_always_on_top(true).ok();
    // 使用异步延迟
    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    window.set_always_on_top(false).ok();
}

// ==================== Ollama 代理命令 ====================

#[derive(Debug, Deserialize)]
pub struct OllamaRequest {
    pub url: String,
    pub method: Option<String>,
    pub body: Option<serde_json::Value>,
}

#[tauri::command]
async fn proxy_ollama(request: OllamaRequest) -> Result<serde_json::Value, String> {
    // Ollama 可能需要较长时间加载模型，特别是首次调用
    // 设置 300 秒（5 分钟）超时
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let method = request.method.as_deref().unwrap_or("POST");
    let body = request.body.clone();

    println!("[Ollama Proxy] Requesting: {} {}", method, request.url);
    if let Some(ref b) = body {
        if let Some(model) = b.get("model") {
            println!("[Ollama Proxy] Model: {}", model);
        }
    }

    let response = if method == "GET" {
        client
            .get(&request.url)
            .send()
            .await
            .map_err(|e| format!("Ollama request failed: {}", e))?
    } else {
        let mut req = client.post(&request.url);
        if let Some(body) = body {
            req = req.json(&body);
        }
        req
            .send()
            .await
            .map_err(|e| format!("Ollama request failed: {}", e))?
    };

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    if !status.is_success() {
        return Err(format!("Ollama returned {}: {}", status.as_u16(), text));
    }

    serde_json::from_str(&text)
        .map_err(|e| format!("Failed to parse Ollama response as JSON: {}", e))
}

// ==================== 主函数 ====================

fn main() {
    let settings = load_settings();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            settings: Mutex::new(settings),
        })
        .invoke_handler(tauri::generate_handler![
            // RSS 相关
            fetch_rss_feed,
            fetch_multiple_feeds,
            // 文件操作
            read_file_content,
            save_file_content,
            // 系统相关
            get_app_version,
            get_app_data_dir,
            write_clipboard,
            show_error_box,
            show_message_box,
            // 窗口控制
            close_window,
            minimize_window,
            maximize_window,
            is_maximized,
            is_fullscreen,
            is_focused,
            request_focus,
            request_attention,
            // 设置管理
            set_setting,
            get_setting,
            get_all_settings,
            import_all_settings,
            // 缓存管理
            get_cache_item,
            set_cache_item,
            clear_cache,
            get_cache_size,
            // Ollama 代理
            proxy_ollama,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
