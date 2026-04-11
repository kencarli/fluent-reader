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

/// 清理 RSS XML 内容,修复常见的格式问题
fn clean_rss_xml(xml: &str) -> String {
    let mut cleaned = String::with_capacity(xml.len());
    let mut in_tag = false;
    let mut in_cdata = false;
    let mut chars = xml.chars().peekable();
    // 用于检测 CDATA 的字符缓冲区（保存最近的几个字符）
    let mut char_buffer: Vec<char> = Vec::with_capacity(10);

    while let Some(c) = chars.next() {
        // 检测 CDATA 区域 - 使用字符缓冲区而不是字节索引
        char_buffer.push(c);
        if char_buffer.len() > 10 {
            char_buffer.remove(0);
        }
        
        if !in_tag {
            let buffer_str: String = char_buffer.iter().collect();
            if buffer_str.ends_with("<![CDATA") {
                in_cdata = true;
            }
        }
        
        if in_cdata && c == ']' && chars.peek() == Some(&']') {
            in_cdata = false;
        }
        
        if c == '<' {
            in_tag = true;
            cleaned.push(c);
        } else if c == '>' {
            in_tag = false;
            cleaned.push(c);
        } else if in_tag {
            // 在标签内部,直接复制
            cleaned.push(c);
        } else if in_cdata {
            // 在 CDATA 内部,直接复制
            cleaned.push(c);
        } else {
            // 在标签外部,修复未编码的 <
            if c == '<' {
                cleaned.push_str("&lt;");
            } else if c == '&' {
                // 检查是否是实体引用
                let mut entity = String::from("&");
                let mut is_entity = false;
                let mut temp_chars = chars.clone();
                
                while let Some(next_c) = temp_chars.next() {
                    entity.push(next_c);
                    if next_c == ';' {
                        is_entity = true;
                        break;
                    }
                    if !next_c.is_alphanumeric() && next_c != '#' {
                        break;
                    }
                }
                
                if is_entity {
                    // 是实体引用,消耗这些字符
                    for _ in 0..entity.len() - 1 {
                        chars.next();
                    }
                    cleaned.push_str(&entity);
                } else {
                    // 不是实体引用,转义 &
                    cleaned.push_str("&amp;");
                }
            } else {
                cleaned.push(c);
            }
        }
    }
    
    cleaned
}

#[tauri::command]
async fn fetch_rss_feed(url: String) -> Result<String, String> {
    // 首先尝试直接访问
    let result = fetch_rss_direct(&url).await;
    
    match result {
        Ok(content) => Ok(content),
        Err(e) => {
            // 如果失败，尝试通过 rss2json API 获取
            println!("[RSS] Direct fetch failed: {}, trying rss2json proxy", e);
            fetch_rss_via_proxy(&url).await
        }
    }
}

