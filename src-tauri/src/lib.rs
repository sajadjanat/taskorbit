use std::fs;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{Manager, WebviewWindow};
use url::Url;

struct ConnectionState {
    local_url: Mutex<Option<Url>>,
    first_entry: AtomicBool,
}
impl Default for ConnectionState {
    fn default() -> Self {
        Self {
            local_url: Mutex::new(None),
            first_entry: AtomicBool::new(true),
        }
    }
}

fn validate_server(address: &str) -> Result<Url, String> {
    let mut url = Url::parse(address.trim()).map_err(|_| "Enter a valid server URL")?;
    let local = matches!(
        url.host_str(),
        Some("localhost") | Some("127.0.0.1") | Some("[::1]")
    );
    if url.scheme() != "https" && !(url.scheme() == "http" && local) {
        return Err("Use HTTPS for your self-hosted server".into());
    }
    if url.host_str().is_none() || !url.username().is_empty() || url.password().is_some() {
        return Err("URL must not contain credentials".into());
    }
    if url.path() != "/" && !url.path().is_empty() {
        return Err("Enter the root server address, without a path".into());
    }
    url.set_fragment(None);
    url.set_query(None);
    Ok(url)
}

#[tauri::command]
fn connect_server(window: WebviewWindow, address: String) -> Result<(), String> {
    local_only(&window)?;
    let url = validate_server(&address)?;
    let dir = window
        .app_handle()
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::write(dir.join("server.txt"), url.as_str()).map_err(|e| e.to_string())?;
    window.navigate(url).map_err(|e| e.to_string())
}

fn is_local_url(current: &Url) -> bool {
    (current.scheme() == "tauri" && current.host_str() == Some("localhost"))
        || (matches!(current.scheme(), "http" | "https")
            && current.host_str() == Some("tauri.localhost"))
        || (cfg!(debug_assertions)
            && current.scheme() == "http"
            && matches!(current.host_str(), Some("localhost") | Some("127.0.0.1"))
            && current.port() == Some(5173))
}

fn local_only(window: &WebviewWindow) -> Result<(), String> {
    if !is_local_url(&window.url().map_err(|e| e.to_string())?) {
        return Err("Native commands are restricted to the local connection screen".into());
    }
    Ok(())
}

#[tauri::command]
fn saved_server(window: WebviewWindow) -> Result<String, String> {
    local_only(&window)?;
    let dir = window
        .app_handle()
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?;
    Ok(fs::read_to_string(dir.join("server.txt")).unwrap_or_default())
}

#[tauri::command]
fn resume_server(window: WebviewWindow) -> Result<(), String> {
    let saved = saved_server(window.clone())?;
    let url = validate_server(&saved)?;
    window.navigate(url).map_err(|e| e.to_string())
}

#[tauri::command]
fn should_resume(window: WebviewWindow) -> Result<bool, String> {
    local_only(&window)?;
    Ok(window
        .state::<ConnectionState>()
        .first_entry
        .swap(false, Ordering::SeqCst))
}

#[tauri::command]
fn client_info(window: WebviewWindow) -> Result<serde_json::Value, String> {
    local_only(&window)?;
    Ok(serde_json::json!({"version":env!("CARGO_PKG_VERSION"),"platform":std::env::consts::OS}))
}

#[tauri::command]
async fn check_client_update(window: WebviewWindow) -> Result<Option<serde_json::Value>, String> {
    local_only(&window)?;
    #[cfg(desktop)]
    {
        use tauri_plugin_updater::UpdaterExt;
        let update = window
            .updater_builder()
            .timeout(std::time::Duration::from_secs(20))
            .build()
            .map_err(|e| e.to_string())?
            .check()
            .await
            .map_err(|e| e.to_string())?;
        Ok(update.map(|update|{
            let metadata=serde_json::json!({"currentVersion":update.current_version,"version":update.version,"body":update.body,"date":update.raw_json.get("pub_date"),"rawJson":update.raw_json});
            let rid=window.resources_table().add(update);
            let mut metadata=metadata;metadata["rid"]=serde_json::json!(rid);metadata
        }))
    }
    #[cfg(mobile)]
    {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(20))
            .user_agent("TaskOrbit-Android")
            .build()
            .map_err(|e| e.to_string())?;
        let release: serde_json::Value = client
            .get("https://api.github.com/repos/sajadjanat/taskorbit/releases/latest")
            .send()
            .await
            .map_err(|e| e.to_string())?
            .error_for_status()
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())?;
        let tag = release["tag_name"]
            .as_str()
            .ok_or("Release version missing")?;
        let version =
            semver::Version::parse(tag.trim_start_matches('v')).map_err(|e| e.to_string())?;
        if !version.pre.is_empty() || release["draft"] == true || release["prerelease"] == true {
            return Err("No eligible release".into());
        }
        if version <= semver::Version::parse(env!("CARGO_PKG_VERSION")).unwrap() {
            return Ok(None);
        }
        let apk = release["assets"]
            .as_array()
            .ok_or("Release assets missing")?
            .iter()
            .find(|a| a["name"] == "taskorbit-android-arm64.apk")
            .ok_or("Android APK unavailable")?;
        let url = apk["browser_download_url"]
            .as_str()
            .ok_or("APK address missing")?;
        if url!=format!("https://github.com/sajadjanat/taskorbit/releases/download/v{version}/taskorbit-android-arm64.apk"){return Err("Invalid APK address".into());}
        Ok(Some(
            serde_json::json!({"version":version.to_string(),"body":release["body"],"url":url,"android":true}),
        ))
    }
}

