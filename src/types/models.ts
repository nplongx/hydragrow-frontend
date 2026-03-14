// src/types/models.ts

export type DeviceState = 'on' | 'off';
export type ValveState = 'open' | 'closed';

export interface PumpStatus {
  A: DeviceState;
  B: DeviceState;
  PH_UP: DeviceState;
  PH_DOWN: DeviceState;
  CIRCULATION: DeviceState;
  WATER_PUMP: DeviceState;
  VAN_IN: ValveState;
  VAN_OUT: ValveState;
}

export interface SensorData {
  device_id: string;
  ec_value: number;
  ph_value: number;
  temp_value: number;
  water_level: number;
  pump_status: PumpStatus;
  timestamp: string;
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
