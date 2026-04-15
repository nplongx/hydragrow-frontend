import React, { useState } from 'react';
import {
  Settings2, FlaskConical, Droplets, Wind, Power, AlertTriangle, Timer, Activity,
  RefreshCw
} from 'lucide-react';
import { useDeviceContext } from '../context/DeviceContext';
import { useDeviceControl } from '../hooks/useDeviceControl';

// --- Component Nút Bấm Chuyên Sâu ---
const AdvancedDeviceControl = ({
  deviceId,
  pumpId,
  title,
  icon: Icon,
  color,
  currentStatus,
  allowPwm = false,
  updatePumpStatusOptimistically,
  isOnline
}: any) => {
  const { togglePump, setPwm, forceOn } = useDeviceControl(deviceId);
  const [pwmValue, setPwmValue] = useState(100);
  const [duration, setDuration] = useState(120); // Mặc định 120s cho lệnh hẹn giờ
  const [isProcessing, setIsProcessing] = useState(false);

  // Lệnh Bật/Tắt Cơ Bản
  const handleToggle = async () => {
    setIsProcessing(true);
    const targetAction = currentStatus ? 'off' : 'on';
    updatePumpStatusOptimistically(pumpId, targetAction);
    const success = await togglePump(pumpId, targetAction);
    if (!success) updatePumpStatusOptimistically(pumpId, currentStatus ? 'on' : 'off');
    setIsProcessing(false);
  };

  // Lệnh Cưỡng Chế (Force On) với Hẹn Giờ
  const handleForceOn = async () => {
    if (!window.confirm(`⚠️ CẢNH BÁO: Bạn đang dùng lệnh Cưỡng Chế (Force On) bỏ qua an toàn hệ thống cho ${title} trong ${duration} giây. Bạn có chắc chắn?`)) return;
    setIsProcessing(true);
    updatePumpStatusOptimistically(pumpId, 'on');
    const success = await forceOn(pumpId, duration);
    if (!success) updatePumpStatusOptimistically(pumpId, 'off'); // Revert nếu lỗi
    setIsProcessing(false);
  };

  // Lệnh SET PWM
  const handleSetPwm = async () => {
    setIsProcessing(true);
    // Nếu thiết bị đang tắt, gửi lệnh Set PWM cũng sẽ bật thiết bị lên ở mức PWM đó
    if (!currentStatus) updatePumpStatusOptimistically(pumpId, 'on');
    await setPwm(pumpId, pwmValue);
    setIsProcessing(false);
  };

  return (
    <div className={`bg-slate-900 border ${currentStatus ? `border-${color}-500 shadow-[0_0_15px_rgba(var(--tw-colors-${color}-500),0.2)]` : 'border-slate-800'} rounded-2xl p-4 transition-all duration-300`}>
      {/* Tiêu đề & Trạng thái */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-2.5 rounded-xl ${currentStatus ? `bg-${color}-500 text-white` : 'bg-slate-800 text-slate-400'}`}>
            <Icon size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-200">{title}</h3>
            <p className="text-xs text-slate-500">{pumpId}</p>
          </div>
        </div>
        <button
          disabled={!isOnline || isProcessing}
          onClick={handleToggle}
          className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors ${currentStatus
            ? 'bg-rose-500/20 text-rose-500 hover:bg-rose-500/30'
            : 'bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30'
            } disabled:opacity-50`}
        >
          {currentStatus ? 'TẮT' : 'BẬT'}
        </button>
      </div>

      {/* Khu vực Điều khiển Nâng cao */}
      <div className="space-y-4 pt-4 border-t border-slate-800/50">

        {/* Thanh trượt PWM (Chỉ hiện nếu thiết bị hỗ trợ) */}
        {allowPwm && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span className="flex items-center gap-1"><Activity size={12} /> Công suất (PWM)</span>
              <span>{pwmValue}%</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range" min="10" max="100" step="10"
                value={pwmValue}
                onChange={(e) => setPwmValue(parseInt(e.target.value))}
                disabled={!isOnline || isProcessing}
                className="flex-1 accent-emerald-500"
              />
              <button
                onClick={handleSetPwm}
                disabled={!isOnline || isProcessing}
                className="px-3 py-1 bg-slate-800 text-emerald-400 text-xs font-bold rounded-lg border border-slate-700 hover:bg-slate-700"
              >
                Gửi
              </button>
            </div>
          </div>
        )}

        {/* Cưỡng Chế / Hẹn Giờ */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="flex items-center gap-1"><Timer size={12} /> Bật có Thời gian / Cưỡng chế</span>
            <span>{duration}s</span>
          </div>
          <div className="flex gap-2">
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              disabled={!isOnline || isProcessing}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 flex-1"
            >
              <option value={30}>30 Giây</option>
              <option value={60}>1 Phút</option>
              <option value={120}>2 Phút</option>
              <option value={300}>5 Phút</option>
            </select>
            <button
              onClick={handleForceOn}
              disabled={!isOnline || isProcessing}
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded-lg text-xs font-bold hover:bg-amber-500/20"
            >
              <AlertTriangle size={12} /> Force On
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

// --- Main Control Panel Component ---
const ControlPanel = () => {
  const { deviceId, sensorData, deviceStatus, isLoading, updatePumpStatusOptimistically } = useDeviceContext();

  const { isProcessing, resetFault } = useDeviceControl(deviceId || "");

  if (isLoading || !sensorData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const pumps = sensorData.pump_status || {};
  const isOnline = deviceStatus?.is_online || false;

  return (
    <div className="p-4 space-y-6 pb-24 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col space-y-1">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings2 size={24} className="text-emerald-500" />
            Bảng Điều Khiển
          </h1>
          <p className="text-sm text-slate-400">Can thiệp hệ thống thủ công</p>
        </div>

        {/* Nút Reset Lỗi Toàn Hệ Thống */}
        <button
          disabled={!isOnline || isProcessing}
          onClick={async () => {
            if (window.confirm("Bạn có chắc chắn muốn Reset các cảnh báo lỗi hiện tại và khởi động lại FSM không?")) {
              await resetFault();
            }
          }}
          className="flex items-center gap-2 px-3 py-2 bg-rose-500/10 text-rose-500 border border-rose-500/30 rounded-xl font-bold text-xs hover:bg-rose-500/20 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} />
          Reset Lỗi
        </button>
      </div>

      {!isOnline && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex items-center gap-3 text-rose-400">
          <AlertTriangle size={20} />
          <p className="text-sm">Thiết bị đang mất kết nối. Không thể gửi lệnh.</p>
        </div>
      )}

      {/* Khu Vực Dinh Dưỡng */}
      <div className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider font-bold text-slate-500 pl-2">Khu Vực Dinh Dưỡng</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AdvancedDeviceControl
            deviceId={deviceId} pumpId="PUMP_A" title="Bơm Phân A" icon={FlaskConical} color="orange"
            currentStatus={pumps.pump_a} allowPwm={true} updatePumpStatusOptimistically={updatePumpStatusOptimistically} isOnline={isOnline}
          />
          <AdvancedDeviceControl
            deviceId={deviceId} pumpId="PUMP_B" title="Bơm Phân B" icon={FlaskConical} color="orange"
            currentStatus={pumps.pump_b} allowPwm={true} updatePumpStatusOptimistically={updatePumpStatusOptimistically} isOnline={isOnline}
          />
          <AdvancedDeviceControl
            deviceId={deviceId} pumpId="PH_UP" title="Bơm pH Tăng" icon={Activity} color="purple"
            currentStatus={pumps.ph_up} allowPwm={true} updatePumpStatusOptimistically={updatePumpStatusOptimistically} isOnline={isOnline}
          />
          <AdvancedDeviceControl
            deviceId={deviceId} pumpId="PH_DOWN" title="Bơm pH Giảm" icon={Activity} color="purple"
            currentStatus={pumps.ph_down} allowPwm={true} updatePumpStatusOptimistically={updatePumpStatusOptimistically} isOnline={isOnline}
          />
        </div>
      </div>

      {/* Khu Vực Bơm Nước & Khí Hậu */}
      <div className="space-y-3 pt-4">
        <h2 className="text-xs uppercase tracking-wider font-bold text-slate-500 pl-2">Bơm Nước & Khí Hậu</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AdvancedDeviceControl
            deviceId={deviceId} pumpId="WATER_PUMP_IN" title="Bơm Cấp Nước" icon={Droplets} color="blue"
            currentStatus={pumps.water_pump_in} allowPwm={false} updatePumpStatusOptimistically={updatePumpStatusOptimistically} isOnline={isOnline}
          />
          <AdvancedDeviceControl
            deviceId={deviceId} pumpId="WATER_PUMP_OUT" title="Bơm Xả Nước" icon={Droplets} color="cyan"
            currentStatus={pumps.water_pump_out} allowPwm={false} updatePumpStatusOptimistically={updatePumpStatusOptimistically} isOnline={isOnline}
          />
          <AdvancedDeviceControl
            deviceId={deviceId} pumpId="OSAKA" title="Bơm Trộn Osaka" icon={Power} color="indigo"
            currentStatus={pumps.osaka_pump} allowPwm={true} updatePumpStatusOptimistically={updatePumpStatusOptimistically} isOnline={isOnline}
          />
          <AdvancedDeviceControl
            deviceId={deviceId} pumpId="MIST" title="Van Phun Sương" icon={Wind} color="sky"
            currentStatus={pumps.mist_valve} allowPwm={false} updatePumpStatusOptimistically={updatePumpStatusOptimistically} isOnline={isOnline}
          />
        </div>
      </div>

    </div>
  );
};

export default ControlPanel;
