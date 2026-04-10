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
            setDeviceStatus({ is_online: true, last_seen: '' });
          }
        } catch (fetchErr) {
          console.warn("Chưa lấy được data sensor mới nhất:", fetchErr);
        }
        setIsLoading(false);

        // 2. KẾT NỐI WEBSOCKET TRỰC TIẾP TRONG REACT (Bỏ qua Tauri IPC)
        // Xóa dấu gạch chéo ở cuối url nếu có để tránh lỗi //ws
        const cleanBaseUrl = settings.backend_url.replace(/\/$/, "");

        // 🟢 THÊM QUERY PARAMETERS (device_id và api_key) VÀO URL
        const wsUrl = `${cleanBaseUrl.replace(/^http/, 'ws')}/ws?device_id=${deviceId}&api_key=${settings.api_key}`;

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('🟢 [SensorHook] Đã kết nối WebSocket lấy dữ liệu trực tiếp');
        };

        // Trong file src/hooks/useDeviceSensor.ts
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            console.log("📥 WS Nhận:", data.type, data.payload);

            // Bắt trạng thái Online/Offline thông qua Alert
            if (data.type === 'alert' && data.payload.title === 'Trạng thái thiết bị') {
              const isOnline = data.payload.level === 'success'; // success là online, warning là offline
              setDeviceStatus({ is_online: isOnline, last_seen: '' });
              return; // Cập nhật xong thì thoát
            }

            // Bỏ qua các alert khác (Để useSystemAlerts tự lo)
            if (data.type === 'alert' || data.type === 'blockchain_verified') {
              return;
            }

            // Xử lý Sensor
            // Xử lý Sensor
            if (data.type === 'sensor_update') {
              const actualEventData = data.payload.data ? data.payload.data : data.payload;

              // 1. Cập nhật dữ liệu cảm biến
              setSensorData(actualEventData);

              // 2. 🟢 THÊM DÒNG NÀY: Mạch còn gửi Sensor nghĩa là mạch đang ONLINE! (Self-healing)
              setDeviceStatus(prev => {
                if (!prev.is_online) {
                  console.log("🟢 Auto-detected Device Online via Sensor Data!");
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
