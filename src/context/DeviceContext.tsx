import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { fetch } from '@tauri-apps/plugin-http';
import { SensorData, StatusPayload } from '../types/models';
import toast from 'react-hot-toast';

interface DeviceContextType {
  deviceId: string | null;
  sensorData: SensorData | null;
  deviceStatus: StatusPayload;
  fsmState: string;
  isLoading: boolean;
  updatePumpStatusOptimistically: (pumpId: string, action: 'on' | 'off') => void;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider = ({ children }: { children: ReactNode }) => {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<StatusPayload>({ is_online: false, last_seen: '' });
  const [fsmState, setFsmState] = useState<string>("Monitoring");
  const [isLoading, setIsLoading] = useState(true);

  // 1. Tự động load Settings 1 lần duy nhất khi mở App
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const s: any = await invoke('load_settings').catch(() => null);
        if (s && s.device_id && s.backend_url) {
          setSettings(s);
          setDeviceId(s.device_id);
        } else {
          setIsLoading(false); // Xử lý trường hợp chưa cấu hình
        }
      } catch (error) {
        console.error("Lỗi load settings:", error);
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  // 2. Quản lý WebSocket toàn cục (Không bị ngắt khi chuyển trang)
  useEffect(() => {
    if (!deviceId || !settings) return;
    let ws: WebSocket;

    const setupConnection = async () => {
      setIsLoading(true);
      try {
        // Lấy data khởi tạo
        const url = `${settings.backend_url}/api/devices/${deviceId}/sensors/latest`;
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': settings.api_key }
        });

        if (response.ok) {
          const resData = await response.json();
          setSensorData(resData.data || resData);
          setDeviceStatus({ is_online: true, last_seen: '' });
        }
      } catch (err) {
        console.warn("Chưa lấy được data khởi tạo:", err);
      }
      setIsLoading(false);

      // Kết nối WebSocket
      const cleanBaseUrl = settings.backend_url.replace(/\/$/, "");
      const wsUrl = `${cleanBaseUrl.replace(/^http/, 'ws')}/ws?device_id=${deviceId}&api_key=${settings.api_key}`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => console.log('🟢 [GlobalContext] Đã kết nối WebSocket');

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'alert') {
            const alert = data.payload;

            // A. Bắt trạng thái Online/Offline
            if (alert.title === 'Trạng thái thiết bị') {
              const isOnline = alert.level === 'success';
              setDeviceStatus({ is_online: isOnline, last_seen: '' });

              // 🟢 THÊM: Thông báo khi thiết bị kết nối/mất kết nối
              if (isOnline) toast.success("Thiết bị đã trực tuyến trở lại!");
              else toast.error("Mất kết nối với thiết bị!");
              return;
            }

            // B. Bắt trạng thái FSM ẩn (Để update UI)
            if (alert.level === 'FSM_UPDATE') {
              setFsmState(alert.message);
              return;
            }

            // C. 🟢 XỬ LÝ CÁC CẢNH BÁO TOÀN CỤC (Lỗi, Dừng khẩn cấp, Ghi Blockchain...)
            switch (alert.level) {
              case 'critical':
                toast.error(`🚨 ${alert.title}\n${alert.message}`, { duration: 10000 });
                break;
              case 'warning':
                toast.error(`⚠️ ${alert.title}\n${alert.message}`, { duration: 6000 });
                break;
              case 'success':
                toast.success(`✅ ${alert.title}\n${alert.message}`, { duration: 5000 });
                break;
              case 'info':
              default:
                // Các thông báo info (ví dụ: đang xả nước, cấp nước...)
                toast(`ℹ️ ${alert.title}`, { duration: 4000 });
                break;
            }
            return;
          }

          if (data.type === 'sensor_update') {
            setSensorData(data.payload.data || data.payload);
            setDeviceStatus(prev => !prev.is_online ? { is_online: true, last_seen: new Date().toISOString() } : prev);
          }
        } catch (err) {
          console.error("Lỗi parse WS Message:", err);
        }
      };

      ws.onclose = () => {
        console.log('🔴 [GlobalContext] Mất kết nối WebSocket');
        setDeviceStatus({ is_online: false, last_seen: '' });
      };
    };

    setupConnection();

    return () => {
      if (ws) ws.close();
    };
  }, [deviceId, settings]);

  // Cập nhật giao diện mượt mà
  const updatePumpStatusOptimistically = useCallback((pumpId: string, action: 'on' | 'off') => {
    setSensorData(prevData => {
      if (!prevData) return prevData;
      return {
        ...prevData,
        pump_status: { ...prevData.pump_status, [pumpId]: action }
      };
    });
  }, []);

  return (
    <DeviceContext.Provider value={{ deviceId, sensorData, deviceStatus, fsmState, isLoading, updatePumpStatusOptimistically }}>
      {children}
    </DeviceContext.Provider>
  );
};

export const useDeviceContext = () => {
  const context = useContext(DeviceContext);
  if (context === undefined) throw new Error('useDeviceContext must be used within a DeviceProvider');
  return context;
};
