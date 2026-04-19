import { useState } from 'react';
import {
  Settings2, FlaskConical, Droplets, Wind, Power, AlertTriangle, Timer, Activity, RefreshCw, Zap,
  Waves
} from 'lucide-react';
import { useDeviceContext } from '../context/DeviceContext';
import { useDeviceControl } from '../hooks/useDeviceControl';
import { PumpStatus } from '../types/models';

// 🟢 TỪ ĐIỂN MÀU SẮC NEON (Tránh lỗi không nhận diện được class của Tailwind)
const NEON_COLORS: Record<string, any> = {
  orange: { bg: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500/50', shadow: 'shadow-[0_0_20px_rgba(249,115,22,0.3)]', glow: 'from-orange-500/20' },
  purple: { bg: 'bg-purple-500', text: 'text-purple-400', border: 'border-purple-500/50', shadow: 'shadow-[0_0_20px_rgba(168,85,247,0.3)]', glow: 'from-purple-500/20' },
  blue: { bg: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500/50', shadow: 'shadow-[0_0_20px_rgba(59,130,246,0.3)]', glow: 'from-blue-500/20' },
  cyan: { bg: 'bg-cyan-500', text: 'text-cyan-400', border: 'border-cyan-500/50', shadow: 'shadow-[0_0_20px_rgba(6,182,212,0.3)]', glow: 'from-cyan-500/20' },
  indigo: { bg: 'bg-indigo-500', text: 'text-indigo-400', border: 'border-indigo-500/50', shadow: 'shadow-[0_0_20px_rgba(99,102,241,0.3)]', glow: 'from-indigo-500/20' },
  sky: { bg: 'bg-sky-500', text: 'text-sky-400', border: 'border-sky-500/50', shadow: 'shadow-[0_0_20px_rgba(14,165,233,0.3)]', glow: 'from-sky-500/20' },
};

// --- Component Khối Điều Khiển Pha Lê ---
const AdvancedDeviceControl = ({
  deviceId, pumpId, title, icon: Icon, colorTheme, currentStatus, allowPwm = false, updatePumpStatusOptimistically, isOnline
}: any) => {
  const { togglePump, setPwm, forceOn } = useDeviceControl(deviceId);
  const [pwmValue, setPwmValue] = useState(100);
  const [duration, setDuration] = useState(120);
  const [isProcessing, setIsProcessing] = useState(false);

  const theme = NEON_COLORS[colorTheme];

  const handleToggle = async () => {
    setIsProcessing(true);
    const targetAction = currentStatus ? 'off' : 'on';
    updatePumpStatusOptimistically(pumpId, targetAction);
    const success = await togglePump(pumpId, targetAction);
    if (!success) updatePumpStatusOptimistically(pumpId, currentStatus ? 'on' : 'off');
    setIsProcessing(false);
  };

  const handleForceOn = async () => {
    if (!window.confirm(`⚠️ CẢNH BÁO: Bật cưỡng chế ${title} trong ${duration}s?`)) return;
    setIsProcessing(true);
    updatePumpStatusOptimistically(pumpId, 'on');
    const success = await forceOn(pumpId, duration);
    if (!success) updatePumpStatusOptimistically(pumpId, 'off');
    setIsProcessing(false);
  };

  const handleSetPwm = async () => {
    setIsProcessing(true);
    if (!currentStatus) updatePumpStatusOptimistically(pumpId, 'on');
    await setPwm(pumpId, pwmValue);
    setIsProcessing(false);
  };

  return (
    <div className={`relative bg-slate-900/40 backdrop-blur-xl rounded-[2rem] p-5 transition-all duration-500 overflow-hidden group ${currentStatus ? `border ${theme.border} ${theme.shadow}` : 'border border-white/5'
      }`}>

      {/* Nền Gradient mờ ảo khi thiết bị đang bật */}
      <div className={`absolute inset-0 bg-gradient-to-br ${theme.glow} to-transparent opacity-0 transition-opacity duration-500 pointer-events-none ${currentStatus ? 'opacity-100' : ''}`}></div>

      <div className="relative z-10">
        {/* Header: Icon & Tên */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-3">
            <div className={`p-3 rounded-2xl transition-all duration-500 ${currentStatus ? `${theme.bg} text-white shadow-lg` : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'
              }`}>
              <Icon size={20} className={currentStatus ? "animate-pulse" : ""} />
            </div>
            <div>
              <h3 className={`font-black tracking-wide ${currentStatus ? 'text-white' : 'text-slate-300'}`}>{title}</h3>
              <p className="text-[10px] text-slate-500 font-mono tracking-widest">{pumpId}</p>
            </div>
          </div>

          {/* Nút Bật/Tắt To Bản */}
          <button
            disabled={!isOnline || isProcessing}
            onClick={handleToggle}
            className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-300 active:scale-95 disabled:opacity-50 ${currentStatus
              ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.5)]'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
              }`}
          >
            {currentStatus ? 'TẮT' : 'BẬT'}
          </button>
        </div>

        {/* Các chức năng mở rộng (Tự động đẩy xuống dưới) */}
        <div className={`space-y-4 pt-4 border-t transition-all duration-500 ${currentStatus ? `border-${colorTheme}-500/20` : 'border-slate-800/50'}`}>

          {/* Thanh trượt PWM */}
          {allowPwm && (
            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <span className="flex items-center gap-1.5"><Activity size={12} className={currentStatus ? theme.text : ''} /> Công suất (PWM)</span>
                <span className={currentStatus ? theme.text : 'text-white'}>{pwmValue}%</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range" min="10" max="100" step="10"
                  value={pwmValue}
                  onChange={(e) => setPwmValue(parseInt(e.target.value))}
                  disabled={!isOnline || isProcessing}
                  className={`flex-1 h-2 rounded-lg appearance-none cursor-pointer bg-slate-800 accent-${colorTheme}-500 outline-none`}
                />
                <button
                  onClick={handleSetPwm}
                  disabled={!isOnline || isProcessing}
                  className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${currentStatus ? `${theme.bg} text-white` : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-white'
                    }`}
                >
                  SET
                </button>
              </div>
            </div>
          )}

          {/* Cưỡng chế hẹn giờ */}
          <div className="space-y-2.5 pt-1">
            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <span className="flex items-center gap-1.5"><Timer size={12} className="text-amber-500" /> Hẹn giờ chạy</span>
            </div>
            <div className="flex gap-2">
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                disabled={!isOnline || isProcessing}
                className="bg-slate-800/50 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl px-3 py-2 flex-1 focus:ring-2 focus:ring-amber-500 outline-none appearance-none"
              >
                <option value={30}>30 Giây</option>
                <option value={60}>1 Phút</option>
                <option value={120}>2 Phút</option>
                <option value={300}>5 Phút</option>
              </select>
              <button
                onClick={handleForceOn}
                disabled={!isOnline || isProcessing}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-amber-500 hover:text-white hover:shadow-[0_0_15px_rgba(245,158,11,0.5)] transition-all"
              >
                <Zap size={14} className={isProcessing ? "animate-pulse" : ""} /> FORCE
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

