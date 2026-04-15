import { Droplets, Thermometer, Activity, Waves, Settings, FlaskConical, Wind, Zap } from 'lucide-react';
import { useDeviceContext } from '../context/DeviceContext';
import { useDeviceControl } from '../hooks/useDeviceControl';

import { SensorBentoCard } from '../components/ui/SensorBentoCard';
import { FsmStatusBadge } from '../components/ui/FsmStatusBadge';
import { PumpStatus } from '../types/models';

// Component con hiển thị nhãn thiết bị đang chạy
const ActiveDeviceTag = ({ label, color }: { label: string; color: string }) => (
  <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider animate-in zoom-in duration-300 ${color}`}>
    <Zap size={10} className="fill-current" />
    {label}
  </span>
);

const Dashboard = () => {
  const { deviceId, sensorData, deviceStatus, fsmState, isLoading, updatePumpStatusOptimistically } = useDeviceContext();
  const { isProcessing, togglePump } = useDeviceControl(deviceId || "");

  if (isLoading || !sensorData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!deviceId) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 p-6 text-center animate-in fade-in">
        <div className="p-4 bg-slate-900 rounded-full border border-slate-800">
          <Settings size={32} className="text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Chưa cấu hình thiết bị</h2>
        <p className="text-sm text-slate-400 max-w-xs">Vui lòng vào mục Cài đặt để nhập Device ID.</p>
      </div>
    );
  }

  const isOnline = deviceStatus?.is_online;
  // Ép toàn bộ về {} (tắt hết) nếu thiết bị đang offline để xóa "bóng ma" dữ liệu cũ
  const pumps: PumpStatus = isOnline ? (sensorData.pump_status || {}) : {};

  // Logic xử lý lệnh nhanh
  const handleToggle = async (pumpId: string, currentStatus: boolean | undefined) => {
    const targetAction = currentStatus ? 'off' : 'on';
    updatePumpStatusOptimistically(pumpId, targetAction);
    const success = await togglePump(pumpId, targetAction);
    if (!success) updatePumpStatusOptimistically(pumpId, currentStatus ? 'on' : 'off');
  };

  return (
    <div className="p-4 space-y-6 animate-in fade-in duration-500 pb-24">
      {/* 1. Header & Connectivity Status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Trạm Thủy Canh</h1>
          <div className="flex items-center mt-1 space-x-2">
            <span className={`relative flex h-3 w-3 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`}>
              {isOnline && <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
            </span>
            <span className="text-sm text-slate-400">
              {isOnline ? `Hoạt động tốt • ${deviceId}` : `Mất kết nối • ${deviceId}`}
            </span>
          </div>
        </div>
      </div>

      {/* 2. System Status & Active Devices Monitor */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Tiến trình FSM</span>
          <FsmStatusBadge state={fsmState} />
        </div>

        {/* Luồng giám sát các thiết bị đang chạy thực tế */}
        <div className="pt-3 border-t border-slate-800/50">
          <p className="text-[10px] font-bold text-slate-600 uppercase mb-2">Đang hoạt động:</p>
          <div className="flex flex-wrap gap-2">
            {pumps.pump_a && <ActiveDeviceTag label="Dinh dưỡng A" color="bg-orange-500/10 text-orange-400 border-orange-500/30" />}
            {pumps.pump_b && <ActiveDeviceTag label="Dinh dưỡng B" color="bg-orange-500/10 text-orange-400 border-orange-500/30" />}
            {pumps.ph_up && <ActiveDeviceTag label="Tăng pH" color="bg-purple-500/10 text-purple-400 border-purple-500/30" />}
            {pumps.ph_down && <ActiveDeviceTag label="Giảm pH" color="bg-purple-500/10 text-purple-400 border-purple-500/30" />}
            {pumps.osaka_pump && <ActiveDeviceTag label="Bơm Trộn" color="bg-indigo-500/10 text-indigo-400 border-indigo-500/30" />}
            {pumps.mist_valve && <ActiveDeviceTag label="Phun Sương" color="bg-sky-500/10 text-sky-400 border-sky-500/30" />}
            {pumps.water_pump_in && <ActiveDeviceTag label="Cấp Nước" color="bg-blue-500/10 text-blue-400 border-blue-500/30" />}
            {pumps.water_pump_out && <ActiveDeviceTag label="Xả Nước" color="bg-cyan-500/10 text-cyan-400 border-cyan-500/30" />}

            {/* Nếu không có gì đang chạy */}
            {!Object.values(pumps).some(v => v === true) && (
              <span className="text-xs text-slate-600 italic">Không có thiết bị nào đang chạy</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Sensors Grid */}
      <div className="grid grid-cols-2 gap-4">
        <SensorBentoCard title="Dinh dưỡng (EC)" value={sensorData.ec_value} unit="mS" icon={Activity} theme="blue" />
        <SensorBentoCard title="Độ pH" value={sensorData.ph_value} icon={Droplets} theme="fuchsia" />
        <SensorBentoCard title="Nhiệt độ" value={sensorData.temp_value} unit="°C" icon={Thermometer} theme="orange" />
        <SensorBentoCard title="Mực nước" value={sensorData.water_level} unit="%" icon={Waves} theme="cyan" />
      </div>

      {/* 4. Quick Actions (Manual Override) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
        <h3 className="text-xs font-bold text-slate-500 uppercase mb-4">Thao tác nhanh</h3>
        <div className="flex space-x-3">
          <button
            disabled={isProcessing || !isOnline}
            onClick={() => handleToggle("WATER_PUMP_IN", pumps.water_pump_in)}
            className={`flex-1 py-3 rounded-2xl font-bold flex items-center justify-center space-x-2 transition-all ${pumps.water_pump_in ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white active:scale-95'}`}
          >
            <Waves size={18} /> <span>{pumps.water_pump_in ? 'Ngừng Cấp' : 'Cấp Nước'}</span>
          </button>
          <button
            disabled={isProcessing || !isOnline}
            onClick={() => handleToggle("WATER_PUMP_OUT", pumps.water_pump_out)}
            className={`flex-1 py-3 rounded-2xl font-bold flex items-center justify-center space-x-2 border transition-all ${pumps.water_pump_out ? 'bg-rose-500 border-rose-500 text-white' : 'bg-slate-800 border-slate-700 text-white active:scale-95'}`}
          >
            <Waves size={18} className="rotate-180" /> <span>{pumps.water_pump_out ? 'Ngừng Xả' : 'Xả Nước'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
