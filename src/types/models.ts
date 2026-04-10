// src/types/models.ts

export interface UnifiedDeviceConfig {
  device_id: string;
  control_mode: 'auto' | 'manual';
  is_enabled: boolean;

  // --- 1. Ngưỡng mục tiêu ---
  ec_target: number;
  ec_tolerance: number;
  ph_target: number;
  ph_tolerance: number;
  temp_target: number;
  temp_tolerance: number;

  // --- 2. Nước & Bơm ---
  water_level_min: number;
  water_level_target: number;
  water_level_max: number;
  water_level_tolerance: number;
  auto_refill_enabled: boolean;
  auto_drain_overflow: boolean;
  auto_dilute_enabled: boolean;
  dilute_drain_amount_cm: number;
  scheduled_water_change_enabled: boolean;
  water_change_interval_sec: number;
  scheduled_drain_amount_cm: number;
  misting_on_duration_ms: number;
  misting_off_duration_ms: number;

  // --- 3. An Toàn ---
  emergency_shutdown: boolean;
  max_ec_limit: number;
  min_ec_limit: number;
  min_ph_limit: number;
  max_ph_limit: number;
  max_ec_delta: number;
  max_ph_delta: number;
  max_dose_per_cycle: number;
  water_level_critical_min: number;
  max_refill_duration_sec: number;
  max_drain_duration_sec: number;
  ec_ack_threshold: number;
  ph_ack_threshold: number;
  water_ack_threshold: number;

  // --- 4. Châm Phân ---
  ec_gain_per_ml: number;
  ph_shift_up_per_ml: number;
  ph_shift_down_per_ml: number;
  active_mixing_sec: number;
  sensor_stabilize_sec: number;
  ec_step_ratio: number;
  ph_step_ratio: number;
  dosing_pump_capacity_ml_per_sec: number;
  soft_start_duration: number;
  scheduled_mixing_interval_sec: number;
  scheduled_mixing_duration_sec: number;

  // --- 5. Cảm biến & Lọc nhiễu ---
  ph_v7: number;
  ph_v4: number;
  ec_factor: number;
  ec_offset: number;
  temp_offset: number;
  temp_compensation_beta: number;
  sampling_interval: number;
  publish_interval: number;
  moving_average_window: number;

  // --- 6. Cờ Bật/Tắt Cảm Biến ---
  enable_ec_sensor: boolean;
  enable_ph_sensor: boolean;
  enable_water_level_sensor: boolean;
  enable_temp_sensor: boolean;
}
