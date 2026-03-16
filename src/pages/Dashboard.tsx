// src/pages/Dashboard.tsx
import { useState, useEffect } from 'react';
import { Droplets, Thermometer, Activity, Waves, Settings } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useDeviceSensor } from '../hooks/useDeviceSensor';
import { useDeviceControl } from '../hooks/useDeviceControl';

const Dashboard = () => {
  const [deviceId, setDeviceId] = useState<string | null>("device_001");
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  // 1. Tự động lấy Device ID từ Tauri Store khi mở Dashboard
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings: any = await invoke('load_settings');
        if (settings && settings.device_id) {
          setDeviceId(settings.device_id);

          _
        }
      } catch (error) {
        console.error("Lỗi khi tải cài đặt:", error);
      } finally {
        setIsLoadingSettings(false);
      }
    };
    fetchSettings();
  }, []);

  // Nếu đang tải cấu hình
  if (isLoadingSettings) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  // Nếu chưa có Device ID (Người dùng chưa cấu hình trong Settings)
  // if (!deviceId) {
  //   return (
  //     <div className="flex flex-col items-center justify-center h-full space-y-4 p-6 text-center animate-in fade-in">
  //       <div className="p-4 bg-slate-900 rounded-full border border-slate-800">
  //         <Settings size={32} className="text-slate-400" />
  //       </div>
  //       <h2 className="text-xl font-bold text-white">Chưa cấu hình thiết bị</h2>
  //       <p className="text-sm text-slate-400 max-w-xs">
  //         Vui lòng vào mục Cài đặt để nhập Device ID và các thông số kết nối trước khi xem Dashboard.
  //       </p>
  //     </div>
  //   );
  // }

  // Khởi tạo render chính
  return <DashboardContent deviceId={deviceId} />;
};

// --- COMPONENT CON CHỨA LOGIC CHÍNH ---
// Tách ra để hooks (useDeviceSensor, useDeviceControl) chỉ chạy khi đã có deviceId
const DashboardContent = ({ deviceId }: { deviceId: string }) => {
  const { sensorData, deviceStatus, isLoading } = useDeviceSensor(deviceId);
  const { isProcessing, startRefillSequence, startDrainSequence } = useDeviceControl(deviceId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  // Đảm bảo data luôn là một object có chứa các thuộc tính cần thiết là kiểu số
  const data = {
    ec_value: Number(sensorData?.ec_value) || 0,
    ph_value: Number(sensorData?.ph_value) || 0,
    temp_value: Number(sensorData?.temp_value) || 0,
    water_level: Number(sensorData?.water_level) || 0,
  };

  return (
    <div className="p-4 space-y-6 animate-in fade-in duration-500 pb-24">
      {/* Header: Status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Trạm Thủy Canh</h1>
          <div className="flex items-center mt-1 space-x-2">
            <span className={`relative flex h-3 w-3`}>
              {deviceStatus?.is_online && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${deviceStatus?.is_online ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
            </span>
            <span className="text-sm text-slate-400">
              {deviceStatus?.is_online ? `Hoạt động tốt • ${deviceId}` : `Mất kết nối • ${deviceId}`}
            </span>
          </div>
        </div>
      </div>

      {/* Grid: Bento Box Stats */}
      <div className="grid grid-cols-2 gap-4">
        {/* EC Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between aspect-square relative overflow-hidden">
          <div className="flex items-center space-x-2 text-blue-400 relative z-10">
            <Activity size={20} />
            <span className="font-semibold text-sm">Dinh dưỡng (EC)</span>
          </div>
          <div className="relative z-10">
            <span className="text-4xl font-bold text-white">{data.ec_value.toFixed(2)}</span>
            <span className="text-slate-400 ml-1">mS/cm</span>
          </div>
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl"></div>
        </div>

        {/* pH Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between aspect-square relative overflow-hidden">
          <div className="flex items-center space-x-2 text-fuchsia-400 relative z-10">
            <Droplets size={20} />
            <span className="font-semibold text-sm">Độ pH</span>
          </div>
          <div className="relative z-10">
            <span className="text-4xl font-bold text-white">{data.ph_value.toFixed(1)}</span>
          </div>
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-fuchsia-500/10 rounded-full blur-2xl"></div>
        </div>

        {/* Temp Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between aspect-square relative overflow-hidden">
          <div className="flex items-center space-x-2 text-orange-400 relative z-10">
            <Thermometer size={20} />
            <span className="font-semibold text-sm">Nhiệt độ</span>
          </div>
          <div className="relative z-10">
            <span className="text-4xl font-bold text-white">{data.temp_value.toFixed(1)}</span>
            <span className="text-slate-400 ml-1">°C</span>
          </div>
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl"></div>
        </div>

        {/* Water Level Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between aspect-square relative overflow-hidden">
          <div className="flex items-center space-x-2 text-cyan-400 relative z-10">
            <Waves size={20} />
            <span className="font-semibold text-sm">Mực nước</span>
          </div>
          <div className="relative z-10">
            <span className="text-4xl font-bold text-white">{data.water_level.toFixed(0)}</span>
            <span className="text-slate-400 ml-1">%</span>
          </div>
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl"></div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
        <h3 className="text-sm font-medium text-slate-400 mb-4">Lệnh nhanh (Tự động)</h3>
        <div className="flex space-x-3">
          <button
            disabled={isProcessing || !deviceStatus?.is_online}
            onClick={startRefillSequence}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-2xl font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center space-x-2"
          >
            {isProcessing ? (
              <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></span>
            ) : (
              <Waves size={18} />
            )}
            <span>Cấp Nước</span>
          </button>

          <button
            disabled={isProcessing || !deviceStatus?.is_online}
            onClick={startDrainSequence}
            className="flex-1 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white py-3 rounded-2xl font-semibold transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            <Waves size={18} className="rotate-180" />
            <span>Xả Nước</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