async fn fetch_rss_direct(url: &str) -> Result<String, String> {
    // 创建高度模拟浏览器的 HTTP 客户端
    let client = reqwest::Client::builder()
        // 使用最新 Chrome 的 User-Agent
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
        .gzip(true)
        .brotli(true)
        .deflate(true)
        // 启用 HTTP/2
        .http2_prior_knowledge()
        // 自动处理重定向
        .redirect(reqwest::redirect::Policy::limited(10))
        // 启用 Cookie 存储
        .cookie_store(true)
        // 设置合理超时
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    // 第一次尝试：标准请求
    let result = client
        .get(url)
        // 完整的浏览器 Accept 头
        .header("Accept", "application/rss+xml, application/xml, text/xml, application/atom+xml, text/html;q=0.9, */*;q=0.8")
        .header("Accept-Language", "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7")
        .header("Accept-Encoding", "gzip, deflate, br, zstd")
        .header("Connection", "keep-alive")
        .header("Cache-Control", "max-age=0")
        .header("Sec-Fetch-Dest", "empty")
        .header("Sec-Fetch-Mode", "cors")
        .header("Sec-Fetch-Site", "cross-site")
        .header("Sec-Ch-Ua", "\"Chromium\";v=\"124\", \"Google Chrome\";v=\"124\", \"Not-A.Brand\";v=\"99\"")
        .header("Sec-Ch-Ua-Mobile", "?0")
        .header("Sec-Ch-Ua-Platform", "\"Windows\"")
        .header("Upgrade-Insecure-Requests", "1")
        .header("DNT", "1")
        .send()
        .await;

    // 如果第一次失败，等待后重试一次
    let response = match result {
        Ok(resp) => resp,
        Err(_) => {
            println!("[RSS] First attempt failed, retrying after delay...");
            tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
            
            client
                .get(url)
                .header("Accept", "application/rss+xml, application/xml, text/xml, application/atom+xml, text/html;q=0.9, */*;q=0.8")
                .header("Accept-Language", "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7")
                .header("Accept-Encoding", "gzip, deflate, br")
                .header("Cache-Control", "no-cache")
                .header("Pragma", "no-cache")
                .send()
                .await
                .map_err(|e| format!("Failed to fetch RSS after retry: {}", e))?
        }
    };

    let status = response.status();
    
    // 接受 200-299 的成功状态码
    if !status.is_success() {
        return Err(format!("HTTP {} - {}", status.as_u16(), status.canonical_reason().unwrap_or("Unknown")));
    }

    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    // 验证响应内容是否为 XML/RSS
    if !body.contains("<?xml") && !body.contains("<rss") && !body.contains("<feed") {
        return Err("Response does not appear to be valid RSS/XML".to_string());
    }

    // 清理 XML 内容,修复格式问题
    Ok(clean_rss_xml(&body))
}

