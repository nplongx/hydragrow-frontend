// src/types/models.ts

// Bạn có thể giữ lại DeviceState nếu vẫn dùng cho các UI Component khác (VD: Nút bấm)
export type DeviceState = 'on' | 'off';

/**
 * Trạng thái hoạt động của bơm (Đọc từ MQTT Telemetry)
 * Khớp 100% với struct PumpStatus của ESP32 (Trả về boolean và snake_case)
 */
export interface PumpStatus {
  pump_a: boolean;
  pump_b: boolean;
  ph_up: boolean;
  ph_down: boolean;
  osaka_pump: boolean;
  water_pump_in: boolean;  // Thay cho WATER_PUMP cũ
  water_pump_out: boolean; // Thay cho DRAIN_PUMP cũ
}

/**
 * Dữ liệu thời gian thực từ trạm cảm biến
 */
export interface SensorData {
  device_id: string;
  ec_value: number;
  ph_value: number;
  temp_value: number;
  water_level: number;
  pump_status: PumpStatus;
  timestamp: string;
}

/**
 * Payload dùng để gọi API điều khiển thiết bị (POST /api/devices/{id}/control)
 * Type này giúp bạn gõ code không bao giờ sợ sai tên bơm hay sai lệnh action
 */
export interface PumpControlReq {
  pump:
  | 'A'
  | 'B'
  | 'PH_UP'
  | 'PH_DOWN'
  | 'OSAKA_PUMP'
  | 'WATER_PUMP'       // Cấp nước
  | 'DRAIN_PUMP'       // Xả nước
  | 'CIRCULATION_PUMP' // Bơm tuần hoàn 220V qua Tuya Cloud
  | 'ALL';             // Dành cho lệnh reset hệ thống

  action: 'on' | 'off' | 'reset_fault' | 'set_pwm';
  duration_sec?: number; // Số giây chạy (Tuỳ chọn)
  pwm?: number;          // % Tốc độ bơm từ 0-100 (Tuỳ chọn)
}

export interface AlertPayload {
  id: string;
  metric: string;
  value: number;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
}

export interface StatusPayload {
  is_online: boolean;
  last_seen: string;
}
