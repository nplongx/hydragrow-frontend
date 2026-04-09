// src/types/models.ts

/**
 * Trạng thái hoạt động cơ bản của thiết bị
 */
export type DeviceState = 'on' | 'off';

/**
 * Trạng thái chi tiết của tất cả các máy bơm và van trong hệ thống
 */
export interface PumpStatus {
  A: DeviceState;          // Bơm dinh dưỡng A
  B: DeviceState;          // Bơm dinh dưỡng B
  PH_UP: DeviceState;      // Bơm tăng pH
  PH_DOWN: DeviceState;    // Bơm giảm pH
  OSAKA_PUMP: DeviceState; // Bơm trộn/phun sương chính (Osaka)
  MIST_VALVE: DeviceState; // Van điện từ phun sương
  WATER_PUMP: DeviceState; // Bơm cấp nước vào (In)
  DRAIN_PUMP: DeviceState; // Bơm thoát nước ra (Out)
}

/**
 * Dữ liệu thu thập từ các cảm biến của thiết bị
 */
export interface SensorData {
  device_id: string;
  ec_value: number;        // Giá trị EC (Độ dẫn điện)
  ph_value: number;        // Giá trị pH
  temp_value: number;      // Nhiệt độ nước/môi trường
  water_level: number;     // Mực nước (cm)
  pump_status: PumpStatus; // Trạng thái bơm đồng bộ từ FSM
  time: string;       // Thời gian ghi nhận dữ liệu
}

/**
 * Cấu trúc thông báo cảnh báo hệ thống
 */
export interface AlertPayload {
  id: string;
  metric: string;          // Chỉ số gây ra lỗi (ví dụ: "EC", "WaterLevel")
  value: number;           // Giá trị tại thời điểm xảy ra lỗi
  severity: 'info' | 'warning' | 'critical';
  message: string;         // Nội dung cảnh báo chi tiết
  timestamp: string;
}

/**
 * Trạng thái kết nối của thiết bị với Server/Broker
 */
export interface StatusPayload {
  is_online: boolean;      // Thiết bị có đang kết nối MQTT không
  last_seen: string;       // Lần cuối cùng nhận được tín hiệu (Heartbeat)
}

/**
 * Trạng thái máy trạng thái (FSM) gửi từ Controller
 */
export interface FsmStatePayload {
  current_state: string;   // Ví dụ: "Monitoring", "DosingEC", "EmergencyStop"
  timestamp: string;
}
