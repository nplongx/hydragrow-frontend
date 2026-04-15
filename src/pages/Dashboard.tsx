import { Droplets, Thermometer, Activity, Waves, Settings } from 'lucide-react';
import { useDeviceContext } from '../context/DeviceContext'; // 🟢 SỬ DỤNG CONTEXT MỚI
import { useDeviceControl } from '../hooks/useDeviceControl';

import { SensorBentoCard } from '../components/ui/SensorBentoCard';
import { FsmStatusBadge } from '../components/ui/FsmStatusBadge';

const Dashboard = () => {
  // 🟢 CHỈ CẦN 1 DÒNG ĐỂ LẤY TOÀN BỘ DATA TỪ TRÁI TIM APP
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
        <p className="text-sm text-slate-400 max-w-xs">
          Vui lòng vào mục Cài đặt để nhập Device ID.
        </p>
      </div>
    );
  }

  const pumps = sensorData.pump_status || {};
  const isWaterPumpOn = pumps.water_pump_in;
  const isDrainPumpOn = pumps.water_pump_out;

  const handleToggle = async (pumpId: string, currentStatus: boolean | undefined) => {
    const targetAction = currentStatus ? 'off' : 'on';
    updatePumpStatusOptimistically(pumpId, targetAction);
    const success = await togglePump(pumpId, targetAction);
    if (!success) updatePumpStatusOptimistically(pumpId, currentStatus ? 'on' : 'off');
  };

  return (
    <div className="p-4 space-y-6 animate-in fade-in duration-500 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Trạm Thủy Canh</h1>
          <div className="flex items-center mt-1 space-x-2">
            <span className={`relative flex h-3 w-3 rounded-full ${deviceStatus?.is_online ? 'bg-emerald-500' : 'bg-red-500'}`}>
              {deviceStatus?.is_online && <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
            </span>
            <span className="text-sm text-slate-400">
              {deviceStatus?.is_online ? `Hoạt động tốt • ${deviceId}` : `Mất kết nối • ${deviceId}`}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-400">Trạng thái hệ thống:</span>
        <FsmStatusBadge state={fsmState} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SensorBentoCard title="Dinh dưỡng (EC)" value={sensorData.ec_value} unit="mS/cm" icon={Activity} theme="blue" />
        <SensorBentoCard title="Độ pH" value={sensorData.ph_value} icon={Droplets} theme="fuchsia" />
        <SensorBentoCard title="Nhiệt độ" value={sensorData.temp_value} unit="°C" icon={Thermometer} theme="orange" />
        <SensorBentoCard title="Mực nước" value={sensorData.water_level} unit="%" icon={Waves} theme="cyan" />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
        <h3 className="text-sm font-medium text-slate-400 mb-4">Lệnh nhanh</h3>
        <div className="flex space-x-3">
          <button disabled={isProcessing || !deviceStatus?.is_online} onClick={() => handleToggle("WATER_PUMP", pumps.water_pump_in)} className={`flex-1 py-3 rounded-2xl font-bold flex items-center justify-center space-x-2 ${isWaterPumpOn ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
            <Waves size={18} /> <span>{isWaterPumpOn ? 'Ngừng Cấp' : 'Cấp Nước'}</span>
          </button>
          <button disabled={isProcessing || !deviceStatus?.is_online} onClick={() => handleToggle("DRAIN_PUMP", pumps.water_pump_out)} className={`flex-1 py-3 rounded-2xl font-bold flex items-center justify-center space-x-2 border ${isDrainPumpOn ? 'bg-rose-500 border-rose-500 text-white' : 'bg-slate-800 border-slate-700 text-white'}`}>
            <Waves size={18} className="rotate-180" /> <span>{isDrainPumpOn ? 'Ngừng Xả' : 'Xả Nước'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
