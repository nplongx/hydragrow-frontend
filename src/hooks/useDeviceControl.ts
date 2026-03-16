// src/hooks/useDeviceControl.ts
import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function useDeviceControl(deviceId: string) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hàm bọc try/catch chuẩn chỉ cho mọi lệnh
  const executeCommand = async (commandName: string, args: Record<string, any>) => {
    setIsProcessing(true);
    setError(null);
    try {
      await invoke(commandName, { deviceId, ...args });
      return true;
    } catch (err: any) {
      console.error(`Lỗi thực thi ${commandName}:`, err);
      // Rust trả Err(String) về, nó sẽ văng vào catch ở dạng string
      setError(typeof err === 'string' ? err : 'Đã có lỗi xảy ra');

      // Bắn luôn OS Notification báo lỗi
      await invoke('trigger_os_notification', {
        title: "Lỗi điều khiển",
        body: typeof err === 'string' ? err : 'Hệ thống từ chối lệnh'
      });
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  // Chỉ giữ lại hàm điều khiển Bơm (Pump)
  const togglePump = async (pump: string, action: 'on' | 'off', durationSec?: number) => {
    return executeCommand('manual_pump', { pump, action, durationSec });
  };

  return {
    isProcessing,
    error,
    togglePump,
  };
}
