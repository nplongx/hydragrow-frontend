use crate::models::AppSettings;
use reqwest::Client;
use serde::{de::DeserializeOwned, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

/// Helper để lấy cấu hình kết nối từ tauri-plugin-store
pub fn get_settings(app: &AppHandle) -> Result<AppSettings, String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;

    let backend_url = store
        .get("backend_url")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or("http://192.168.1.3:8080".to_string())
        .trim_end_matches('/')
        .to_string();

    let api_key = store
        .get("api_key")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or("".to_string())
        .to_string();

    let device_id = store
        .get("device_id")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or("".to_string())
        .to_string();

    Ok(AppSettings {
        api_key,
        backend_url,
        device_id,
    })
}

/// Generic HTTP GET
pub async fn get<T: DeserializeOwned>(app: &AppHandle, path: &str) -> Result<T, String> {
    let settings = get_settings(app)?;
    let client = Client::new();
    let url = format!("{}{}", settings.backend_url, path);

    let res = client
        .get(&url)
        .header("X-API-Key", "long")
        .send()
        .await
        .map_err(|e| format!("Lỗi kết nối mạng: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Lỗi từ server: HTTP {}", res.status()));
    }

    res.json::<T>()
        .await
        .map_err(|e| format!("Lỗi parse dữ liệu (JSON): {}", e))
}

/// Generic HTTP POST
pub async fn post<Req: Serialize, Res: DeserializeOwned>(
    app: &AppHandle,
    path: &str,
    payload: &Req,
) -> Result<Res, String> {
    let settings = get_settings(app)?;
    let client = Client::new();
    let url = format!("{}{}", settings.backend_url, path);

    let res = client
        .post(&url)
        .header("X-API-Key", "long")
        .json(payload)
        .send()
        .await
        .map_err(|e| format!("Lỗi kết nối mạng: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Lỗi từ server: HTTP {}", res.status()));
    }

    res.json::<Res>()
        .await
        .map_err(|e| format!("Lỗi parse dữ liệu (JSON): {}", e))
}

/// Generic HTTP PUT (thường không trả về body data hoặc trả về empty)
pub async fn put<Req: Serialize>(
    app: &AppHandle,
    path: &str,
    payload: &Req,
) -> Result<serde_json::Value, String> {
    let settings = get_settings(app)?;
    let client = Client::new();
    let url = format!("{}{}", settings.backend_url, path);

    let res = client
        .put(&url)
        .header("X-API-Key", settings.api_key)
        .json(payload)
        .send()
        .await
        .map_err(|e| format!("Lỗi kết nối mạng: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Lỗi từ server: HTTP {}", res.status()));
    }

    let json = res
        .json::<serde_json::Value>()
        .await
        .map_err(|e| e.to_string())?;
    Ok(json)
}
