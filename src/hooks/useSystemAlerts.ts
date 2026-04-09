// src/hooks/useSystemAlerts.ts
import { useEffect, useState } from 'react';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { invoke } from '@tauri-apps/api/core';
import toast from 'react-hot-toast'; // Hoặc thư viện toast bạn đang dùng

export function useSystemAlerts() {
  const [sensorData, setSensorData] = useState<any>(null);

  useEffect(() => {
    let ws: WebSocket;

    const connectWs = async () => {
      // Lấy cấu hình URL từ Tauri backend hoặc store
      const settings: any = await invoke('load_settings').catch(() => null);
      if (!settings || !settings.backend_url) return;

      // Chuyển http/https thành ws/wss
      const wsUrl = settings.backend_url.replace(/^http/, 'ws') + '/ws';
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ Đã kết nối WebSocket tới hệ thống!');
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          // 1. NHẬN SENSOR DATA
          if (data.type === 'sensor_update') {
            setSensorData(data.payload);
          }
          // 2. 🟢 ĐÓN LÕNG ALERT BÁO LỖI!
          else if (data.type === 'alert') {
            const { level, title, message } = data.payload;

            // --- A. BẬT POPUP TRONG APP (TOAST) ---
            if (level === 'critical') {
              toast.error(`${title}\n${message}`, {
                duration: 10000,
                style: { background: '#7f1d1d', color: '#fff', fontWeight: 'bold' }
              });
            } else if (level === 'warning') {
              toast.error(`${title}\n${message}`, {
                icon: '⚠️',
                duration: 6000,
              });
            } else {
              toast.success(`${title}\n${message}`);
            }

            // --- B. BẮN NATIVE OS NOTIFICATION (TAURI) ---
            let permissionGranted = await isPermissionGranted();
            if (!permissionGranted) {
              const permission = await requestPermission();
              permissionGranted = permission === 'granted';
            }

            if (permissionGranted) {
              sendNotification({
                title: `Agitech - ${title}`,
                body: message,
                // icon: 'path/to/icon.png' // Có thể gắn icon cảnh báo
              });
            }

            // --- C. (Tùy chọn) PHÁT ÂM THANH BÁO ĐỘNG ---
            if (level === 'critical') {
              const audio = new Audio('/sounds/alarm.mp3');
              audio.play().catch(e => console.log("Không thể play âm thanh do policy của trình duyệt:", e));
            }
          }
        } catch (err) {
          console.error("Lỗi parse WS Message:", err);
        }
      };

      ws.onclose = () => {
        console.log('❌ Mất kết nối WebSocket. Tự động kết nối lại sau 5s...');
        setTimeout(connectWs, 5000);
      };
    };

    connectWs();

    return () => {
      if (ws) ws.close();
    };
  }, []);

  return { sensorData };
}
