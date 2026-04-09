// src/pages/Settings.tsx
import { useState, useEffect } from 'react';
import {
  Save, Target, ShieldAlert, Waves,
  FlaskConical, Activity, Settings2, ChevronDown, ChevronUp, Power,
  Network
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  colorClass?: string;
}

// --- COMPONENTS PHỤ ---

const InputGroup = ({ label, type = "number", value, onChange, step, desc }: any) => (
  <div className="flex flex-col space-y-1">
    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">{label}</label>
    <input
      type={type}
      step={step}
      value={value}
      onChange={onChange}
      className="bg-slate-950 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
    />
    {desc && <span className="text-[10px] text-slate-500 pl-1 leading-tight">{desc}</span>}
  </div>
);

// Component mới giúp gom nhóm UI bớt ngộp
const SubCard = ({ title, children, className = "" }: any) => (
  <div className={`bg-slate-950/40 border border-slate-800/60 rounded-xl p-3 ${className}`}>
    {title && <h3 className="text-[11px] font-semibold text-slate-400 mb-3 uppercase tracking-wider">{title}</h3>}
    {children}
  </div>
);

const ToggleSwitch = ({ checked, onChange, colorClass = "bg-emerald-500" }: ToggleSwitchProps) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${checked ? colorClass : 'bg-slate-700'}`}
  >
    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
  </button>
);

const AccordionSection = ({ id, title, icon: Icon, color, children, isOpen, onToggle }: any) => {
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden transition-all duration-300">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 active:bg-slate-800 transition-colors">
        <div className={`flex items-center space-x-3 ${color}`}>
          <Icon size={20} />
          <h2 className="text-sm font-bold text-white">{title}</h2>
        </div>
        {isOpen ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
      </button>
      {isOpen && <div className="p-4 space-y-4 border-t border-slate-800 animate-in slide-in-from-top-2 duration-200">{children}</div>}
    </section>
  );
};

// --- COMPONENT CHÍNH ---
const Settings = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [openSection, setOpenSection] = useState<string | null>('general');

  const handleToggleSection = (id: string) => setOpenSection(openSection === id ? null : id);

  const [deviceConfig, setDeviceConfig] = useState({
    control_mode: 'auto',
    is_enabled: 1,
    ec_target: 1.5,
    ec_tolerance: 0.05,
    ph_target: 6.0,
    ph_tolerance: 0.5,
    temp_target: 24.0,
    temp_tolerance: 2.0,
    last_updated: '',

    // --- CÁC TRƯỜNG ĐÃ ĐƯỢC BỔ SUNG THÊM ---
    ec_ack_threshold: 0.05,
    ph_ack_threshold: 0.1,
    water_ack_threshold: 0.5,
    soft_start_duration: 3000,
    misting_on_duration_ms: 10000,
    misting_off_duration_ms: 180000,
    misting_temp_threshold: 30.0,
    high_temp_misting_on_duration_ms: 15000,
    high_temp_misting_off_duration_ms: 60000,

    dosing_pwm_percent: 50,
    osaka_mixing_pwm_percent: 60,
    osaka_misting_pwm_percent: 100,

    active_mixing_sec: 5,
    sensor_stabilize_sec: 5,
    scheduled_mixing_interval_sec: 3600,
    scheduled_mixing_duration_sec: 300
  });

  const [waterConfig, setWaterConfig] = useState({
    device_id: 'DEVICE_001', water_level_min: 20.0, water_level_target: 80.0, water_level_max: 90.0, water_level_drain: 5.0,
    circulation_mode: 'always_on', circulation_on_sec: 1800, circulation_off_sec: 900, water_level_tolerance: 5.0,
    auto_refill_enabled: 1, auto_drain_overflow: 1, auto_dilute_enabled: 0, dilute_drain_amount_cm: 5.0,
    scheduled_water_change_enabled: 0, water_change_interval_sec: 86400, scheduled_drain_amount_cm: 10.0, last_updated: ''
  });

  const [dosingConfig, setDosingConfig] = useState({
    device_id: 'DEVICE_001', tank_volume_l: 50.0, ec_gain_per_ml: 0.1, ph_shift_up_per_ml: 0.2, ph_shift_down_per_ml: 0.2,
    mixing_delay_sec: 300, ec_step_ratio: 0.4, ph_step_ratio: 0.1, pump_capacity_ml_per_sec: 1.5, last_calibrated: ''
  });

  const [safetyConfig, setSafetyConfig] = useState({
    device_id: 'DEVICE_001', min_ec_limit: 0.5, max_ec_limit: 3.0, min_ph_limit: 4.0, max_ph_limit: 8.0,
    min_temp_limit: 15.0, max_temp_limit: 35.0, max_ec_delta: 0.5, max_ph_delta: 0.3, max_dose_per_cycle: 50.0, max_dose_per_hour: 200.0,
    cooldown_sec: 60, water_level_critical_min: 10.0, max_refill_cycles_per_hour: 3, max_drain_cycles_per_hour: 3,
    max_refill_duration_sec: 120, max_drain_duration_sec: 120, emergency_shutdown: 0, last_updated: ''
  });

  const [sensorCalib, setSensorCalib] = useState({
    device_id: 'DEVICE_001',
    ph_v7: 2.5, ph_v4: 1.428, ec_factor: 880.0, ec_offset: 0.0, temp_offset: 0.0, temp_compensation_beta: 0.02,
    sampling_interval: 1000, publish_interval: 5000, moving_average_window: 10,
    is_ph_enabled: 1, is_ec_enabled: 1, is_temp_enabled: 1, is_water_level_enabled: 1, last_calibrated: ''
  });

  const [appSettings, setAppSettings] = useState({
    api_key: 'long', backend_url: 'http://192.168.1.3:8000', device_id: 'DEVICE_001'
  });

  useEffect(() => {
    const loadAllConfigs = async () => {
      try {
        setIsLoading(true);
        let settings: any = null;
        try { settings = await invoke('load_settings'); if (settings) setAppSettings(settings); } catch (e) { }

        const currentDeviceId = settings?.device_id || appSettings.device_id;
        const reqArgs = { deviceId: currentDeviceId };

        const [devConf, safeConf, sensCalib, waterConf, dosingCalib]: any[] = await Promise.all([
          invoke('get_device_config', reqArgs).catch(() => null),
          invoke('get_safety_config', reqArgs).catch(() => null),
          invoke('get_sensor_calibration', reqArgs).catch(() => null),
          invoke('get_water_config', reqArgs).catch(() => null),
          invoke('get_dosing_calibration', reqArgs).catch(() => null),
        ]);

        if (devConf) setDeviceConfig(prev => ({ ...prev, ...devConf }));
        if (safeConf) setSafetyConfig(prev => ({ ...prev, ...safeConf }));
        if (sensCalib) setSensorCalib(prev => ({ ...prev, ...sensCalib }));
        if (waterConf) setWaterConfig(prev => ({ ...prev, ...waterConf }));
        if (dosingCalib) setDosingConfig(prev => ({ ...prev, ...dosingCalib }));
      } catch (error) { console.error(error); } finally { setIsLoading(false); }
    };
    loadAllConfigs();
  }, []);

  const handleSave = async () => {
    setIsSaving(true); setSaveMessage(null);
    try {
      const devId = appSettings.device_id;
      try { await invoke('save_settings', { apiKey: appSettings.api_key, backendUrl: appSettings.backend_url, deviceId: devId }); } catch (e) { }

      const ts = new Date().toISOString();
      await Promise.all([
        invoke('update_device_config', { deviceId: devId, config: { ...deviceConfig, device_id: devId, last_updated: ts } }),
        invoke('update_safety_config', { deviceId: devId, config: { ...safetyConfig, device_id: devId, last_updated: ts } }),
        invoke('update_sensor_calibration', { deviceId: devId, config: { ...sensorCalib, device_id: devId, last_calibrated: ts } }),
        invoke('update_water_config', { deviceId: devId, config: { ...waterConfig, device_id: devId, last_updated: ts } }),
        invoke('update_dosing_calibration', { deviceId: devId, config: { ...dosingConfig, device_id: devId, last_calibrated: ts } }),
      ]);

      setSaveMessage({ type: 'success', text: 'Đã lưu cấu hình thành công!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error: any) {
      setSaveMessage({ type: 'error', text: 'Lỗi khi lưu cấu hình.' });
    } finally { setIsSaving(false); }
  };

  if (isLoading) return <div className="flex h-full items-center justify-center"><Activity className="animate-pulse text-emerald-500" size={40} /></div>;

  return (
    <div className="p-4 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      <div><h1 className="text-2xl font-bold tracking-tight text-white">Cấu Hình Lõi</h1></div>

      {saveMessage && (
        <div className={`p-3 rounded-xl flex items-center space-x-2 text-sm font-medium ${saveMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          <Settings2 size={16} /><span>{saveMessage.text}</span>
        </div>
      )}

      {/* 0. KẾT NỐI HỆ THỐNG */}
      <AccordionSection id="network" title="Kết Nối Hệ Thống" icon={Network} color="text-slate-400" isOpen={openSection === 'network'} onToggle={() => handleToggleSection('network')}>
        <div className="space-y-3">
          <InputGroup label="Mã Thiết Bị (Device ID)" type="text" value={appSettings.device_id} onChange={(e: any) => setAppSettings({ ...appSettings, device_id: e.target.value })} />
          <InputGroup label="URL Máy Chủ (Backend API)" type="text" value={appSettings.backend_url} onChange={(e: any) => setAppSettings({ ...appSettings, backend_url: e.target.value })} />
          <InputGroup label="Khóa Bảo Mật (API Key)" type="password" value={appSettings.api_key} onChange={(e: any) => setAppSettings({ ...appSettings, api_key: e.target.value })} />
        </div>
      </AccordionSection>

      {/* 1. CHẾ ĐỘ & TỔNG QUAN */}
      <AccordionSection id="general" title="Chế Độ Hoạt Động" icon={Power} color="text-emerald-400" isOpen={openSection === 'general'} onToggle={() => handleToggleSection('general')}>
        <div className="flex items-center justify-between bg-emerald-950/20 p-4 rounded-xl border border-emerald-900/50">
          <div><p className="text-sm font-bold text-white">Kích hoạt Hệ thống</p><p className="text-[10px] text-slate-400 mt-1">Bật/tắt toàn bộ tính năng tự động</p></div>
          <input type="checkbox" checked={deviceConfig.is_enabled === 1} onChange={(e) => setDeviceConfig({ ...deviceConfig, is_enabled: e.target.checked ? 1 : 0 })} className="toggle-checkbox" />
        </div>
        <div className="flex items-center justify-between bg-red-950/30 p-4 rounded-xl border border-red-900/50 mt-3">
          <div><p className="text-sm font-bold text-red-400">Dừng Khẩn Cấp (E-Stop)</p><p className="text-[10px] text-slate-400 mt-1">Ngắt ngay lập tức mọi bơm và van</p></div>
          <input type="checkbox" checked={safetyConfig.emergency_shutdown === 1} onChange={(e) => setSafetyConfig({ ...safetyConfig, emergency_shutdown: e.target.checked ? 1 : 0 })} className="toggle-checkbox border-red-500 checked:bg-red-500" />
        </div>
        <div className="mt-4">
          <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block pl-1">Chế độ điều khiển</label>
          <div className="flex space-x-2">
            <button onClick={() => setDeviceConfig({ ...deviceConfig, control_mode: 'auto' })} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${deviceConfig.control_mode === 'auto' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Tự động</button>
            <button onClick={() => setDeviceConfig({ ...deviceConfig, control_mode: 'manual' })} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${deviceConfig.control_mode === 'manual' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Thủ công</button>
          </div>
        </div>
      </AccordionSection>

      {/* 2. MỤC TIÊU SINH TRƯỞNG & PHUN SƯƠNG */}
      <AccordionSection id="growth" title="Mục Tiêu Sinh Trưởng & Khí Hậu" icon={Target} color="text-blue-400" isOpen={openSection === 'growth'} onToggle={() => handleToggleSection('growth')}>
        <SubCard title="Dinh Dưỡng (EC)">
          <div className="grid grid-cols-2 gap-3">
            <InputGroup label="Mức mong muốn" step="0.1" value={deviceConfig.ec_target} onChange={(e: any) => setDeviceConfig({ ...deviceConfig, ec_target: parseFloat(e.target.value) })} />
            <InputGroup label="Độ sai số (±)" step="0.05" value={deviceConfig.ec_tolerance} onChange={(e: any) => setDeviceConfig({ ...deviceConfig, ec_tolerance: parseFloat(e.target.value) })} />
          </div>
        </SubCard>

        <SubCard title="Độ pH" className="mt-3">
          <div className="grid grid-cols-2 gap-3">
            <InputGroup label="Mức mong muốn" step="0.1" value={deviceConfig.ph_target} onChange={(e: any) => setDeviceConfig({ ...deviceConfig, ph_target: parseFloat(e.target.value) })} />
            <InputGroup label="Độ sai số (±)" step="0.05" value={deviceConfig.ph_tolerance} onChange={(e: any) => setDeviceConfig({ ...deviceConfig, ph_tolerance: parseFloat(e.target.value) })} />
          </div>
        </SubCard>

        <SubCard title="Phun Sương Làm Mát (Misting)" className="mt-3 border-blue-500/30">
          <div className="grid grid-cols-2 gap-3">
            <InputGroup label="Nhiệt độ cảnh báo (°C)" step="0.5" value={deviceConfig.misting_temp_threshold} onChange={(e: any) => setDeviceConfig({ ...deviceConfig, misting_temp_threshold: parseFloat(e.target.value) })} desc="Vượt ngưỡng này sẽ chạy chế độ NÓNG." />
            <InputGroup label="Ngưỡng môi trường (°C)" step="0.5" value={deviceConfig.temp_target} onChange={(e: any) => setDeviceConfig({ ...deviceConfig, temp_target: parseFloat(e.target.value) })} />

            <div className="col-span-2 pt-2 pb-1"><p className="text-[10px] text-blue-400 font-bold uppercase">Nhịp bình thường</p></div>
            <InputGroup label="Thời gian Phun (ms)" step="1000" value={deviceConfig.misting_on_duration_ms} onChange={(e: any) => setDeviceConfig({ ...deviceConfig, misting_on_duration_ms: parseInt(e.target.value) })} />
            <InputGroup label="Thời gian Nghỉ (ms)" step="1000" value={deviceConfig.misting_off_duration_ms} onChange={(e: any) => setDeviceConfig({ ...deviceConfig, misting_off_duration_ms: parseInt(e.target.value) })} />

            <div className="col-span-2 pt-2 pb-1 border-t border-slate-800"><p className="text-[10px] text-red-400 font-bold uppercase">Nhịp khi nhiệt độ CAO</p></div>
            <InputGroup label="Phun khi Nóng (ms)" step="1000" value={deviceConfig.high_temp_misting_on_duration_ms} onChange={(e: any) => setDeviceConfig({ ...deviceConfig, high_temp_misting_on_duration_ms: parseInt(e.target.value) })} />
            <InputGroup label="Nghỉ khi Nóng (ms)" step="1000" value={deviceConfig.high_temp_misting_off_duration_ms} onChange={(e: any) => setDeviceConfig({ ...deviceConfig, high_temp_misting_off_duration_ms: parseInt(e.target.value) })} />
          </div>
        </SubCard>
      </AccordionSection>

      {/* 3. CẤU HÌNH NƯỚC */}
      <AccordionSection id="water" title="Quản Lý Nước & Tuần Hoàn" icon={Waves} color="text-cyan-400" isOpen={openSection === 'water'} onToggle={() => handleToggleSection('water')}>
        <SubCard title="Mức Nước (%)">
          <div className="grid grid-cols-2 gap-3">
            <InputGroup label="Mục tiêu" value={waterConfig.water_level_target} onChange={(e: any) => setWaterConfig({ ...waterConfig, water_level_target: parseFloat(e.target.value) })} />
            <InputGroup label="Sai số cho phép" value={waterConfig.water_level_tolerance} onChange={(e: any) => setWaterConfig({ ...waterConfig, water_level_tolerance: parseFloat(e.target.value) })} />
            <InputGroup label="Giới hạn Dưới" value={waterConfig.water_level_min} onChange={(e: any) => setWaterConfig({ ...waterConfig, water_level_min: parseFloat(e.target.value) })} />
            <InputGroup label="Giới hạn Trên (Tràn)" value={waterConfig.water_level_max} onChange={(e: any) => setWaterConfig({ ...waterConfig, water_level_max: parseFloat(e.target.value) })} />
          </div>
        </SubCard>

        <SubCard title="Tự động hóa Nước" className="mt-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white">Bơm đầy tự động</span>
              <input type="checkbox" checked={waterConfig.auto_refill_enabled === 1} onChange={(e) => setWaterConfig({ ...waterConfig, auto_refill_enabled: e.target.checked ? 1 : 0 })} className="toggle-checkbox scale-90" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white">Xả tràn tự động</span>
              <input type="checkbox" checked={waterConfig.auto_drain_overflow === 1} onChange={(e) => setWaterConfig({ ...waterConfig, auto_drain_overflow: e.target.checked ? 1 : 0 })} className="toggle-checkbox scale-90" />
            </div>

            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-white">Tự động pha loãng (Dilute)</span>
                  <p className="text-[10px] text-slate-400">Xả bớt nước nếu nồng độ quá cao</p>
                </div>
                <input type="checkbox" checked={waterConfig.auto_dilute_enabled === 1} onChange={(e) => setWaterConfig({ ...waterConfig, auto_dilute_enabled: e.target.checked ? 1 : 0 })} className="toggle-checkbox scale-90" />
              </div>
              {waterConfig.auto_dilute_enabled === 1 && (
                <div className="mt-3 pl-3 border-l-2 border-emerald-500/50 animate-in fade-in">
                  <InputGroup
                    label="Lượng nước xả đi mỗi lần (cm)"
                    step="0.5"
                    value={waterConfig.dilute_drain_amount_cm}
                    onChange={(e: any) => setWaterConfig({ ...waterConfig, dilute_drain_amount_cm: parseFloat(e.target.value) })}
                    desc="Hệ thống sẽ xả mức này rồi bơm lại nước sạch để làm loãng."
                  />
                </div>
              )}
            </div>
          </div>
        </SubCard>

        <SubCard title="Lịch Trình Thay Nước" className="mt-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-white">Bật lịch trình</span>
            <input type="checkbox" checked={waterConfig.scheduled_water_change_enabled === 1} onChange={(e) => setWaterConfig({ ...waterConfig, scheduled_water_change_enabled: e.target.checked ? 1 : 0 })} className="toggle-checkbox scale-90" />
          </div>
          {waterConfig.scheduled_water_change_enabled === 1 && (
            <div className="grid grid-cols-2 gap-3 animate-in fade-in">
              <InputGroup label="Chu kỳ (Giây)" value={waterConfig.water_change_interval_sec} onChange={(e: any) => setWaterConfig({ ...waterConfig, water_change_interval_sec: parseInt(e.target.value) })} />
              <InputGroup label="Lượng xả (cm)" value={waterConfig.scheduled_drain_amount_cm} onChange={(e: any) => setWaterConfig({ ...waterConfig, scheduled_drain_amount_cm: parseFloat(e.target.value) })} />
            </div>
          )}
        </SubCard>
      </AccordionSection>

      {/* 4. ĐỊNH LƯỢNG */}
      <AccordionSection id="dosing" title="Định Lượng & Pha Chế" icon={FlaskConical} color="text-fuchsia-400" isOpen={openSection === 'dosing'} onToggle={() => handleToggleSection('dosing')}>

        <SubCard title="Tốc Độ Bơm (PWM & Soft Start)">
          <div className="grid grid-cols-2 gap-3">
            <InputGroup label="Bơm Vi Lượng (%)" step="1" value={deviceConfig.dosing_pwm_percent} onChange={(e: any) => setDeviceConfig({ ...deviceConfig, dosing_pwm_percent: parseInt(e.target.value) })} />
            <InputGroup label="Bơm Trộn Osaka (%)" step="1" value={deviceConfig.osaka_mixing_pwm_percent} onChange={(e: any) => setDeviceConfig({ ...deviceConfig, osaka_mixing_pwm_percent: parseInt(e.target.value) })} />
            <InputGroup label="Bơm Sương Osaka (%)" step="1" value={deviceConfig.osaka_misting_pwm_percent} onChange={(e: any) => setDeviceConfig({ ...deviceConfig, osaka_misting_pwm_percent: parseInt(e.target.value) })} />
            <InputGroup label="Khởi động mềm (ms)" step="100" value={deviceConfig.soft_start_duration} onChange={(e: any) => setDeviceConfig({ ...deviceConfig, soft_start_duration: parseInt(e.target.value) })} desc="Giảm giật bơm" />
          </div>
        </SubCard>

        <SubCard title="Lịch Trình Khuấy (Jet Mixing)" className="mt-3">
          <div className="grid grid-cols-2 gap-3">
            <InputGroup label="Chu kỳ khuấy định kỳ (s)" step="60" value={deviceConfig.scheduled_mixing_interval_sec} onChange={(e: any) => setDeviceConfig({ ...deviceConfig, scheduled_mixing_interval_sec: parseInt(e.target.value) })} />
            <InputGroup label="Thời gian khuấy mỗi lần (s)" step="10" value={deviceConfig.scheduled_mixing_duration_sec} onChange={(e: any) => setDeviceConfig({ ...deviceConfig, scheduled_mixing_duration_sec: parseInt(e.target.value) })} />
            <InputGroup label="Khuấy chủ động (s)" step="1" value={deviceConfig.active_mixing_sec} onChange={(e: any) => setDeviceConfig({ ...deviceConfig, active_mixing_sec: parseInt(e.target.value) })} desc="Khuấy ngay khi châm phân" />
            <InputGroup label="Thời gian chờ Ổn định (s)" step="1" value={deviceConfig.sensor_stabilize_sec} onChange={(e: any) => setDeviceConfig({ ...deviceConfig, sensor_stabilize_sec: parseInt(e.target.value) })} desc="Chờ cảm biến đọc chuẩn sau khi trộn" />
          </div>
        </SubCard>

        <SubCard title="Công thức Dinh Dưỡng" className="mt-3">
          <div className="grid grid-cols-2 gap-3">
            <InputGroup label="Thể tích bồn (L)" value={dosingConfig.tank_volume_l} onChange={(e: any) => setDosingConfig({ ...dosingConfig, tank_volume_l: parseFloat(e.target.value) })} />
            <InputGroup label="Công suất Bơm (ml/s)" value={dosingConfig.pump_capacity_ml_per_sec} onChange={(e: any) => setDosingConfig({ ...dosingConfig, pump_capacity_ml_per_sec: parseFloat(e.target.value) })} desc="Lưu lượng thực tế của bơm." />
            <InputGroup label="EC tăng thêm / 1ml" step="0.01" value={dosingConfig.ec_gain_per_ml} onChange={(e: any) => setDosingConfig({ ...dosingConfig, ec_gain_per_ml: parseFloat(e.target.value) })} />
            <InputGroup label="Hệ số bù EC (Ratio)" step="0.1" value={dosingConfig.ec_step_ratio} onChange={(e: any) => setDosingConfig({ ...dosingConfig, ec_step_ratio: parseFloat(e.target.value) })} />
          </div>
        </SubCard>

        <SubCard title="Công thức pH" className="mt-3">
          <div className="grid grid-cols-2 gap-3">
            <InputGroup label="pH TĂNG / 1ml (UP)" step="0.01" value={dosingConfig.ph_shift_up_per_ml} onChange={(e: any) => setDosingConfig({ ...dosingConfig, ph_shift_up_per_ml: parseFloat(e.target.value) })} />
            <InputGroup label="pH GIẢM / 1ml (DOWN)" step="0.01" value={dosingConfig.ph_shift_down_per_ml} onChange={(e: any) => setDosingConfig({ ...dosingConfig, ph_shift_down_per_ml: parseFloat(e.target.value) })} />
          </div>
        </SubCard>
      </AccordionSection>

      {/* 5. AN TOÀN */}
      <AccordionSection id="safety" title="Giới Hạn & An Toàn" icon={ShieldAlert} color="text-orange-400" isOpen={openSection === 'safety'} onToggle={() => handleToggleSection('safety')}>
        <SubCard title="Cảnh báo Môi trường (Alarm)">
          <div className="grid grid-cols-2 gap-3">
            <InputGroup label="EC Min (Nguy hiểm)" step="0.1" value={safetyConfig.min_ec_limit} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, min_ec_limit: parseFloat(e.target.value) })} />
            <InputGroup label="EC Max (Nguy hiểm)" step="0.1" value={safetyConfig.max_ec_limit} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, max_ec_limit: parseFloat(e.target.value) })} />
            <InputGroup label="pH Min (Nguy hiểm)" step="0.1" value={safetyConfig.min_ph_limit} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, min_ph_limit: parseFloat(e.target.value) })} />
            <InputGroup label="pH Max (Nguy hiểm)" step="0.1" value={safetyConfig.max_ph_limit} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, max_ph_limit: parseFloat(e.target.value) })} />
            <InputGroup label="Cạn Nước (Critical %)" value={safetyConfig.water_level_critical_min} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, water_level_critical_min: parseFloat(e.target.value) })} />
          </div>
        </SubCard>

        <SubCard title="Bảo vệ Bơm Châm Phân (Dosing)" className="mt-3">
          <div className="grid grid-cols-2 gap-3">
            <InputGroup label="Max 1 chu kỳ (ml)" value={safetyConfig.max_dose_per_cycle} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, max_dose_per_cycle: parseFloat(e.target.value) })} />
            <InputGroup label="Max 1 giờ (ml)" value={safetyConfig.max_dose_per_hour} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, max_dose_per_hour: parseFloat(e.target.value) })} />
            <InputGroup label="Lệch EC Max/lần" step="0.1" value={safetyConfig.max_ec_delta} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, max_ec_delta: parseFloat(e.target.value) })} />
            <InputGroup label="Lệch pH Max/lần" step="0.1" value={safetyConfig.max_ph_delta} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, max_ph_delta: parseFloat(e.target.value) })} />
            <div className="col-span-2">
              <InputGroup label="Khóa Bơm Tạm Thời (s)" value={safetyConfig.cooldown_sec} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, cooldown_sec: parseInt(e.target.value) })} desc="Thời gian nghỉ bắt buộc giữa 2 lần bơm liên tiếp." />
            </div>
          </div>
        </SubCard>

        <SubCard title="Bảo vệ Bơm Nước Chếnh" className="mt-3">
          <div className="grid grid-cols-2 gap-3">
            <InputGroup label="Giới hạn Bơm vào/giờ" value={safetyConfig.max_refill_cycles_per_hour} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, max_refill_cycles_per_hour: parseInt(e.target.value) })} />
            <InputGroup label="Thời gian chạy Max (s)" value={safetyConfig.max_refill_duration_sec} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, max_refill_duration_sec: parseInt(e.target.value) })} />
            <InputGroup label="Giới hạn Xả đi/giờ" value={safetyConfig.max_drain_cycles_per_hour} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, max_drain_cycles_per_hour: parseInt(e.target.value) })} />
            <InputGroup label="Thời gian xả Max (s)" value={safetyConfig.max_drain_duration_sec} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, max_drain_duration_sec: parseInt(e.target.value) })} />
          </div>
        </SubCard>
      </AccordionSection>

      {/* 6. HIỆU CHUẨN ĐẦU DÒ */}
      <AccordionSection id="sensor" title="Cảm Biến & Lấy Mẫu" icon={Activity} color="text-indigo-400" isOpen={openSection === 'sensor'} onToggle={() => handleToggleSection('sensor')}>

        <SubCard title="Ngưỡng Xác Nhận (ACK Threshold)" className="mb-4">
          <div className="grid grid-cols-2 gap-4">
            <InputGroup label="Sai số EC cho phép" step="0.01" value={deviceConfig.ec_ack_threshold} onChange={(e: any) => setDeviceConfig({ ...deviceConfig, ec_ack_threshold: parseFloat(e.target.value) })} desc="Delta để xác nhận lệnh đã đạt" />
            <InputGroup label="Sai số pH cho phép" step="0.01" value={deviceConfig.ph_ack_threshold} onChange={(e: any) => setDeviceConfig({ ...deviceConfig, ph_ack_threshold: parseFloat(e.target.value) })} />
            <InputGroup label="Sai số Nước (cm)" step="0.1" value={deviceConfig.water_ack_threshold} onChange={(e: any) => setDeviceConfig({ ...deviceConfig, water_ack_threshold: parseFloat(e.target.value) })} />
          </div>
        </SubCard>

        <SubCard title="Kích Hoạt Cảm Biến">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-200 font-medium">Cảm biến pH</span>
              <ToggleSwitch checked={sensorCalib.is_ph_enabled === 1} onChange={(val) => setSensorCalib({ ...sensorCalib, is_ph_enabled: val ? 1 : 0 })} colorClass="bg-indigo-500" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-200 font-medium">Cảm biến Dinh dưỡng (EC)</span>
              <ToggleSwitch checked={sensorCalib.is_ec_enabled === 1} onChange={(val) => setSensorCalib({ ...sensorCalib, is_ec_enabled: val ? 1 : 0 })} colorClass="bg-indigo-500" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-200 font-medium">Cảm biến Nhiệt độ</span>
              <ToggleSwitch checked={sensorCalib.is_temp_enabled === 1} onChange={(val) => setSensorCalib({ ...sensorCalib, is_temp_enabled: val ? 1 : 0 })} colorClass="bg-indigo-500" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-200 font-medium">Cảm biến Mực nước</span>
              <ToggleSwitch checked={sensorCalib.is_water_level_enabled === 1} onChange={(val) => setSensorCalib({ ...sensorCalib, is_water_level_enabled: val ? 1 : 0 })} colorClass="bg-indigo-500" />
            </div>
          </div>
        </SubCard>

        <SubCard title="Tần Suất Lấy Mẫu (Node Sensor)" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputGroup label="Lấy mẫu mỗi (ms)" step="100" value={sensorCalib.sampling_interval} onChange={(e) => setSensorCalib({ ...sensorCalib, sampling_interval: parseInt(e.target.value) })} desc="Tốc độ đọc ADC (vd: 1000 = 1s)" />
            <InputGroup label="Bắn MQTT mỗi (ms)" step="1000" value={sensorCalib.publish_interval} onChange={(e) => setSensorCalib({ ...sensorCalib, publish_interval: parseInt(e.target.value) })} desc="Tốc độ gửi dữ liệu lên Backend" />
            <div className="sm:col-span-2">
              <InputGroup label="Khung Trượt Trung Bình (M.A)" step="1" value={sensorCalib.moving_average_window} onChange={(e) => setSensorCalib({ ...sensorCalib, moving_average_window: parseInt(e.target.value) })} desc="Lọc nhiễu: Lấy trung bình cộng của N lần đọc." />
            </div>
          </div>
        </SubCard>

        <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl mt-4 mb-2 flex items-start space-x-2">
          <FlaskConical size={16} className="text-indigo-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-indigo-300 leading-relaxed">Khu vực Hiệu Chuẩn: Chỉ thay đổi khi bạn đang sử dụng dung dịch chuẩn (Calibration Buffer).</p>
        </div>

        <SubCard title="Hiệu Chuẩn pH & EC">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputGroup label="pH v7 (Voltage)" step="0.01" value={sensorCalib.ph_v7} onChange={(e) => setSensorCalib({ ...sensorCalib, ph_v7: parseFloat(e.target.value) })} />
            <InputGroup label="pH v4 (Voltage)" step="0.01" value={sensorCalib.ph_v4} onChange={(e) => setSensorCalib({ ...sensorCalib, ph_v4: parseFloat(e.target.value) })} />
            <InputGroup label="Hệ số EC (K Factor)" step="1.0" value={sensorCalib.ec_factor} onChange={(e) => setSensorCalib({ ...sensorCalib, ec_factor: parseFloat(e.target.value) })} />
            <InputGroup label="Bù sai số EC (Offset)" step="0.1" value={sensorCalib.ec_offset} onChange={(e) => setSensorCalib({ ...sensorCalib, ec_offset: parseFloat(e.target.value) })} />
          </div>
        </SubCard>

        <SubCard title="Hiệu Chuẩn & Bù Trừ Nhiệt Độ" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputGroup label="Nhiệt độ (Offset °C)" step="0.1" value={sensorCalib.temp_offset} onChange={(e) => setSensorCalib({ ...sensorCalib, temp_offset: parseFloat(e.target.value) })} />
            <InputGroup label="Hệ số bù nhiệt độ (β)" step="0.01" value={sensorCalib.temp_compensation_beta} onChange={(e) => setSensorCalib({ ...sensorCalib, temp_compensation_beta: parseFloat(e.target.value) })} desc="Hệ số tự động tính EC theo nhiệt độ." />
          </div>
        </SubCard>

      </AccordionSection>

      {/* NÚT LƯU LUÔN NỔI */}
      <div className="fixed bottom-32 left-4 right-4 z-50">
        <button onClick={handleSave} disabled={isSaving} className="w-full bg-emerald-500 text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center space-x-2">
          {isSaving ? <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></span> : <><Save size={20} /><span>Lưu Cấu Hình SQL</span></>}
        </button>
      </div>
    </div>
  );
};

export default Settings;
