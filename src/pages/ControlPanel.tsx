import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FlaskConical, Droplets, Waves, RotateCcw, CloudRain,
  Calculator, X, CheckCircle2, Activity, Settings, AlertTriangle
} from 'lucide-react';

import { invoke } from '@tauri-apps/api/core';
import toast from 'react-hot-toast';

import { ControlCard } from '../components/ui/ControlCard';
import { FsmStatusBadge } from '../components/ui/FsmStatusBadge';

import { PumpStatus } from '../types/models';
import { useDeviceContext } from '../context/DeviceContext';
import { useDeviceControl } from '../hooks/useDeviceControl';

const CONSTANTS = {
  EC_GAIN_PER_ML: 0.015,
  PH_UP_PER_ML: 0.02,
  PH_DOWN_PER_ML: 0.025,
  PUMP_CAPACITY_ML_SEC: 1.0,
  DEFAULT_DOSING_PWM: 50,
};
const ACTIVE_PUMP_CAPACITY = CONSTANTS.PUMP_CAPACITY_ML_SEC * (CONSTANTS.DEFAULT_DOSING_PWM / 100.0);

const ControlPanel = () => {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  // Lấy Device ID từ cấu hình hệ thống
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings: any = await invoke('load_settings');
        if (settings && settings.device_id) {
          setDeviceId(settings.device_id);
        }
      } catch (error) {
        console.error("Lỗi khi tải cài đặt:", error);
      } finally {
        setIsLoadingSettings(false);
      }
    };
    fetchSettings();
  }, []);

  if (isLoadingSettings) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!deviceId) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 p-6 text-center animate-in fade-in">
        <div className="p-4 bg-slate-900 rounded-full border border-slate-800 text-slate-400">
          <Settings size={32} />
        </div>
        <h2 className="text-xl font-bold text-white">Chưa cấu hình thiết bị</h2>
        <p className="text-sm text-slate-400 max-w-xs">
          Vui lòng vào mục Cài đặt để thiết lập Device ID trước khi điều khiển.
        </p>
      </div>
    );
  }

  return <ControlPanelContent deviceId={deviceId} />;
};

