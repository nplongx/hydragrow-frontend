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
  systemEvents: any[];
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider = ({ children }: { children: ReactNode }) => {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [sensorData, setSensorData] = useState<SensorData | null>(null);

  const [deviceStatus, setDeviceStatus] = useState<StatusPayload>({ is_online: false, last_seen: '' });
  const [fsmState, setFsmState] = useState<string>("Offline");
  const [systemEvents, setSystemEvents] = useState<any[]>([]);
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
              setSystemEvents(json.data);
            }
          }
        } catch (error) {
          console.error("Lỗi nạp lịch sử sự kiện:", error);
        }
      };

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

            // 1. XỬ LÝ TRẠNG THÁI ONLINE/OFFLINE (LWT HOẶC STATUS)
            if (data.type === 'status' || (data.type === 'alert' && data.payload.title === 'Trạng thái thiết bị')) {
              const isOnline = data.type === 'status' ? data.payload.online : data.payload.level === 'success';

              setDeviceStatus({ is_online: isOnline, last_seen: new Date().toISOString() });

              if (isOnline) {
                toast.success("Thiết bị đã trực tuyến trở lại!");
                resetSensorTimeout();
              } else {
                toast.error("Đã ngắt kết nối mạch điều khiển!");
                if (sensorTimeoutRef.current) clearTimeout(sensorTimeoutRef.current);
                setFsmState("Offline");
                setSensorData(prev => prev ? { ...prev, pump_status: {} as any } : prev);
              }
              return;
            }

            // 2. XỬ LÝ CẢNH BÁO (ALERTS & FSM_UPDATE)
            if (data.type === 'alert') {
              const alert = data.payload;

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

            // 3. XỬ LÝ DỮ LIỆU CẢM BIẾN & THÔNG SỐ SỨC KHỎE
            if (data.type === 'sensor_update') {
              const incomingPayload = data.payload.data || data.payload;

              setSensorData(prev => {
                // Nếu chưa có data gì thì lấy luôn cái mới
                if (!prev) return incomingPayload;

                // 🟢 GỘP DỮ LIỆU: Giữ lại những trường đang có nếu bản tin mới không gửi (để hỗ trợ việc Controller và Sensor gửi riêng rẽ)
                return {
                  ...prev,
                  ...incomingPayload,
                  // Đảm bảo không bị mất các trường option nếu payload mới thiếu
                  rssi: incomingPayload.rssi !== undefined ? incomingPayload.rssi : prev.rssi,
                  free_heap: incomingPayload.free_heap !== undefined ? incomingPayload.free_heap : prev.free_heap,
                  uptime: incomingPayload.uptime !== undefined ? incomingPayload.uptime : prev.uptime,
                  err_water: incomingPayload.err_water !== undefined ? incomingPayload.err_water : prev.err_water,
                };
              });

              setDeviceStatus(prev => !prev.is_online ? { is_online: true, last_seen: new Date().toISOString() } : prev);
              resetSensorTimeout();
            }

            // 4. XỬ LÝ ĐỘC LẬP BẢN TIN HEALTH CỦA CONTROLLER (Nếu Backend tách riêng)
            if (data.type === 'device_health') {
              const healthData = data.payload;
              setSensorData(prev => {
                if (!prev) return prev;
                return {
                  ...prev,
                  rssi: healthData.rssi !== undefined ? healthData.rssi : prev.rssi,
                  free_heap: healthData.free_heap !== undefined ? healthData.free_heap : prev.free_heap,
                  uptime: healthData.uptime_sec !== undefined ? healthData.uptime_sec : prev.uptime,
                  // Nếu Controller gửi pump_status đính kèm trong bản tin health thì chèn vào luôn
                  pump_status: healthData.pump_status ? healthData.pump_status : prev.pump_status,
                };
              });
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
