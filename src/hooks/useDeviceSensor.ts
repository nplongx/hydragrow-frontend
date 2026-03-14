// src/hooks/useDeviceSensor.ts
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core'; // Dùng '@tauri-apps/api' nếu là v1
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { SensorData, AlertPayload, StatusPayload } from '../types/models';

export function useDeviceSensor(deviceId: string) {
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<StatusPayload>({ is_online: false, last_seen: '' });
  const [alerts, setAlerts] = useState<AlertPayload[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!deviceId) return;

    let unlistenSensor: UnlistenFn;
    let unlistenStatus: UnlistenFn;
    let unlistenAlert: UnlistenFn;

    const setup = async () => {
      try {
        // 1. Lấy data mới nhất để hiển thị ngay lập tức
        const initialData = await invoke<SensorData>('get_latest_sensor', { deviceId });
        setSensorData(initialData);
        setIsLoading(false);

        // 2. Yêu cầu Rust khởi động WebSocket listener ngầm
        await invoke('start_ws_listener', { deviceId });

        // 3. Đăng ký nhận Event từ Rust (emit từ file ws_client.rs)
        unlistenSensor = await listen<SensorData>('sensor_update', (event) => {
          setSensorData(event.payload);
        });

        unlistenStatus = await listen<StatusPayload>('device_status', (event) => {
          setDeviceStatus(event.payload);
        });

        unlistenAlert = await listen<AlertPayload>('alert', (event) => {
          setAlerts((prev) => [event.payload, ...prev].slice(0, 10)); // Giữ 10 alert mới nhất
        });

      } catch (error) {
        console.error("Lỗi khởi tạo sensor:", error);
        setIsLoading(false);
      }
    };

    setup();

    // Cleanup function: Hủy đăng ký lắng nghe khi component unmount
    return () => {
      if (unlistenSensor) unlistenSensor();
      if (unlistenStatus) unlistenStatus();
      if (unlistenAlert) unlistenAlert();
    };
  }, [deviceId]);

  return { sensorData, deviceStatus, alerts, isLoading };
}