#[tauri::command]
fn open_apk_update(window: WebviewWindow, version: String) -> Result<(), String> {
    local_only(&window)?;
    let parsed = semver::Version::parse(&version).map_err(|e| e.to_string())?;
    if !parsed.pre.is_empty() || !parsed.build.is_empty() {
        return Err("Invalid version".into());
    }
    use tauri_plugin_opener::OpenerExt;
    window.app_handle().opener().open_url(format!("https://github.com/sajadjanat/taskorbit/releases/download/v{parsed}/taskorbit-android-arm64.apk"),None::<&str>).map_err(|e|e.to_string())
}

#[tauri::command]
fn restart_client(window: WebviewWindow) -> Result<(), String> {
    local_only(&window)?;
    window.app_handle().restart();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ConnectionState::default())
        .on_page_load(|webview, payload| {
            // Setup runs before the first navigation: window.url() can still be about:blank.
            // Capture only the actual bundled origin from a navigation event.
            if webview.label() == "main" && is_local_url(payload.url()) {
                let mut url = payload.url().clone();
                url.set_query(None);
                url.set_fragment(None);
                *webview.state::<ConnectionState>().local_url.lock().unwrap() = Some(url);
            }
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            connect_server,
            saved_server,
            resume_server,
            should_resume,
            client_info,
            check_client_update,
            open_apk_update,
            restart_client
        ])
        .setup(|app| {
            #[cfg(desktop)]
            {
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
                use tauri::menu::{Menu, MenuItem, Submenu};
                let item = MenuItem::with_id(
                    app,
                    "updates",
                    "Server connection and updates…",
                    true,
                    None::<&str>,
                )?;
                let menu = Menu::default(app.handle())?;
                menu.append(&Submenu::with_items(app, "Connection", true, &[&item])?)?;
                app.set_menu(menu)?;
                app.on_menu_event(move |app, event| {
                    if event.id().as_ref() == "updates" {
                        if let Some(window) = app.get_webview_window("main") {
                            let local = app
                                .state::<ConnectionState>()
                                .local_url
                                .lock()
                                .unwrap()
                                .clone();
                            if let Some(mut url) = local {
                                url.set_query(Some("settings=1"));
                                let _ = window.navigate(url);
                            }
                        }
                    }
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("TaskOrbit failed to start");
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn requires_secure_remote_origin() {
        assert!(validate_server("https://tasks.example.com").is_ok());
        assert!(validate_server("http://tasks.example.com").is_err());
        assert!(validate_server("http://127.0.0.1:4310").is_ok());
    }
    #[test]
    fn rejects_credentials_and_paths() {
        assert!(validate_server("https://user:secret@example.com").is_err());
        assert!(validate_server("https://example.com/api").is_err());
        assert!(validate_server("javascript:alert(1)").is_err());
    }
    #[test]
    fn blank_and_remote_pages_cannot_be_local_settings() {
        assert!(!is_local_url(&Url::parse("about:blank").unwrap()));
        assert!(!is_local_url(
            &Url::parse("https://tasks.example.com/").unwrap()
        ));
        assert!(is_local_url(
            &Url::parse("http://tauri.localhost/?settings=1").unwrap()
        ));
        assert!(is_local_url(&Url::parse("tauri://localhost/").unwrap()));
    }
}
