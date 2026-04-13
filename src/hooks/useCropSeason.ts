import { useState, useEffect, useCallback } from 'react';
import { fetch } from '@tauri-apps/plugin-http';
import { CropSeason } from '../types/models';
import toast from 'react-hot-toast';
import { useDeviceContext } from '../context/DeviceContext';

export const useCropSeason = () => {
  const { deviceId, settings } = useDeviceContext();
  const [activeSeason, setActiveSeason] = useState<CropSeason | null>(null);
  const [history, setHistory] = useState<CropSeason[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const getHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    'X-API-Key': settings?.api_key || ''
  }), [settings]);

  const loadSeasons = useCallback(async () => {
    if (!deviceId || !settings?.backend_url) return;
    setIsLoading(true);
    try {
      const baseUrl = `${settings.backend_url}/api/devices/${deviceId}/seasons`;

      // Load active
      const activeRes = await fetch(`${baseUrl}/active`, { method: 'GET', headers: getHeaders() });
      const activeData = await activeRes.json();
      setActiveSeason(activeData.data);

      // Load history
      const historyRes = await fetch(baseUrl, { method: 'GET', headers: getHeaders() });
      const historyData = await historyRes.json();
      setHistory(historyData.data || []);
    } catch (error) {
      console.error("Lỗi tải dữ liệu mùa vụ:", error);
      toast.error("Không thể tải thông tin mùa vụ");
    } finally {
      setIsLoading(false);
    }
  }, [deviceId, settings, getHeaders]);

  useEffect(() => {
    loadSeasons();
  }, [loadSeasons]);

  const createSeason = async (name: string, plantType: string) => {
    if (!deviceId || !settings?.backend_url) return false;
    try {
      const res = await fetch(`${settings.backend_url}/api/devices/${deviceId}/seasons`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name, plant_type: plantType })
      });
      if (res.ok) {
        toast.success("Đã bắt đầu mùa vụ mới!");
        await loadSeasons();
        return true;
      }
    } catch (error) {
      toast.error("Lỗi khi tạo mùa vụ");
    }
    return false;
  };

  const endSeason = async () => {
    if (!deviceId || !settings?.backend_url) return false;
    try {
      const res = await fetch(`${settings.backend_url}/api/devices/${deviceId}/seasons/active/end`, {
        method: 'PUT',
        headers: getHeaders()
      });
      if (res.ok) {
        toast.success("Đã kết thúc mùa vụ hiện tại!");
        await loadSeasons();
        return true;
      }
    } catch (error) {
      toast.error("Lỗi khi kết thúc mùa vụ");
    }
    return false;
  };

  return { activeSeason, history, isLoading, createSeason, endSeason, refresh: loadSeasons };
};
