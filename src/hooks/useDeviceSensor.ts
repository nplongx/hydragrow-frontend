// src/hooks/useDeviceSensor.ts
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { SensorData, AlertPayload, StatusPayload } from '../types/models';

export function useDeviceSensor(deviceId: string) {
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<StatusPayload>({ is_online: false, last_seen: '' });
  const [alerts, setAlerts] = useState<AlertPayload[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!deviceId) return;

    // Khai báo các biến lưu trữ Promise của hàm listen
    let sensorPromise: Promise<() => void>;
    let statusPromise: Promise<() => void>;
    let alertPromise: Promise<() => void>;

    const setup = async () => {
      try {
        // 1. Lấy data mới nhất để hiển thị ngay lập tức
        const initialData = await invoke<SensorData>('get_latest_sensor_data', { deviceId });
        setSensorData(initialData);
        setIsLoading(false);

        // 2. ĐĂNG KÝ LẮNG NGHE TRƯỚC (QUAN TRỌNG: Phải đặt trước start_ws_listener)
        sensorPromise = listen<SensorData>('sensor_update', (event) => {
          setSensorData(event.payload);
        });

        statusPromise = listen<StatusPayload>('device_status', (event) => {
          console.log("🟢 Nhận được trạng thái từ Rust:", event.payload); // In ra để dễ debug
          setDeviceStatus(event.payload);
        });

        alertPromise = listen<AlertPayload>('alert', (event) => {
          setAlerts((prev) => [event.payload, ...prev].slice(0, 10));
        });

        // Đợi tất cả listener đăng ký xong xuôi...
        await Promise.all([sensorPromise, statusPromise, alertPromise]);

        // 3. RỒI MỚI BẢO RUST KHỞI ĐỘNG WEBSOCKET
        await invoke('start_ws_listener', { deviceId });

      } catch (error) {
        console.error("Lỗi khởi tạo sensor:", error);
        setIsLoading(false);
      }
    };

    setup();

    // 4. Cleanup function chuẩn xác (đợi unlisten resolve mới gọi)
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
