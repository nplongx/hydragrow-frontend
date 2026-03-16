// src-tauri/src/models.rs
use serde::{Deserialize, Serialize};

// ── Settings ─────────────────────────────────────────────────────────
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub api_key: String,
    pub backend_url: String,
    pub device_id: String,
}

// ── Enums (Map chuẩn với Backend ESP32/MQTT) ─────────────────────────
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum DeviceState {
    On,
    #[default]
    Off,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ValveState {
    Open,
    #[default]
    Closed,
}

// ── Sensor & Relay Data ──────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PumpStatus {
    #[serde(rename = "A")]
    pub a: DeviceState,
    #[serde(rename = "B")]
    pub b: DeviceState,
    #[serde(rename = "PH_UP")]
    pub ph_up: DeviceState,
    #[serde(rename = "PH_DOWN")]
    pub ph_down: DeviceState,
    #[serde(rename = "CIRCULATION")]
    pub circulation: DeviceState,
    #[serde(rename = "WATER_PUMP")]
    pub water_pump: DeviceState,
    #[serde(rename = "VAN_IN")]
    pub van_in: ValveState,
    #[serde(rename = "VAN_OUT")]
    pub van_out: ValveState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensorData {
    pub device_id: String,
    pub ec_value: f64,
    pub ph_value: f64,
    pub temp_value: f64,
    pub water_level: f64,
    pub pump_status: PumpStatus,
    pub timestamp: String,
}

// ── Configurations (DB Entities) ─────────────────────────────────────
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeviceConfig {
    pub device_id: String,
    pub ec_target: f64,
    pub ec_tolerance: f64,
    pub ph_target: f64,
    pub ph_tolerance: f64,
    pub temp_target: f64,
    pub temp_tolerance: f64,
    pub control_mode: String,
    pub is_enabled: i64, // SQLite không có boolean, dùng INTEGER (0, 1)
    pub last_updated: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SensorCalibration {
    pub device_id: String,
    pub ph_v7: f64,
    pub ph_v4: f64,
    pub ec_factor: f64,
    pub temp_offset: f64,
    pub last_calibrated: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PumpCalibration {
    pub id: String,
    pub device_id: String,
    pub pump_type: String,
    pub flow_rate_ml_per_sec: f64,
    pub min_activation_sec: f64,
    pub max_activation_sec: f64,
    pub last_calibrated: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DosingCalibration {
    pub device_id: String,
    pub tank_volume_l: f64,
    pub ec_gain_per_ml: f64,
    pub ph_shift_up_per_ml: f64,
    pub ph_shift_down_per_ml: f64,
    pub mixing_delay_sec: i64,
    pub ec_step_ratio: f64,
    pub ph_step_ratio: f64,
    pub pump_capacity_ml_per_sec: f64,
    // Đã thêm 2 trường từ state.rs: active_mixing_sec và sensor_stabilize_sec
    pub active_mixing_sec: i64,
    pub sensor_stabilize_sec: i64,
    pub last_calibrated: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SafetyConfig {
    pub device_id: String,
    pub max_ec_limit: f64,
    pub min_ec_limit: f64,
    pub min_ph_limit: f64,
    pub max_ph_limit: f64,
    pub max_ec_delta: f64,
    pub max_ph_delta: f64,
    pub max_dose_per_cycle: f64,
    pub cooldown_sec: i64,
    pub max_dose_per_hour: f64,

    pub water_level_critical_min: f64, // Mức nước nguy hiểm
    pub max_refill_cycles_per_hour: i64,
    pub max_drain_cycles_per_hour: i64,
    pub max_refill_duration_sec: i64,
    pub max_drain_duration_sec: i64,

    pub min_temp_limit: f64,
    pub max_temp_limit: f64,

    pub emergency_shutdown: i64,
    pub last_updated: String,
}

// Struct phụ trợ cho quy trình water_sequence (Cấp/xả nước tự động)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WaterConfig {
    pub device_id: String,
    pub water_level_min: f64,
    pub water_level_target: f64,
    pub water_level_max: f64,
    pub water_level_drain: f64,
    pub circulation_mode: String,
    pub circulation_on_sec: i64,
    pub circulation_off_sec: i64,

    pub water_level_tolerance: f64,
    pub auto_refill_enabled: i64,
    pub auto_drain_overflow: i64,
    pub auto_dilute_enabled: i64,
    pub dilute_drain_amount_cm: f64,
    pub scheduled_water_change_enabled: i64,
    pub water_change_interval_sec: i64,
    pub scheduled_drain_amount_cm: f64,

    pub last_updated: String,
}

// ── Aggregated Data (Đẩy xuống ESP32) ────────────────────────────────
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Esp32AggregatedConfig {
    pub device_id: String,
    pub control_mode: String,
    pub is_enabled: bool,

    // --- 1. DEVICE CONFIG ---
    pub ec_target: f64,
    pub ec_tolerance: f64,
    pub ph_target: f64,
    pub ph_tolerance: f64,

    // --- 2. WATER CONFIG ---
    pub water_level_min: f64,
    pub water_level_target: f64,
    pub water_level_max: f64,
    pub water_level_tolerance: f64,
    pub auto_refill_enabled: bool,
    pub auto_drain_overflow: bool,

    pub auto_dilute_enabled: bool,
    pub dilute_drain_amount_cm: f64,

    pub scheduled_water_change_enabled: bool,
    pub water_change_interval_sec: i64,
    pub scheduled_drain_amount_cm: f64,

    // --- 3. SAFETY CONFIG ---
    pub emergency_shutdown: bool,
    pub max_ec_limit: f64,
    pub min_ph_limit: f64,
    pub max_ph_limit: f64,
    pub max_ec_delta: f64,
    pub max_ph_delta: f64,
    pub max_dose_per_cycle: f64,
    pub water_level_critical_min: f64,
    pub max_refill_duration_sec: i64,
    pub max_drain_duration_sec: i64,

    // --- 4. DOSING & PUMP ---
    pub ec_gain_per_ml: f64,
    pub ph_shift_up_per_ml: f64,
    pub ph_shift_down_per_ml: f64,
    pub mixing_delay_sec: i64,
    pub ec_step_ratio: f64,
    pub ph_step_ratio: f64,
    pub pump_capacity_ml_per_sec: f64,
    // Đã thêm 2 trường từ state.rs
    pub active_mixing_sec: i64,
    pub sensor_stabilize_sec: i64,
}

// ── API Requests ─────────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValveCommandReq {
    pub valve: String,
    pub action: ValveState,
}

// ── WebSocket Payloads (Gửi sang React UI) ───────────────────────────
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AlertPayload {
    pub id: String,
    pub metric: String,
    pub value: f64,
    pub severity: String, // "info" | "warning" | "critical"
    pub message: String,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StatusPayload {
    pub is_online: bool,
    pub last_seen: String,
}
