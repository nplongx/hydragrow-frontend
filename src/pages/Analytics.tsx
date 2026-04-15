// src/pages/Analytics.tsx
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { fetch } from '@tauri-apps/plugin-http';
import { listen } from '@tauri-apps/api/event';
import { Download, Activity, Droplets, Thermometer, Waves, ChevronDown } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { SensorData } from '../types/models';

interface CropSeason {
  id: string;
  name: string;
  status: 'active' | 'completed';
  start_time: string;
  end_time?: string;
}

const Analytics = () => {
  const [appConfig, setAppConfig] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // States cho Vụ Mùa
  const [seasons, setSeasons] = useState<CropSeason[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);

  // 1. Lấy cấu hình máy chủ và danh sách Vụ Mùa
  useEffect(() => {
    const init = async () => {
      try {
        const settings: any = await invoke('load_settings').catch(() => null);
        if (settings && settings.device_id && settings.backend_url) {
          setAppConfig(settings);
          await fetchSeasons(settings.device_id, settings.backend_url, settings.api_key);
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Lỗi khởi tạo Analytics:", error);
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // Fetch danh sách Vụ Mùa
  const fetchSeasons = async (devId: string, backendUrl: string, apiKey: string) => {
    try {
      const url = `${backendUrl}/api/devices/${devId}/seasons`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey }
      });
      if (response.ok) {
        const resData = await response.json();
        const actualData = resData.data ? resData.data : resData;
        setSeasons(actualData);
        if (actualData.length > 0) {
          setSelectedSeason(actualData[0].id); // Chọn vụ gần nhất làm mặc định
        }
      }
    } catch (err) {
      console.warn("Lỗi khi tải vụ mùa:", err);
    }
  };

  // 2. Lấy dữ liệu Sensor theo Vụ mùa được chọn VÀ quản lý Realtime
  useEffect(() => {
    if (!appConfig || !selectedSeason) return;

    let unlistenSensorUpdate: (() => void) | undefined;
    let isSubscribed = true; // Tránh memory leak khi unmount

    const activeSeasonData = seasons.find(s => s.id === selectedSeason);
    const isCompleted = activeSeasonData?.status === 'completed';

    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        // Lấy thời gian khoảng của mùa vụ
        const start = activeSeasonData ? new Date(activeSeasonData.start_time) : new Date(Date.now() - 24 * 3600 * 1000);
        const end = activeSeasonData?.end_time ? new Date(activeSeasonData.end_time) : new Date();

        const queryParams = new URLSearchParams({
          start: start.toISOString(),
          end: end.toISOString(),
          limit: '100' // Giới hạn biểu đồ ở 100 điểm để không giật lag
        }).toString();

        const url = `${appConfig.backend_url}/api/devices/${appConfig.device_id}/sensors/history?${queryParams}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': appConfig.api_key
          }
        });

        if (response.ok && isSubscribed) {
          const resData = await response.json();
          const actualData = resData.data ? resData.data : resData;

          if (Array.isArray(actualData)) {
            const formattedData = actualData.map((d: SensorData) => ({
              ...d,
              formattedTime: new Date(d.time).toLocaleTimeString('vi-VN', {
                hour: '2-digit', minute: '2-digit'
              })
            }));
            setHistoryData(formattedData.reverse());
          }
        }
      } catch (error) {
        console.error("Lỗi lấy lịch sử:", error);
      } finally {
        if (isSubscribed) setIsLoading(false);
      }
    };

    const setupRealtime = async () => {
      unlistenSensorUpdate = await listen<any>('sensor_update', (event) => {
        const newData = event.payload.data ? event.payload.data : event.payload;
        if (newData.device_id !== appConfig.device_id) return;

        const newFormattedData = {
          ...newData,
          formattedTime: new Date(newData.time).toLocaleTimeString('vi-VN', {
            hour: '2-digit', minute: '2-digit'
          })
        };

        setHistoryData((prevData) => {
          if (prevData.length > 0 && prevData[prevData.length - 1].time === newData.time) {
            return prevData; // Bỏ qua trùng lặp
          }
          const updated = [...prevData, newFormattedData];
          return updated.slice(-100);
        });
      });

      try {
        await invoke('start_ws_listener', { deviceId: appConfig.device_id });
      } catch (error) {
        console.error("Lỗi khi gọi Rust start WebSocket:", error);
      }
    };

    fetchHistory();

    // 🟢 Chìa khóa: Nếu mùa vụ 'completed', không bật realtime để đóng băng dữ liệu lịch sử.
    if (!isCompleted) {
      setupRealtime();
    }

    return () => {
      isSubscribed = false;
      if (unlistenSensorUpdate) unlistenSensorUpdate();
    };
  }, [selectedSeason, appConfig, seasons]);

  // 3. Export CSV Lọc Theo Vụ Mùa
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      if (!appConfig || !appConfig.backend_url) throw new Error("Chưa cấu hình Backend URL");

      const activeSeasonData = seasons.find(s => s.id === selectedSeason);
      const start = activeSeasonData ? new Date(activeSeasonData.start_time) : new Date(Date.now() - 24 * 3600 * 1000);
      const end = activeSeasonData?.end_time ? new Date(activeSeasonData.end_time) : new Date();

      // Khi xuất CSV, tăng limit lên để lấy chi tiết nhất có thể
      const queryParams = new URLSearchParams({
        start: start.toISOString(),
        end: end.toISOString(),
        limit: '5000'
      }).toString();

      const url = `${appConfig.backend_url}/api/devices/${appConfig.device_id}/sensors/history?${queryParams}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'X-API-Key': appConfig.api_key }
      });

      if (!response.ok) throw new Error("Không thể lấy dữ liệu lịch sử");

      const resData = await response.json();
      const exportData = resData.data ? resData.data : resData;

      if (!Array.isArray(exportData) || exportData.length === 0) {
        alert("Không có dữ liệu để xuất trong mùa vụ này.");
        return;
      }

      // Convert JSON sang CSV format
      const headers = "Thời gian,EC,pH,Nhiệt độ,Mực Nước\n";
      const rows = exportData.map((d: SensorData) =>
        `"${new Date(d.time).toLocaleString('vi-VN')}","${d.ec_value.toFixed(2)}","${d.ph_value.toFixed(2)}","${d.temp_value.toFixed(2)}","${d.water_level.toFixed(2)}"`
      ).join('\n');

      const csvString = "\uFEFF" + headers + rows; // \uFEFF fix lỗi font UTF-8 trên Excel

      // Logic tải file tự động xuống máy
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const blobUrl = URL.createObjectURL(blob);

      link.setAttribute('href', blobUrl);
      link.setAttribute('download', `bao-cao-thong-so_${selectedSeason || 'all'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error("Lỗi xuất CSV:", error);
      alert("Lỗi xuất file CSV, vui lòng thử lại.");
    } finally {
      setIsExporting(false);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 p-3 rounded-xl shadow-xl">
          <p className="text-slate-300 text-xs mb-2 font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center space-x-2 text-sm font-bold" style={{ color: entry.color }}>
              <span>{entry.name}:</span>
              <span>{entry.value.toFixed(2)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">

      {/* HEADER & LỌC THEO VỤ MÙA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-slate-900/50 p-5 rounded-3xl border border-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.05)] backdrop-blur-md gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1 flex items-center">
            <Activity className="text-blue-400 mr-2" size={26} />
            Phân Tích Dữ Liệu
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1">Biểu đồ biến thiên thông số môi trường.</p>
        </div>

        <div className="flex flex-row items-end gap-3 shrink-0">

          {/* Nút Xuất CSV */}
          <button
            onClick={handleExportCSV}
            disabled={isExporting || historyData.length === 0}
            className="flex items-center justify-center space-x-2 px-4 py-3.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-semibold rounded-2xl transition-all border border-slate-700 active:scale-95"
            title="Xuất dữ liệu ra Excel"
          >
            {isExporting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Download size={18} className={historyData.length > 0 ? "text-emerald-400" : "text-slate-500"} />
            )}
            <span className="hidden sm:inline">Xuất CSV</span>
          </button>

          {/* Dropdown Vụ Mùa */}
          <div className="relative min-w-[200px] flex-1 sm:flex-none">
            <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1.5 block ml-1">Khoảng dữ liệu (Mùa vụ)</label>
            <div className="relative">
              <select
                value={selectedSeason || ''}
                onChange={(e) => setSelectedSeason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 hover:border-blue-500/50 text-white text-sm font-semibold rounded-2xl pl-4 pr-10 py-3.5 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all cursor-pointer"
              >
                {seasons.map(ss => (
                  <option key={ss.id} value={ss.id}>
                    {ss.status === 'active' ? '🟢' : '📦'} {ss.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="text-sm text-slate-400 font-medium animate-pulse">Đang nạp dữ liệu môi trường...</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* EC Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 pt-6 hover:border-blue-500/30 transition-all">
            <div className="flex items-center space-x-2 mb-4 px-2">
              <Activity className="text-blue-400" size={20} />
              <h3 className="text-white font-semibold">Độ dẫn điện (EC)</h3>
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorEc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="formattedTime" stroke="#64748b" fontSize={12} tickMargin={10} minTickGap={30} />
                  <YAxis stroke="#64748b" fontSize={12} domain={['auto', 'auto']} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="ec_value" name="EC" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorEc)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* PH Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 pt-6 hover:border-fuchsia-500/30 transition-all">
            <div className="flex items-center space-x-2 mb-4 px-2">
              <Droplets className="text-fuchsia-400" size={20} />
              <h3 className="text-white font-semibold">Độ pH</h3>
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPh" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d946ef" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#d946ef" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="formattedTime" stroke="#64748b" fontSize={12} tickMargin={10} minTickGap={30} />
                  <YAxis stroke="#64748b" fontSize={12} domain={[0, 14]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="ph_value" name="pH" stroke="#d946ef" strokeWidth={3} fillOpacity={1} fill="url(#colorPh)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* NHIỆT ĐỘ Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 pt-6 hover:border-orange-500/30 transition-all">
            <div className="flex items-center space-x-2 mb-4 px-2">
              <Thermometer className="text-orange-400" size={20} />
              <h3 className="text-white font-semibold">Nhiệt độ dung dịch (°C)</h3>
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="formattedTime" stroke="#64748b" fontSize={12} tickMargin={10} minTickGap={30} />
                  <YAxis stroke="#64748b" fontSize={12} domain={['auto', 'auto']} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="temp_value" name="Nhiệt độ" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorTemp)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* MỰC NƯỚC Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 pt-6 hover:border-cyan-500/30 transition-all">
            <div className="flex items-center space-x-2 mb-4 px-2">
              <Waves className="text-cyan-400" size={20} />
              <h3 className="text-white font-semibold">Mực Nước Hệ Thống (%)</h3>
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorWater" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="formattedTime" stroke="#64748b" fontSize={12} tickMargin={10} minTickGap={30} />
                  <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="water_level" name="Mực nước" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#colorWater)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default Analytics;
