import { Droplets, Thermometer, Activity, Waves } from 'lucide-react';
import { useDeviceSensor } from '../hooks/useDeviceSensor';
import { useDeviceControl } from '../hooks/useDeviceControl';

// Bạn có thể lấy deviceId từ Context hoặc Settings, ở đây tôi tạm hardcode để demo
const DEVICE_ID = "HYDRO_001";

const Dashboard = () => {
  const { sensorData, deviceStatus, isLoading } = useDeviceSensor(DEVICE_ID);
  const { isProcessing, startRefillSequence, startDrainSequence } = useDeviceControl(DEVICE_ID);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  // Fallback nếu mất kết nối
  const data = sensorData || { ec_value: 0, ph_value: 0, temp_value: 0, water_level: 0 };

  return (
    <div className="p-4 space-y-6 animate-in fade-in duration-500">

      {/* Header: Status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Trạm Thủy Canh</h1>
          <div className="flex items-center mt-1 space-x-2">
            <span className={`relative flex h-3 w-3`}>
              {deviceStatus.is_online && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${deviceStatus.is_online ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
            </span>
            <span className="text-sm text-slate-400">
              {deviceStatus.is_online ? 'Hệ thống đang hoạt động' : 'Mất kết nối thiết bị'}
            </span>
          </div>
        </div>
      </div>

      {/* Grid: Bento Box Stats */}
      <div className="grid grid-cols-2 gap-4">
        {/* EC Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between aspect-square relative overflow-hidden">
          <div className="flex items-center space-x-2 text-blue-400">
            <Activity size={20} />
            <span className="font-semibold text-sm">Dinh dưỡng (EC)</span>
          </div>
          <div>
            <span className="text-4xl font-bold text-white">{data.ec_value.toFixed(2)}</span>
            <span className="text-slate-400 ml-1">mS/cm</span>
          </div>
          {/* Lớp màu nền mờ trang trí */}
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl"></div>
        </div>

        {/* pH Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between aspect-square relative overflow-hidden">
          <div className="flex items-center space-x-2 text-fuchsia-400">
            <Droplets size={20} />
            <span className="font-semibold text-sm">Độ pH</span>
          </div>
          <div>
            <span className="text-4xl font-bold text-white">{data.ph_value.toFixed(1)}</span>
          </div>
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-fuchsia-500/10 rounded-full blur-2xl"></div>
        </div>

        {/* Temp Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between aspect-square relative overflow-hidden">
          <div className="flex items-center space-x-2 text-orange-400">
            <Thermometer size={20} />
            <span className="font-semibold text-sm">Nhiệt độ</span>
          </div>
          <div>
            <span className="text-4xl font-bold text-white">{data.temp_value.toFixed(1)}</span>
            <span className="text-slate-400 ml-1">°C</span>
          </div>
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl"></div>
        </div>

        {/* Water Level Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between aspect-square relative overflow-hidden">
          <div className="flex items-center space-x-2 text-cyan-400">
            <Waves size={20} />
            <span className="font-semibold text-sm">Mực nước</span>
          </div>
          <div>
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
            disabled={isProcessing || !deviceStatus.is_online}
            onClick={startRefillSequence}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-2xl font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center space-x-2"
          >
            {isProcessing ? <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></span> : <Waves size={18} />}
            <span>Cấp Nước</span>
          </button>

          <button
            disabled={isProcessing || !deviceStatus.is_online}
            onClick={startDrainSequence}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-2xl font-semibold transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
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
