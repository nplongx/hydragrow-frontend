// src/hooks/useDeviceSensor.ts
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { fetch } from '@tauri-apps/plugin-http'; // <--- Import Native HTTP
import { SensorData, AlertPayload, StatusPayload } from '../types/models';

export function useDeviceSensor(deviceId: string) {
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<StatusPayload>({ is_online: false, last_seen: '' });
  const [alerts, setAlerts] = useState<AlertPayload[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!deviceId) return;

    let sensorPromise: Promise<() => void>;
    let statusPromise: Promise<() => void>;
    let alertPromise: Promise<() => void>;

    const setup = async () => {
      try {
        // Lấy cấu hình mạng để gọi API
        const settings: any = await invoke('load_settings').catch(() => null);

        // 1. LẤY DATA KHỞI TẠO BẰNG HTTP FETCH (Thay cho invoke cũ)
        if (settings && settings.backend_url) {
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
              // Bóc vỏ JSON y hệt logic cũ của bạn
              const actualInitialData = resData.data ? resData.data : resData;
              setSensorData(actualInitialData);
            }
          } catch (fetchErr) {
            console.warn("Chưa lấy được data sensor mới nhất:", fetchErr);
          }
        }
        setIsLoading(false);

        // 2. LẮNG NGHE WEBSOCKET TỪ RUST (Giữ nguyên)
        sensorPromise = listen<any>('sensor_update', (event) => {
          const actualEventData = event.payload.data ? event.payload.data : event.payload;
          setSensorData(actualEventData);
        });

        statusPromise = listen<StatusPayload>('device_status', (event) => {
          console.log("🟢 Nhận được trạng thái từ Rust:", JSON.stringify(event.payload));
          setDeviceStatus(event.payload);
        });

        alertPromise = listen<AlertPayload>('alert', (event) => {
          setAlerts((prev) => [event.payload, ...prev].slice(0, 10));
        });

        // Đợi tất cả listener đăng ký xong xuôi...
        await Promise.all([sensorPromise, statusPromise, alertPromise]);

        // 3. RỒI MỚI BẢO RUST KHỞI ĐỘNG WEBSOCKET LISTENER
        await invoke('start_ws_listener', { deviceId });

      } catch (error) {
        console.error("Lỗi khởi tạo sensor:", error);
        setIsLoading(false);
      }
    };

    setup();

    // 4. Cleanup
    return () => {
      if (sensorPromise) sensorPromise.then(unlisten => unlisten());
      if (statusPromise) statusPromise.then(unlisten => unlisten());
      if (alertPromise) alertPromise.then(unlisten => unlisten());
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

  return { sensorData, deviceStatus, alerts, isLoading, updatePumpStatusOptimistically };
}
