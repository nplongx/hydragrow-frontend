// src/pages/ControlPanel.tsx
import { useState } from 'react';
import { FlaskConical, Droplets, Waves, AlertTriangle, Power, RotateCcw, Activity } from 'lucide-react';
import { useDeviceSensor } from '../hooks/useDeviceSensor';
import { useDeviceControl } from '../hooks/useDeviceControl';

const DEVICE_ID = "device_001"; // Hardcode tạm cho demo

const ControlPanel = () => {
  const { sensorData, deviceStatus, isLoading, updatePumpStatusOptimistically } = useDeviceSensor(DEVICE_ID);
  const { isProcessing, error, togglePump, setPumpPwm } = useDeviceControl(DEVICE_ID);

  // Local state quản lý giá trị PWM
  const [pwmValues, setPwmValues] = useState<Record<string, number>>({
    OSAKA_PUMP: 100,
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

  // 🟢 ESP32 trả về dữ liệu kiểu boolean (true/false)
  const isOsakaOn = pumps.osaka_pump === true;

  // Nút gạt Switch
  const Switch = ({ isOn, disabled }: { isOn: boolean; disabled: boolean }) => (
    <div className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none shadow-inner ${isOn ? 'bg-emerald-500' : 'bg-slate-700'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
      <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out ${isOn ? 'translate-x-5' : 'translate-x-0'}`} />
    </div>
  );

  // 🟢 Hàm xử lý On/Off thiết bị
  const handleToggle = async (pumpId: string, sensorKey: keyof typeof pumps, isDosingPump: boolean = false, currentPwm?: number) => {
    const isOn = pumps[sensorKey] === true;
    const targetAction = isOn ? 'off' : 'on';

    if (isDosingPump && !isOn && !isOsakaOn) {
      alert("⚠️ CẢNH BÁO AN TOÀN:\nVui lòng bật 'Bơm Sục Khí / Trộn (Osaka)' trước khi châm dinh dưỡng hoặc pH!");
      return;
    }

    // Tối ưu UI: Cập nhật ngay lập tức trước khi gọi API
    updatePumpStatusOptimistically(sensorKey, !isOn ? 'on' : 'off');

    const pwmToSend = targetAction === 'on' ? currentPwm : undefined;
    const success = await togglePump(pumpId, targetAction, pwmToSend);

    // Nếu gọi API thất bại, đảo ngược trạng thái UI về như cũ
    if (!success) {
      updatePumpStatusOptimistically(sensorKey, isOn ? 'on' : 'off');
    }
  };

  // Kéo thanh trượt PWM
  const handlePwmCommit = async (pumpId: string, val: number) => {
    if (!isOnline) return;
    if (setPumpPwm) {
      await setPumpPwm(pumpId, val);
    } else {
      console.warn("Chưa triển khai setPumpPwm trong useDeviceControl!");
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

  // Component Thẻ thiết bị (Bento Card)
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
      onToggle(supportsPwm ? currentPwm : undefined);
    };

    return (
      <div
        onClick={handleClick}
        className={`relative overflow-hidden bg-slate-900/80 backdrop-blur-sm border-2 rounded-3xl p-4 flex flex-col transition-all duration-300 cursor-pointer
          ${isOn ? `border-${borderClass} shadow-[0_0_15px_rgba(0,0,0,0.2)] shadow-${borderClass}/20` : 'border-slate-800 hover:border-slate-700'}
          ${isLocked ? 'opacity-60 grayscale-[0.3]' : 'active:scale-[0.98]'}
        `}
      >
        <div className="flex items-center justify-between z-10 w-full">
          <div className="flex items-center space-x-4 overflow-hidden">
            <div className={`p-2.5 rounded-2xl shrink-0 transition-colors duration-300 ${isOn ? `bg-${borderClass}/10 ${colorClass}` : 'bg-slate-800 text-slate-500'}`}>
              <Icon size={24} />
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center space-x-2">
                <span className={`font-semibold truncate transition-colors duration-300 ${isOn ? 'text-white' : 'text-slate-300'}`}>
                  {title} {supportsPwm && isOn && <span className={`text-xs ml-1 ${colorClass}`}>{currentPwm}%</span>}
                </span>
                {isOn && !supportsPwm && (
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
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
              type="range"
              min="0"
              max="100"
              value={currentPwm}
              onChange={(e) => setPwmValues(prev => ({ ...prev, [pumpId]: parseInt(e.target.value) }))}
              onMouseUp={() => handlePwmCommit(pumpId, currentPwm)}
              onTouchEnd={() => handlePwmCommit(pumpId, currentPwm)}
              className={`w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-${borderClass}`}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-1">Bảng Điều Khiển</h1>
          <p className="text-sm text-slate-400">Quản lý thiết bị Thủy canh.</p>
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

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-4 flex items-start space-x-3 shadow-lg shadow-red-500/5 mt-4">
          <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="text-sm font-semibold text-red-400">Lỗi thao tác</h4>
            <p className="text-sm text-red-300/80 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* ── Nhóm 2: Tuần hoàn & Cấp Xả ── */}
      <section className="space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-2">Hệ Thống Chính</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ControlCard
            pumpId="OSAKA_PUMP" title="Bơm Jet Mixing (Osaka)" icon={Waves} colorClass="text-cyan-400" borderClass="cyan-500"
            isOn={pumps.osaka_pump === true}
            onToggle={(pwm) => handleToggle('OSAKA_PUMP', 'osaka_pump', false, pwm)}
            supportsPwm={true}
          />
          <ControlCard
            pumpId="CIRCULATION_PUMP" title="Bơm Tuần Hoàn (Tuya 220V)" icon={Activity} colorClass="text-blue-400" borderClass="blue-500"
            isOn={false} // Chức năng này sẽ cần đọc từ Tuya API nếu muốn đồng bộ state (có thể tạm để false hoặc mock data)
            onToggle={() => handleToggle('CIRCULATION_PUMP', 'osaka_pump' /* Mock key */)}
            supportsPwm={false}
          />
          <ControlCard
            pumpId="WATER_PUMP" title="Bơm Cấp Nước In" icon={Power} colorClass="text-emerald-400" borderClass="emerald-500"
            isOn={pumps.water_pump_in === true}
            onToggle={() => handleToggle('WATER_PUMP', 'water_pump_in')}
          />
          <ControlCard
            pumpId="DRAIN_PUMP" title="Bơm Xả Nước Out" icon={Waves} colorClass="text-red-400" borderClass="red-500"
            isOn={pumps.water_pump_out === true}
            onToggle={() => handleToggle('DRAIN_PUMP', 'water_pump_out')}
          />
        </div>
      </section>

      {/* ── Nhóm 1: Bơm Dinh Dưỡng & pH ── */}
      <section className="space-y-3 mt-8">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-2">Châm Dinh Dưỡng (Dosing)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ControlCard
            pumpId="A" title="Bơm Dinh Dưỡng A" icon={FlaskConical} colorClass="text-fuchsia-400" borderClass="fuchsia-500"
            isOn={pumps.pump_a === true}
            onToggle={(pwm) => handleToggle('A', 'pump_a', true, pwm)}
            lockedMessage={!isOsakaOn ? "Yêu cầu bật Bơm Jet Mixing" : undefined}
            supportsPwm={true}
          />
          <ControlCard
            pumpId="B" title="Bơm Dinh Dưỡng B" icon={FlaskConical} colorClass="text-purple-400" borderClass="purple-500"
            isOn={pumps.pump_b === true}
            onToggle={(pwm) => handleToggle('B', 'pump_b', true, pwm)}
            lockedMessage={!isOsakaOn ? "Yêu cầu bật Bơm Jet Mixing" : undefined}
            supportsPwm={true}
          />
          <ControlCard
            pumpId="PH_UP" title="pH UP (+)" icon={Droplets} colorClass="text-orange-400" borderClass="orange-500"
            isOn={pumps.ph_up === true}
            onToggle={(pwm) => handleToggle('PH_UP', 'ph_up', true, pwm)}
            lockedMessage={!isOsakaOn ? "Yêu cầu bật Bơm Jet Mixing" : undefined}
            supportsPwm={true}
          />
          <ControlCard
            pumpId="PH_DOWN" title="pH DOWN (-)" icon={Droplets} colorClass="text-pink-500" borderClass="pink-500"
            isOn={pumps.ph_down === true}
            onToggle={(pwm) => handleToggle('PH_DOWN', 'ph_down', true, pwm)}
            lockedMessage={!isOsakaOn ? "Yêu cầu bật Bơm Jet Mixing" : undefined}
            supportsPwm={true}
          />
        </div>
      </section>
    </div>
  );
};

export default ControlPanel;
