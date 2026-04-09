// src/hooks/useDeviceControl.ts
import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { fetch } from '@tauri-apps/plugin-http'; // <--- Import Native HTTP

export function useDeviceControl(deviceId: string) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hàm Helper để gọi API Control thẳng xuống Actix Backend
  const callControlApi = async (payload: any) => {
    // 1. Đọc cấu hình mạng từ Store nội bộ
    const settings: any = await invoke('load_settings').catch(() => null);
    if (!settings || !settings.backend_url) {
      throw new Error("Chưa cấu hình URL máy chủ.");
    }

    const url = `${settings.backend_url}/api/devices/${deviceId}/control`;

    // 2. Bắn Native HTTP POST
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': settings.api_key
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Từ chối lệnh: HTTP ${res.status}`);
    }
    return await res.json();
  };

  // 🟢 Bổ sung thêm tham số duration_sec
  const togglePump = async (pumpId: string, action: string, pwm?: number, duration_sec?: number) => {
    try {
      setIsProcessing(true);
      setError(null);
      await callControlApi({
        pump: pumpId,
        action: action,
        duration_sec: duration_sec || null, // Truyền thời gian hẹn giờ tắt xuống Actix
        pwm: pwm || null
      });
      return true;
    } catch (err: any) {
      console.error(`Lỗi thực thi togglePump (${pumpId}):`, err);
      setError(err.message || String(err));
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const setPumpPwm = async (pumpId: string, pwmValue: number) => {
    try {
      setIsProcessing(true);
      setError(null);
      await callControlApi({
        pump: pumpId,
        action: 'set_pwm',
        duration_sec: null,
        pwm: pwmValue
      });
      return true;
    } catch (err: any) {
      console.error(`Lỗi thực thi setPumpPwm (${pumpId}):`, err);
      setError(err.message || String(err));
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isProcessing,
    error,
    togglePump,
    setPumpPwm
  };
}