async fn fetch_rss_via_proxy(url: &str) -> Result<String, String> {
    // 使用 rss2json API 作为代理
    let encoded_url = urlencoding::encode(url);
    let api_url = format!("https://api.rss2json.com/v1/api.json?rss_url={}", encoded_url);
    
    println!("[RSS] Trying rss2json proxy: {}", api_url);
    
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&api_url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch via proxy: {}", e))?;

    let status = response.status();
    println!("[RSS] rss2json response status: {}", status);

    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read proxy response: {}", e))?;

    println!("[RSS] rss2json response length: {} bytes", body.len());

    // 将 JSON 转换回 RSS XML 格式
    let json: serde_json::Value = match serde_json::from_str(&body) {
        Ok(j) => j,
        Err(e) => {
            println!("[RSS] Failed to parse JSON: {}", e);
            println!("[RSS] Response preview: {}", &body[..body.len().min(500)]);
            return Err(format!("Failed to parse JSON: {}", e));
        }
    };

    println!("[RSS] rss2json status field: {:?}", json["status"]);

    if json["status"] == "ok" {
        // 构建简单的 RSS XML
        let title = json["feed"]["title"].as_str().unwrap_or("");
        let link = json["feed"]["link"].as_str().unwrap_or("");
        let description = json["feed"]["description"].as_str().unwrap_or("");
        
        let mut xml = format!(r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>{}</title>
    <link>{}</link>
    <description>{}</description>
"#, escape_xml(title), escape_xml(link), escape_xml(description));

        if let Some(items) = json["items"].as_array() {
            println!("[RSS] Converting {} items from JSON to XML", items.len());
            for item in items {
                let item_title = item["title"].as_str().unwrap_or("");
                let item_link = item["link"].as_str().unwrap_or("");
                let item_desc = item["description"].as_str().unwrap_or("");
                let item_date = item["pubDate"].as_str().unwrap_or("");
                let item_content = item["content"].as_str().unwrap_or("");
                let item_author = item["author"].as_str().unwrap_or("");
                
                xml.push_str(&format!(r#"    <item>
      <title>{}</title>
      <link>{}</link>
      <description>{}</description>
      <content:encoded><![CDATA[{}]]></content:encoded>
      <author>{}</author>
      <pubDate>{}</pubDate>
    </item>
"#, 
                    escape_xml(item_title), 
                    escape_xml(item_link), 
                    escape_xml(item_desc),
                    item_content,
                    escape_xml(item_author),
                    escape_xml(item_date)
                ));
            }
        }

        xml.push_str("  </channel>\n</rss>");
        println!("[RSS] Successfully converted to XML, {} bytes", xml.len());
        Ok(xml)
    } else {
        let error_msg = json["message"].as_str().unwrap_or("Unknown error");
        println!("[RSS] rss2json API error: {}", error_msg);
        Err(format!("rss2json API returned error: {}", error_msg))
    }
}

fn escape_xml(s: &str) -> String {
    s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&apos;")
}

// ==================== 网页内容获取命令 ====================

#[tauri::command]
async fn fetch_webpage(url: String) -> Result<String, String> {
    // 创建更像浏览器的 HTTP 客户端
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .gzip(true)
        .brotli(true)
        .redirect(reqwest::redirect::Policy::limited(10))
        .cookie_store(true)
        .build()
        .map_err(|e| e.to_string())?;

    // 第一次请求：获取 HTML
    let response = client
        .get(&url)
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8")
        .header("Accept-Language", "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7")
        .header("Accept-Encoding", "gzip, deflate, br")
        .header("Connection", "keep-alive")
        .header("Sec-Ch-Ua", "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Google Chrome\";v=\"120\"")
        .header("Sec-Ch-Ua-Mobile", "?0")
        .header("Sec-Ch-Ua-Platform", "\"Windows\"")
        .header("Sec-Fetch-Dest", "document")
        .header("Sec-Fetch-Mode", "navigate")
        .header("Sec-Fetch-Site", "none")
        .header("Sec-Fetch-User", "?1")
        .header("Upgrade-Insecure-Requests", "1")
        .header("Cache-Control", "max-age=0")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch webpage: {}", e))?;

    let status = response.status();
    
    // 即使 403 也返回内容，让前端 Mercury Parser 尝试处理
    if !status.is_success() && status.as_u16() != 403 {
        return Err(format!("HTTP {} - {}", status.as_u16(), status.canonical_reason().unwrap_or("Unknown")));
    }

    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read webpage: {}", e))?;

    // 返回原始 HTML，前端会使用 Mercury Parser 提取正文
    if status.as_u16() == 403 {
        // 对于 403，在返回的 HTML 中添加提示
        Ok(format!("<!-- HTTP 403: Access denied. Website may have anti-bot protection. -->\n{}", body))
    } else {
        Ok(body)
    }
}

#[tauri::command]
async fn fetch_multiple_feeds(urls: Vec<String>) -> Result<Vec<(String, Result<String, String>)>, String> {
    // 创建优化的 HTTP 客户端
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
        .gzip(true)
        .brotli(true)
        .redirect(reqwest::redirect::Policy::limited(10))
        .cookie_store(true)
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();

    for url in urls {
        // 为每个 URL 实现带重试的抓取
        let result = async {
            // 第一次尝试
            let response = client
                .get(&url)
                .header("Accept", "application/rss+xml, application/xml, text/xml, application/atom+xml, text/html;q=0.9, */*;q=0.8")
                .header("Accept-Language", "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7")
                .header("Accept-Encoding", "gzip, deflate, br")
                .header("Sec-Fetch-Dest", "empty")
                .header("Sec-Fetch-Mode", "cors")
                .header("Sec-Fetch-Site", "cross-site")
                .send()
                .await
                .map_err(|e| e.to_string())?;

            let status = response.status();
            if !status.is_success() {
                return Err(format!("HTTP {} - {}", status.as_u16(), status.canonical_reason().unwrap_or("Unknown")));
            }

            let body = response
                .text()
                .await
                .map_err(|e| e.to_string())?;

            // 验证 RSS 内容
            if !body.contains("<?xml") && !body.contains("<rss") && !body.contains("<feed") {
                return Err("Invalid RSS/XML response".to_string());
            }

            // 清理 XML 内容
            Ok(clean_rss_xml(&body))
        }.await;

        // 如果失败，等待后重试一次
        let result = match result {
            Ok(content) => Ok(content),
            Err(e) => {
                println!("[RSS] First attempt failed for {}: {}, retrying...", url, e);
                tokio::time::sleep(std::time::Duration::from_millis(2000)).await;
                
                client
                    .get(&url)
                    .header("Accept", "application/rss+xml, application/xml, text/xml, text/html;q=0.9")
                    .header("Accept-Language", "en-US,en;q=0.9")
                    .header("Cache-Control", "no-cache")
                    .header("Pragma", "no-cache")
                    .send()
                    .await
                    .map_err(|e| e.to_string())
                    .and_then(|response| {
                        async move {
                            let status = response.status();
                            if !status.is_success() {
                                return Err(format!("Retry failed: HTTP {} - {}", status.as_u16(), status.canonical_reason().unwrap_or("Unknown")));
                            }
                            
                            let body = response.text().await.map_err(|e| e.to_string())?;
                            
                            if !body.contains("<?xml") && !body.contains("<rss") && !body.contains("<feed") {
                                return Err("Invalid RSS/XML after retry".to_string());
                            }
                            
                            Ok(clean_rss_xml(&body))
                        }.await
                    })
            }
        };

        match result {
            Ok(body) => results.push((url.clone(), Ok(body))),
            Err(e) => {
                println!("[RSS] All attempts failed for {}: {}", url, e);
                results.push((url.clone(), Err(e)))
            }
        }
        
        // 在请求之间添加小延迟，避免被限流
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
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

// ==================== 对话框命令 ====================

#[tauri::command]
async fn show_open_dialog(
    app: tauri::AppHandle,
    filters: Option<Vec<(String, Vec<String>)>>,
    default_path: Option<String>,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    
    let mut dialog = app.dialog().file();
    
    // 添加过滤器
    if let Some(f) = filters {
        for (name, extensions) in f {
            let ext_refs: Vec<&str> = extensions.iter().map(|s| s.as_str()).collect();
            dialog = dialog.add_filter(&name, &ext_refs);
        }
    }
    
    // 设置默认文件名
    if let Some(path) = default_path {
        if let Some(file_name) = std::path::Path::new(&path).file_name() {
            if let Some(name_str) = file_name.to_str() {
                dialog = dialog.set_file_name(name_str);
            }
        }
    }
    
    // 阻塞式选择文件
    let result = dialog.blocking_pick_file();
    
    match result {
        Some(path) => {
            // FilePath 枚举转换为字符串
            match path {
                tauri_plugin_dialog::FilePath::Path(p) => {
                    Ok(p.to_str().map(|s| s.to_string()))
                }
                tauri_plugin_dialog::FilePath::Url(url) => {
                    Ok(Some(url.to_string()))
                }
            }
        }
        None => Ok(None),
    }
}

#[tauri::command]
async fn show_save_dialog(
    app: tauri::AppHandle,
    filters: Option<Vec<(String, Vec<String>)>>,
    default_path: Option<String>,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    
    let mut dialog = app.dialog().file();
    
    // 添加过滤器
    if let Some(f) = filters {
        for (name, extensions) in f {
            let ext_refs: Vec<&str> = extensions.iter().map(|s| s.as_str()).collect();
            dialog = dialog.add_filter(&name, &ext_refs);
        }
    }
    
    // 设置默认文件名
    if let Some(path) = default_path {
        if let Some(file_name) = std::path::Path::new(&path).file_name() {
            if let Some(name_str) = file_name.to_str() {
                dialog = dialog.set_file_name(name_str);
            }
        }
    }
    
    // 阻塞式保存文件
    let result = dialog.blocking_save_file();
    
    match result {
        Some(path) => {
            match path {
                tauri_plugin_dialog::FilePath::Path(p) => {
                    Ok(p.to_str().map(|s| s.to_string()))
                }
                tauri_plugin_dialog::FilePath::Url(url) => {
                    Ok(Some(url.to_string()))
                }
            }
        }
        None => Ok(None),
    }
}

#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    use std::fs;
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
async fn write_file(path: String, content: String) -> Result<(), String> {
    use std::fs;
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write file: {}", e))
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
            fetch_webpage,
            // 文件操作
            read_file_content,
            save_file_content,
            read_file,
            write_file,
            // 对话框
            show_open_dialog,
            show_save_dialog,
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
