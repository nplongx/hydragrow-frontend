// src/pages/Settings.tsx
import { useState, useEffect } from 'react';
import {
  Save, Target, ShieldAlert, Waves,
  FlaskConical, Activity, Settings2, ChevronDown, ChevronUp, Power,
  Network
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

const Settings = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // State quản lý Accordion nào đang mở
  const [openSection, setOpenSection] = useState<string | null>('general');

  // --- 1. State: Device Config (Đã đổi thành cấu trúc đối xứng Target/Tolerance) ---
  const [deviceConfig, setDeviceConfig] = useState({
    control_mode: 'auto', is_enabled: 1,
    ec_target: 1.5, ec_tolerance: 0.05,
    ph_target: 6.0, ph_tolerance: 0.5,
    temp_target: 24.0, temp_tolerance: 2.0,
    last_updated: ''
  });

  // --- 2. State: Water Config (Đã dọn dẹp và gom đúng các mốc nước về đây) ---
  const [waterConfig, setWaterConfig] = useState({
    device_id: 'DEVICE_001',
    water_level_target: 80.0, water_level_min: 20.0, water_level_max: 90.0, water_level_drain: 5.0,
    circulation_mode: 'always_on', circulation_on_sec: 1800, circulation_off_sec: 900,
    valve_open_delay_ms: 500
  });

  // --- 3. State: Dosing Config (Giữ nguyên) ---
  const [dosingConfig, setDosingConfig] = useState({
    device_id: 'DEVICE_001',
    tank_volume_l: 50.0, ec_gain_per_ml: 0.1, ph_shift_up_per_ml: 0.2, ph_shift_down_per_ml: 0.2,
    mixing_delay_sec: 300, ec_step_ratio: 0.4, ph_step_ratio: 0.1
  });

  // --- 4. State: Safety Config (Đã thêm min_ec, min_temp, max_temp) ---
  const [safetyConfig, setSafetyConfig] = useState({
    device_id: 'DEVICE_001',
    min_ec_limit: 0.5,
    max_ec_limit: 3.0,
    min_ph_limit: 4.0,
    max_ph_limit: 8.0,
    min_temp_limit: 15.0,
    max_temp_limit: 35.0,
    max_ec_delta: 0.5,
    max_ph_delta: 0.3,
    max_dose_per_cycle: 50.0,
    max_dose_per_hour: 200.0,
    cooldown_sec: 60,
    water_level_critical_min: 10.0,
    max_refill_cycles_per_hour: 3,
    max_drain_cycles_per_hour: 3,
    max_refill_duration_sec: 120,
    max_drain_duration_sec: 120,
    emergency_shutdown: 0,
    last_updated: ''
  });

  // --- 5. State: Sensor Calibration (Giữ nguyên) ---
  const [sensorCalib, setSensorCalib] = useState({
    ph_v7: 2.5, ph_v4: 1.428, ec_factor: 880.0, temp_offset: 0.0, last_updated: ''
  });

  const [appSettings, setAppSettings] = useState({ api_key: 'long', backend_url: 'http://192.168.1.3:8000', device_id: 'DEVICE_001' });

  useEffect(() => {
    const loadAllConfigs = async () => {
      try {
        setIsLoading(true);

        const settings: any = await invoke('load_settings');
        if (settings) {
          setAppSettings(settings);
        }

        const currentDeviceId = settings?.device_id || 'DEVICE_001';

        const [devConf, safeConf, sensCalib, waterConf, dosingCalib]: any[] = await Promise.all([
          invoke('get_device_config', { deviceId: currentDeviceId }).catch(() => null),
          invoke('get_safety_config', { deviceId: currentDeviceId }).catch(() => null),
          invoke('get_sensor_calibration', { deviceId: currentDeviceId }).catch(() => null),
          invoke('get_water_config', { deviceId: currentDeviceId }).catch(() => null),
          invoke('get_dosing_calibration', { deviceId: currentDeviceId }).catch(() => null),
        ]);

        if (devConf) setDeviceConfig(prev => ({ ...prev, ...devConf }));
        if (safeConf) setSafetyConfig(prev => ({ ...prev, ...safeConf }));
        if (sensCalib) setSensorCalib(prev => ({ ...prev, ...sensCalib }));
        if (waterConf) setWaterConfig(prev => ({ ...prev, ...waterConf }));
        if (dosingCalib) setDosingConfig(prev => ({ ...prev, ...dosingCalib }));

      } catch (error) {
        console.error("Lỗi khi load configs:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAllConfigs();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const currentDeviceId = appSettings.device_id;

      await invoke('save_settings', {
        apiKey: appSettings.api_key,
        backendUrl: appSettings.backend_url,
        deviceId: currentDeviceId
      });

      const currentTime = new Date().toISOString();
      const payloadDevice = { ...deviceConfig, device_id: currentDeviceId, last_updated: currentTime };
      const payloadSafety = { ...safetyConfig, device_id: currentDeviceId, last_updated: currentTime };
      const payloadSensor = { ...sensorCalib, device_id: currentDeviceId, last_calibrated: currentTime };
      const payloadWater = { ...waterConfig, device_id: currentDeviceId, last_updated: currentTime };
      const payloadDosing = { ...dosingConfig, device_id: currentDeviceId, last_calibrated: currentTime };

      await Promise.all([
        invoke('update_device_config', { deviceId: currentDeviceId, config: payloadDevice }),
        invoke('update_safety_config', { deviceId: currentDeviceId, config: payloadSafety }),
        invoke('update_sensor_calibration', { deviceId: currentDeviceId, cal: payloadSensor }),
        invoke('update_water_config', { deviceId: currentDeviceId, config: payloadWater }),
        invoke('update_dosing_calibration', { deviceId: currentDeviceId, cal: payloadDosing }),
      ]);

      setSaveMessage({ type: 'success', text: 'Đã đồng bộ toàn bộ cấu hình với hệ thống!' });

      setDeviceConfig(payloadDevice);
      setSafetyConfig(payloadSafety);
      setSensorCalib(payloadSensor);
      setWaterConfig(payloadWater);
      setDosingConfig(payloadDosing);

      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error: any) {
      console.error("Lỗi khi lưu:", error);
      setSaveMessage({ type: 'error', text: typeof error === 'string' ? error : 'Lỗi khi lưu cấu hình.' });
    } finally {
      setIsSaving(false);
    }
  };

  const InputGroup = ({ label, type = "number", value, onChange, step }: any) => (
    <div className="flex flex-col space-y-1">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">{label}</label>
      <input type={type} step={step} value={value} onChange={onChange} className="bg-slate-950 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
    </div>
  );

  const AccordionSection = ({ id, title, icon: Icon, color, children }: any) => {
    const isOpen = openSection === id;
    return (
      <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden transition-all duration-300">
        <button onClick={() => setOpenSection(isOpen ? null : id)} className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 active:bg-slate-800 transition-colors">
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

  if (isLoading) return <div className="flex h-full items-center justify-center"><Activity className="animate-pulse text-emerald-500" size={40} /></div>;

  return (
    <div className="p-4 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Cấu Hình Lõi</h1>
        <p className="text-xs text-slate-400">Quản trị toàn quyền thông số kỹ thuật.</p>
      </div>

      {saveMessage && (
        <div className={`p-3 rounded-xl flex items-center space-x-2 text-sm font-medium ${saveMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          <Settings2 size={16} /><span>{saveMessage.text}</span>
        </div>
      )}

      {/* 0. KẾT NỐI HỆ THỐNG */}
      <AccordionSection id="network" title="Kết Nối Hệ Thống" icon={Network} color="text-slate-400">
        <div className="space-y-3">
          <p className="text-[11px] text-slate-500 italic mb-1">* Cấu hình giao tiếp mạng. Cẩn thận khi thay đổi.</p>
          <InputGroup label="Mã Thiết Bị (Device ID)" type="text" value={appSettings.device_id} onChange={(e: any) => setAppSettings({ ...appSettings, device_id: e.target.value })} />
          <InputGroup label="URL Máy Chủ (Backend API)" type="text" value={appSettings.backend_url} onChange={(e: any) => setAppSettings({ ...appSettings, backend_url: e.target.value })} />
          <InputGroup label="Khóa Bảo Mật (API Key)" type="password" value={appSettings.api_key} onChange={(e: any) => setAppSettings({ ...appSettings, api_key: e.target.value })} />
        </div>
      </AccordionSection>

      {/* 1. CHẾ ĐỘ & TỔNG QUAN */}
      <AccordionSection id="general" title="Chế Độ Hoạt Động" icon={Power} color="text-emerald-400">
        <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div><p className="text-sm font-bold text-white">Kích hoạt Hệ thống</p><p className="text-[10px] text-slate-400">is_enabled</p></div>
          <input type="checkbox" checked={deviceConfig.is_enabled === 1} onChange={(e) => setDeviceConfig({ ...deviceConfig, is_enabled: e.target.checked ? 1 : 0 })} className="toggle-checkbox" />
        </div>
        <div className="flex items-center justify-between bg-red-950/30 p-3 rounded-xl border border-red-900/50">
          <div><p className="text-sm font-bold text-red-400">Dừng Khẩn Cấp</p><p className="text-[10px] text-red-400/70">emergency_shutdown</p></div>
          <input type="checkbox" checked={safetyConfig.emergency_shutdown === 1} onChange={(e) => setSafetyConfig({ ...safetyConfig, emergency_shutdown: e.target.checked ? 1 : 0 })} className="toggle-checkbox border-red-500 checked:bg-red-500" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Chế độ điều khiển</label>
          <select value={deviceConfig.control_mode} onChange={(e) => setDeviceConfig({ ...deviceConfig, control_mode: e.target.value })} className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 outline-none">
            <option value="auto">Tự động (Auto)</option>
            <option value="manual">Thủ công (Manual)</option>
          </select>
        </div>
      </AccordionSection>

      {/* 2. MỤC TIÊU SINH TRƯỞNG (Đã sửa lại Target/Tolerance) */}
      <AccordionSection id="growth" title="Mục Tiêu Sinh Trưởng" icon={Target} color="text-blue-400">
        <div className="grid grid-cols-2 gap-3">
          <InputGroup label="EC Target" step="0.1" value={deviceConfig.ec_target} onChange={(e: any) => setDeviceConfig({ ...deviceConfig, ec_target: parseFloat(e.target.value) })} />
          <InputGroup label="EC Tolerance" step="0.05" value={deviceConfig.ec_tolerance} onChange={(e: any) => setDeviceConfig({ ...deviceConfig, ec_tolerance: parseFloat(e.target.value) })} />

          <InputGroup label="pH Target" step="0.1" value={deviceConfig.ph_target} onChange={(e: any) => setDeviceConfig({ ...deviceConfig, ph_target: parseFloat(e.target.value) })} />
          <InputGroup label="pH Tolerance" step="0.05" value={deviceConfig.ph_tolerance} onChange={(e: any) => setDeviceConfig({ ...deviceConfig, ph_tolerance: parseFloat(e.target.value) })} />

          <InputGroup label="Temp Target (°C)" step="0.5" value={deviceConfig.temp_target} onChange={(e: any) => setDeviceConfig({ ...deviceConfig, temp_target: parseFloat(e.target.value) })} />
          <InputGroup label="Temp Tolerance" step="0.5" value={deviceConfig.temp_tolerance} onChange={(e: any) => setDeviceConfig({ ...deviceConfig, temp_tolerance: parseFloat(e.target.value) })} />
        </div>
      </AccordionSection>

      {/* 3. CẤU HÌNH NƯỚC (Đã map đúng vào waterConfig) */}
      <AccordionSection id="water" title="Quản Lý Nước & Tuần Hoàn" icon={Waves} color="text-cyan-400">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <InputGroup label="Target Lvl (%)" value={waterConfig.water_level_target} onChange={(e: any) => setWaterConfig({ ...waterConfig, water_level_target: parseFloat(e.target.value) })} />
          <InputGroup label="Min Lvl (%)" value={waterConfig.water_level_min} onChange={(e: any) => setWaterConfig({ ...waterConfig, water_level_min: parseFloat(e.target.value) })} />
          <InputGroup label="Max Lvl (%)" value={waterConfig.water_level_max} onChange={(e: any) => setWaterConfig({ ...waterConfig, water_level_max: parseFloat(e.target.value) })} />
          <InputGroup label="Drain Lvl (%)" value={waterConfig.water_level_drain} onChange={(e: any) => setWaterConfig({ ...waterConfig, water_level_drain: parseFloat(e.target.value) })} />
        </div>
        <div className="space-y-1 mb-3">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Chế độ Tuần Hoàn</label>
          <select value={waterConfig.circulation_mode} onChange={(e) => setWaterConfig({ ...waterConfig, circulation_mode: e.target.value })} className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 outline-none">
            <option value="always_on">Luôn bật (Always On)</option>
            <option value="scheduled">Theo lịch trình (Scheduled)</option>
            <option value="temp_triggered">Kích hoạt theo nhiệt độ</option>
          </select>
        </div>
        {waterConfig.circulation_mode === 'scheduled' && (
          <div className="grid grid-cols-2 gap-3">
            <InputGroup label="Bật (Giây)" value={waterConfig.circulation_on_sec} onChange={(e: any) => setWaterConfig({ ...waterConfig, circulation_on_sec: parseInt(e.target.value) })} />
            <InputGroup label="Tắt (Giây)" value={waterConfig.circulation_off_sec} onChange={(e: any) => setWaterConfig({ ...waterConfig, circulation_off_sec: parseInt(e.target.value) })} />
          </div>
        )}
      </AccordionSection>

      {/* 4. ĐỊNH LƯỢNG */}
      <AccordionSection id="dosing" title="Định Lượng & Pha Chế" icon={FlaskConical} color="text-fuchsia-400">
        <div className="grid grid-cols-2 gap-3">
          <InputGroup label="Thể tích bồn (L)" value={dosingConfig.tank_volume_l} onChange={(e: any) => setDosingConfig({ ...dosingConfig, tank_volume_l: parseFloat(e.target.value) })} />
          <InputGroup label="Mixing Delay (s)" value={dosingConfig.mixing_delay_sec} onChange={(e: any) => setDosingConfig({ ...dosingConfig, mixing_delay_sec: parseInt(e.target.value) })} />
          <InputGroup label="EC Gain/ml" step="0.01" value={dosingConfig.ec_gain_per_ml} onChange={(e: any) => setDosingConfig({ ...dosingConfig, ec_gain_per_ml: parseFloat(e.target.value) })} />
          <InputGroup label="EC Step Ratio" step="0.1" value={dosingConfig.ec_step_ratio} onChange={(e: any) => setDosingConfig({ ...dosingConfig, ec_step_ratio: parseFloat(e.target.value) })} />
          <InputGroup label="pH Shift UP/ml" step="0.01" value={dosingConfig.ph_shift_up_per_ml} onChange={(e: any) => setDosingConfig({ ...dosingConfig, ph_shift_up_per_ml: parseFloat(e.target.value) })} />
          <InputGroup label="pH Shift DOWN/ml" step="0.01" value={dosingConfig.ph_shift_down_per_ml} onChange={(e: any) => setDosingConfig({ ...dosingConfig, ph_shift_down_per_ml: parseFloat(e.target.value) })} />
        </div>
      </AccordionSection>

      {/* 5. AN TOÀN (Bổ sung đầy đủ EC, Temp, pH Cảnh báo) */}
      <AccordionSection id="safety" title="Giới Hạn & An Toàn" icon={ShieldAlert} color="text-orange-400">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><p className="text-xs font-bold text-slate-300 mt-2 border-b border-slate-700 pb-1">Giới Hạn Dinh Dưỡng & pH</p></div>
          <InputGroup label="Max Dose/Cycle (ml)" value={safetyConfig.max_dose_per_cycle} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, max_dose_per_cycle: parseFloat(e.target.value) })} />
          <InputGroup label="Max Dose/Hour (ml)" value={safetyConfig.max_dose_per_hour} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, max_dose_per_hour: parseFloat(e.target.value) })} />
          <InputGroup label="Max EC Lệch/lần" step="0.1" value={safetyConfig.max_ec_delta} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, max_ec_delta: parseFloat(e.target.value) })} />
          <InputGroup label="Max pH Lệch/lần" step="0.1" value={safetyConfig.max_ph_delta} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, max_ph_delta: parseFloat(e.target.value) })} />

          <div className="col-span-2"><p className="text-xs font-bold text-slate-300 mt-2 border-b border-slate-700 pb-1">Báo Động Ngưỡng Cứng</p></div>
          <InputGroup label="EC Nguy Hiểm (Min)" step="0.1" value={safetyConfig.min_ec_limit} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, min_ec_limit: parseFloat(e.target.value) })} />
          <InputGroup label="EC Nguy Hiểm (Max)" step="0.1" value={safetyConfig.max_ec_limit} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, max_ec_limit: parseFloat(e.target.value) })} />
          <InputGroup label="pH Nguy Hiểm (Min)" step="0.1" value={safetyConfig.min_ph_limit} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, min_ph_limit: parseFloat(e.target.value) })} />
          <InputGroup label="pH Nguy Hiểm (Max)" step="0.1" value={safetyConfig.max_ph_limit} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, max_ph_limit: parseFloat(e.target.value) })} />
          <InputGroup label="Temp Nguy Hiểm (Min)" step="0.5" value={safetyConfig.min_temp_limit} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, min_temp_limit: parseFloat(e.target.value) })} />
          <InputGroup label="Temp Nguy Hiểm (Max)" step="0.5" value={safetyConfig.max_temp_limit} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, max_temp_limit: parseFloat(e.target.value) })} />

          <div className="col-span-2"><p className="text-xs font-bold text-slate-300 mt-2 border-b border-slate-700 pb-1">Giới Hạn Nước & Bơm</p></div>
          <InputGroup label="Mức nước Critical (%)" value={safetyConfig.water_level_critical_min} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, water_level_critical_min: parseFloat(e.target.value) })} />
          <InputGroup label="Thời gian nghỉ bơm (s)" value={safetyConfig.cooldown_sec} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, cooldown_sec: parseInt(e.target.value) })} />
          <InputGroup label="Bơm Nước Max/Giờ" value={safetyConfig.max_refill_cycles_per_hour} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, max_refill_cycles_per_hour: parseInt(e.target.value) })} />
          <InputGroup label="Xả Nước Max/Giờ" value={safetyConfig.max_drain_cycles_per_hour} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, max_drain_cycles_per_hour: parseInt(e.target.value) })} />
          <InputGroup label="Thời gian Bơm Max (s)" value={safetyConfig.max_refill_duration_sec} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, max_refill_duration_sec: parseInt(e.target.value) })} />
          <InputGroup label="Thời gian Xả Max (s)" value={safetyConfig.max_drain_duration_sec} onChange={(e: any) => setSafetyConfig({ ...safetyConfig, max_drain_duration_sec: parseInt(e.target.value) })} />
        </div>
      </AccordionSection>

      {/* 6. HIỆU CHUẨN ĐẦU DÒ */}
      <AccordionSection id="sensor" title="Hiệu Chuẩn Cảm Biến" icon={Activity} color="text-indigo-400">
        <div className="grid grid-cols-2 gap-3">
          <InputGroup label="Điện thế pH v7" step="0.01" value={sensorCalib.ph_v7} onChange={(e: any) => setSensorCalib({ ...sensorCalib, ph_v7: parseFloat(e.target.value) })} />
          <InputGroup label="Điện thế pH v4" step="0.01" value={sensorCalib.ph_v4} onChange={(e: any) => setSensorCalib({ ...sensorCalib, ph_v4: parseFloat(e.target.value) })} />
          <InputGroup label="EC Factor (K)" step="1.0" value={sensorCalib.ec_factor} onChange={(e: any) => setSensorCalib({ ...sensorCalib, ec_factor: parseFloat(e.target.value) })} />
          <InputGroup label="Bù trừ Nhiệt độ" step="0.1" value={sensorCalib.temp_offset} onChange={(e: any) => setSensorCalib({ ...sensorCalib, temp_offset: parseFloat(e.target.value) })} />
        </div>
      </AccordionSection>

      {/* NÚT LƯU LUÔN NỔI */}
      <div className="fixed bottom-32 left-4 right-4 z-50">
        <button onClick={handleSave} disabled={isSaving} className="w-full bg-emerald-500 text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2">
          {isSaving ? <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></span> : <><Save size={20} /><span>Lưu Cấu Hình SQL</span></>}
        </button>
      </div>
    </div>
  );
};

export default Settings;
