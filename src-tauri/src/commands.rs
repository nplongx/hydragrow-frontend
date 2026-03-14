// src-tauri/src/commands.rs

use crate::http_client;
use crate::models::*;
use crate::valve_guard::ValveGuardState;
use crate::water_sequence;
use crate::ws_client;
use tauri::{AppHandle, State};

// ── Sensor ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_latest_sensor(app: AppHandle, device_id: String) -> Result<SensorData, String> {
    http_client::get(&app, &format!("/api/devices/{}/sensors/latest", device_id)).await
}

#[tauri::command]
pub async fn get_sensor_history(
    app: AppHandle,
    device_id: String,
    start: String,
    end: String,
    limit: u32,
) -> Result<Vec<SensorData>, String> {
    // Giả định backend hỗ trợ query params start, end, limit
    let path = format!(
        "/api/devices/{}/sensors/history?start={}&end={}&limit={}",
        device_id, start, end, limit
    );
    http_client::get(&app, &path).await
}

// ── Config ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_device_config(app: AppHandle, device_id: String) -> Result<DeviceConfig, String> {
    http_client::get(&app, &format!("/api/devices/{}/config", device_id)).await
}

#[tauri::command]
pub async fn update_device_config(
    app: AppHandle,
    device_id: String,
    config: DeviceConfig,
) -> Result<serde_json::Value, String> {
    http_client::put(&app, &format!("/api/devices/{}/config", device_id), &config).await
}

// ── Calibration ──────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_sensor_calibration(
    app: AppHandle,
    device_id: String,
) -> Result<SensorCalibration, String> {
    http_client::get(
        &app,
        &format!("/api/devices/{}/calibration/sensor", device_id),
    )
    .await
}

#[tauri::command]
pub async fn update_sensor_calibration(
    app: AppHandle,
    device_id: String,
    cal: SensorCalibration,
) -> Result<serde_json::Value, String> {
    http_client::post(
        &app,
        &format!("/api/devices/{}/calibration/sensor", device_id),
        &cal,
    )
    .await
}

// Thêm các hàm tương tự cho Pump / Dosing Calibration tùy theo route backend...
// ... (để gọn, mình mô phỏng logic chuẩn, bạn có thể clone pattern này cho các endpoint còn lại)

// ── Safety ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_safety_config(app: AppHandle, device_id: String) -> Result<SafetyConfig, String> {
    http_client::get(&app, &format!("/api/devices/{}/config/safety", device_id)).await
}

#[tauri::command]
pub async fn update_safety_config(
    app: AppHandle,
    device_id: String,
    config: SafetyConfig,
) -> Result<serde_json::Value, String> {
    http_client::post(
        &app,
        &format!("/api/devices/{}/config/safety", device_id),
        &config,
    )
    .await
}

// ── Manual Control ───────────────────────────────────────────────────

#[tauri::command]
pub async fn manual_pump(
    app: AppHandle,
    device_id: String,
    pump: String,
    action: String,
    duration_sec: Option<u32>,
) -> Result<(), String> {
    // Tạo payload ẩn danh gọn nhẹ cho reqwest
    let payload = serde_json::json!({
        "pump": pump,
        "action": action,
        "duration_sec": duration_sec
    });
    http_client::post(
        &app,
        &format!("/api/devices/{}/control/pump", device_id),
        &payload,
    )
    .await
}

#[tauri::command]
pub async fn manual_valve(
    app: AppHandle,
    guard: State<'_, ValveGuardState>,
    device_id: String,
    valve: String,
    action: String,
) -> Result<(), String> {
    // Chuyển action string thành ValveState enum
    let valve_state = if action.to_lowercase() == "open" {
        ValveState::Open
    } else {
        ValveState::Closed
    };

    // ⚠️ GUARD CHECK: Chặn lệnh không an toàn ngay tại Rust!
    guard.check_safety(&valve, &valve_state)?;

    let payload = ValveCommandReq {
        valve,
        action: valve_state,
    };
    http_client::post(
        &app,
        &format!("/api/devices/{}/control/valve", device_id),
        &payload,
    )
    .await
}

// ── Water Sequence ───────────────────────────────────────────────────

#[tauri::command]
pub async fn start_water_refill(app: AppHandle, device_id: String) -> Result<(), String> {
    // Gọi logic đã viết ở file water_sequence.rs
    water_sequence::run_refill_sequence(app, device_id).await
}

#[tauri::command]
pub async fn start_water_drain(app: AppHandle, device_id: String) -> Result<(), String> {
    water_sequence::run_drain_sequence(app, device_id).await
}

// ── WebSocket & App Settings ─────────────────────────────────────────

#[tauri::command]
pub async fn start_ws_listener(app: AppHandle, device_id: String) -> Result<(), String> {
    // Chạy background task, không block luồng chính
    ws_client::start_ws_listener(app, device_id).await;
    Ok(())
}

#[tauri::command]
pub async fn load_settings(app: AppHandle) -> Result<AppSettings, String> {
    http_client::get_settings(&app)
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

// ── Export ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn export_csv(
    app: AppHandle,
    device_id: String,
    start: String,
    end: String,
) -> Result<String, String> {
    // Lấy data history
    let data: Vec<SensorData> = get_sensor_history(app, device_id, start, end, 10000).await?;

    // Dựng string CSV thủ công hoặc dùng crate `csv`
    let mut csv_string = String::from("Timestamp,EC,pH,Temperature,Water Level\n");
    for row in data {
        csv_string.push_str(&format!(
            "{},{:.2},{:.2},{:.2},{:.2}\n",
            row.timestamp, row.ec_value, row.ph_value, row.temp_value, row.water_level
        ));
    }

    // Trả về string này cho React, React sẽ dùng trình duyệt/Tauri API để trigger save file dialog
    Ok(csv_string)
}

// ── Water Config ───────────────────────────────────────────────────

#[tauri::command]
pub async fn get_water_config(app: AppHandle, device_id: String) -> Result<WaterConfig, String> {
    http_client::get(&app, &format!("/api/devices/{}/config/water", device_id)).await
}

#[tauri::command]
pub async fn update_water_config(
    app: AppHandle,
    device_id: String,
    config: WaterConfig,
) -> Result<serde_json::Value, String> {
    http_client::post(
        &app,
        &format!("/api/devices/{}/config/water", device_id),
        &config,
    )
    .await
}

// ── Dosing Calibration ─────────────────────────────────────────────

#[tauri::command]
pub async fn get_dosing_calibration(
    app: AppHandle,
    device_id: String,
) -> Result<DosingCalibration, String> {
    http_client::get(
        &app,
        &format!("/api/devices/{}/calibration/dosing", device_id),
    )
    .await
}

#[tauri::command]
pub async fn update_dosing_calibration(
    app: AppHandle,
    device_id: String,
    cal: DosingCalibration,
) -> Result<serde_json::Value, String> {
    http_client::post(
        &app,
        &format!("/api/devices/{}/calibration/dosing", device_id),
        &cal,
    )
    .await
}