// --- Bảng Điều Khiển Chính ---
const ControlPanel = () => {
  const { deviceId, sensorData, deviceStatus, isLoading, updatePumpStatusOptimistically } = useDeviceContext();
  const { isProcessing, resetFault } = useDeviceControl(deviceId || "");

  if (isLoading || !sensorData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
      </div>
    );
  }

  const isOnline = deviceStatus?.is_online || false;
  // Chặn bóng ma dữ liệu cũ
  const pumps: PumpStatus = isOnline ? (sensorData.pump_status || {}) : {};

  return (
    <div className="p-4 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-32 relative min-h-screen">

      {/* 🟢 Hiệu ứng nền Mesh Gradient */}
      <div className="absolute top-0 right-0 w-[80%] h-64 bg-gradient-to-bl from-indigo-500/10 via-transparent to-transparent pointer-events-none blur-3xl"></div>

      {/* Header */}
      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-1">
          <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-indigo-400 tracking-tight flex items-center gap-3">
            ĐIỀU KHIỂN
            <Settings2 size={28} className="text-indigo-400" />
          </h1>
          <p className="text-sm text-slate-400 font-medium">Bảng can thiệp thủ công Override</p>
        </div>

        {/* Nút Khôi Phục Lỗi (Báo động đỏ) */}
        <button
          disabled={!isOnline || isProcessing}
          onClick={async () => {
            if (window.confirm("CẢNH BÁO: Reset lỗi sẽ khởi động lại toàn bộ chu trình FSM. Xác nhận?")) await resetFault();
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-rose-500/10 text-rose-500 border border-rose-500/30 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-500 hover:text-white hover:shadow-[0_0_15px_rgba(244,63,94,0.5)] transition-all disabled:opacity-50 disabled:hover:bg-rose-500/10 disabled:hover:text-rose-500 disabled:hover:shadow-none"
        >
          <RefreshCw size={14} className={isProcessing ? "animate-spin" : ""} />
          Reset Lỗi
        </button>
      </div>

      {!isOnline && (
        <div className="bg-rose-500/10 backdrop-blur-md border border-rose-500/30 rounded-2xl p-4 flex items-center gap-3 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.15)] relative z-10 animate-in zoom-in">
          <AlertTriangle size={24} className="animate-pulse" />
          <div>
            <h4 className="font-bold text-sm uppercase tracking-wider">Mất kết nối trạm</h4>
            <p className="text-xs text-rose-400/80">Không thể gửi lệnh điều khiển lúc này.</p>
          </div>
        </div>
      )}

      {/* Khu Vực Dinh Dưỡng */}
      <div className="space-y-4 relative z-10">
        <h2 className="text-[10px] uppercase tracking-widest font-black text-slate-500 pl-3 flex items-center gap-2">
          <FlaskConical size={14} className="text-orange-500" /> Khu Vực Châm Phân & pH
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <AdvancedDeviceControl deviceId={deviceId} pumpId="PUMP_A" title="Bơm Phân A" icon={FlaskConical} colorTheme="orange" currentStatus={pumps.pump_a} allowPwm={true} updatePumpStatusOptimistically={updatePumpStatusOptimistically} isOnline={isOnline} />
          <AdvancedDeviceControl deviceId={deviceId} pumpId="PUMP_B" title="Bơm Phân B" icon={FlaskConical} colorTheme="orange" currentStatus={pumps.pump_b} allowPwm={true} updatePumpStatusOptimistically={updatePumpStatusOptimistically} isOnline={isOnline} />
          <AdvancedDeviceControl deviceId={deviceId} pumpId="PH_UP" title="Bơm Tăng pH" icon={Activity} colorTheme="purple" currentStatus={pumps.ph_up} allowPwm={true} updatePumpStatusOptimistically={updatePumpStatusOptimistically} isOnline={isOnline} />
          <AdvancedDeviceControl deviceId={deviceId} pumpId="PH_DOWN" title="Bơm Giảm pH" icon={Activity} colorTheme="purple" currentStatus={pumps.ph_down} allowPwm={true} updatePumpStatusOptimistically={updatePumpStatusOptimistically} isOnline={isOnline} />
        </div>
      </div>

      {/* Khu Vực Bơm Nước & Khí Hậu */}
      <div className="space-y-4 pt-4 relative z-10">
        <h2 className="text-[10px] uppercase tracking-widest font-black text-slate-500 pl-3 flex items-center gap-2">
          <Waves size={14} className="text-cyan-500" /> Bơm Nước & Sục Trộn
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <AdvancedDeviceControl deviceId={deviceId} pumpId="WATER_PUMP_IN" title="Cấp Nước" icon={Droplets} colorTheme="blue" currentStatus={pumps.water_pump_in} allowPwm={false} updatePumpStatusOptimistically={updatePumpStatusOptimistically} isOnline={isOnline} />
          <AdvancedDeviceControl deviceId={deviceId} pumpId="WATER_PUMP_OUT" title="Xả Nước" icon={Droplets} colorTheme="cyan" currentStatus={pumps.water_pump_out} allowPwm={false} updatePumpStatusOptimistically={updatePumpStatusOptimistically} isOnline={isOnline} />
          <AdvancedDeviceControl deviceId={deviceId} pumpId="OSAKA" title="Trộn Osaka" icon={Power} colorTheme="indigo" currentStatus={pumps.osaka_pump} allowPwm={true} updatePumpStatusOptimistically={updatePumpStatusOptimistically} isOnline={isOnline} />
          <AdvancedDeviceControl deviceId={deviceId} pumpId="MIST" title="Phun Sương" icon={Wind} colorTheme="sky" currentStatus={pumps.mist_valve} allowPwm={false} updatePumpStatusOptimistically={updatePumpStatusOptimistically} isOnline={isOnline} />
        </div>
      </div>

    </div>
  );
};

export default ControlPanel;