const ControlPanelContent = ({ deviceId }: { deviceId: string }) => {
  const { sensorData, deviceStatus, fsmState, isLoading, updatePumpStatusOptimistically, settings } = useDeviceContext();
  const { isProcessing, togglePump, setPumpPwm, syncDeviceStatus } = useDeviceControl(deviceId);

  const [deviceConfig, setDeviceConfig] = useState<any>(null);
  const isOnline = deviceStatus?.is_online || false;

  // Sync thiết bị khi online
  useEffect(() => {
    if (isOnline) {
      syncDeviceStatus();
    }
  }, [isOnline]);

  // Tải cấu hình từ mạch ESP32 về để check an toàn
  useEffect(() => {
    if (!deviceId || !settings?.backend_url) return;
    const fetchDeviceConfig = async () => {
      try {
        const res = await fetch(`${settings.backend_url}/api/devices/${deviceId}/config`, {
          headers: { 'X-API-Key': settings.api_key }
        });
        if (res.ok) {
          const data = await res.json();
          setDeviceConfig(data.data || data);
        }
      } catch (err) {
        console.error("Lỗi fetch cấu hình thiết bị:", err);
      }
    };
    fetchDeviceConfig();
  }, [deviceId, settings]);

  const [pwmValues, setPwmValues] = useState<Record<string, number>>({
    OSAKA_PUMP: 100, MIST_VALVE: 100, A: 50, B: 50, PH_UP: 50, PH_DOWN: 50
  });

  const [showSmartModal, setShowSmartModal] = useState(false);
  const [tankVolume, setTankVolume] = useState<number>(100);
  const [manualEC, setManualEC] = useState({ current: 1.0, target: 1.5 });
  const [manualPH, setManualPH] = useState({ current: 6.0, target: 6.0 });
  const [confirmStep, setConfirmStep] = useState(false);

  // 🟢 TRẠNG THÁI CHO POPUP CONFIRM CƯỠNG CHẾ
  const [forceConfirmModal, setForceConfirmModal] = useState<{
    isOpen: boolean;
    pumpId: string;
    title: string;
    val?: number;
  }>({ isOpen: false, pumpId: '', title: '' });

  const pumps: Partial<PumpStatus> = sensorData?.pump_status || {};
  const isOsakaOn = pumps.osaka_pump === true;

  // 🟢 HÀM KIỂM TRA NGUY HIỂM (Được tối ưu để không bị lỗi undefined)
  const checkIsDangerous = useCallback(() => {
    // 1. Dựa vào trạng thái FSM (Chính xác nhất)
    if (fsmState.includes('Emergency') || fsmState.includes('Fault')) return true;

    // 2. Dựa vào thông số môi trường thực tế
    if (!sensorData || !deviceConfig) return false;

    const water = Number(sensorData.water_level);
    const ec = Number(sensorData.ec_value);
    const ph = Number(sensorData.ph_value);

    const isWaterCritical = deviceConfig.enable_water_level_sensor && (water <= Number(deviceConfig.water_level_critical_min));
    const isEcBad = deviceConfig.enable_ec_sensor && (ec <= Number(deviceConfig.min_ec_limit) || ec >= Number(deviceConfig.max_ec_limit));
    const isPhBad = deviceConfig.enable_ph_sensor && (ph <= Number(deviceConfig.min_ph_limit) || ph >= Number(deviceConfig.max_ph_limit));

    return isWaterCritical || isEcBad || isPhBad || deviceConfig.emergency_shutdown === true;
  }, [fsmState, sensorData, deviceConfig]);

  const handleOpenSmartDosing = () => {
    if (!isOnline) return toast.error("Thiết bị đang Offline!");
    if (!isOsakaOn) return toast("Vui lòng bật Bơm Trộn (Osaka) trước khi pha chế!", { icon: '⚠️' });

    setManualEC({
      current: sensorData?.ec_value ? Number(sensorData.ec_value.toFixed(2)) : 0,
      target: sensorData?.ec_value ? Number((sensorData.ec_value + 0.5).toFixed(2)) : 1.5
    });
    setManualPH({
      current: sensorData?.ph_value ? Number(sensorData.ph_value.toFixed(2)) : 0,
      target: 6.0
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

  // --- CÁC HÀM THỰC THI GỬI LỆNH XUỐNG SERVER ---
  const executeToggle = async (pumpId: string, actionStr: 'on' | 'off' | 'force_on', currentPwm?: number, name?: string) => {
    const isTurningOn = actionStr === 'on' || actionStr === 'force_on';

    // Ghi đè UI lập tức để mượt mà
    updatePumpStatusOptimistically(pumpId, isTurningOn);
    const toastId = toast.loading(`Đang gửi lệnh ${actionStr === 'force_on' ? 'CƯỠNG CHẾ BẬT' : (isTurningOn ? 'BẬT' : 'TẮT')} ${name}...`);

    // Gửi lệnh xuống API (Cưỡng chế mặc định 120s)
    const success = await togglePump(pumpId, actionStr, currentPwm, actionStr === 'force_on' ? 120 : undefined);

    if (success) {
      toast.success(`Đã ${actionStr === 'force_on' ? 'CƯỠNG CHẾ BẬT' : (isTurningOn ? 'BẬT' : 'TẮT')} ${name}!`, { id: toastId });
    } else {
      toast.error(`Lỗi điều khiển ${name}.`, { id: toastId });
      updatePumpStatusOptimistically(pumpId, !isTurningOn); // Trả lại state nếu lỗi
    }
  };

  const executePwmCommit = async (pumpId: string, val: number, title: string, isForce: boolean = false) => {
    if (isForce) {
      const toastId = toast.loading(`Đang cưỡng chế chạy ${title} ở ${val}%...`);
      updatePumpStatusOptimistically(pumpId, true);
      const success = await togglePump(pumpId, 'force_on', val, 120);

      if (success) {
        toast.success(`Đã CƯỠNG CHẾ chạy ${title} ở ${val}%!`, { id: toastId });
      } else {
        toast.error(`Lỗi điều khiển ${title}.`, { id: toastId });
        updatePumpStatusOptimistically(pumpId, false);
        handlePwmChange(pumpId, 0);
      }
      return;
    }

    const toastId = toast.loading(`Đang cập nhật công suất ${title}...`);
    if (setPumpPwm) {
      await setPumpPwm(pumpId, val);
      toast.success(`Đã lưu công suất ${title}: ${val}%`, { id: toastId });
    }
  };

  // --- CÁC EVENT HANDLERS TỪ GIAO DIỆN (NÚT BẤM / SLIDER) ---
  const handleToggle = (pumpId: string, action: 'on' | 'off' | boolean, _isLocked: boolean, currentPwm?: number, title?: string) => {
    const isTurningOn = action === 'on' || action === true;
    const name = title || pumpId;

    if (isTurningOn && checkIsDangerous()) {
      // Dừng luồng hiện tại, mở Popup Confirm lên thay vì gửi lệnh ngay
      setForceConfirmModal({ isOpen: true, pumpId, title: name, val: undefined });
      return;
    }

    // Nếu bình thường thì gửi lệnh
    executeToggle(pumpId, isTurningOn ? 'on' : 'off', currentPwm, name);
  };

  const handlePwmChange = (pumpId: string, val: number) => {
    setPwmValues(prev => ({ ...prev, [pumpId]: val }));
  };

  const handlePwmCommit = (pumpId: string, val: number, title: string) => {
    if (!isOnline) return;

    if (val > 0 && checkIsDangerous()) {
      // Dừng lại, mở Popup Confirm
      setForceConfirmModal({ isOpen: true, pumpId, title, val });
      return;
    }

    executePwmCommit(pumpId, val, title, false);
  };

  // --- XỬ LÝ POPUP BUTTONS (OK / HỦY) ---
  const confirmForceAction = () => {
    const { pumpId, title, val } = forceConfirmModal;
    setForceConfirmModal({ isOpen: false, pumpId: '', title: '' });

    // Dùng setTimeout nhỏ để tránh xung đột render của React khi đóng/mở UI
    setTimeout(() => {
      if (val !== undefined) {
        executePwmCommit(pumpId, val, title, true);
      } else {
        executeToggle(pumpId, 'force_on', undefined, title);
      }
    }, 50);
  };

  const cancelForceAction = () => {
    const { pumpId, val } = forceConfirmModal;
    setForceConfirmModal({ isOpen: false, pumpId: '', title: '' });

    if (val !== undefined) {
      handlePwmChange(pumpId, 0);
    } else {
      updatePumpStatusOptimistically(pumpId, false);
    }
  };

  const handleResetFault = async () => {
    if (!isOnline) return toast.error("Thiết bị Offline!");
    if (window.confirm("Gửi lệnh Reset Lỗi hệ thống?")) {
      const toastId = toast.loading("Đang reset...");
      const success = await togglePump("ALL", "reset_fault" as any);
      if (success) toast.success("Đã gửi lệnh thành công!", { id: toastId });
      else toast.error("Lỗi khi reset.", { id: toastId });
    }
  };

  const executeSmartDosing = async () => {
    if (doseCalc.totalTime === 0) return toast("Thông số đã đạt chuẩn.", { icon: 'ℹ️' });
    if (!isOnline) return toast.error("Thiết bị Offline!");

    setShowSmartModal(false);
    toast.success("🚀 Bắt đầu pha chế tự động!");

    if (doseCalc.ec_sec > 0) {
      await togglePump("A", "on", CONSTANTS.DEFAULT_DOSING_PWM, doseCalc.ec_sec);
      toast(`🧪 Đang châm Vi lượng A (${doseCalc.ec_sec}s)...`, { icon: 'ℹ️', duration: 4000 });

      setTimeout(async () => {
        await togglePump("B", "on", CONSTANTS.DEFAULT_DOSING_PWM, doseCalc.ec_sec);
        toast(`🧪 Đang châm Vi lượng B (${doseCalc.ec_sec}s)...`, { icon: 'ℹ️', duration: 4000 });

        setTimeout(async () => {
          if (doseCalc.ph_up_sec > 0) await togglePump("PH_UP", "on", CONSTANTS.DEFAULT_DOSING_PWM, doseCalc.ph_up_sec);
          if (doseCalc.ph_down_sec > 0) await togglePump("PH_DOWN", "on", CONSTANTS.DEFAULT_DOSING_PWM, doseCalc.ph_down_sec);
          toast("⚖️ Đang cân bằng pH...", { icon: 'ℹ️' });
        }, (doseCalc.ec_sec + 5) * 1000);
      }, (doseCalc.ec_sec + 10) * 1000);
    } else {
      if (doseCalc.ph_up_sec > 0) await togglePump("PH_UP", "on", CONSTANTS.DEFAULT_DOSING_PWM, doseCalc.ph_up_sec);
      if (doseCalc.ph_down_sec > 0) await togglePump("PH_DOWN", "on", CONSTANTS.DEFAULT_DOSING_PWM, doseCalc.ph_down_sec);
    }
  };

  if (isLoading || !sensorData) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950">
        <Activity className="animate-pulse text-emerald-500" size={48} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 relative">

      {/* HEADER SECTION */}
      <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-3xl border border-slate-800/60 backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-black text-white mb-1">Điều Khiển Thủ Công</h1>
          <div className="flex items-center space-x-3">
            <FsmStatusBadge state={fsmState} />
            <span className={`text-[10px] uppercase tracking-widest font-bold ${isOnline ? 'text-emerald-400' : 'text-red-400'}`}>
              {isOnline ? 'Sẵn sàng' : 'Mất kết nối'}
            </span>
          </div>
        </div>
        <button
          onClick={handleOpenSmartDosing}
          className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-2xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
        >
          <Calculator size={24} />
        </button>
      </div>

      <div className="flex justify-end">
        <button onClick={handleResetFault} className="text-slate-500 hover:text-white text-xs flex items-center space-x-1 transition-colors">
          <RotateCcw size={14} />
          <span>Reset Lỗi Hệ Thống</span>
        </button>
      </div>

      {/* CORE SYSTEMS */}
      <section className="space-y-3">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 ml-2">Hệ Thống Chính</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ControlCard
            pumpId="OSAKA_PUMP" title="Bơm Tuần Hoàn (Trộn)" icon={Waves} colorClass="text-cyan-400" borderClass="cyan-500"
            isOn={pumps.osaka_pump === true}
            supportsPwm currentPwm={pwmValues.OSAKA_PUMP}
            isOnline={isOnline} isProcessing={isProcessing} onToggle={handleToggle as any} onPwmChange={handlePwmChange} onPwmCommit={handlePwmCommit}
          />
          <ControlCard
            pumpId="MIST_VALVE" title="Van Phun Sương" icon={CloudRain} colorClass="text-blue-400" borderClass="blue-500"
            isOn={pumps.mist_valve === true}
            isOnline={isOnline} isProcessing={isProcessing} onToggle={handleToggle as any}
          />
          <ControlCard
            pumpId="WATER_PUMP" title="Bơm Cấp Nước Sạch" icon={Droplets} colorClass="text-emerald-400" borderClass="emerald-500"
            isOn={pumps.water_pump_in === true}
            isOnline={isOnline} isProcessing={isProcessing} onToggle={handleToggle as any}
          />
          <ControlCard
            pumpId="DRAIN_PUMP" title="Bơm Xả Thải" icon={Waves} colorClass="text-red-400" borderClass="red-500"
            isOn={pumps.water_pump_out === true}
            isOnline={isOnline} isProcessing={isProcessing} onToggle={handleToggle as any}
          />
        </div>
      </section>

      {/* DOSING SYSTEMS */}
      <section className="space-y-3 pt-2">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 ml-2">Bơm Định Lượng</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ControlCard
            pumpId="A" title="Dinh Dưỡng A" icon={FlaskConical} colorClass="text-fuchsia-400" borderClass="fuchsia-500"
            isOn={pumps.pump_a === true}
            supportsPwm currentPwm={pwmValues.A}
            lockedMessage={!isOsakaOn ? "Cần bật Bơm Trộn" : undefined}
            isOnline={isOnline} isProcessing={isProcessing} onToggle={handleToggle as any} onPwmChange={handlePwmChange} onPwmCommit={handlePwmCommit}
          />
          <ControlCard
            pumpId="B" title="Dinh Dưỡng B" icon={FlaskConical} colorClass="text-purple-400" borderClass="purple-500"
            isOn={pumps.pump_b === true}
            supportsPwm currentPwm={pwmValues.B}
            lockedMessage={!isOsakaOn ? "Cần bật Bơm Trộn" : undefined}
            isOnline={isOnline} isProcessing={isProcessing} onToggle={handleToggle as any} onPwmChange={handlePwmChange} onPwmCommit={handlePwmCommit}
          />
          <ControlCard
            pumpId="PH_UP" title="Tăng pH (+)" icon={Droplets} colorClass="text-orange-400" borderClass="orange-500"
            isOn={pumps.ph_up === true}
            supportsPwm currentPwm={pwmValues.PH_UP}
            lockedMessage={!isOsakaOn ? "Cần bật Bơm Trộn" : undefined}
            isOnline={isOnline} isProcessing={isProcessing} onToggle={handleToggle as any} onPwmChange={handlePwmChange} onPwmCommit={handlePwmCommit}
          />
          <ControlCard
            pumpId="PH_DOWN" title="Giảm pH (-)" icon={Droplets} colorClass="text-pink-500" borderClass="pink-500"
            isOn={pumps.ph_down === true}
            supportsPwm currentPwm={pwmValues.PH_DOWN}
            lockedMessage={!isOsakaOn ? "Cần bật Bơm Trộn" : undefined}
            isOnline={isOnline} isProcessing={isProcessing} onToggle={handleToggle as any} onPwmChange={handlePwmChange} onPwmCommit={handlePwmCommit}
          />
        </div>
      </section>

      {/* 🟢 MODAL CẢNH BÁO CƯỠNG CHẾ BẬT BƠM */}
      {forceConfirmModal.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-red-900/50 rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden transform transition-all">
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto bg-red-500/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="text-red-500" size={32} />
              </div>
              <h2 className="text-xl font-bold text-white">Cảnh báo An toàn!</h2>
              <p className="text-slate-400 text-sm">
                Hệ thống phát hiện thông số môi trường đang ở ngưỡng nguy hiểm. Bơm đang bị khóa bảo vệ.
              </p>
              <p className="text-slate-300 text-sm font-medium">
                Bạn có chắc chắn muốn <span className="text-red-400">CƯỠNG CHẾ CHẠY</span> <br />
                <strong className="text-white text-base">[{forceConfirmModal.title}]</strong>
                {forceConfirmModal.val !== undefined ? ` ở mức ${forceConfirmModal.val}%` : ''} không?
              </p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-800 border-t border-slate-800">
              <button
                onClick={cancelForceAction}
                className="p-4 font-semibold text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={confirmForceAction}
                className="p-4 font-bold text-red-500 hover:bg-red-500/10 transition-colors"
              >
                Cưỡng Chế
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMART DOSING MODAL */}
      {showSmartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/50 rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-slate-800">
              <h2 className="text-xl font-black text-white flex items-center">
                <Calculator className="mr-2 text-indigo-400" /> Trợ Lý Pha Chế
              </h2>
              <button onClick={() => setShowSmartModal(false)} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
              {!confirmStep ? (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Thể tích bồn (Lít)</label>
                    <input
                      type="number" value={tankVolume}
                      onChange={e => setTankVolume(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-bold focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-fuchsia-500 uppercase">Mục tiêu EC</label>
                      <input
                        type="number" step="0.1" value={manualEC.target}
                        onChange={e => setManualEC({ ...manualEC, target: Number(e.target.value) })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white focus:border-fuchsia-500 outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-orange-500 uppercase">Mục tiêu pH</label>
                      <input
                        type="number" step="0.1" value={manualPH.target}
                        onChange={e => setManualPH({ ...manualPH, target: Number(e.target.value) })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white focus:border-orange-500 outline-none"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4 animate-in slide-in-from-right-4">
                  <div className="bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/20 text-center">
                    <CheckCircle2 size={32} className="mx-auto text-indigo-400 mb-2" />
                    <p className="text-white font-bold">Lệnh Pha Chế Tự Động</p>
                  </div>
                  <div className="bg-slate-950 rounded-2xl divide-y divide-slate-900 border border-slate-900">
                    {doseCalc.ec_sec > 0 && (
                      <div className="p-4 flex justify-between items-center">
                        <span className="text-slate-400 text-sm">Bơm A & B</span>
                        <span className="text-white font-bold">{doseCalc.ec_sec} giây / bơm</span>
                      </div>
                    )}
                    {doseCalc.ph_up_sec > 0 && (
                      <div className="p-4 flex justify-between items-center">
                        <span className="text-slate-400 text-sm">Bơm pH UP</span>
                        <span className="text-white font-bold">{doseCalc.ph_up_sec} giây</span>
                      </div>
                    )}
                    {doseCalc.ph_down_sec > 0 && (
                      <div className="p-4 flex justify-between items-center">
                        <span className="text-slate-400 text-sm">Bơm pH DOWN</span>
                        <span className="text-white font-bold">{doseCalc.ph_down_sec} giây</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-900 grid grid-cols-2 gap-3">
              <button
                onClick={() => confirmStep ? setConfirmStep(false) : setShowSmartModal(false)}
                className="py-4 bg-slate-800 rounded-2xl text-white font-bold hover:bg-slate-700 transition-colors"
              >
                {confirmStep ? 'Quay lại' : 'Hủy'}
              </button>
              <button
                onClick={() => confirmStep ? executeSmartDosing() : setConfirmStep(true)}
                className={`py-4 rounded-2xl text-white font-bold transition-all ${confirmStep ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}
              >
                {confirmStep ? 'Thực Thi' : 'Tiếp Tục'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ControlPanel;
