use tauri::{Manager, WebviewWindow};
use std::fs;
use url::Url;

fn validate_server(address: &str) -> Result<Url, String> {
    let mut url = Url::parse(address.trim()).map_err(|_| "Enter a valid server URL")?;
    let local = matches!(url.host_str(), Some("localhost") | Some("127.0.0.1") | Some("[::1]"));
    if url.scheme() != "https" && !(url.scheme() == "http" && local) { return Err("Use HTTPS for your self-hosted server".into()); }
    if url.host_str().is_none() || !url.username().is_empty() || url.password().is_some() { return Err("URL must not contain credentials".into()); }
    if url.path() != "/" && !url.path().is_empty() { return Err("Enter the root server address, without a path".into()); }
    url.set_fragment(None); url.set_query(None);
    Ok(url)
}

#[tauri::command]
fn connect_server(window: WebviewWindow, address: String) -> Result<(), String> {
    local_only(&window)?;
    let url = validate_server(&address)?;
    let dir = window.app_handle().path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e|e.to_string())?;
    fs::write(dir.join("server.txt"), url.as_str()).map_err(|e|e.to_string())?;
    window.navigate(url).map_err(|e|e.to_string())
}

fn local_only(window: &WebviewWindow) -> Result<(), String> {
    let current=window.url().map_err(|e|e.to_string())?;
    let local=current.scheme()=="tauri" || current.host_str()==Some("tauri.localhost") || (matches!(current.host_str(),Some("localhost")|Some("127.0.0.1")) && current.port()==Some(5173));
    if !local {return Err("Native commands are restricted to the local connection screen".into());}
    Ok(())
}

#[tauri::command]
fn saved_server(window: WebviewWindow) -> Result<String,String> {
    local_only(&window)?;
    let dir=window.app_handle().path().app_config_dir().map_err(|e|e.to_string())?;
    Ok(fs::read_to_string(dir.join("server.txt")).unwrap_or_default())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![connect_server,saved_server])
        .setup(|app| {
            let window=app.get_webview_window("main").unwrap();
            let dir=app.path().app_config_dir()?;
            // Always open the local connection screen. Remember the address, never credentials.
            if let Ok(value)=fs::read_to_string(dir.join("server.txt")) {
                if let Ok(url)=validate_server(&value) {
                    let escaped=url.as_str().replace('\\', "\\\\").replace('\'', "\\'");
                    window.eval(&format!("window.localStorage.setItem('taskorbit.server','{}');",escaped))?;
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("TaskOrbit failed to start");
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn requires_secure_remote_origin() {assert!(validate_server("https://tasks.example.com").is_ok());assert!(validate_server("http://tasks.example.com").is_err());assert!(validate_server("http://127.0.0.1:4310").is_ok());}
    #[test] fn rejects_credentials_and_paths(){assert!(validate_server("https://user:secret@example.com").is_err());assert!(validate_server("https://example.com/api").is_err());assert!(validate_server("javascript:alert(1)").is_err());}
}
