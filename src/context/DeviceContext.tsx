import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { fetch } from '@tauri-apps/plugin-http';
import { SensorData, StatusPayload } from '../types/models';
import toast from 'react-hot-toast';

interface DeviceContextType {
  deviceId: string | null;
  settings: any;
  sensorData: SensorData | null;
  deviceStatus: StatusPayload;
  fsmState: string;
  isLoading: boolean;
  updatePumpStatusOptimistically: (stateKey: string, isNowOn: boolean) => void;
  systemEvents: any
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider = ({ children }: { children: ReactNode }) => {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [sensorData, setSensorData] = useState<SensorData | null>(null);

  const [deviceStatus, setDeviceStatus] = useState<StatusPayload>({ is_online: false, last_seen: '' });
  const [fsmState, setFsmState] = useState<string>("Offline");
  const [systemEvents, setSystemEvents] = useState<any[]>([]); // 🟢 THÊM STATE NÀY
  const [isLoading, setIsLoading] = useState(true);

  // ==========================================
  // 🟢 WATCHDOG: Bảo vệ phía Client (15 giây)
  // ==========================================
  const sensorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetSensorTimeout = useCallback(() => {
    if (sensorTimeoutRef.current) {
      clearTimeout(sensorTimeoutRef.current);
    }
    sensorTimeoutRef.current = setTimeout(() => {
      setDeviceStatus({ is_online: false, last_seen: '' });

      // ++ THÊM 2 DÒNG NÀY ĐỂ XÓA DỮ LIỆU CŨ ++
      setFsmState("Offline");
      setSensorData(prev => prev ? { ...prev, pump_status: {} as any } : prev);

      toast.error("Mất tín hiệu từ thiết bị! (Timeout)");
    }, 15000);
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const s: any = await invoke('load_settings').catch(() => null);
        if (s && s.device_id && s.backend_url) {
          setSettings(s);
          setDeviceId(s.device_id);
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Lỗi load settings:", error);
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    if (!deviceId || !settings) return;

    let ws: WebSocket;
    let pingInterval: NodeJS.Timeout;
    let reconnectTimeout: NodeJS.Timeout;

    const setupConnection = async () => {
      setIsLoading(true);
      try {
        const url = `${settings.backend_url}/api/devices/${deviceId}/sensors/latest`;
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': settings.api_key }
        });

        if (response.ok) {
          const resData = await response.json();
          setSensorData(resData.data || resData);
        }
      } catch (err) {
        console.warn("Chưa lấy được data khởi tạo:", err);
      }
      setIsLoading(false);

      const loadEventHistory = async () => {
        try {
          const res = await fetch(`${settings.backend_url}/api/devices/${deviceId}/events`, {
            method: 'GET',
            headers: { 'X-API-Key': settings.api_key || '' }
          });
          if (res.ok) {
            const json = await res.json();
            if (json.data && Array.isArray(json.data)) {
              // Nạp dữ liệu cũ vào RAM
              setSystemEvents(json.data);
            }
          }
        } catch (error) {
          console.error("Lỗi nạp lịch sử sự kiện:", error);
        }
      };

      // Gọi hàm hút dữ liệu ngay lập tức
      loadEventHistory();

      const connectWs = () => {
        const cleanBaseUrl = settings.backend_url.replace(/\/$/, "");
        const wsUrl = `${cleanBaseUrl.replace(/^http/, 'ws')}/api/devices/${deviceId}/ws?api_key=${settings.api_key}`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('🟢 [GlobalContext] Đã kết nối tới Server WebSocket');
          resetSensorTimeout();

          pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send('ping');
          }, 25000);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // 🟢 TÍCH HỢP ĐÓN "DI CHÚC" (LWT) TỪ ESP32
            // Nếu Backend parse message từ topic "status" và trả về dạng "status" hoặc alert
            if (data.type === 'status' || (data.type === 'alert' && data.payload.title === 'Trạng thái thiết bị')) {
              const isOnline = data.type === 'status' ? data.payload.online : data.payload.level === 'success';

              setDeviceStatus({ is_online: isOnline, last_seen: new Date().toISOString() });

              if (isOnline) {
                toast.success("Thiết bị đã trực tuyến trở lại!");
                resetSensorTimeout();
              } else {
                toast.error("Đã ngắt kết nối mạch ESP32 (LWT)!");
                if (sensorTimeoutRef.current) clearTimeout(sensorTimeoutRef.current);

                setFsmState("Offline");
                setSensorData(prev => prev ? { ...prev, pump_status: {} as any } : prev);
              }
              return;
            }

            if (data.type === 'alert') {
              const alert = data.payload;

              // 🟢 THÊM DÒNG NÀY: Đẩy sự kiện mới nhất lên đầu mảng (chỉ giữ 50 cái)
              if (alert.level !== 'FSM_UPDATE') {
                setSystemEvents(prev => [alert, ...prev].slice(0, 50));
              }

              if (alert.level === 'FSM_UPDATE') {
                setFsmState(alert.message);
                return;
              }
              switch (alert.level) {
                case 'critical': toast.error(`🚨 ${alert.title}\n${alert.message}`, { duration: 10000 }); break;
                case 'warning': toast.error(`⚠️ ${alert.title}\n${alert.message}`, { duration: 6000 }); break;
                case 'success': toast.success(`✅ ${alert.title}\n${alert.message}`, { duration: 5000 }); break;
                default: toast(`ℹ️ ${alert.title}`, { duration: 4000 }); break;
              }
              return;
            }

            if (data.type === 'sensor_update') {
              setSensorData(data.payload.data || data.payload);
              setDeviceStatus(prev => !prev.is_online ? { is_online: true, last_seen: new Date().toISOString() } : prev);

              // Nhận data tức là mạch còn sống -> Cập nhật lại bộ đếm Watchdog
              resetSensorTimeout();
            }
          } catch (err) {
            console.error("Lỗi parse WS Message:", err);
          }
        };

        ws.onclose = () => {
          console.log('🔴 [GlobalContext] Mất kết nối WebSocket. Đang thử kết nối lại...');
          setDeviceStatus({ is_online: false, last_seen: '' });
          clearInterval(pingInterval);
          if (sensorTimeoutRef.current) clearTimeout(sensorTimeoutRef.current);

          reconnectTimeout = setTimeout(() => { connectWs(); }, 5000);
        };

        ws.onerror = (err) => {
          console.error("⚠️ [GlobalContext] Lỗi kết nối WebSocket:", err);
          ws.close();
        };
      };

      connectWs();
    };

    setupConnection();

    return () => {
      clearInterval(pingInterval);
      clearTimeout(reconnectTimeout);
      if (sensorTimeoutRef.current) clearTimeout(sensorTimeoutRef.current);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [deviceId, settings, resetSensorTimeout]);

  const updatePumpStatusOptimistically = useCallback((stateKey: string, isNowOn: boolean) => {
    setSensorData(prevData => {
      if (!prevData) return prevData;
      return {
        ...prevData,
        pump_status: {
          ...prevData.pump_status,
          [stateKey]: isNowOn
        }
      };
    });
  }, []);

  return (
    <DeviceContext.Provider value={{
      deviceId, sensorData, deviceStatus, fsmState, isLoading, updatePumpStatusOptimistically, settings, systemEvents
    }}>
      {children}
    </DeviceContext.Provider>
  );
};

export const useDeviceContext = () => {
  const context = useContext(DeviceContext);
  if (context === undefined) throw new Error('useDeviceContext must be used within a DeviceProvider');
  return context;
};
