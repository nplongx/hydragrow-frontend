// src-tauri/src/commands.rs
use reqwest::Client;
use serde::{de::DeserializeOwned, Serialize};
use serde_json::Value;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

use crate::{
    http_client,
    models::{
        AppSettings, DeviceConfig, DosingCalibration, Esp32AggregatedConfig, SafetyConfig,
        SensorCalibration, WaterConfig,
    },
    ws_client,
};

// ==========================================
// 0. HTTP HELPERS (Đọc từ tauri-plugin-store)
// ==========================================

/// Helper để lấy cấu hình kết nối từ tauri-plugin-store
pub fn get_settings(app: &AppHandle) -> Result<AppSettings, String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;

    let backend_url = store
        .get("backend_url")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or("http://192.168.1.3:8000".to_string())
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
        .header("X-API-Key", settings.api_key) // Đã đổi "long" thành tham số lấy từ store
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
        .header("X-API-Key", settings.api_key)
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

/// Generic HTTP PUT
pub async fn put<Req: Serialize>(
    app: &AppHandle,
    path: &str,
    payload: &Req,
) -> Result<Value, String> {
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

    let json = res.json::<Value>().await.map_err(|e| e.to_string())?;
    Ok(json)
}

// ==========================================
// 1. DEVICE CONFIG
// ==========================================

#[tauri::command]
pub async fn get_device_config(app: AppHandle, device_id: String) -> Result<DeviceConfig, String> {
    let path = format!("/api/devices/{}/config", device_id);
    get(&app, &path).await
}

#[tauri::command]
pub async fn update_device_config(
    app: AppHandle,
    device_id: String,
    config: DeviceConfig,
) -> Result<Value, String> {
    let path = format!("/api/devices/{}/config", device_id);
    put(&app, &path, &config).await
}

// ==========================================
// 2. WATER CONFIG
// ==========================================

#[tauri::command]
pub async fn get_water_config(app: AppHandle, device_id: String) -> Result<WaterConfig, String> {
    let path = format!("/api/devices/{}/config/water", device_id);
    get(&app, &path).await
}

#[tauri::command]
pub async fn update_water_config(
    app: AppHandle,
    device_id: String,
    config: WaterConfig,
) -> Result<Value, String> {
    let path = format!("/api/devices/{}/config/water", device_id);
    post(&app, &path, &config).await // Backend dùng POST
}

// ==========================================
// 3. SAFETY CONFIG
// ==========================================

#[tauri::command]
pub async fn get_safety_config(app: AppHandle, device_id: String) -> Result<SafetyConfig, String> {
    let path = format!("/api/devices/{}/config/safety", device_id);
    get(&app, &path).await
}

#[tauri::command]
pub async fn update_safety_config(
    app: AppHandle,
    device_id: String,
    config: SafetyConfig,
) -> Result<Value, String> {
    let path = format!("/api/devices/{}/config/safety", device_id);
    post(&app, &path, &config).await // Backend dùng POST
}

// ==========================================
// 4. SENSOR CALIBRATION
// ==========================================

#[tauri::command]
pub async fn get_sensor_calibration(
    app: AppHandle,
    device_id: String,
) -> Result<SensorCalibration, String> {
    let path = format!("/api/devices/{}/calibration/sensor", device_id);
    get(&app, &path).await
}

#[tauri::command]
pub async fn update_sensor_calibration(
    app: AppHandle,
    device_id: String,
    config: SensorCalibration,
) -> Result<Value, String> {
    let path = format!("/api/devices/{}/calibration/sensor", device_id);
    post(&app, &path, &config).await
}

// ==========================================
// 5. DOSING CALIBRATION
// ==========================================

#[tauri::command]
pub async fn get_dosing_calibration(
    app: AppHandle,
    device_id: String,
) -> Result<DosingCalibration, String> {
    let path = format!("/api/devices/{}/calibration/dosing", device_id);
    get(&app, &path).await
}

#[tauri::command]
pub async fn update_dosing_calibration(
    app: AppHandle,
    device_id: String,
    config: DosingCalibration,
) -> Result<Value, String> {
    let path = format!("/api/devices/{}/calibration/dosing", device_id);
    post(&app, &path, &config).await
}

// ==========================================
// 6. AGGREGATED CONFIG (Chỉ Get)
// ==========================================

#[tauri::command]
pub async fn get_esp32_aggregated_config(
    app: AppHandle,
    device_id: String,
) -> Result<Esp32AggregatedConfig, String> {
    let path = format!("/api/devices/{}/config/aggregated", device_id);
    get(&app, &path).await
}

// ==========================================
// 7. CONTROL PUMP
// ==========================================

#[derive(Serialize)]
pub struct PumpControlPayload {
    pub pump: String,
    pub action: String,
    pub duration_sec: Option<u64>,
}

#[tauri::command]
pub async fn control_pump(
    app: AppHandle,
    device_id: String,
    pump: String,
    action: String,
    duration_sec: Option<u64>,
) -> Result<Value, String> {
    let path = format!("/api/devices/{}/control", device_id);
    let payload = PumpControlPayload {
        pump,
        action,
        duration_sec,
    };
    post(&app, &path, &payload).await
}

// ==========================================
// 8. SENSOR DATA (INFLUXDB)
// ==========================================

#[tauri::command]
pub async fn get_latest_sensor_data(app: AppHandle, device_id: String) -> Result<Value, String> {
    let path = format!("/api/devices/{}/sensors/latest", device_id);
    get(&app, &path).await
}

#[tauri::command]
pub async fn get_sensor_history(
    app: AppHandle,
    device_id: String,
    range: Option<String>,
) -> Result<Value, String> {
    let mut path = format!("/api/devices/{}/sensors/history", device_id);
    if let Some(r) = range {
        path.push_str(&format!("?range={}", r));
    }
    get(&app, &path).await
}

#[tauri::command]
pub async fn save_settings(
    app: AppHandle,
    api_key: String,
    backend_url: String,
    device_id: String,
) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;

    // Lưu vào tauri-plugin-store
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("api_key", serde_json::json!(api_key));
    store.set("backend_url", serde_json::json!(backend_url));
    store.set("device_id", serde_json::json!(device_id));
    let _ = store.save(); // Bỏ qua lỗi save nếu có

    Ok(())
}

#[tauri::command]
pub async fn load_settings(app: AppHandle) -> Result<AppSettings, String> {
    http_client::get_settings(&app)
}

#[tauri::command]
pub async fn start_ws_listener(app: AppHandle, device_id: String) -> Result<(), String> {
    // Chạy background task, không block luồng chính
    ws_client::start_ws_listener(app, device_id).await;
    Ok(())
}

// ==========================================
// 9. LỆNH ĐIỀU KHIỂN BƠM & CHU TRÌNH TỰ ĐỘNG
// ==========================================

#[tauri::command]
pub async fn manual_pump(
    app: AppHandle,
    device_id: String,
    pump: String,
    action: String,
    duration_sec: Option<u64>,
) -> Result<Value, String> {
    // Tái sử dụng struct PumpControlPayload đã khai báo ở phần 7
    let path = format!("/api/devices/{}/control", device_id);
    let payload = PumpControlPayload {
        pump,
        action,
        duration_sec,
    };

    post(&app, &path, &payload).await
}
