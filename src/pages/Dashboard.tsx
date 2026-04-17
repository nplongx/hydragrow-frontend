import React from 'react';
import { Droplets, Thermometer, Activity, Waves, Settings, Zap, Cpu } from 'lucide-react';
import { useDeviceContext } from '../context/DeviceContext';
import { useDeviceControl } from '../hooks/useDeviceControl';

import { SensorBentoCard } from '../components/ui/SensorBentoCard';
import { FsmStatusBadge } from '../components/ui/FsmStatusBadge';

// 🟢 COMPONENT: Nhãn thiết bị đang chạy (Đã nâng cấp hiệu ứng Glow & Pulse)
const ActiveDeviceTag = ({ label, color, glowColor }: { label: string; color: string; glowColor: string }) => (
  <span
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-extrabold uppercase tracking-widest animate-in zoom-in duration-300 backdrop-blur-md ${color}`}
    style={{ boxShadow: `0 0 12px ${glowColor}, inset 0 0 8px ${glowColor}` }}
  >
    <Zap size={12} className="fill-current animate-pulse" />
    {label}
  </span>
);

const Dashboard = () => {
  const { deviceId, sensorData, deviceStatus, fsmState, isLoading, updatePumpStatusOptimistically } = useDeviceContext();
  const { isProcessing, togglePump } = useDeviceControl(deviceId || "");

  if (isLoading || !sensorData) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen bg-slate-950">
        <div className="relative">
          <div className="absolute inset-0 bg-emerald-500 rounded-full blur-xl opacity-50 animate-pulse"></div>
          <Cpu size={40} className="text-emerald-400 animate-bounce relative z-10" />
        </div>
      </div>
    );
  }

  if (!deviceId) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[80vh] space-y-6 p-6 text-center animate-in fade-in zoom-in duration-500">
        <div className="relative p-6 bg-slate-900/80 backdrop-blur-xl rounded-full border border-slate-700 shadow-[0_0_30px_rgba(0,0,0,0.5)] group">
          <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-2xl group-hover:bg-indigo-500/30 transition-colors"></div>
          <Settings size={48} className="text-indigo-400 relative z-10 animate-[spin_10s_linear_infinite]" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
            CHƯA KẾT NỐI TRẠM
          </h2>
          <p className="text-sm text-slate-400 max-w-xs mx-auto leading-relaxed">
            Vui lòng vào mục Cài đặt để nhập Device ID và bắt đầu đồng bộ dữ liệu.
          </p>
        </div>
      </div>
    );
  }

  // 🟢 LOGIC: Loại bỏ "Bóng ma dữ liệu" khi Offline
  const isOnline = deviceStatus?.is_online;
  const pumps = isOnline ? (sensorData.pump_status || {}) : {};

  const handleToggle = async (pumpId: string, currentStatus: boolean | undefined) => {
    const targetAction = currentStatus ? 'off' : 'on';
    updatePumpStatusOptimistically(pumpId, targetAction);
    const success = await togglePump(pumpId, targetAction);
    if (!success) updatePumpStatusOptimistically(pumpId, currentStatus ? 'on' : 'off');
  };

  return (
    <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-32 relative min-h-screen">

      {/* 🟢 Hiệu ứng nền Mesh Gradient */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-emerald-500/10 via-transparent to-transparent pointer-events-none blur-3xl"></div>

      {/* 1. HEADER & STATUS PILL */}
      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-1">
          <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400 tracking-tight">
            TRẠM TRUNG TÂM
          </h1>
          <div className="flex items-center mt-1 space-x-2">
            <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full border backdrop-blur-md ${isOnline ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.2)]'}`}>
              <span className={`relative flex h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-rose-500'}`}>
                {isOnline && <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {isOnline ? 'Đang Hoạt Động' : 'Mất Kết Nối'}
              </span>
            </div>
            <span className="text-xs text-slate-500 font-mono">{deviceId}</span>
          </div>
        </div>
      </div>

      {/* 2. THẺ GIÁM SÁT FSM (NEON GLASSMORPHISM) */}
      <div className="relative bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-5 shadow-[0_20px_40px_rgba(0,0,0,0.4)] overflow-hidden group">
        {/* Glow nền mờ ảo bên trong thẻ */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/20 transition-colors duration-500"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-blue-500/20 transition-colors duration-500"></div>

        <div className="relative z-10 flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-slate-400" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Tiến trình FSM</span>
          </div>
          <FsmStatusBadge state={fsmState} />
        </div>

        {/* Khu vực thiết bị đang chạy */}
        <div className="relative z-10 pt-4 border-t border-slate-700/50">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-slate-500"></span>
            Đang tiêu thụ điện:
          </p>
          <div className="flex flex-wrap gap-2.5">
            {pumps.pump_a && <ActiveDeviceTag label="Bơm Phân A" color="bg-orange-500/10 text-orange-400 border-orange-500/50" glowColor="rgba(249,115,22,0.25)" />}
            {pumps.pump_b && <ActiveDeviceTag label="Bơm Phân B" color="bg-orange-500/10 text-orange-400 border-orange-500/50" glowColor="rgba(249,115,22,0.25)" />}
            {pumps.ph_up && <ActiveDeviceTag label="Tăng pH" color="bg-purple-500/10 text-purple-400 border-purple-500/50" glowColor="rgba(168,85,247,0.25)" />}
            {pumps.ph_down && <ActiveDeviceTag label="Giảm pH" color="bg-purple-500/10 text-purple-400 border-purple-500/50" glowColor="rgba(168,85,247,0.25)" />}
            {pumps.osaka_pump && <ActiveDeviceTag label="Bơm Trộn" color="bg-indigo-500/10 text-indigo-400 border-indigo-500/50" glowColor="rgba(99,102,241,0.25)" />}
            {pumps.mist_valve && <ActiveDeviceTag label="Phun Sương" color="bg-sky-500/10 text-sky-400 border-sky-500/50" glowColor="rgba(14,165,233,0.25)" />}
            {pumps.water_pump_in && <ActiveDeviceTag label="Cấp Nước" color="bg-blue-500/10 text-blue-400 border-blue-500/50" glowColor="rgba(59,130,246,0.25)" />}
            {pumps.water_pump_out && <ActiveDeviceTag label="Xả Nước" color="bg-cyan-500/10 text-cyan-400 border-cyan-500/50" glowColor="rgba(6,182,212,0.25)" />}

            {!Object.values(pumps).some(v => v === true) && (
              <span className="text-xs text-slate-600 font-medium italic flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-800">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-600"></div>
                Hệ thống đang nghỉ
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. LƯỚI CẢM BIẾN */}
      <div className="grid grid-cols-2 gap-4 relative z-10">
        <SensorBentoCard title="Dinh dưỡng (EC)" value={sensorData.ec_value} unit="mS/cm" icon={Activity} theme="blue" />
        <SensorBentoCard title="Độ pH" value={sensorData.ph_value} icon={Droplets} theme="fuchsia" />
        <SensorBentoCard title="Nhiệt độ" value={sensorData.temp_value} unit="°C" icon={Thermometer} theme="orange" />
        <SensorBentoCard title="Mực nước" value={sensorData.water_level} unit="%" icon={Waves} theme="cyan" />
      </div>

      {/* 4. QUICK ACTIONS (NÚT BẤM 3D NEON) */}
      <div className="bg-slate-900/40 backdrop-blur-lg border border-slate-800/80 rounded-[2rem] p-5 relative z-10">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Zap size={14} className="text-amber-500" /> Cưỡng chế nhanh
        </h3>
        <div className="flex space-x-3">
          <button
            disabled={isProcessing || !isOnline}
            onClick={() => handleToggle("WATER_PUMP_IN", pumps.water_pump_in)}
            className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:active:scale-100 border ${pumps.water_pump_in
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                : 'bg-slate-800/50 text-blue-400 border-blue-500/20 hover:bg-blue-500/10 hover:border-blue-500/40 shadow-inner'
              }`}
          >
            <Waves size={18} className={pumps.water_pump_in ? "animate-pulse" : ""} />
            <span>{pumps.water_pump_in ? 'NGỪNG CẤP' : 'CẤP NƯỚC'}</span>
          </button>

          <button
            disabled={isProcessing || !isOnline}
            onClick={() => handleToggle("WATER_PUMP_OUT", pumps.water_pump_out)}
            className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:active:scale-100 border ${pumps.water_pump_out
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                : 'bg-slate-800/50 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/10 hover:border-cyan-500/40 shadow-inner'
              }`}
          >
            <Waves size={18} className={`rotate-180 ${pumps.water_pump_out ? "animate-pulse" : ""}`} />
            <span>{pumps.water_pump_out ? 'NGỪNG XẢ' : 'XẢ NƯỚC'}</span>
          </button>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
