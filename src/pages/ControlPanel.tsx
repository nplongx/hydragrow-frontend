import React, { useState, useMemo } from 'react';
import { FlaskConical, Droplets, Waves, AlertTriangle, Power, RotateCcw, CloudRain, Calculator, X } from 'lucide-react';
import { useDeviceSensor } from '../hooks/useDeviceSensor';
import { useDeviceControl } from '../hooks/useDeviceControl';

const DEVICE_ID = "device_001"; // Hardcode cho demo

// --- HẰNG SỐ CÔNG THỨC (Đồng bộ với ESP32 Default Config) ---
const CONSTANTS = {
  EC_GAIN_PER_ML: 0.015,         // 1ml tăng được 0.015 EC cho 100 Lít
  PH_UP_PER_ML: 0.02,            // 1ml tăng được 0.02 pH cho 100 Lít
  PH_DOWN_PER_ML: 0.025,         // 1ml giảm được 0.025 pH cho 100 Lít
  PUMP_CAPACITY_ML_SEC: 1.0,     // Công suất 1.0 ml/s ở 100% PWM
  DEFAULT_DOSING_PWM: 50,        // Mặc định chạy 50% công suất
};
const ACTIVE_PUMP_CAPACITY = CONSTANTS.PUMP_CAPACITY_ML_SEC * (CONSTANTS.DEFAULT_DOSING_PWM / 100.0);

