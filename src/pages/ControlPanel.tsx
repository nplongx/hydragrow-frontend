// src/pages/ControlPanel.tsx
import React, { useState } from 'react';
import { FlaskConical, Droplets, Waves, AlertTriangle, Power, RotateCcw, CloudRain } from 'lucide-react';
import { useDeviceSensor } from '../hooks/useDeviceSensor';
import { useDeviceControl } from '../hooks/useDeviceControl';

const DEVICE_ID = "device_001"; // Hardcode cho demo

const ControlPanel = () => {
  const { sensorData, deviceStatus, isLoading, updatePumpStatusOptimistically } = useDeviceSensor(DEVICE_ID);
  const { isProcessing, togglePump, setPumpPwm } = useDeviceControl(DEVICE_ID);

  // Local state để quản lý giá trị PWM mượt mà trên UI trước khi commit qua API
  const [pwmValues, setPwmValues] = useState<Record<string, number>>({
    OSAKA_PUMP: 100,
    MIST_VALVE: 100,
    A: 50,
    B: 50,
    PH_UP: 50,
    PH_DOWN: 50
  });

  if (isLoading || !sensorData) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const pumps = sensorData.pump_status || {};
  const isOnline = deviceStatus?.is_online || false;
  const isOsakaOn = pumps.OSAKA_PUMP === 'on';

  const Switch = ({ isOn, disabled }: { isOn: boolean; disabled: boolean }) => (
    <div className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none shadow-inner ${isOn ? 'bg-emerald-500' : 'bg-slate-700'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
      <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out ${isOn ? 'translate-x-5' : 'translate-x-0'}`} />
    </div>
  );

  const handleToggle = async (pumpId: string, currentStatus: string | undefined, isDosingPump: boolean = false, currentPwm?: number) => {
    const isOn = currentStatus === 'on';
    const targetAction = isOn ? 'off' : 'on';

    if (isDosingPump && !isOn && !isOsakaOn) {
      alert("⚠️ CẢNH BÁO AN TOÀN:\nVui lòng bật 'Bơm Osaka (Tuần Hoàn)' trước khi châm dinh dưỡng hoặc pH!");
      return;
    }

    updatePumpStatusOptimistically(pumpId, targetAction);
    const pwmToSend = targetAction === 'on' ? (currentPwm || pwmValues[pumpId]) : undefined;
    const success = await togglePump(pumpId, targetAction, pwmToSend);

    if (!success) {
      updatePumpStatusOptimistically(pumpId, isOn ? 'on' : 'off');
    }
  };

  const handlePwmCommit = async (pumpId: string, val: number) => {
    if (!isOnline) return;
    if (setPumpPwm) {
      await setPumpPwm(pumpId, val);
    }
  };

  const handleResetFault = async () => {
    if (!isOnline) {
      alert("Thiết bị đang Offline. Không thể điều khiển!");
      return;
    }
    if (!window.confirm("Bạn có chắc chắn muốn gửi lệnh Reset Lỗi tới toàn bộ hệ thống?")) return;
    await togglePump("ALL", "reset_fault");
  };

  const ControlCard = ({
    title, icon: Icon, colorClass, borderClass, isOn, onToggle, lockedMessage,
    pumpId, supportsPwm = false
  }: {
    title: string; icon: any; colorClass: string; borderClass: string; isOn: boolean;
    onToggle: (currentPwm?: number) => void;
    lockedMessage?: string;
    pumpId: string; supportsPwm?: boolean;
  }) => {
    const isLocked = lockedMessage && !isOn;
    const currentPwm = pwmValues[pumpId] || 100;

    const handleClick = (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (!isOnline) {
        alert("Thiết bị đang Offline. Không thể điều khiển!");
        return;
      }
      if (isProcessing) return;
      onToggle(currentPwm);
    };

    return (
      <div
        onClick={handleClick}
        className={`relative overflow-hidden bg-slate-900/80 backdrop-blur-sm border-2 rounded-3xl p-4 flex flex-col transition-all duration-300 cursor-pointer
          ${isOn ? `border-${borderClass} shadow-[0_0_15px_rgba(0,0,0,0.1)]` : 'border-slate-800 hover:border-slate-700'}
          ${isLocked ? 'opacity-60 grayscale-[0.3]' : 'active:scale-[0.98]'}
        `}
      >
        <div className="flex items-center justify-between z-10 w-full">
          <div className="flex items-center space-x-4 overflow-hidden">
            <div className={`p-2.5 rounded-2xl shrink-0 transition-colors duration-300 ${isOn ? `bg-slate-800 ${colorClass}` : 'bg-slate-800 text-slate-500'}`}>
              <Icon size={24} />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center space-x-2">
                <span className={`font-semibold truncate ${isOn ? 'text-white' : 'text-slate-300'}`}>
                  {title} {supportsPwm && isOn && <span className={`text-xs ml-1 ${colorClass}`}>{currentPwm}%</span>}
                </span>
              </div>
              {isLocked && (
                <span className="text-[11px] font-medium text-orange-400 mt-0.5 flex items-center">
                  <AlertTriangle size={10} className="mr-1 shrink-0" /> <span className="truncate">{lockedMessage}</span>
                </span>
              )}
            </div>
          </div>
          <div className="z-10 shrink-0 ml-2">
            <Switch isOn={isOn} disabled={isProcessing || !isOnline} />
          </div>
        </div>

        {supportsPwm && (
          <div className={`transition-all duration-300 overflow-hidden ${isOn ? 'max-h-12 opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'}`}>
            <input
              type="range" min="0" max="100" value={currentPwm}
              onChange={(e) => setPwmValues(prev => ({ ...prev, [pumpId]: parseInt(e.target.value) }))}
              onMouseUp={() => handlePwmCommit(pumpId, currentPwm)}
              onTouchEnd={() => handlePwmCommit(pumpId, currentPwm)}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 space-y-6 pb-24 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-1">Bảng Điều Khiển</h1>
          <p className="text-sm text-slate-400">Quản lý thủ công và công suất trạm bơm.</p>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center space-x-2 ${isOnline ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
          <div className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-500'}`}></div>
          <span>{isOnline ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleResetFault}
          disabled={!isOnline || isProcessing}
          className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl border border-slate-700 transition-colors disabled:opacity-50"
        >
          <RotateCcw size={16} className={isProcessing ? "animate-spin" : ""} />
          <span>Khôi phục (Reset Fault)</span>
        </button>
      </div>

      <section className="space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-2">Hệ Thống Chính</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ControlCard pumpId="OSAKA_PUMP" title="Bơm Osaka (Tuần Hoàn)" icon={Waves} colorClass="text-cyan-400" borderClass="cyan-500" isOn={pumps.OSAKA_PUMP === 'on'} onToggle={(pwm) => handleToggle('OSAKA_PUMP', pumps.OSAKA_PUMP, false, pwm)} supportsPwm={true} />
          <ControlCard pumpId="MIST_VALVE" title="Van Phun Sương (Mist)" icon={CloudRain} colorClass="text-blue-400" borderClass="blue-500" isOn={pumps.MIST_VALVE === 'on'} onToggle={(pwm) => handleToggle('MIST_VALVE', pumps.MIST_VALVE, false, pwm)} supportsPwm={true} />
          <ControlCard pumpId="WATER_PUMP" title="Bơm Cấp Nước" icon={Power} colorClass="text-emerald-400" borderClass="emerald-500" isOn={pumps.WATER_PUMP === 'on'} onToggle={() => handleToggle('WATER_PUMP', pumps.WATER_PUMP)} />
          <ControlCard pumpId="DRAIN_PUMP" title="Bơm Xả Nước" icon={Waves} colorClass="text-red-400" borderClass="red-500" isOn={pumps.DRAIN_PUMP === 'on'} onToggle={() => handleToggle('DRAIN_PUMP', pumps.DRAIN_PUMP)} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-2">Châm Dinh Dưỡng (Dosing)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ControlCard pumpId="A" title="Bơm Dinh Dưỡng A" icon={FlaskConical} colorClass="text-fuchsia-400" borderClass="fuchsia-500" isOn={pumps.A === 'on'} onToggle={(pwm) => handleToggle('A', pumps.A, true, pwm)} lockedMessage={!isOsakaOn ? "Yêu cầu bật Bơm Osaka" : undefined} supportsPwm={true} />
          <ControlCard pumpId="B" title="Bơm Dinh Dưỡng B" icon={FlaskConical} colorClass="text-purple-400" borderClass="purple-500" isOn={pumps.B === 'on'} onToggle={(pwm) => handleToggle('B', pumps.B, true, pwm)} lockedMessage={!isOsakaOn ? "Yêu cầu bật Bơm Osaka" : undefined} supportsPwm={true} />
          <ControlCard pumpId="PH_UP" title="pH UP (+)" icon={Droplets} colorClass="text-orange-400" borderClass="orange-500" isOn={pumps.PH_UP === 'on'} onToggle={(pwm) => handleToggle('PH_UP', pumps.PH_UP, true, pwm)} lockedMessage={!isOsakaOn ? "Khóa an toàn: Cần bật Bơm Osaka" : undefined} supportsPwm={true} />
          <ControlCard pumpId="PH_DOWN" title="pH DOWN (-)" icon={Droplets} colorClass="text-pink-500" borderClass="pink-500" isOn={pumps.PH_DOWN === 'on'} onToggle={(pwm) => handleToggle('PH_DOWN', pumps.PH_DOWN, true, pwm)} lockedMessage={!isOsakaOn ? "Khóa an toàn: Cần bật Bơm Osaka" : undefined} supportsPwm={true} />
        </div>
      </section>
    </div>
  );
};

export default ControlPanel;
