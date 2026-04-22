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
  controllerHealth: any;
  fsmState: string;
  isLoading: boolean;
  updatePumpStatusOptimistically: (stateKey: string, isNowOn: boolean) => void;
  systemEvents: any[];
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider = ({ children }: { children: ReactNode }) => {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);

  // Dù tên là sensorData nhưng giờ nó đóng vai trò là Global Device State (chứa cả sensor + pump)
  const [sensorData, setSensorData] = useState<SensorData | null>(null);

  const [controllerHealth, setControllerHealth] = useState<any>(null);

  // deviceStatus bây giờ CHỈ đại diện cho MẠCH ĐIỀU KHIỂN (Controller)
  const [deviceStatus, setDeviceStatus] = useState<StatusPayload>({ is_online: false, last_seen: '' });
  const [fsmState, setFsmState] = useState<string>("Offline");
  const [systemEvents, setSystemEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ==========================================
  // 🟢 TÁCH 2 WATCHDOG RIÊNG BIỆT CHO 2 NODE
  // ==========================================
  const controllerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sensorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Xử lý khi Controller mất tín hiệu
  const resetControllerTimeout = useCallback(() => {
    if (controllerTimeoutRef.current) clearTimeout(controllerTimeoutRef.current);

    controllerTimeoutRef.current = setTimeout(() => {
      setDeviceStatus({ is_online: false, last_seen: '' });
      setFsmState("Offline");
      // Mất controller thì không biết trạng thái bơm, clear pump_status
      setSensorData(prev => prev ? { ...prev, pump_status: {} as any } : prev);
      toast.error("Mất tín hiệu từ Trạm Điều Khiển (Controller)!");
    }, 15000);
  }, []);

  // 2. Xử lý khi Sensor Node mất tín hiệu
  const resetSensorTimeout = useCallback(() => {
    if (sensorTimeoutRef.current) clearTimeout(sensorTimeoutRef.current);

    sensorTimeoutRef.current = setTimeout(() => {
      // Chỉ bật cờ lỗi nước để làm mờ UI cảm biến, KHÔNG ĐÁNH SẬP is_online của toàn hệ thống
      setSensorData(prev => prev ? { ...prev, err_water: true } : prev);
      toast.error("Mất kết nối với Mạch Cảm Biến!");
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
      // Fetch data mồi...
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
      } catch (err) { /* empty */ }
      setIsLoading(false);

      // Fetch events...
      try {
        const res = await fetch(`${settings.backend_url}/api/devices/${deviceId}/events`, {
          method: 'GET',
          headers: { 'X-API-Key': settings.api_key || '' }
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data && Array.isArray(json.data)) setSystemEvents(json.data);
        }
      } catch (err) { /* empty */ }

      const connectWs = () => {
        const cleanBaseUrl = settings.backend_url.replace(/\/$/, "");
        const wsUrl = `${cleanBaseUrl.replace(/^http/, 'ws')}/api/devices/${deviceId}/ws?api_key=${settings.api_key}`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('🟢 [GlobalContext] Đã kết nối tới Server WebSocket');
          // Khởi động cả 2 bộ đếm an toàn
          resetControllerTimeout();
          resetSensorTimeout();

          pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send('ping');
          }, 25000);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // =====================================
            // 1. CẢNH BÁO LWT TỪ CONTROLLER
            // =====================================
            if (data.type === 'status' || (data.type === 'alert' && data.payload.title === 'Trạng thái thiết bị')) {
              const isOnline = data.type === 'status' ? data.payload.online : data.payload.level === 'success';

              setDeviceStatus({ is_online: isOnline, last_seen: new Date().toISOString() });

              if (isOnline) {
                toast.success("Trạm Điều Khiển đã trực tuyến trở lại!");
                resetControllerTimeout();
              } else {
                toast.error("Đã ngắt kết nối Trạm Điều Khiển (LWT)!");
                if (controllerTimeoutRef.current) clearTimeout(controllerTimeoutRef.current);
                setFsmState("Offline");
                setSensorData(prev => prev ? { ...prev, pump_status: {} as any } : prev);
              }
              return;
            }

            // =====================================
            // 2. SỰ KIỆN ALERTS & FSM
            // =====================================
            if (data.type === 'alert') {
              const alert = data.payload;
              if (alert.level !== 'FSM_UPDATE') {
                setSystemEvents(prev => [alert, ...prev].slice(0, 50));
              } else {
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

            // =====================================
            // 3. LUỒNG SENSOR (Từ Cảm Biến)
            // =====================================
            if (data.type === 'sensor_update') {
              const incomingPayload = data.payload.data || data.payload;

              setSensorData(prev => {
                if (!prev) return incomingPayload;
                return {
                  ...prev,
                  temp_value: incomingPayload.temp_value !== undefined ? incomingPayload.temp_value : prev.temp_value,
                  ec_value: incomingPayload.ec_value !== undefined ? incomingPayload.ec_value : prev.ec_value,
                  ph_value: incomingPayload.ph_value !== undefined ? incomingPayload.ph_value : prev.ph_value,
                  water_level: incomingPayload.water_level !== undefined ? incomingPayload.water_level : prev.water_level,
                  err_water: incomingPayload.err_water !== undefined ? incomingPayload.err_water : prev.err_water,
                  is_continuous: incomingPayload.is_continuous !== undefined ? incomingPayload.is_continuous : prev.is_continuous,
                  // KẾT LIỄU LỖI CẤN: KHÔNG lấy rssi, free_heap của Sensor đè vào đây. Dành chỗ đó cho Controller.
                };
              });

              // CHỈ reset Watchdog của Sensor. Không đụng tới is_online của hệ thống.
              resetSensorTimeout();
            }

            // =====================================
            // 4. LUỒNG CONTROLLER HEALTH
            // =====================================
            if (data.type === 'device_health') {
              const healthData = data.payload;

              // Cập nhật Sức khỏe Controller vào biến độc lập
              setControllerHealth({
                rssi: healthData.rssi,
                free_heap: healthData.free_heap,
                uptime: healthData.uptime_sec
              });

              // Cập nhật riêng trạng thái bơm vào sensorData để UI đồng bộ trạng thái FSM
              setSensorData(prev => {
                if (!prev) return prev;
                return { ...prev, pump_status: healthData.pump_status };
              });

              setDeviceStatus(prev => !prev.is_online ? { is_online: true, last_seen: new Date().toISOString() } : prev);
              resetControllerTimeout();
            }

          } catch (err) {
            console.error("Lỗi parse WS Message:", err);
          }
        };

        ws.onclose = () => {
          console.log('🔴 [GlobalContext] Mất kết nối WebSocket. Đang thử kết nối lại...');
          setDeviceStatus({ is_online: false, last_seen: '' });
          clearInterval(pingInterval);
          if (controllerTimeoutRef.current) clearTimeout(controllerTimeoutRef.current);
          if (sensorTimeoutRef.current) clearTimeout(sensorTimeoutRef.current);

          reconnectTimeout = setTimeout(() => { connectWs(); }, 5000);
        };

        ws.onerror = (_err) => ws.close();
      };

      connectWs();
    };

    setupConnection();

    return () => {
      clearInterval(pingInterval);
      clearTimeout(reconnectTimeout);
      if (controllerTimeoutRef.current) clearTimeout(controllerTimeoutRef.current);
      if (sensorTimeoutRef.current) clearTimeout(sensorTimeoutRef.current);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [deviceId, settings, resetControllerTimeout, resetSensorTimeout]);

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
      deviceId, sensorData, deviceStatus, fsmState, isLoading, updatePumpStatusOptimistically, settings, systemEvents, controllerHealth
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
