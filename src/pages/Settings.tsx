import React, { useState, useEffect } from 'react';
import {
  Save, Target, ShieldAlert, Waves,
  FlaskConical, Activity, Settings2, Power, Network
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { fetch } from '@tauri-apps/plugin-http';
import toast from 'react-hot-toast';

// IMPORT CÁC COMPONENT DÙNG CHUNG
import { Switch } from '../components/ui/Switch';
import { InputGroup } from '../components/ui/InputGroup';
import { SubCard } from '../components/ui/SubCard';
import { AccordionSection } from '../components/ui/AccordionSection';

type InputEvent = React.ChangeEvent<HTMLInputElement>;

const Settings = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>('general');

  const handleToggleSection = (id: string) => setOpenSection(openSection === id ? null : id);

  const [config, setConfig] = useState<any>({
    control_mode: 'auto', is_enabled: true,
    ec_target: 1.5, ec_tolerance: 0.05, ph_target: 6.0, ph_tolerance: 0.5, temp_target: 24.0, temp_tolerance: 2.0,
    misting_on_duration_ms: 10000, misting_off_duration_ms: 180000,
    misting_temp_threshold: 30.0, high_temp_misting_on_duration_ms: 15000, high_temp_misting_off_duration_ms: 60000,
    water_level_min: 20.0, water_level_target: 80.0, water_level_max: 90.0, water_level_drain: 5.0,
    circulation_mode: 'always_on', circulation_on_sec: 1800, circulation_off_sec: 900, water_level_tolerance: 5.0,
    auto_refill_enabled: true, auto_drain_overflow: true, auto_dilute_enabled: false, dilute_drain_amount_cm: 5.0,
    scheduled_water_change_enabled: false, water_change_interval_sec: 86400, scheduled_drain_amount_cm: 10.0,
    tank_volume_l: 50.0, ec_gain_per_ml: 0.1, ph_shift_up_per_ml: 0.2, ph_shift_down_per_ml: 0.2,
    dosing_pump_capacity_ml_per_sec: 1.5, ec_step_ratio: 0.4, ph_step_ratio: 0.1,
    active_mixing_sec: 5, sensor_stabilize_sec: 5, scheduled_mixing_interval_sec: 3600, scheduled_mixing_duration_sec: 300,
    dosing_pwm_percent: 50, osaka_mixing_pwm_percent: 60, osaka_misting_pwm_percent: 100, soft_start_duration: 3000,
    min_ec_limit: 0.5, max_ec_limit: 3.0, min_ph_limit: 4.0, max_ph_limit: 8.0,
    min_temp_limit: 15.0, max_temp_limit: 35.0, max_ec_delta: 0.5, max_ph_delta: 0.3,
    max_dose_per_cycle: 50.0, max_dose_per_hour: 200.0, cooldown_sec: 60, water_level_critical_min: 10.0,
    max_refill_cycles_per_hour: 3, max_drain_cycles_per_hour: 3, max_refill_duration_sec: 120, max_drain_duration_sec: 120,
    emergency_shutdown: false, ec_ack_threshold: 0.05, ph_ack_threshold: 0.1, water_ack_threshold: 0.5,
    ph_v7: 2.5, ph_v4: 1.428, ec_factor: 880.0, ec_offset: 0.0, temp_offset: 0.0, temp_compensation_beta: 0.02,
    sampling_interval: 1000, publish_interval: 5000, moving_average_window: 10,
    enable_ph_sensor: true, enable_ec_sensor: true, enable_temp_sensor: true, enable_water_level_sensor: true,
    pump_a_capacity_ml_per_sec: 1.2, pump_b_capacity_ml_per_sec: 1.2, delay_between_a_and_b_sec: 10,
  });

  const [appSettings, setAppSettings] = useState({
    api_key: 'long', backend_url: 'http://192.168.1.3:8000', device_id: 'DEVICE_001'
  });

  const callApi = async (path: string, method: string = 'GET', body: any = null, currentSettings: any = appSettings) => {
    const url = `${currentSettings.backend_url}${path}`;
    const options: any = { method, headers: { 'Content-Type': 'application/json', 'X-API-Key': currentSettings.api_key } };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return await res.json();
  };

  useEffect(() => {
    const loadConfig = async () => {
      try {
        setIsLoading(true);
        let settings: any = null;
        try {
          settings = await invoke('load_settings');
          if (settings) setAppSettings(settings);
        } catch (e) { console.error("Chưa load được store"); }

        const currentDeviceId = settings?.device_id || appSettings.device_id;
        const unifiedData = await callApi(`/api/devices/${currentDeviceId}/config/unified`, 'GET', null, settings).catch(() => null);

        if (unifiedData) {
          setConfig((prev: any) => ({ ...prev, ...unifiedData }));
        }
      } catch (error) {
        console.error("Lỗi khi load cấu hình:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    const toastId = toast.loading("Đang lưu và đồng bộ với ESP32...");

    try {
      const devId = appSettings.device_id;
      try { await invoke('save_settings', { apiKey: appSettings.api_key, backendUrl: appSettings.backend_url, deviceId: devId }); } catch (e) { }

      const ts = new Date().toISOString();

      // 🟢 FIX 400: SQLite và Rust SQLx dùng Integer (1/0) thay vì Boolean (true/false).
      const devConf = {
        device_id: devId,
        control_mode: config.control_mode,
        is_enabled: config.is_enabled ? 1 : 0,
        ec_target: Number(config.ec_target),
        ec_tolerance: Number(config.ec_tolerance),
        ph_target: Number(config.ph_target),
        ph_tolerance: Number(config.ph_tolerance),
        temp_target: Number(config.temp_target),
        temp_tolerance: Number(config.temp_tolerance),
        last_updated: ts,
        pump_a_capacity_ml_per_sec: Number(config.pump_a_capacity_ml_per_sec),
        pump_b_capacity_ml_per_sec: Number(config.pump_b_capacity_ml_per_sec),
        delay_between_a_and_b_sec: Number(config.delay_between_a_and_b_sec),
      };

      const waterConf = {
        device_id: devId,
        water_level_min: Number(config.water_level_min),
        water_level_target: Number(config.water_level_target),
        water_level_max: Number(config.water_level_max),
        water_level_drain: Number(config.water_level_drain),
        circulation_mode: config.circulation_mode,
        circulation_on_sec: Number(config.circulation_on_sec),
        circulation_off_sec: Number(config.circulation_off_sec),
        water_level_tolerance: Number(config.water_level_tolerance),
        auto_refill_enabled: config.auto_refill_enabled ? 1 : 0,
        auto_drain_overflow: config.auto_drain_overflow ? 1 : 0,
        auto_dilute_enabled: config.auto_dilute_enabled ? 1 : 0,
        dilute_drain_amount_cm: Number(config.dilute_drain_amount_cm),
        scheduled_water_change_enabled: config.scheduled_water_change_enabled ? 1 : 0,
        water_change_interval_sec: Number(config.water_change_interval_sec),
        scheduled_drain_amount_cm: Number(config.scheduled_drain_amount_cm),
        misting_on_duration_ms: Number(config.misting_on_duration_ms),
        misting_off_duration_ms: Number(config.misting_off_duration_ms),
        last_updated: ts
      };

      const safeConf = {
        device_id: devId,
        emergency_shutdown: config.emergency_shutdown ? 1 : 0,
        max_ec_limit: Number(config.max_ec_limit),
        min_ec_limit: Number(config.min_ec_limit),
        min_ph_limit: Number(config.min_ph_limit),
        max_ph_limit: Number(config.max_ph_limit),
        max_ec_delta: Number(config.max_ec_delta),
        max_ph_delta: Number(config.max_ph_delta),
        max_dose_per_cycle: Number(config.max_dose_per_cycle),
        cooldown_sec: Number(config.cooldown_sec),
        max_dose_per_hour: Number(config.max_dose_per_hour),
        water_level_critical_min: Number(config.water_level_critical_min),
        max_refill_cycles_per_hour: Number(config.max_refill_cycles_per_hour),
        max_drain_cycles_per_hour: Number(config.max_drain_cycles_per_hour),
        max_refill_duration_sec: Number(config.max_refill_duration_sec),
        max_drain_duration_sec: Number(config.max_drain_duration_sec),
        min_temp_limit: Number(config.min_temp_limit),
        max_temp_limit: Number(config.max_temp_limit),
        ec_ack_threshold: Number(config.ec_ack_threshold),
        ph_ack_threshold: Number(config.ph_ack_threshold),
        water_ack_threshold: Number(config.water_ack_threshold),
        last_updated: ts
      };

      const doseConf = {
        device_id: devId,
        tank_volume_l: Number(config.tank_volume_l),
        ec_gain_per_ml: Number(config.ec_gain_per_ml),
        ph_shift_up_per_ml: Number(config.ph_shift_up_per_ml),
        ph_shift_down_per_ml: Number(config.ph_shift_down_per_ml),
        active_mixing_sec: Number(config.active_mixing_sec),
        sensor_stabilize_sec: Number(config.sensor_stabilize_sec),
        ec_step_ratio: Number(config.ec_step_ratio),
        ph_step_ratio: Number(config.ph_step_ratio),
        dosing_pump_capacity_ml_per_sec: Number(config.dosing_pump_capacity_ml_per_sec),
        soft_start_duration: Number(config.soft_start_duration),
        scheduled_mixing_interval_sec: Number(config.scheduled_mixing_interval_sec),
        scheduled_mixing_duration_sec: Number(config.scheduled_mixing_duration_sec),
        dosing_pwm_percent: Number(config.dosing_pwm_percent),
        osaka_mixing_pwm_percent: Number(config.osaka_mixing_pwm_percent),
        osaka_misting_pwm_percent: Number(config.osaka_misting_pwm_percent),
        last_calibrated: ts
      };

      const sensConf = {
        device_id: devId,
        ph_v7: Number(config.ph_v7),
        ph_v4: Number(config.ph_v4),
        ec_factor: Number(config.ec_factor),
        ec_offset: Number(config.ec_offset),
        temp_offset: Number(config.temp_offset),
        temp_compensation_beta: Number(config.temp_compensation_beta),
        sampling_interval: Number(config.sampling_interval),
        publish_interval: Number(config.publish_interval),
        moving_average_window: Number(config.moving_average_window),
        is_ph_enabled: config.enable_ph_sensor ? 1 : 0,
        is_ec_enabled: config.enable_ec_sensor ? 1 : 0,
        is_temp_enabled: config.enable_temp_sensor ? 1 : 0,
        is_water_level_enabled: config.enable_water_level_sensor ? 1 : 0,
        last_calibrated: ts
      };

      // Đóng gói thành 1 Payload Duy Nhất
      const unifiedPayload = {
        device_config: devConf,
        water_config: waterConf,
        safety_config: safeConf,
        sensor_calibration: sensConf,
        dosing_calibration: doseConf,
      };

      await callApi(`/api/devices/${devId}/config/unified`, 'PUT', unifiedPayload);

      toast.success('Đã lưu và đồng bộ với ESP32!', { id: toastId });
    } catch (error: any) {
      console.error(error);
      toast.error('Lỗi mạng hoặc dữ liệu không hợp lệ.', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center space-y-4">
        <Activity className="animate-pulse text-emerald-500" size={48} />
        <span className="text-slate-400 font-medium text-sm">Đang tải cấu hình thiết bị...</span>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-36 max-w-4xl mx-auto relative">
      <div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-3">
          <Settings2 className="text-slate-400" /> Cấu Hình Lõi
        </h1>
        <p className="text-slate-400 text-sm mt-1.5 ml-9">Tùy chỉnh thông số vận hành và giới hạn an toàn.</p>
      </div>

      <div className="space-y-3 pt-2">
        {/* 0. KẾT NỐI HỆ THỐNG */}
        <AccordionSection id="network" title="Kết Nối Hệ Thống" icon={Network} color="text-slate-400" isOpen={openSection === 'network'} onToggle={() => handleToggleSection('network')}>
          <div className="space-y-3">
            <InputGroup label="Mã Thiết Bị (Device ID)" type="text" value={appSettings.device_id} onChange={(e: InputEvent) => setAppSettings({ ...appSettings, device_id: e.target.value })} />
            <InputGroup label="URL Máy Chủ (Backend API)" type="text" value={appSettings.backend_url} onChange={(e: InputEvent) => setAppSettings({ ...appSettings, backend_url: e.target.value })} />
            <InputGroup label="Khóa Bảo Mật (API Key)" type="password" value={appSettings.api_key} onChange={(e: InputEvent) => setAppSettings({ ...appSettings, api_key: e.target.value })} />
          </div>
        </AccordionSection>

        {/* 1. CHẾ ĐỘ & TỔNG QUAN */}
        <AccordionSection id="general" title="Chế Độ Hoạt Động" icon={Power} color="text-emerald-400" isOpen={openSection === 'general'} onToggle={() => handleToggleSection('general')}>
          <div className="flex items-center justify-between bg-gradient-to-r from-emerald-950/40 to-transparent p-4 rounded-xl border border-emerald-900/50">
            <div><p className="text-sm font-bold text-emerald-50">Kích hoạt Hệ thống</p><p className="text-[10px] text-emerald-200/60 mt-1">Bật/tắt toàn bộ tính năng tự động</p></div>
            <Switch isOn={config.is_enabled} onClick={(val) => setConfig({ ...config, is_enabled: val })} colorClass="bg-emerald-500" />
          </div>
          <div className="flex items-center justify-between bg-gradient-to-r from-red-950/40 to-transparent p-4 rounded-xl border border-red-900/50 mt-3">
            <div><p className="text-sm font-bold text-red-400">Dừng Khẩn Cấp (E-Stop)</p><p className="text-[10px] text-red-300/60 mt-1">Ngắt ngay lập tức mọi thiết bị ngoại vi</p></div>
            <Switch isOn={config.emergency_shutdown} onClick={(val) => setConfig({ ...config, emergency_shutdown: val })} colorClass="bg-red-500" />
          </div>
          <div className="mt-5 p-4 bg-slate-950/30 rounded-xl border border-slate-800/60">
            <label className="text-xs font-bold text-slate-400 uppercase mb-3 block text-center">Chế độ điều khiển</label>
            <div className="flex space-x-3 bg-slate-900 p-1.5 rounded-xl">
              <button onClick={() => setConfig({ ...config, control_mode: 'auto' })} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 shadow-sm ${config.control_mode === 'auto' ? 'bg-emerald-600 text-white shadow-emerald-900/50' : 'bg-transparent text-slate-400 hover:bg-slate-800'}`}>TỰ ĐỘNG</button>
              <button onClick={() => setConfig({ ...config, control_mode: 'manual' })} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 shadow-sm ${config.control_mode === 'manual' ? 'bg-orange-600 text-white shadow-orange-900/50' : 'bg-transparent text-slate-400 hover:bg-slate-800'}`}>THỦ CÔNG</button>
            </div>
          </div>
        </AccordionSection>

        {/* 2. MỤC TIÊU SINH TRƯỞNG & PHUN SƯƠNG */}
        <AccordionSection id="growth" title="Mục Tiêu Sinh Trưởng & Khí Hậu" icon={Target} color="text-blue-400" isOpen={openSection === 'growth'} onToggle={() => handleToggleSection('growth')}>
          <SubCard title="Dinh Dưỡng (EC)">
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Mức mong muốn" step="0.1" value={config.ec_target} onChange={(e: InputEvent) => setConfig({ ...config, ec_target: parseFloat(e.target.value) })} />
              <InputGroup label="Độ sai số (±)" step="0.05" value={config.ec_tolerance} onChange={(e: InputEvent) => setConfig({ ...config, ec_tolerance: parseFloat(e.target.value) })} />
            </div>
          </SubCard>

          <SubCard title="Độ pH" className="mt-4">
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Mức mong muốn" step="0.1" value={config.ph_target} onChange={(e: InputEvent) => setConfig({ ...config, ph_target: parseFloat(e.target.value) })} />
              <InputGroup label="Độ sai số (±)" step="0.05" value={config.ph_tolerance} onChange={(e: InputEvent) => setConfig({ ...config, ph_tolerance: parseFloat(e.target.value) })} />
            </div>
          </SubCard>

          <SubCard title="Phun Sương Làm Mát (Misting)" className="mt-4 border-blue-900/30 bg-blue-950/10">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <InputGroup label="Nhiệt độ kích hoạt làm mát (°C)" step="0.5" value={config.misting_temp_threshold} onChange={(e: InputEvent) => setConfig({ ...config, misting_temp_threshold: parseFloat(e.target.value) })} desc="Nhiệt độ trên mức này sẽ áp dụng nhịp NÓNG." />
              </div>
              <InputGroup label="Ngưỡng môi trường (°C)" step="0.5" value={config.temp_target} onChange={(e: InputEvent) => setConfig({ ...config, temp_target: parseFloat(e.target.value) })} />

              <div className="col-span-2 pt-3 pb-1"><p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest bg-blue-950/40 py-1.5 px-3 rounded-lg inline-block">Nhịp phun bình thường</p></div>
              <InputGroup label="Thời gian Phun (ms)" step="1000" value={config.misting_on_duration_ms} onChange={(e: InputEvent) => setConfig({ ...config, misting_on_duration_ms: parseInt(e.target.value) })} />
              <InputGroup label="Thời gian Nghỉ (ms)" step="1000" value={config.misting_off_duration_ms} onChange={(e: InputEvent) => setConfig({ ...config, misting_off_duration_ms: parseInt(e.target.value) })} />

              <div className="col-span-2 pt-3 pb-1 border-t border-slate-800/60"><p className="text-[10px] text-red-400 font-bold uppercase tracking-widest bg-red-950/40 py-1.5 px-3 rounded-lg inline-block">Nhịp phun khi trời NÓNG</p></div>
              <InputGroup label="Phun khi Nóng (ms)" step="1000" value={config.high_temp_misting_on_duration_ms} onChange={(e: InputEvent) => setConfig({ ...config, high_temp_misting_on_duration_ms: parseInt(e.target.value) })} />
              <InputGroup label="Nghỉ khi Nóng (ms)" step="1000" value={config.high_temp_misting_off_duration_ms} onChange={(e: InputEvent) => setConfig({ ...config, high_temp_misting_off_duration_ms: parseInt(e.target.value) })} />
            </div>
          </SubCard>
        </AccordionSection>

        {/* 3. CẤU HÌNH NƯỚC */}
        <AccordionSection id="water" title="Quản Lý Nước & Tuần Hoàn" icon={Waves} color="text-cyan-400" isOpen={openSection === 'water'} onToggle={() => handleToggleSection('water')}>
          <SubCard title="Giới hạn Mức Nước (%)">
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Mục tiêu" value={config.water_level_target} onChange={(e: InputEvent) => setConfig({ ...config, water_level_target: parseFloat(e.target.value) })} />
              <InputGroup label="Sai số cho phép" value={config.water_level_tolerance} onChange={(e: InputEvent) => setConfig({ ...config, water_level_tolerance: parseFloat(e.target.value) })} />
              <InputGroup label="Giới hạn Dưới" value={config.water_level_min} onChange={(e: InputEvent) => setConfig({ ...config, water_level_min: parseFloat(e.target.value) })} />
              <InputGroup label="Giới hạn Trên (Tràn)" value={config.water_level_max} onChange={(e: InputEvent) => setConfig({ ...config, water_level_max: parseFloat(e.target.value) })} />
            </div>
          </SubCard>

          <SubCard title="Kịch Bản Tự Động" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-200 font-medium">Tự động Bơm đầy</span>
                <Switch isOn={config.auto_refill_enabled} onClick={(val) => setConfig({ ...config, auto_refill_enabled: val })} colorClass="bg-cyan-500" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-200 font-medium">Tự động Xả tràn</span>
                <Switch isOn={config.auto_drain_overflow} onClick={(val) => setConfig({ ...config, auto_drain_overflow: val })} colorClass="bg-cyan-500" />
              </div>

              <div className="pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-slate-200 font-medium">Tự động pha loãng (Dilute)</span>
                    <p className="text-[10px] text-slate-400 mt-1">Xả bớt nước nếu phân bón quá liều</p>
                  </div>
                  <Switch isOn={config.auto_dilute_enabled} onClick={(val) => setConfig({ ...config, auto_dilute_enabled: val })} colorClass="bg-cyan-500" />
                </div>
                {config.auto_dilute_enabled && (
                  <div className="mt-4 pl-4 border-l-2 border-cyan-500/50 animate-in fade-in">
                    <InputGroup
                      label="Lượng xả để làm loãng (cm)" step="0.5"
                      value={config.dilute_drain_amount_cm}
                      onChange={(e: InputEvent) => setConfig({ ...config, dilute_drain_amount_cm: parseFloat(e.target.value) })}
                      desc="Xả lượng này rồi bơm lại nước sạch."
                    />
                  </div>
                )}
              </div>
            </div>
          </SubCard>

          <SubCard title="Lịch Trình Thay Nước Định Kỳ" className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-slate-200 font-medium">Bật lịch trình thay nước</span>
              <Switch isOn={config.scheduled_water_change_enabled} onClick={(val) => setConfig({ ...config, scheduled_water_change_enabled: val })} colorClass="bg-cyan-500" />
            </div>
            {config.scheduled_water_change_enabled && (
              <div className="grid grid-cols-2 gap-4 animate-in fade-in bg-slate-900/50 p-3 rounded-xl border border-slate-800/50">
                <InputGroup label="Chu kỳ lặp lại (Giây)" value={config.water_change_interval_sec} onChange={(e: InputEvent) => setConfig({ ...config, water_change_interval_sec: parseInt(e.target.value) })} />
                <InputGroup label="Lượng nước xả (cm)" value={config.scheduled_drain_amount_cm} onChange={(e: InputEvent) => setConfig({ ...config, scheduled_drain_amount_cm: parseFloat(e.target.value) })} />
              </div>
            )}
          </SubCard>
        </AccordionSection>

        {/* 4. ĐỊNH LƯỢNG */}
        <AccordionSection id="dosing" title="Định Lượng & Pha Chế" icon={FlaskConical} color="text-fuchsia-400" isOpen={openSection === 'dosing'} onToggle={() => handleToggleSection('dosing')}>
          <SubCard title="Tốc Độ Bơm & Soft Start (PWM)">
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Bơm Vi Lượng (%)" step="1" value={config.dosing_pwm_percent} onChange={(e: InputEvent) => setConfig({ ...config, dosing_pwm_percent: parseInt(e.target.value) })} />
              <InputGroup label="Bơm Trộn Osaka (%)" step="1" value={config.osaka_mixing_pwm_percent} onChange={(e: InputEvent) => setConfig({ ...config, osaka_mixing_pwm_percent: parseInt(e.target.value) })} />
              <InputGroup label="Bơm Sương Osaka (%)" step="1" value={config.osaka_misting_pwm_percent} onChange={(e: InputEvent) => setConfig({ ...config, osaka_misting_pwm_percent: parseInt(e.target.value) })} />
              <InputGroup label="Khởi động mềm (ms)" step="100" value={config.soft_start_duration} onChange={(e: InputEvent) => setConfig({ ...config, soft_start_duration: parseInt(e.target.value) })} desc="Giảm sốc điện cho bơm" />
            </div>
          </SubCard>

          <SubCard title="Lịch Trình Khuấy (Jet Mixing)" className="mt-4">
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Chu kỳ khuấy định kỳ (s)" step="60" value={config.scheduled_mixing_interval_sec} onChange={(e: InputEvent) => setConfig({ ...config, scheduled_mixing_interval_sec: parseInt(e.target.value) })} />
              <InputGroup label="Thời gian chạy mỗi lần (s)" step="10" value={config.scheduled_mixing_duration_sec} onChange={(e: InputEvent) => setConfig({ ...config, scheduled_mixing_duration_sec: parseInt(e.target.value) })} />
              <InputGroup label="Thời gian khuấy chủ động (s)" step="1" value={config.active_mixing_sec} onChange={(e: InputEvent) => setConfig({ ...config, active_mixing_sec: parseInt(e.target.value) })} desc="Khuấy ngay khi vừa châm phân" />
              <InputGroup label="Chờ Ổn định cảm biến (s)" step="1" value={config.sensor_stabilize_sec} onChange={(e: InputEvent) => setConfig({ ...config, sensor_stabilize_sec: parseInt(e.target.value) })} desc="Tạm ngưng đọc cảm biến khi nước đang xoáy" />
            </div>
          </SubCard>

          <SubCard title="Động học Phân Bón" className="mt-4">
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Thể tích bồn (Lít)" value={config.tank_volume_l} onChange={(e: InputEvent) => setConfig({ ...config, tank_volume_l: parseFloat(e.target.value) })} />
              <InputGroup label="Độ trễ giữa A và B (s)" step="1" value={config.delay_between_a_and_b_sec} onChange={(e: InputEvent) => setConfig({ ...config, delay_between_a_and_b_sec: parseInt(e.target.value) })} desc="Chờ phân A hòa tan trước khi bơm B" />
              <InputGroup label="Công suất Bơm A (ml/s)" step="0.1" value={config.pump_a_capacity_ml_per_sec} onChange={(e: InputEvent) => setConfig({ ...config, pump_a_capacity_ml_per_sec: parseFloat(e.target.value) })} />
              <InputGroup label="Công suất Bơm B (ml/s)" step="0.1" value={config.pump_b_capacity_ml_per_sec} onChange={(e: InputEvent) => setConfig({ ...config, pump_b_capacity_ml_per_sec: parseFloat(e.target.value) })} />
              <InputGroup label="Công suất Bơm chung (ml/s)" step="0.1" value={config.dosing_pump_capacity_ml_per_sec} onChange={(e: InputEvent) => setConfig({ ...config, dosing_pump_capacity_ml_per_sec: parseFloat(e.target.value) })} desc="Dùng cho bơm pH" />
              <InputGroup label="EC tăng thêm / 1ml" step="0.01" value={config.ec_gain_per_ml} onChange={(e: InputEvent) => setConfig({ ...config, ec_gain_per_ml: parseFloat(e.target.value) })} />
              <InputGroup label="Hệ số làm mịn (Ratio)" step="0.1" value={config.ec_step_ratio} onChange={(e: InputEvent) => setConfig({ ...config, ec_step_ratio: parseFloat(e.target.value) })} desc="Chỉ bơm X% liều lượng tính toán để chống lố" />
            </div>
          </SubCard>

          <SubCard title="Động học Dung dịch pH" className="mt-4">
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="pH TĂNG / 1ml (UP)" step="0.01" value={config.ph_shift_up_per_ml} onChange={(e: InputEvent) => setConfig({ ...config, ph_shift_up_per_ml: parseFloat(e.target.value) })} />
              <InputGroup label="pH GIẢM / 1ml (DOWN)" step="0.01" value={config.ph_shift_down_per_ml} onChange={(e: InputEvent) => setConfig({ ...config, ph_shift_down_per_ml: parseFloat(e.target.value) })} />
            </div>
          </SubCard>
        </AccordionSection>

        {/* 5. AN TOÀN */}
        <AccordionSection id="safety" title="Giới Hạn & An Toàn" icon={ShieldAlert} color="text-orange-400" isOpen={openSection === 'safety'} onToggle={() => handleToggleSection('safety')}>
          <SubCard title="Ngưỡng Cảnh Báo Môi Trường">
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="EC Min (Nguy hiểm)" step="0.1" value={config.min_ec_limit} onChange={(e: InputEvent) => setConfig({ ...config, min_ec_limit: parseFloat(e.target.value) })} />
              <InputGroup label="EC Max (Nguy hiểm)" step="0.1" value={config.max_ec_limit} onChange={(e: InputEvent) => setConfig({ ...config, max_ec_limit: parseFloat(e.target.value) })} />
              <InputGroup label="pH Min (Nguy hiểm)" step="0.1" value={config.min_ph_limit} onChange={(e: InputEvent) => setConfig({ ...config, min_ph_limit: parseFloat(e.target.value) })} />
              <InputGroup label="pH Max (Nguy hiểm)" step="0.1" value={config.max_ph_limit} onChange={(e: InputEvent) => setConfig({ ...config, max_ph_limit: parseFloat(e.target.value) })} />
              <div className="col-span-2">
                <InputGroup label="Mức cạn nước nguy hiểm (cm)" value={config.water_level_critical_min} onChange={(e: InputEvent) => setConfig({ ...config, water_level_critical_min: parseFloat(e.target.value) })} desc="Hệ thống sẽ E-STOP nếu mực nước rớt dưới mức này." />
              </div>
            </div>
          </SubCard>

          <SubCard title="Giới Hạn Cơ Học (Dosing)" className="mt-4">
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Max thể tích/chu kỳ (ml)" value={config.max_dose_per_cycle} onChange={(e: InputEvent) => setConfig({ ...config, max_dose_per_cycle: parseFloat(e.target.value) })} />
              <InputGroup label="Max thể tích/giờ (ml)" value={config.max_dose_per_hour} onChange={(e: InputEvent) => setConfig({ ...config, max_dose_per_hour: parseFloat(e.target.value) })} />
              <InputGroup label="Bước nhảy EC cho phép" step="0.1" value={config.max_ec_delta} onChange={(e: InputEvent) => setConfig({ ...config, max_ec_delta: parseFloat(e.target.value) })} desc="Tránh nhiễu: EC nhảy quá mức này sẽ bị bỏ qua." />
              <InputGroup label="Bước nhảy pH cho phép" step="0.1" value={config.max_ph_delta} onChange={(e: InputEvent) => setConfig({ ...config, max_ph_delta: parseFloat(e.target.value) })} />
              <div className="col-span-2">
                <InputGroup label="Khóa Bơm Tạm Thời (s)" value={config.cooldown_sec} onChange={(e: InputEvent) => setConfig({ ...config, cooldown_sec: parseInt(e.target.value) })} desc="Nghỉ bắt buộc giữa 2 lần châm phân liên tiếp." />
              </div>
            </div>
          </SubCard>

          <SubCard title="Giới Hạn Cấp/Xả Nước" className="mt-4">
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Max số lần Bơm/giờ" value={config.max_refill_cycles_per_hour} onChange={(e: InputEvent) => setConfig({ ...config, max_refill_cycles_per_hour: parseInt(e.target.value) })} />
              <InputGroup label="Thời gian cấp nước Max (s)" value={config.max_refill_duration_sec} onChange={(e: InputEvent) => setConfig({ ...config, max_refill_duration_sec: parseInt(e.target.value) })} desc="Chống cháy bơm nếu hết nguồn nước." />
              <InputGroup label="Max số lần Xả/giờ" value={config.max_drain_cycles_per_hour} onChange={(e: InputEvent) => setConfig({ ...config, max_drain_cycles_per_hour: parseInt(e.target.value) })} />
              <InputGroup label="Thời gian xả Max (s)" value={config.max_drain_duration_sec} onChange={(e: InputEvent) => setConfig({ ...config, max_drain_duration_sec: parseInt(e.target.value) })} />
            </div>
          </SubCard>
        </AccordionSection>

        {/* 6. HIỆU CHUẨN ĐẦU DÒ */}
        <AccordionSection id="sensor" title="Cảm Biến & Lấy Mẫu" icon={Activity} color="text-indigo-400" isOpen={openSection === 'sensor'} onToggle={() => handleToggleSection('sensor')}>
          <SubCard title="Quản Lý Nguồn Cảm Biến" className="mb-4 bg-indigo-950/10 border-indigo-900/30">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-200 font-medium">Bật Cảm biến pH</span>
                <Switch isOn={config.enable_ph_sensor} onClick={(val) => setConfig({ ...config, enable_ph_sensor: val })} colorClass="bg-indigo-500" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-200 font-medium">Bật Cảm biến Dinh dưỡng (EC)</span>
                <Switch isOn={config.enable_ec_sensor} onClick={(val) => setConfig({ ...config, enable_ec_sensor: val })} colorClass="bg-indigo-500" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-200 font-medium">Bật Cảm biến Nhiệt độ</span>
                <Switch isOn={config.enable_temp_sensor} onClick={(val) => setConfig({ ...config, enable_temp_sensor: val })} colorClass="bg-indigo-500" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-200 font-medium">Bật Cảm biến Mực nước</span>
                <Switch isOn={config.enable_water_level_sensor} onClick={(val) => setConfig({ ...config, enable_water_level_sensor: val })} colorClass="bg-indigo-500" />
              </div>
            </div>
          </SubCard>

          <SubCard title="Ngưỡng Xác Nhận Bơm (ACK Threshold)">
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Bù delta EC" step="0.01" value={config.ec_ack_threshold} onChange={(e: InputEvent) => setConfig({ ...config, ec_ack_threshold: parseFloat(e.target.value) })} desc="Mức chênh lệch tối thiểu để FSM biết phân đã vào nước." />
              <InputGroup label="Bù delta pH" step="0.01" value={config.ph_ack_threshold} onChange={(e: InputEvent) => setConfig({ ...config, ph_ack_threshold: parseFloat(e.target.value) })} />
              <div className="col-span-2">
                <InputGroup label="Bù delta Mực Nước (cm)" step="0.1" value={config.water_ack_threshold} onChange={(e: InputEvent) => setConfig({ ...config, water_ack_threshold: parseFloat(e.target.value) })} />
              </div>
            </div>
          </SubCard>

          <SubCard title="Tần Suất Lấy Mẫu (Node Sensor)" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputGroup label="Lấy mẫu mỗi (ms)" step="100" value={config.sampling_interval} onChange={(e: InputEvent) => setConfig({ ...config, sampling_interval: parseInt(e.target.value) })} desc="Tốc độ đọc ADC (vd: 1000 = 1s)" />
              <InputGroup label="Bắn MQTT mỗi (ms)" step="1000" value={config.publish_interval} onChange={(e: InputEvent) => setConfig({ ...config, publish_interval: parseInt(e.target.value) })} desc="Chu kỳ gửi telemetry lên Backend" />
              <div className="sm:col-span-2">
                <InputGroup label="Khung Trượt Trung Bình (M.A Window)" step="1" value={config.moving_average_window} onChange={(e: InputEvent) => setConfig({ ...config, moving_average_window: parseInt(e.target.value) })} desc="Lọc nhiễu phần mềm: Lấy trung bình cộng của N lần đọc." />
              </div>
            </div>
          </SubCard>

          <div className="px-4 py-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl mt-6 mb-3 flex items-start space-x-3">
            <FlaskConical size={18} className="text-indigo-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-indigo-300 leading-relaxed font-medium">Khu vực Hiệu Chuẩn: Vui lòng chỉ thay đổi khi bạn đang sử dụng dung dịch chuẩn (Calibration Buffer) đi kèm.</p>
          </div>

          <SubCard title="Hiệu Chuẩn Analog pH & EC">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputGroup label="pH v7 (Voltage)" step="0.01" value={config.ph_v7} onChange={(e: InputEvent) => setConfig({ ...config, ph_v7: parseFloat(e.target.value) })} />
              <InputGroup label="pH v4 (Voltage)" step="0.01" value={config.ph_v4} onChange={(e: InputEvent) => setConfig({ ...config, ph_v4: parseFloat(e.target.value) })} />
              <InputGroup label="Hệ số EC (K Factor)" step="1.0" value={config.ec_factor} onChange={(e: InputEvent) => setConfig({ ...config, ec_factor: parseFloat(e.target.value) })} />
              <InputGroup label="Bù sai số tĩnh EC (Offset)" step="0.1" value={config.ec_offset} onChange={(e: InputEvent) => setConfig({ ...config, ec_offset: parseFloat(e.target.value) })} />
            </div>
          </SubCard>

          <SubCard title="Bù Trừ Nhiệt Độ" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputGroup label="Nhiệt độ bù tĩnh (Offset °C)" step="0.1" value={config.temp_offset} onChange={(e: InputEvent) => setConfig({ ...config, temp_offset: parseFloat(e.target.value) })} />
              <InputGroup label="Hệ số động (β)" step="0.01" value={config.temp_compensation_beta} onChange={(e: InputEvent) => setConfig({ ...config, temp_compensation_beta: parseFloat(e.target.value) })} desc="Tính toán giãn nở EC theo nhiệt độ." />
            </div>
          </SubCard>
        </AccordionSection>
      </div>

      {/* 🟢 NÚT LƯU - FIXED BOTTOM BAR */}
      <div className="fixed bottom-20 md:bottom-6 left-0 right-0 p-4 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent pt-12 pointer-events-none z-50">
        <div className="max-w-4xl mx-auto pointer-events-auto px-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-emerald-500 text-white py-3.5 rounded-2xl font-bold text-[15px] tracking-wide shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:bg-emerald-400 hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-none flex items-center justify-center space-x-2"
          >
            {isSaving ? (
              <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></span>
            ) : (
              <>
                <Save size={20} />
                <span>LƯU & ĐỒNG BỘ ESP32</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
