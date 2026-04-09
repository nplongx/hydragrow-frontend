// src/hooks/useDeviceSensor.ts
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { fetch } from '@tauri-apps/plugin-http';
import { SensorData, StatusPayload } from '../types/models';

export function useDeviceSensor(deviceId: string) {
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<StatusPayload>({ is_online: false, last_seen: '' });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!deviceId) return;
    let ws: WebSocket;

    const setup = async () => {
      try {
        // Lấy cấu hình mạng
        const settings: any = await invoke('load_settings').catch(() => null);
        if (!settings || !settings.backend_url) {
          setIsLoading(false);
          return;
        }

        // 1. LẤY DATA KHỞI TẠO BẰNG HTTP FETCH
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
          }
        } catch (fetchErr) {
          console.warn("Chưa lấy được data sensor mới nhất:", fetchErr);
        }
        setIsLoading(false);

        // 2. KẾT NỐI WEBSOCKET TRỰC TIẾP TRONG REACT (Bỏ qua Tauri IPC)
        const wsUrl = settings.backend_url.replace(/^http/, 'ws') + '/ws';
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('🟢 [SensorHook] Đã kết nối WebSocket lấy dữ liệu trực tiếp');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // 🟢 LỌC BẢN TIN: Bỏ qua các bản tin không phải của Sensor
            if (data.type === 'alert' || data.type === 'blockchain_verified') {
              return; // Để hook useSystemAlerts tự xử lý
            }

            if (data.type === 'sensor_update') {
              const actualEventData = data.payload.data ? data.payload.data : data.payload;
              setSensorData(actualEventData);
            }
            else if (data.type === 'device_status') {
              console.log("🟢 Nhận được trạng thái thiết bị:", data);
              setDeviceStatus({ is_online: data.online, last_seen: '' });
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

    // 3. CLEANUP: Đóng kết nối khi rời khỏi trang ControlPanel
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [deviceId]);

  // Hàm cập nhật state ngay lập tức cho UI mượt mà (Optimistic UI)
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

  return { sensorData, deviceStatus, isLoading, updatePumpStatusOptimistically };
}
