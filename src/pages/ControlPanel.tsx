import React, { useState, useMemo } from 'react';
import {
  FlaskConical, Droplets, Waves, AlertTriangle, Power,
  RotateCcw, CloudRain, Calculator, X, Lock, CheckCircle2,
  Info,
  Activity
} from 'lucide-react';
import { useDeviceSensor } from '../hooks/useDeviceSensor';
import { useDeviceControl } from '../hooks/useDeviceControl';

const DEVICE_ID = "device_001";

const CONSTANTS = {
  EC_GAIN_PER_ML: 0.015,
  PH_UP_PER_ML: 0.02,
  PH_DOWN_PER_ML: 0.025,
  PUMP_CAPACITY_ML_SEC: 1.0,
  DEFAULT_DOSING_PWM: 50,
};
const ACTIVE_PUMP_CAPACITY = CONSTANTS.PUMP_CAPACITY_ML_SEC * (CONSTANTS.DEFAULT_DOSING_PWM / 100.0);

const ControlPanel = () => {
  const { sensorData, deviceStatus, isLoading, updatePumpStatusOptimistically } = useDeviceSensor(DEVICE_ID);
  const { isProcessing, togglePump, setPumpPwm } = useDeviceControl(DEVICE_ID);

  const [pwmValues, setPwmValues] = useState<Record<string, number>>({
    OSAKA_PUMP: 100, MIST_VALVE: 100, A: 50, B: 50, PH_UP: 50, PH_DOWN: 50
  });

  const [showSmartModal, setShowSmartModal] = useState(false);
  const [tankVolume, setTankVolume] = useState<number>(100);
  const [manualEC, setManualEC] = useState({ current: 1.0, target: 1.5 });
  const [manualPH, setManualPH] = useState({ current: 6.0, target: 6.0 });
  const [confirmStep, setConfirmStep] = useState(false);

  // 🟢 UX FIX: Tự động lấy dữ liệu cảm biến thật khi mở Modal Smart Dosing
  const handleOpenSmartDosing = () => {
    if (!isOnline) return alert("Thiết bị Offline!");
    if (!isOsakaOn) return alert("⚠️ Vui lòng bật Bơm Osaka (Trộn) trước!");

    setManualEC({
      current: sensorData?.ec_value ? Number(sensorData.ec_value.toFixed(2)) : 0,
      target: sensorData?.ec_value ? Number((sensorData.ec_value + 0.5).toFixed(2)) : 1.5 // Gợi ý tăng nhẹ
    });
    setManualPH({
      current: sensorData?.ph_value ? Number(sensorData.ph_value.toFixed(2)) : 0,
      target: 6.0 // Chuẩn chung thủy canh
    });
    setConfirmStep(false);
    setShowSmartModal(true);
  };

  const doseCalc = useMemo(() => {
    let ec_ml = 0, ph_up_ml = 0, ph_down_ml = 0;
    const ecDiff = manualEC.target - manualEC.current;
    if (ecDiff > 0) ec_ml = (ecDiff / CONSTANTS.EC_GAIN_PER_ML) * (tankVolume / 100);

    const phDiff = manualPH.target - manualPH.current;
    if (phDiff > 0) {
      ph_up_ml = (phDiff / CONSTANTS.PH_UP_PER_ML) * (tankVolume / 100);
    } else if (phDiff < 0) {
      ph_down_ml = (Math.abs(phDiff) / CONSTANTS.PH_DOWN_PER_ML) * (tankVolume / 100);
    }

    return {
      ec_ml, ec_sec: Math.round(ec_ml / ACTIVE_PUMP_CAPACITY),
      ph_up_ml, ph_up_sec: Math.round(ph_up_ml / ACTIVE_PUMP_CAPACITY),
      ph_down_ml, ph_down_sec: Math.round(ph_down_ml / ACTIVE_PUMP_CAPACITY),
      hasWarning: ec_ml > 100 || ph_up_ml > 100 || ph_down_ml > 100,
      totalTime: Math.max(Math.round(ec_ml / ACTIVE_PUMP_CAPACITY), Math.round(ph_up_ml / ACTIVE_PUMP_CAPACITY), Math.round(ph_down_ml / ACTIVE_PUMP_CAPACITY))
    };
  }, [tankVolume, manualEC, manualPH]);

  if (isLoading || !sensorData) return (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center space-y-4">
        <Activity className="animate-pulse text-emerald-500" size={48} />
        <span className="text-slate-400 font-medium text-sm">Đang kết nối hệ thống bơm...</span>
      </div>
    </div>
  );

  const pumps = sensorData.pump_status || {};
  const isOnline = deviceStatus?.is_online || false;
  const isOsakaOn = pumps.OSAKA_PUMP === 'on';

  // --- HANDLERS ---
  const handleToggle = async (pumpId: string, currentStatus: string | undefined, isDosingPump: boolean = false, currentPwm?: number) => {
    const isOn = currentStatus === 'on';
    const targetAction = isOn ? 'off' : 'on';

    if (isDosingPump && !isOn && !isOsakaOn) return;

    updatePumpStatusOptimistically(pumpId, targetAction);

    // 🟢 LẤY ĐÚNG GIÁ TRỊ TRUYỀN VÀO, KHÔNG FALLBACK NỮA
    const pwmToSend = targetAction === 'on' ? currentPwm : undefined;

    const success = await togglePump(pumpId, targetAction, pwmToSend);

    if (!success) updatePumpStatusOptimistically(pumpId, isOn ? 'on' : 'off');
  };

  const handlePwmCommit = async (pumpId: string, val: number) => {
    if (!isOnline) return;
    if (setPumpPwm) await setPumpPwm(pumpId, val);
  };

  const handleResetFault = async () => {
    if (!isOnline) return;
    if (window.confirm("Gửi lệnh Reset Lỗi tới hệ thống?")) await togglePump("ALL", "reset_fault");
  };

  const executeSmartDosing = async () => {
    if (doseCalc.ec_sec === 0 && doseCalc.ph_up_sec === 0 && doseCalc.ph_down_sec === 0) {
      alert("Thông số đã đạt chuẩn, không cần bơm thêm.");
      return;
    }

    // Check nếu không có kết nối thì dừng
    if (!isOnline) return alert("Thiết bị đang Offline!");

    setShowSmartModal(false);

    // 1. CHÂM PHÂN BÓN A VÀ B (TUẦN TỰ)
    if (doseCalc.ec_sec > 0) {
      // Bật bơm A
      await togglePump("A", "on", CONSTANTS.DEFAULT_DOSING_PWM, doseCalc.ec_sec);

      // Tính toán độ trễ = (Thời gian bơm A chạy) + (10 giây trộn)
      const delayMs = (doseCalc.ec_sec + 10) * 1000;

      // Dùng toast / alert để dặn người dùng
      console.log(`Đang chạy Bơm A. Chờ ${doseCalc.ec_sec + 10}s để hòa tan trước khi tự động chạy Bơm B...`);
      // LƯU Ý: Frontend có thể thêm một UI nhỏ góc màn hình báo "Đang trong tiến trình châm phân..."

      setTimeout(async () => {
        // Bật bơm B sau khi A đã hoàn tất và hòa tan xong
        await togglePump("B", "on", CONSTANTS.DEFAULT_DOSING_PWM, doseCalc.ec_sec);

        // 2. SAU KHI CHÂM A & B XONG, MỚI CHÂM pH (Tránh phản ứng hóa học chéo)
        setTimeout(async () => {
          if (doseCalc.ph_up_sec > 0) await togglePump("PH_UP", "on", CONSTANTS.DEFAULT_DOSING_PWM, doseCalc.ph_up_sec);
          if (doseCalc.ph_down_sec > 0) await togglePump("PH_DOWN", "on", CONSTANTS.DEFAULT_DOSING_PWM, doseCalc.ph_down_sec);
        }, (doseCalc.ec_sec + 5) * 1000); // Đợi B chạy xong + 5s rồi mới châm pH

      }, delayMs);
    }
    // Nếu chỉ có chỉnh pH (không cần châm EC)
    else {
      if (doseCalc.ph_up_sec > 0) await togglePump("PH_UP", "on", CONSTANTS.DEFAULT_DOSING_PWM, doseCalc.ph_up_sec);
      if (doseCalc.ph_down_sec > 0) await togglePump("PH_DOWN", "on", CONSTANTS.DEFAULT_DOSING_PWM, doseCalc.ph_down_sec);
    }
  };

  // --- UI COMPONENTS ---
  const Switch = ({ isOn, disabled }: { isOn: boolean; disabled: boolean }) => (
    <div className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-all duration-300 ease-in-out shadow-inner ${isOn ? 'bg-emerald-500' : 'bg-slate-700'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
      <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-out ${isOn ? 'translate-x-5' : 'translate-x-0'}`} />
    </div>
  );

  const ControlCard = ({ title, icon: Icon, colorClass, borderClass, isOn, lockedMessage, pumpId, supportsPwm = false }: any) => {
    const isLocked = lockedMessage && !isOn;
    const currentPwm = pwmValues[pumpId] || 100;

    const handleClick = (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (!isOnline || isProcessing || isLocked) return;

      // 🟢 CHỈ GỬI PWM NẾU BƠM NÀY THỰC SỰ HỖ TRỢ (supportsPwm = true)
      const pwmToPass = supportsPwm ? currentPwm : undefined;

      handleToggle(pumpId, isOn ? 'on' : 'off', !!lockedMessage, pwmToPass);
    };

    return (
      <div
        onClick={handleClick}
        className={`relative overflow-hidden bg-slate-900/80 backdrop-blur-md rounded-3xl p-4 flex flex-col transition-all duration-300 select-none
          ${isOn ? `border border-${borderClass} shadow-[0_0_20px_rgba(0,0,0,0.2)] shadow-${borderClass}/10 bg-slate-800/80` : 'border border-slate-800 hover:border-slate-700/80'} 
          ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'}
        `}
      >
        <div className={`flex items-center justify-between z-10 w-full transition-opacity ${isLocked ? 'opacity-50 grayscale' : ''}`}>
          <div className="flex items-center space-x-4 overflow-hidden">
            <div className={`p-3 rounded-2xl shrink-0 transition-all duration-500 ${isOn ? `bg-slate-950 shadow-inner ${colorClass}` : 'bg-slate-800/50 text-slate-500'}`}>
              <Icon size={24} className={isOn ? "animate-pulse" : ""} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className={`font-bold tracking-wide truncate ${isOn ? 'text-white' : 'text-slate-300'}`}>
                {title}
              </span>
              {supportsPwm && isOn ? (
                <span className={`text-xs font-semibold mt-0.5 ${colorClass}`}>PWM: {currentPwm}%</span>
              ) : (
                <span className="text-[11px] font-medium text-slate-500 mt-0.5">{isOn ? 'Đang chạy' : 'Đã tắt'}</span>
              )}
            </div>
          </div>
          <div className="z-10 shrink-0 ml-2">
            {isLocked ? (
              <div className="h-7 w-12 flex items-center justify-center bg-slate-800/50 rounded-full border border-slate-700/50">
                <Lock size={14} className="text-slate-500" />
              </div>
            ) : (
              <Switch isOn={isOn} disabled={isProcessing || !isOnline} />
            )}
          </div>
        </div>

        {/* Cảnh báo khóa ẩn ngay trong card thay vì alert */}
        {isLocked && (
          <div className="mt-3 pt-3 border-t border-red-500/20 text-[11px] text-red-400 font-medium flex items-center bg-red-500/5 p-2 rounded-xl">
            <Lock size={12} className="mr-1.5 shrink-0" /> {lockedMessage}
          </div>
        )}

        {/* PWM Slider - UX FIX: Trơn tru và to bản hơn */}
        {supportsPwm && !isLocked && (
          <div className={`transition-all duration-300 ease-out overflow-hidden ${isOn ? 'max-h-20 opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'}`}>
            <div className="px-1">
              <input
                type="range" min="10" max="100" step="5"
                value={currentPwm}
                onChange={(e) => setPwmValues(prev => ({ ...prev, [pumpId]: parseInt(e.target.value) }))}
                onMouseUp={() => handlePwmCommit(pumpId, currentPwm)}
                onTouchEnd={() => handlePwmCommit(pumpId, currentPwm)}
                className={`w-full h-2 rounded-lg appearance-none cursor-pointer transition-colors ${isOn ? 'bg-slate-700' : 'bg-slate-800'}`}
                style={{ accentColor: 'currentColor' }}
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-semibold mt-1.5 px-1">
                <span>Nhẹ</span><span>Vừa</span><span>Mạnh</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24 max-w-4xl mx-auto relative animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* HEADER TÁI THIẾT KẾ */}
      <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-3xl border border-slate-800/60 backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white mb-1">Thiết Bị Cầm Tay</h1>
          <p className="text-xs font-medium text-slate-400 flex items-center">
            Trạng thái máy chủ:
            <span className={`ml-1.5 flex items-center ${isOnline ? 'text-emerald-400' : 'text-red-400'}`}>
              <span className={`h-2 w-2 rounded-full mr-1.5 ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500'}`}></span>
              {isOnline ? 'Sẵn sàng' : 'Mất kết nối'}
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button onClick={handleOpenSmartDosing} className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-sm font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/25 border border-indigo-500/50">
            <Calculator size={18} />
            <span className="hidden sm:inline">Trợ lý Pha Chế</span>
            <span className="sm:hidden">Pha Chế</span>
          </button>
        </div>
      </div>

      {/* QUICK ACTION */}
      <div className="flex justify-end mb-2">
        <button onClick={handleResetFault} disabled={!isOnline || isProcessing} className="flex items-center space-x-2 px-3 py-1.5 text-slate-400 hover:text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50">
          <RotateCcw size={14} className={isProcessing ? "animate-spin" : ""} />
          <span>Xóa Lỗi (Reset FSM)</span>
        </button>
      </div>

      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-2 flex items-center"><Power size={14} className="mr-1.5" /> Core Systems</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ControlCard pumpId="OSAKA_PUMP" title="Bơm Tuần Hoàn (Trộn)" icon={Waves} colorClass="text-cyan-400" borderClass="cyan-500" isOn={pumps.OSAKA_PUMP === 'on'} supportsPwm={true} />
          <ControlCard pumpId="MIST_VALVE" title="Van Phun Sương" icon={CloudRain} colorClass="text-blue-400" borderClass="blue-500" isOn={pumps.MIST_VALVE === 'on'} />
          <ControlCard pumpId="WATER_PUMP" title="Bơm Cấp Nước Sạch" icon={Droplets} colorClass="text-emerald-400" borderClass="emerald-500" isOn={pumps.WATER_PUMP === 'on'} />
          <ControlCard pumpId="DRAIN_PUMP" title="Bơm Xả Thải" icon={Waves} colorClass="text-red-400" borderClass="red-500" isOn={pumps.DRAIN_PUMP === 'on'} />
        </div>
      </section>

      <section className="space-y-3 pt-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-2 flex items-center"><FlaskConical size={14} className="mr-1.5" /> Dosing Pumps</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ControlCard pumpId="A" title="Vi lượng A" icon={FlaskConical} colorClass="text-fuchsia-400" borderClass="fuchsia-500" isOn={pumps.A === 'on'} lockedMessage={!isOsakaOn ? "Yêu cầu bật Bơm Tuần Hoàn" : undefined} supportsPwm={true} />
          <ControlCard pumpId="B" title="Vi lượng B" icon={FlaskConical} colorClass="text-purple-400" borderClass="purple-500" isOn={pumps.B === 'on'} lockedMessage={!isOsakaOn ? "Yêu cầu bật Bơm Tuần Hoàn" : undefined} supportsPwm={true} />
          <ControlCard pumpId="PH_UP" title="Dung dịch pH UP (+)" icon={Droplets} colorClass="text-orange-400" borderClass="orange-500" isOn={pumps.PH_UP === 'on'} lockedMessage={!isOsakaOn ? "Yêu cầu bật Bơm Tuần Hoàn" : undefined} supportsPwm={true} />
          <ControlCard pumpId="PH_DOWN" title="Dung dịch pH DOWN (-)" icon={Droplets} colorClass="text-pink-500" borderClass="pink-500" isOn={pumps.PH_DOWN === 'on'} lockedMessage={!isOsakaOn ? "Yêu cầu bật Bơm Tuần Hoàn" : undefined} supportsPwm={true} />
        </div>
      </section>

      {/* 🟢 MODAL: SMART DOSING ĐƯỢC TÁI THIẾT KẾ UX */}
      {showSmartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/50 rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">

            <div className="flex justify-between items-center p-5 border-b border-slate-800/60 bg-slate-800/20 shrink-0">
              <div>
                <h2 className="text-xl font-black text-white flex items-center tracking-tight">
                  <Calculator className="mr-2 text-indigo-400" size={24} />
                  Trợ Lý Pha Chế
                </h2>
                <p className="text-xs text-slate-400 font-medium mt-1">Tính toán liều lượng chuẩn xác</p>
              </div>
              <button onClick={() => setShowSmartModal(false)} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto custom-scrollbar">
              {!confirmStep ? (
                <>
                  <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/60">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Thể tích hiện tại</label>
                    <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl p-1 focus-within:border-indigo-500/50 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                      <div className="px-3 text-slate-500"><Waves size={18} /></div>
                      <input type="number" value={tankVolume} onChange={e => setTankVolume(Number(e.target.value))} className="w-full bg-transparent border-none px-2 py-2 text-white font-bold text-lg focus:outline-none" />
                      <div className="px-4 text-sm font-bold text-slate-500 bg-slate-800 py-1.5 rounded-lg mr-1">LÍT</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-fuchsia-950/20 p-4 rounded-2xl border border-fuchsia-900/30">
                      <label className="block text-[11px] font-bold text-fuchsia-500/70 uppercase tracking-widest mb-3">Dinh Dưỡng (EC)</label>
                      <div className="space-y-3">
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-1">Đang Đo Được</span>
                          <input type="number" step="0.1" value={manualEC.current} onChange={e => setManualEC({ ...manualEC, current: Number(e.target.value) })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 font-medium focus:outline-none focus:border-fuchsia-500/50" />
                        </div>
                        <div>
                          <span className="text-[10px] text-fuchsia-400 font-bold block mb-1">Mục Tiêu Tới</span>
                          <input type="number" step="0.1" value={manualEC.target} onChange={e => setManualEC({ ...manualEC, target: Number(e.target.value) })} className="w-full bg-fuchsia-500/10 border border-fuchsia-500/50 rounded-lg px-3 py-2 text-fuchsia-400 font-bold focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-orange-950/20 p-4 rounded-2xl border border-orange-900/30">
                      <label className="block text-[11px] font-bold text-orange-500/70 uppercase tracking-widest mb-3">Cân Bằng pH</label>
                      <div className="space-y-3">
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-1">Đang Đo Được</span>
                          <input type="number" step="0.1" value={manualPH.current} onChange={e => setManualPH({ ...manualPH, current: Number(e.target.value) })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 font-medium focus:outline-none focus:border-orange-500/50" />
                        </div>
                        <div>
                          <span className="text-[10px] text-orange-400 font-bold block mb-1">Mục Tiêu Tới</span>
                          <input type="number" step="0.1" value={manualPH.target} onChange={e => setManualPH({ ...manualPH, target: Number(e.target.value) })} className="w-full bg-orange-500/10 border border-orange-500/50 rounded-lg px-3 py-2 text-orange-400 font-bold focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4 animate-in slide-in-from-right-4 fade-in">
                  <div className="text-center p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                    <CheckCircle2 size={32} className="mx-auto text-indigo-400 mb-2" />
                    <h3 className="text-white font-bold">Hóa Đơn Pha Chế</h3>
                    <p className="text-xs text-indigo-300 mt-1">Hệ thống sẽ chạy tự động theo liều lượng sau ở mức <b>Công suất {CONSTANTS.DEFAULT_DOSING_PWM}%</b></p>
                  </div>

                  <div className="bg-slate-900 rounded-2xl border border-slate-800 divide-y divide-slate-800/60 overflow-hidden">
                    {doseCalc.ec_sec > 0 && (
                      <div className="p-4 flex justify-between items-center bg-fuchsia-950/10">
                        <div>
                          <p className="text-sm font-bold text-fuchsia-400">Bơm A & B (Dinh Dưỡng)</p>
                          <p className="text-xs text-slate-400">{doseCalc.ec_sec} giây / mỗi bơm</p>
                        </div>
                        <span className="text-lg font-black text-white">{doseCalc.ec_ml.toFixed(1)} <span className="text-xs text-slate-500 font-bold">mL</span></span>
                      </div>
                    )}
                    {doseCalc.ph_up_sec > 0 && (
                      <div className="p-4 flex justify-between items-center bg-orange-950/10">
                        <div>
                          <p className="text-sm font-bold text-orange-400">Bơm pH UP (+)</p>
                          <p className="text-xs text-slate-400">{doseCalc.ph_up_sec} giây</p>
                        </div>
                        <span className="text-lg font-black text-white">{doseCalc.ph_up_ml.toFixed(1)} <span className="text-xs text-slate-500 font-bold">mL</span></span>
                      </div>
                    )}
                    {doseCalc.ph_down_sec > 0 && (
                      <div className="p-4 flex justify-between items-center bg-pink-950/10">
                        <div>
                          <p className="text-sm font-bold text-pink-500">Bơm pH DOWN (-)</p>
                          <p className="text-xs text-slate-400">{doseCalc.ph_down_sec} giây</p>
                        </div>
                        <span className="text-lg font-black text-white">{doseCalc.ph_down_ml.toFixed(1)} <span className="text-xs text-slate-500 font-bold">mL</span></span>
                      </div>
                    )}

                    {(doseCalc.ec_sec === 0 && doseCalc.ph_up_sec === 0 && doseCalc.ph_down_sec === 0) && (
                      <div className="p-6 text-center text-slate-400 text-sm font-medium">
                        Nước đã đạt chuẩn, không cần bơm thêm gì!
                      </div>
                    )}
                  </div>

                  {doseCalc.hasWarning && (
                    <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start space-x-3">
                      <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-300 leading-relaxed font-medium"><b>Cảnh báo:</b> Liều lượng một lần khá lớn ({'>'}100mL). Để tránh sốc rễ cây, bạn nên chia làm 2-3 lần châm nhỏ!</p>
                    </div>
                  )}

                  <div className="flex items-center space-x-2 text-xs font-medium text-slate-400 bg-slate-950/50 p-3 rounded-xl">
                    <Info size={14} className="text-slate-500" />
                    <span>Sau khi bấm thực thi, hệ thống sẽ châm và tự động tắt bơm khi đếm ngược xong.</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-800/60 bg-slate-900 shrink-0 grid grid-cols-2 gap-3">
              <button
                onClick={() => confirmStep ? setConfirmStep(false) : setShowSmartModal(false)}
                className="py-3.5 rounded-xl text-sm font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                {confirmStep ? 'Quay lại sửa' : 'Hủy bỏ'}
              </button>

              {!confirmStep ? (
                <button
                  onClick={() => setConfirmStep(true)}
                  className="py-3.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-lg shadow-indigo-500/25"
                >
                  Tính Toán Liều Lượng
                </button>
              ) : (
                <button
                  onClick={executeSmartDosing}
                  disabled={doseCalc.totalTime === 0}
                  className="py-3.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:bg-slate-800 disabled:text-slate-500 text-white transition-all shadow-lg shadow-emerald-500/25"
                >
                  🚀 Thực Thi Ngay
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ControlPanel;
