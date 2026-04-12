// src/hooks/useDeviceSensor.ts
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { fetch } from '@tauri-apps/plugin-http';
import { SensorData, StatusPayload } from '../types/models';

export function useDeviceSensor(deviceId: string) {
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<StatusPayload>({ is_online: false, last_seen: '' });

  // 🟢 1. THÊM STATE MỚI QUẢN LÝ FSM
  const [fsmState, setFsmState] = useState<string>("Monitoring");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!deviceId) return;
    let ws: WebSocket;

    const setup = async () => {
      try {
        const settings: any = await invoke('load_settings').catch(() => null);
        if (!settings || !settings.backend_url) {
          setIsLoading(false);
          return;
        }

        try {
          const url = `${settings.backend_url}/api/devices/${deviceId}/sensors/latest`;
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': settings.api_key
            }
          });

          if (response.ok) {
            const resData = await response.json();
            const actualInitialData = resData.data ? resData.data : resData;
            setSensorData(actualInitialData);
            setDeviceStatus({ is_online: true, last_seen: '' });
          }
        } catch (fetchErr) {
          console.warn("Chưa lấy được data sensor mới nhất:", fetchErr);
        }
        setIsLoading(false);

        const cleanBaseUrl = settings.backend_url.replace(/\/$/, "");
        const wsUrl = `${cleanBaseUrl.replace(/^http/, 'ws')}/ws?device_id=${deviceId}&api_key=${settings.api_key}`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('🟢 [SensorHook] Đã kết nối WebSocket');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log("📥 WS Nhận:", data.type, data.payload);

            // XỬ LÝ CÁC GÓI TIN DẠNG ALERT
            if (data.type === 'alert') {
              // A. Bắt trạng thái Online/Offline
              if (data.payload.title === 'Trạng thái thiết bị') {
                const isOnline = data.payload.level === 'success';
                setDeviceStatus({ is_online: isOnline, last_seen: '' });
                return;
              }

              // B. 🟢 BẮT TRẠNG THÁI FSM ẨN TỪ BACKEND
              if (data.payload.level === 'FSM_UPDATE') {
                setFsmState(data.payload.message); // message chứa "Monitoring", "WaterRefilling"...
                return;
              }

              // C. Bỏ qua các Alert báo lỗi thông thường (Để useSystemAlerts hiển thị Toast)
              return;
            }

            if (data.type === 'blockchain_verified') {
              return;
            }

            // XỬ LÝ SENSOR DATA
            if (data.type === 'sensor_update') {
              const actualEventData = data.payload.data ? data.payload.data : data.payload;
              setSensorData(actualEventData);

              setDeviceStatus(prev => {
                if (!prev.is_online) {
                  return { is_online: true, last_seen: new Date().toISOString() };
                }
                return prev;
              });
            }
          } catch (err) {
            console.error("Lỗi parse WS Message trong SensorHook:", err);
          }
        };

        ws.onclose = () => {
          console.log('🔴 [SensorHook] Mất kết nối WebSocket');
        };

      } catch (error) {
        console.error("Lỗi khởi tạo sensor:", error);
        setIsLoading(false);
      }
    };

    setup();

    return () => {
      if (ws) ws.close();
    };
  }, [deviceId]);

  const updatePumpStatusOptimistically = useCallback((pumpId: string, action: 'on' | 'off') => {
    setSensorData(prevData => {
      if (!prevData) return prevData;
      return {
        ...prevData,
        pump_status: {
          ...prevData.pump_status,
          [pumpId]: action
        }
      };
    });
  }, []);

  // 🟢 2. XUẤT THÊM BIẾN fsmState RA NGOÀI
  return { sensorData, deviceStatus, fsmState, isLoading, updatePumpStatusOptimistically };
}