const ControlPanel = () => {
  const { sensorData, deviceStatus, isLoading, updatePumpStatusOptimistically } = useDeviceSensor(DEVICE_ID);
  const { isProcessing, togglePump, setPumpPwm } = useDeviceControl(DEVICE_ID);

  // --- STATE QUẢN LÝ PWM ---
  const [pwmValues, setPwmValues] = useState<Record<string, number>>({
    OSAKA_PUMP: 100, MIST_VALVE: 100, A: 50, B: 50, PH_UP: 50, PH_DOWN: 50
  });

  // --- STATE SMART DOSING (BÁN TỰ ĐỘNG) ---
  const [showSmartModal, setShowSmartModal] = useState(false);
  const [tankVolume, setTankVolume] = useState<number>(100);
  const [manualEC, setManualEC] = useState({ current: 1.0, target: 1.0 });
  const [manualPH, setManualPH] = useState({ current: 6.0, target: 6.0 });

  // Tính toán liều lượng Real-time
  const doseCalc = useMemo(() => {
    let ec_ml = 0, ph_up_ml = 0, ph_down_ml = 0;

    // Tính EC (Chỉ châm thêm, không có rút bớt)
    const ecDiff = manualEC.target - manualEC.current;
    if (ecDiff > 0) {
      ec_ml = (ecDiff / CONSTANTS.EC_GAIN_PER_ML) * (tankVolume / 100);
    }

    // Tính pH
    const phDiff = manualPH.target - manualPH.current;
    if (phDiff > 0) {
      ph_up_ml = (phDiff / CONSTANTS.PH_UP_PER_ML) * (tankVolume / 100);
    } else if (phDiff < 0) {
      ph_down_ml = (Math.abs(phDiff) / CONSTANTS.PH_DOWN_PER_ML) * (tankVolume / 100);
    }

    return {
      ec_ml,
      ec_sec: Math.round(ec_ml / ACTIVE_PUMP_CAPACITY),
      ph_up_ml,
      ph_up_sec: Math.round(ph_up_ml / ACTIVE_PUMP_CAPACITY),
      ph_down_ml,
      ph_down_sec: Math.round(ph_down_ml / ACTIVE_PUMP_CAPACITY),
      hasWarning: ec_ml > 100 || ph_up_ml > 100 || ph_down_ml > 100
    };
  }, [tankVolume, manualEC, manualPH]);

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

  // --- HANDLERS ---
  const handleToggle = async (pumpId: string, currentStatus: string | undefined, isDosingPump: boolean = false, currentPwm?: number) => {
    const isOn = currentStatus === 'on';
    const targetAction = isOn ? 'off' : 'on';

    if (isDosingPump && !isOn && !isOsakaOn) {
      alert("⚠️ CẢNH BÁO AN TOÀN:\nVui lòng bật 'Bơm Osaka (Tuần Hoàn)' trước khi châm dinh dưỡng hoặc pH!");
      return;
    }

    updatePumpStatusOptimistically(pumpId, targetAction);
    const pwmToSend = targetAction === 'on' ? (currentPwm || pwmValues[pumpId]) : undefined;
    const success = await togglePump(pumpId, targetAction, pwmToSend); // Nếu đang BẬT thủ công, nó chạy vô tận (không gửi duration)

    if (!success) {
      updatePumpStatusOptimistically(pumpId, isOn ? 'on' : 'off');
    }
  };

  const handlePwmCommit = async (pumpId: string, val: number) => {
    if (!isOnline) return;
    if (setPumpPwm) await setPumpPwm(pumpId, val);
  };

  const handleResetFault = async () => {
    if (!isOnline) return alert("Thiết bị đang Offline. Không thể điều khiển!");
    if (!window.confirm("Bạn có chắc chắn muốn gửi lệnh Reset Lỗi tới toàn bộ hệ thống?")) return;
    await togglePump("ALL", "reset_fault");
  };

  // 🟢 THỰC THI SMART DOSING
  const executeSmartDosing = async () => {
    if (!isOnline) return alert("Thiết bị Offline!");
    if (!isOsakaOn) return alert("⚠️ Vui lòng ra ngoài bật Bơm Osaka (Trộn) trước khi chạy Smart Dosing!");

    const actions = [];
    if (doseCalc.ec_sec > 0) actions.push(`Bơm A & B: ${doseCalc.ec_ml.toFixed(1)}mL (${doseCalc.ec_sec} giây)`);
    if (doseCalc.ph_up_sec > 0) actions.push(`Bơm pH UP: ${doseCalc.ph_up_ml.toFixed(1)}mL (${doseCalc.ph_up_sec} giây)`);
    if (doseCalc.ph_down_sec > 0) actions.push(`Bơm pH DOWN: ${doseCalc.ph_down_ml.toFixed(1)}mL (${doseCalc.ph_down_sec} giây)`);

    if (actions.length === 0) return alert("Thông số đã đạt chuẩn, không cần bơm thêm gì cả.");

    const confirmMsg = `Hệ thống sẽ thực thi các lệnh sau với PWM 50%:\n\n${actions.join("\n")}\n\nBạn có chắc chắn muốn thực thi mù (Blind Dosing)?`;
    if (!window.confirm(confirmMsg)) return;

    setShowSmartModal(false);

    // Gửi lệnh song song với duration_sec. ESP32 sẽ tự động đếm ngược và tắt!
    if (doseCalc.ec_sec > 0) {
      await togglePump("A", "on", CONSTANTS.DEFAULT_DOSING_PWM, doseCalc.ec_sec);
      await togglePump("B", "on", CONSTANTS.DEFAULT_DOSING_PWM, doseCalc.ec_sec);
    }
    if (doseCalc.ph_up_sec > 0) {
      await togglePump("PH_UP", "on", CONSTANTS.DEFAULT_DOSING_PWM, doseCalc.ph_up_sec);
    }
    if (doseCalc.ph_down_sec > 0) {
      await togglePump("PH_DOWN", "on", CONSTANTS.DEFAULT_DOSING_PWM, doseCalc.ph_down_sec);
    }
    alert("🚀 Đã gửi lệnh Smart Dosing thành công! Bơm sẽ tự tắt sau khi hoàn thành.");
  };


  // --- UI COMPONENTS ---
  const Switch = ({ isOn, disabled }: { isOn: boolean; disabled: boolean }) => (
    <div className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out shadow-inner ${isOn ? 'bg-emerald-500' : 'bg-slate-700'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
      <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out ${isOn ? 'translate-x-5' : 'translate-x-0'}`} />
    </div>
  );

  const ControlCard = ({ title, icon: Icon, colorClass, borderClass, isOn, onToggle, lockedMessage, pumpId, supportsPwm = false }: any) => {
    const isLocked = lockedMessage && !isOn;
    const currentPwm = pwmValues[pumpId] || 100;

    const handleClick = (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (!isOnline) return alert("Thiết bị đang Offline!");
      if (isProcessing) return;
      onToggle(currentPwm);
    };

    return (
      <div onClick={handleClick} className={`relative overflow-hidden bg-slate-900/80 backdrop-blur-sm border-2 rounded-3xl p-4 flex flex-col transition-all duration-300 cursor-pointer ${isOn ? `border-${borderClass} shadow-[0_0_15px_rgba(0,0,0,0.1)]` : 'border-slate-800 hover:border-slate-700'} ${isLocked ? 'opacity-60 grayscale-[0.3]' : 'active:scale-[0.98]'}`}>
        <div className="flex items-center justify-between z-10 w-full">
          <div className="flex items-center space-x-4 overflow-hidden">
            <div className={`p-2.5 rounded-2xl shrink-0 transition-colors duration-300 ${isOn ? `bg-slate-800 ${colorClass}` : 'bg-slate-800 text-slate-500'}`}>
              <Icon size={24} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className={`font-semibold truncate ${isOn ? 'text-white' : 'text-slate-300'}`}>
                {title} {supportsPwm && isOn && <span className={`text-xs ml-1 ${colorClass}`}>{currentPwm}%</span>}
              </span>
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
            <input type="range" min="0" max="100" value={currentPwm} onChange={(e) => setPwmValues(prev => ({ ...prev, [pumpId]: parseInt(e.target.value) }))} onMouseUp={() => handlePwmCommit(pumpId, currentPwm)} onTouchEnd={() => handlePwmCommit(pumpId, currentPwm)} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 space-y-6 pb-24 max-w-5xl mx-auto relative">
      {/* Header */}
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

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3">
        <button onClick={() => setShowSmartModal(true)} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-indigo-500/20">
          <Calculator size={16} />
          <span>Smart Dosing</span>
        </button>
        <button onClick={handleResetFault} disabled={!isOnline || isProcessing} className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl border border-slate-700 transition-colors disabled:opacity-50">
          <RotateCcw size={16} className={isProcessing ? "animate-spin" : ""} />
          <span>Reset Lỗi</span>
        </button>
      </div>

      {/* Main Sections */}
      <section className="space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-2">Hệ Thống Chính</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ControlCard pumpId="OSAKA_PUMP" title="Bơm Osaka (Tuần Hoàn)" icon={Waves} colorClass="text-cyan-400" borderClass="cyan-500" isOn={pumps.OSAKA_PUMP === 'on'} onToggle={(pwm: number) => handleToggle('OSAKA_PUMP', pumps.OSAKA_PUMP, false, pwm)} supportsPwm={true} />
          <ControlCard pumpId="MIST_VALVE" title="Van Phun Sương (Mist)" icon={CloudRain} colorClass="text-blue-400" borderClass="blue-500" isOn={pumps.MIST_VALVE === 'on'} onToggle={(pwm: number) => handleToggle('MIST_VALVE', pumps.MIST_VALVE, false, pwm)} supportsPwm={true} />
          <ControlCard pumpId="WATER_PUMP" title="Bơm Cấp Nước" icon={Power} colorClass="text-emerald-400" borderClass="emerald-500" isOn={pumps.WATER_PUMP === 'on'} onToggle={() => handleToggle('WATER_PUMP', pumps.WATER_PUMP)} />
          <ControlCard pumpId="DRAIN_PUMP" title="Bơm Xả Nước" icon={Waves} colorClass="text-red-400" borderClass="red-500" isOn={pumps.DRAIN_PUMP === 'on'} onToggle={() => handleToggle('DRAIN_PUMP', pumps.DRAIN_PUMP)} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-2">Châm Dinh Dưỡng (Dosing)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ControlCard pumpId="A" title="Bơm Dinh Dưỡng A" icon={FlaskConical} colorClass="text-fuchsia-400" borderClass="fuchsia-500" isOn={pumps.A === 'on'} onToggle={(pwm: number) => handleToggle('A', pumps.A, true, pwm)} lockedMessage={!isOsakaOn ? "Yêu cầu bật Bơm Osaka" : undefined} supportsPwm={true} />
          <ControlCard pumpId="B" title="Bơm Dinh Dưỡng B" icon={FlaskConical} colorClass="text-purple-400" borderClass="purple-500" isOn={pumps.B === 'on'} onToggle={(pwm: number) => handleToggle('B', pumps.B, true, pwm)} lockedMessage={!isOsakaOn ? "Yêu cầu bật Bơm Osaka" : undefined} supportsPwm={true} />
          <ControlCard pumpId="PH_UP" title="pH UP (+)" icon={Droplets} colorClass="text-orange-400" borderClass="orange-500" isOn={pumps.PH_UP === 'on'} onToggle={(pwm: number) => handleToggle('PH_UP', pumps.PH_UP, true, pwm)} lockedMessage={!isOsakaOn ? "Khóa an toàn: Cần bật Bơm Osaka" : undefined} supportsPwm={true} />
          <ControlCard pumpId="PH_DOWN" title="pH DOWN (-)" icon={Droplets} colorClass="text-pink-500" borderClass="pink-500" isOn={pumps.PH_DOWN === 'on'} onToggle={(pwm: number) => handleToggle('PH_DOWN', pumps.PH_DOWN, true, pwm)} lockedMessage={!isOsakaOn ? "Khóa an toàn: Cần bật Bơm Osaka" : undefined} supportsPwm={true} />
        </div>
      </section>

      {/* 🟢 MODAL: SMART DOSING */}
      {showSmartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-800/50">
              <h2 className="text-lg font-bold text-white flex items-center">
                <Calculator className="mr-2 text-indigo-400" size={20} />
                Smart Dosing (Bán tự động)
              </h2>
              <button onClick={() => setShowSmartModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Thể tích */}
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Thể tích bồn hiện tại (Lít)</label>
                <input type="number" value={tankVolume} onChange={e => setTankVolume(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>

              {/* EC */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">EC Đo Thực Tế</label>
                  <input type="number" step="0.1" value={manualEC.current} onChange={e => setManualEC({ ...manualEC, current: Number(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-fuchsia-400 font-bold outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">EC Mục Tiêu</label>
                  <input type="number" step="0.1" value={manualEC.target} onChange={e => setManualEC({ ...manualEC, target: Number(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-fuchsia-400 font-bold outline-none" />
                </div>
                {doseCalc.ec_ml > 0 && (
                  <div className="col-span-2 text-sm text-slate-300 mt-1">
                    Cần châm: <span className="font-bold text-white">{doseCalc.ec_ml.toFixed(1)} mL</span> Phân A & B <br />
                    Thời gian chạy: <span className="font-bold text-white">{doseCalc.ec_sec} giây</span> (PWM 50%)
                  </div>
                )}
              </div>

              {/* pH */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">pH Đo Thực Tế</label>
                  <input type="number" step="0.1" value={manualPH.current} onChange={e => setManualPH({ ...manualPH, current: Number(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-orange-400 font-bold outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">pH Mục Tiêu</label>
                  <input type="number" step="0.1" value={manualPH.target} onChange={e => setManualPH({ ...manualPH, target: Number(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-orange-400 font-bold outline-none" />
                </div>
                {doseCalc.ph_up_ml > 0 && (
                  <div className="col-span-2 text-sm text-slate-300 mt-1">
                    Cần châm: <span className="font-bold text-white">{doseCalc.ph_up_ml.toFixed(1)} mL</span> pH UP (+)<br />
                    Thời gian chạy: <span className="font-bold text-white">{doseCalc.ph_up_sec} giây</span> (PWM 50%)
                  </div>
                )}
                {doseCalc.ph_down_ml > 0 && (
                  <div className="col-span-2 text-sm text-slate-300 mt-1">
                    Cần châm: <span className="font-bold text-white">{doseCalc.ph_down_ml.toFixed(1)} mL</span> pH DOWN (-)<br />
                    Thời gian chạy: <span className="font-bold text-white">{doseCalc.ph_down_sec} giây</span> (PWM 50%)
                  </div>
                )}
              </div>

              {doseCalc.hasWarning && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-start">
                  <AlertTriangle size={16} className="mr-2 shrink-0 mt-0.5" />
                  <p>Liều lượng tính toán khá lớn (&gt;100mL). Để tránh sốc rễ, bạn nên giảm Mục tiêu xuống để chia làm 2-3 lần châm!</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-800/30 flex justify-end space-x-3">
              <button onClick={() => setShowSmartModal(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors">
                Hủy bỏ
              </button>
              <button onClick={executeSmartDosing} className="px-5 py-2 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-lg shadow-indigo-500/20">
                🚀 Thực Thi Blind Dosing
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ControlPanel;
