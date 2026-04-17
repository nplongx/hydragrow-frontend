import React, { useState, useEffect } from 'react';
import {
  Save, Target, ShieldAlert, Waves,
  FlaskConical, Activity, Settings2, Power, Network, Zap, Cpu
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { fetch } from '@tauri-apps/plugin-http';
import toast from 'react-hot-toast';

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

    // Đã thêm cấu hình định lượng định kỳ
    scheduled_dosing_enabled: false,
    scheduled_dosing_interval_sec: 86400, // 1 Ngày
    scheduled_dose_a_ml: 10.0,
    scheduled_dose_b_ml: 10.0,
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
    const toastId = toast.loading("Đang nạp dữ liệu lõi vào ESP32...");

    try {
      const devId = appSettings.device_id;
      try { await invoke('save_settings', { apiKey: appSettings.api_key, backendUrl: appSettings.backend_url, deviceId: devId }); } catch (e) { }

      const ts = new Date().toISOString();

      const devConf = {
        device_id: devId, control_mode: config.control_mode, is_enabled: config.is_enabled,
        ec_target: Number(config.ec_target), ec_tolerance: Number(config.ec_tolerance),
        ph_target: Number(config.ph_target), ph_tolerance: Number(config.ph_tolerance),
        temp_target: Number(config.temp_target), temp_tolerance: Number(config.temp_tolerance),
        last_updated: ts, pump_a_capacity_ml_per_sec: Number(config.pump_a_capacity_ml_per_sec),
        pump_b_capacity_ml_per_sec: Number(config.pump_b_capacity_ml_per_sec), delay_between_a_and_b_sec: Number(config.delay_between_a_and_b_sec),
      };

      const waterConf = {
        device_id: devId, water_level_min: Number(config.water_level_min), water_level_target: Number(config.water_level_target),
        water_level_max: Number(config.water_level_max), water_level_drain: Number(config.water_level_drain),
        circulation_mode: config.circulation_mode, circulation_on_sec: Number(config.circulation_on_sec), circulation_off_sec: Number(config.circulation_off_sec),
        water_level_tolerance: Number(config.water_level_tolerance), auto_refill_enabled: config.auto_refill_enabled,
        auto_drain_overflow: config.auto_drain_overflow, auto_dilute_enabled: config.auto_dilute_enabled,
        dilute_drain_amount_cm: Number(config.dilute_drain_amount_cm), scheduled_water_change_enabled: config.scheduled_water_change_enabled,
        water_change_interval_sec: Number(config.water_change_interval_sec), scheduled_drain_amount_cm: Number(config.scheduled_drain_amount_cm),
        misting_on_duration_ms: Number(config.misting_on_duration_ms), misting_off_duration_ms: Number(config.misting_off_duration_ms), last_updated: ts
      };

      const safeConf = {
        device_id: devId, emergency_shutdown: config.emergency_shutdown,
        max_ec_limit: Number(config.max_ec_limit),
        min_ec_limit: Number(config.min_ec_limit), min_ph_limit: Number(config.min_ph_limit), max_ph_limit: Number(config.max_ph_limit),
        max_ec_delta: Number(config.max_ec_delta), max_ph_delta: Number(config.max_ph_delta), max_dose_per_cycle: Number(config.max_dose_per_cycle),
        cooldown_sec: Number(config.cooldown_sec), max_dose_per_hour: Number(config.max_dose_per_hour), water_level_critical_min: Number(config.water_level_critical_min),
        max_refill_cycles_per_hour: Number(config.max_refill_cycles_per_hour), max_drain_cycles_per_hour: Number(config.max_drain_cycles_per_hour),
        max_refill_duration_sec: Number(config.max_refill_duration_sec), max_drain_duration_sec: Number(config.max_drain_duration_sec),
        min_temp_limit: Number(config.min_temp_limit), max_temp_limit: Number(config.max_temp_limit), ec_ack_threshold: Number(config.ec_ack_threshold),
        ph_ack_threshold: Number(config.ph_ack_threshold), water_ack_threshold: Number(config.water_ack_threshold), last_updated: ts
      };

      const doseConf = {
        device_id: devId, tank_volume_l: Number(config.tank_volume_l), ec_gain_per_ml: Number(config.ec_gain_per_ml),
        ph_shift_up_per_ml: Number(config.ph_shift_up_per_ml), ph_shift_down_per_ml: Number(config.ph_shift_down_per_ml),
        active_mixing_sec: Number(config.active_mixing_sec), sensor_stabilize_sec: Number(config.sensor_stabilize_sec),
        ec_step_ratio: Number(config.ec_step_ratio), ph_step_ratio: Number(config.ph_step_ratio),
        dosing_pump_capacity_ml_per_sec: Number(config.dosing_pump_capacity_ml_per_sec), soft_start_duration: Number(config.soft_start_duration),
        scheduled_mixing_interval_sec: Number(config.scheduled_mixing_interval_sec), scheduled_mixing_duration_sec: Number(config.scheduled_mixing_duration_sec),
        dosing_pwm_percent: Number(config.dosing_pwm_percent), osaka_mixing_pwm_percent: Number(config.osaka_mixing_pwm_percent),
        osaka_misting_pwm_percent: Number(config.osaka_misting_pwm_percent),

        // Đã cập nhật mapping cho backend
        scheduled_dosing_enabled: config.scheduled_dosing_enabled,
        scheduled_dosing_interval_sec: Number(config.scheduled_dosing_interval_sec),
        scheduled_dose_a_ml: Number(config.scheduled_dose_a_ml),
        scheduled_dose_b_ml: Number(config.scheduled_dose_b_ml),

        last_calibrated: ts
      };

      const sensConf = {
        device_id: devId, ph_v7: Number(config.ph_v7), ph_v4: Number(config.ph_v4), ec_factor: Number(config.ec_factor),
        ec_offset: Number(config.ec_offset), temp_offset: Number(config.temp_offset), temp_compensation_beta: Number(config.temp_compensation_beta),
        sampling_interval: Number(config.sampling_interval), publish_interval: Number(config.publish_interval), moving_average_window: Number(config.moving_average_window),
        is_ph_enabled: config.enable_ph_sensor, is_ec_enabled: config.enable_ec_sensor,
        is_temp_enabled: config.enable_temp_sensor, is_water_level_enabled: config.enable_water_level_sensor, last_calibrated: ts
      };

      const unifiedPayload = { device_config: devConf, water_config: waterConf, safety_config: safeConf, sensor_calibration: sensConf, dosing_calibration: doseConf };

      await callApi(`/api/devices/${devId}/config/unified`, 'PUT', unifiedPayload);

      toast.success('Đồng bộ cấu hình lõi thành công!', { id: toastId });
    } catch (error: any) {
      console.error(error);
      toast.error('Lỗi giao thức. Vui lòng kiểm tra lại.', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return (
    <div className="flex h-screen items-center justify-center bg-slate-950 relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[300px] h-[300px] border border-emerald-500/20 rounded-full animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
        <div className="w-[150px] h-[150px] border border-emerald-500/40 rounded-full absolute animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
      </div>
      <div className="flex flex-col items-center space-y-4 relative z-10">
        <Cpu className="text-emerald-400 animate-pulse" size={48} />
        <span className="text-emerald-500/70 font-black tracking-widest text-xs uppercase animate-pulse">Trích xuất cấu hình...</span>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-40 max-w-4xl mx-auto relative min-h-screen">

      {/* Nền sương mù Mesh Gradient */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[30%] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      {/* HEADER */}
      <div className="relative z-10 flex flex-col space-y-1 animate-in slide-in-from-top-4 duration-500 mb-8">
        <h1 className="text-3xl font-black flex items-center gap-3">
          <div className="p-2.5 bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700 shadow-[0_0_20px_rgba(148,163,184,0.15)]">
            <Settings2 size={24} className="text-slate-300" />
          </div>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-100 to-slate-500 tracking-tight">
            CẤU HÌNH LÕI
          </span>
        </h1>
        <p className="text-xs text-slate-400 ml-[52px] font-medium tracking-wide uppercase">
          Tùy chỉnh thông số vận hành Firmware
        </p>
      </div>

      <div className="space-y-4 relative z-10">

        {/* 0. KẾT NỐI HỆ THỐNG */}
        <AccordionSection id="network" title="Giao Thức Mạng" icon={Network} color="text-slate-300" isOpen={openSection === 'network'} onToggle={() => handleToggleSection('network')}>
          <div className="space-y-3 bg-slate-900/30 p-4 rounded-2xl border border-white/5 shadow-inner">
            <InputGroup label="Mã Thiết Bị (Device ID)" type="text" value={appSettings.device_id} onChange={(e: InputEvent) => setAppSettings({ ...appSettings, device_id: e.target.value })} />
            <InputGroup label="URL Máy Chủ (Backend API)" type="text" value={appSettings.backend_url} onChange={(e: InputEvent) => setAppSettings({ ...appSettings, backend_url: e.target.value })} />
            <InputGroup label="Khóa Bảo Mật (API Key)" type="password" value={appSettings.api_key} onChange={(e: InputEvent) => setAppSettings({ ...appSettings, api_key: e.target.value })} />
          </div>
        </AccordionSection>

        {/* 1. CHẾ ĐỘ & TỔNG QUAN */}
        <AccordionSection id="general" title="Trung Tâm Kiểm Soát" icon={Power} color="text-emerald-400" isOpen={openSection === 'general'} onToggle={() => handleToggleSection('general')}>
          <div className="space-y-4">
            {/* Master Switch */}
            <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-500 ${config.is_enabled ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)]' : 'bg-slate-900/50 border-slate-800'}`}>
              <div>
                <p className={`text-sm font-black tracking-wide ${config.is_enabled ? 'text-emerald-400' : 'text-slate-400'}`}>NGUỒN HỆ THỐNG</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Kích hoạt luồng chạy tự động</p>
              </div>
              <Switch isOn={config.is_enabled} onClick={(val) => setConfig({ ...config, is_enabled: val })} colorClass="bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            </div>

            {/* E-Stop */}
            <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-500 ${config.emergency_shutdown ? 'bg-rose-500/20 border-rose-500/50 shadow-[0_0_30px_rgba(244,63,94,0.3)] animate-pulse' : 'bg-slate-900/50 border-slate-800'}`}>
              <div className="flex items-start gap-3">
                <ShieldAlert className={config.emergency_shutdown ? 'text-rose-400' : 'text-slate-600'} size={20} />
                <div>
                  <p className={`text-sm font-black tracking-wide ${config.emergency_shutdown ? 'text-rose-400' : 'text-slate-400'}`}>DỪNG KHẨN CẤP (E-STOP)</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Ngắt ngay lập tức mọi rơ-le</p>
                </div>
              </div>
              <Switch isOn={config.emergency_shutdown} onClick={(val) => setConfig({ ...config, emergency_shutdown: val })} colorClass="bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.6)]" />
            </div>

            {/* Control Mode Toggle */}
            <div className="p-4 bg-slate-900/40 rounded-2xl border border-white/5 backdrop-blur-md">
              <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase mb-3 flex items-center gap-2">
                <Zap size={12} className="text-amber-500" /> Chế độ điều khiển lõi
              </label>
              <div className="flex space-x-2 bg-slate-950/50 p-1.5 rounded-xl border border-slate-800/50 shadow-inner">
                <button
                  onClick={() => setConfig({ ...config, control_mode: 'auto' })}
                  className={`flex-1 py-3 rounded-lg text-xs font-black tracking-widest transition-all duration-300 ${config.control_mode === 'auto'
                    ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)] scale-[1.02]'
                    : 'bg-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                    }`}
                >
                  TỰ ĐỘNG
                </button>
                <button
                  onClick={() => setConfig({ ...config, control_mode: 'manual' })}
                  className={`flex-1 py-3 rounded-lg text-xs font-black tracking-widest transition-all duration-300 ${config.control_mode === 'manual'
                    ? 'bg-orange-500 text-slate-950 shadow-[0_0_15px_rgba(249,115,22,0.5)] scale-[1.02]'
                    : 'bg-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                    }`}
                >
                  THỦ CÔNG
                </button>
              </div>
            </div>
          </div>
        </AccordionSection>

        {/* 2. MỤC TIÊU SINH TRƯỞNG & PHUN SƯƠNG */}
        <AccordionSection id="growth" title="Mục Tiêu & Môi Trường" icon={Target} color="text-blue-400" isOpen={openSection === 'growth'} onToggle={() => handleToggleSection('growth')}>
          <SubCard title="Dinh Dưỡng (EC)">
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Ngưỡng mục tiêu" step="0.1" value={config.ec_target} onChange={(e: InputEvent) => setConfig({ ...config, ec_target: parseFloat(e.target.value) })} />
              <InputGroup label="Dung sai (±)" step="0.05" value={config.ec_tolerance} onChange={(e: InputEvent) => setConfig({ ...config, ec_tolerance: parseFloat(e.target.value) })} />
            </div>
          </SubCard>

          <SubCard title="Độ pH" className="mt-4">
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Ngưỡng mục tiêu" step="0.1" value={config.ph_target} onChange={(e: InputEvent) => setConfig({ ...config, ph_target: parseFloat(e.target.value) })} />
              <InputGroup label="Dung sai (±)" step="0.05" value={config.ph_tolerance} onChange={(e: InputEvent) => setConfig({ ...config, ph_tolerance: parseFloat(e.target.value) })} />
            </div>
          </SubCard>

          <SubCard title="Phun Sương Kép (Dual Misting)" className="mt-4 border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <InputGroup label="Ngưỡng Kích hoạt chế độ NÓNG (°C)" step="0.5" value={config.misting_temp_threshold} onChange={(e: InputEvent) => setConfig({ ...config, misting_temp_threshold: parseFloat(e.target.value) })} desc="Vượt qua mức này sẽ chạy nhịp Misting công suất cao." />
              </div>
              <InputGroup label="Nhiệt độ phòng (°C)" step="0.5" value={config.temp_target} onChange={(e: InputEvent) => setConfig({ ...config, temp_target: parseFloat(e.target.value) })} />

              <div className="col-span-2 pt-4 pb-1"><span className="text-[9px] text-blue-400 font-black uppercase tracking-widest bg-blue-500/10 border border-blue-500/20 py-1.5 px-3 rounded-lg shadow-inner">Nhịp cơ bản (Mát)</span></div>
              <InputGroup label="Mở van (ms)" step="1000" value={config.misting_on_duration_ms} onChange={(e: InputEvent) => setConfig({ ...config, misting_on_duration_ms: parseInt(e.target.value) })} />
              <InputGroup label="Đóng van (ms)" step="1000" value={config.misting_off_duration_ms} onChange={(e: InputEvent) => setConfig({ ...config, misting_off_duration_ms: parseInt(e.target.value) })} />

              <div className="col-span-2 pt-4 pb-1 border-t border-slate-800"><span className="text-[9px] text-rose-400 font-black uppercase tracking-widest bg-rose-500/10 border border-rose-500/20 py-1.5 px-3 rounded-lg shadow-inner">Nhịp tăng cường (Nóng)</span></div>
              <InputGroup label="Mở van (ms)" step="1000" value={config.high_temp_misting_on_duration_ms} onChange={(e: InputEvent) => setConfig({ ...config, high_temp_misting_on_duration_ms: parseInt(e.target.value) })} />
              <InputGroup label="Đóng van (ms)" step="1000" value={config.high_temp_misting_off_duration_ms} onChange={(e: InputEvent) => setConfig({ ...config, high_temp_misting_off_duration_ms: parseInt(e.target.value) })} />
            </div>
          </SubCard>
        </AccordionSection>

        {/* 3. CẤU HÌNH NƯỚC */}
        <AccordionSection id="water" title="Động Lực Nước" icon={Waves} color="text-cyan-400" isOpen={openSection === 'water'} onToggle={() => handleToggleSection('water')}>
          <SubCard title="Radar Mực Nước (%)">
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Mục tiêu" value={config.water_level_target} onChange={(e: InputEvent) => setConfig({ ...config, water_level_target: parseFloat(e.target.value) })} />
              <InputGroup label="Dung sai" value={config.water_level_tolerance} onChange={(e: InputEvent) => setConfig({ ...config, water_level_tolerance: parseFloat(e.target.value) })} />
              <InputGroup label="Ngưỡng Cạn" value={config.water_level_min} onChange={(e: InputEvent) => setConfig({ ...config, water_level_min: parseFloat(e.target.value) })} />
              <InputGroup label="Ngưỡng Tràn" value={config.water_level_max} onChange={(e: InputEvent) => setConfig({ ...config, water_level_max: parseFloat(e.target.value) })} />
            </div>
          </SubCard>

          <SubCard title="Tự Động Hóa Van Nước" className="mt-4 bg-slate-900/30">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 tracking-wide uppercase">Cấp nước tự động</span>
                <Switch isOn={config.auto_refill_enabled} onClick={(val) => setConfig({ ...config, auto_refill_enabled: val })} colorClass="bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.4)]" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 tracking-wide uppercase">Xả tràn tự động</span>
                <Switch isOn={config.auto_drain_overflow} onClick={(val) => setConfig({ ...config, auto_drain_overflow: val })} colorClass="bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.4)]" />
              </div>

              <div className="pt-4 border-t border-slate-800/50">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-300 tracking-wide uppercase">Pha loãng khẩn cấp</span>
                    <p className="text-[10px] text-slate-500 mt-1">Tự xả nước nếu phát hiện EC quá liều</p>
                  </div>
                  <Switch isOn={config.auto_dilute_enabled} onClick={(val) => setConfig({ ...config, auto_dilute_enabled: val })} colorClass="bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.4)]" />
                </div>
                {config.auto_dilute_enabled && (
                  <div className="mt-4 pl-4 border-l-2 border-cyan-500/50 animate-in fade-in slide-in-from-left-2">
                    <InputGroup label="Lượng xả loãng (cm)" step="0.5" value={config.dilute_drain_amount_cm} onChange={(e: InputEvent) => setConfig({ ...config, dilute_drain_amount_cm: parseFloat(e.target.value) })} />
                  </div>
                )}
              </div>
            </div>
          </SubCard>

          <SubCard title="Bảo Dưỡng Định Kỳ" className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-300 tracking-wide uppercase">Lịch thay nước</span>
              <Switch isOn={config.scheduled_water_change_enabled} onClick={(val) => setConfig({ ...config, scheduled_water_change_enabled: val })} colorClass="bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.4)]" />
            </div>
            {config.scheduled_water_change_enabled && (
              <div className="grid grid-cols-2 gap-4 animate-in fade-in bg-slate-900/50 p-4 rounded-xl border border-white/5 shadow-inner">
                <InputGroup label="Chu kỳ (Giây)" value={config.water_change_interval_sec} onChange={(e: InputEvent) => setConfig({ ...config, water_change_interval_sec: parseInt(e.target.value) })} />
                <InputGroup label="Mức xả (cm)" value={config.scheduled_drain_amount_cm} onChange={(e: InputEvent) => setConfig({ ...config, scheduled_drain_amount_cm: parseFloat(e.target.value) })} />
              </div>
            )}
          </SubCard>
        </AccordionSection>

        {/* 4. ĐỊNH LƯỢNG */}
        <AccordionSection id="dosing" title="Pha Chế & Định Lượng" icon={FlaskConical} color="text-fuchsia-400" isOpen={openSection === 'dosing'} onToggle={() => handleToggleSection('dosing')}>
          <SubCard title="Băm Xung (PWM) & Khởi Động Mềm">
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Bơm Vi Lượng (%)" step="1" value={config.dosing_pwm_percent} onChange={(e: InputEvent) => setConfig({ ...config, dosing_pwm_percent: parseInt(e.target.value) })} />
              <InputGroup label="Bơm Trộn Osaka (%)" step="1" value={config.osaka_mixing_pwm_percent} onChange={(e: InputEvent) => setConfig({ ...config, osaka_mixing_pwm_percent: parseInt(e.target.value) })} />
              <InputGroup label="Bơm Sương Osaka (%)" step="1" value={config.osaka_misting_pwm_percent} onChange={(e: InputEvent) => setConfig({ ...config, osaka_misting_pwm_percent: parseInt(e.target.value) })} />
              <InputGroup label="Delay Khởi Động (ms)" step="100" value={config.soft_start_duration} onChange={(e: InputEvent) => setConfig({ ...config, soft_start_duration: parseInt(e.target.value) })} desc="Giảm Shock dòng tử" />
            </div>
          </SubCard>

          {/* MỚI: CHÂM PHÂN ĐỊNH KỲ */}
          <SubCard title="Châm Phân Định Kỳ (Lịch Trình)" className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-300 tracking-wide uppercase">Kích hoạt châm theo lịch</span>
              <Switch isOn={config.scheduled_dosing_enabled} onClick={(val) => setConfig({ ...config, scheduled_dosing_enabled: val })} colorClass="bg-fuchsia-500 shadow-[0_0_10px_rgba(217,70,239,0.4)]" />
            </div>
            {config.scheduled_dosing_enabled && (
              <div className="grid grid-cols-2 gap-4 animate-in fade-in bg-slate-900/50 p-4 rounded-xl border border-white/5 shadow-inner">
                <div className="col-span-2">
                  <InputGroup label="Chu kỳ châm (Giây) - VD: 86400 (1 Ngày)" value={config.scheduled_dosing_interval_sec} onChange={(e: InputEvent) => setConfig({ ...config, scheduled_dosing_interval_sec: parseInt(e.target.value) })} />
                </div>
                <InputGroup label="Lượng Bơm A (ml)" step="0.5" value={config.scheduled_dose_a_ml} onChange={(e: InputEvent) => setConfig({ ...config, scheduled_dose_a_ml: parseFloat(e.target.value) })} />
                <InputGroup label="Lượng Bơm B (ml)" step="0.5" value={config.scheduled_dose_b_ml} onChange={(e: InputEvent) => setConfig({ ...config, scheduled_dose_b_ml: parseFloat(e.target.value) })} />
              </div>
            )}
          </SubCard>

          <SubCard title="Khuấy Trộn Phản Lực (Jet Mixing)" className="mt-4">
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Chu kỳ khuấy (s)" step="60" value={config.scheduled_mixing_interval_sec} onChange={(e: InputEvent) => setConfig({ ...config, scheduled_mixing_interval_sec: parseInt(e.target.value) })} />
              <InputGroup label="T/g mỗi nhịp (s)" step="10" value={config.scheduled_mixing_duration_sec} onChange={(e: InputEvent) => setConfig({ ...config, scheduled_mixing_duration_sec: parseInt(e.target.value) })} />
              <InputGroup label="T/g khuấy chủ động (s)" step="1" value={config.active_mixing_sec} onChange={(e: InputEvent) => setConfig({ ...config, active_mixing_sec: parseInt(e.target.value) })} desc="Khuấy ngay sau khi châm" />
              <InputGroup label="T/g Chờ ổn định (s)" step="1" value={config.sensor_stabilize_sec} onChange={(e: InputEvent) => setConfig({ ...config, sensor_stabilize_sec: parseInt(e.target.value) })} />
            </div>
          </SubCard>

          <SubCard title="Thuật Toán Dinh Dưỡng" className="mt-4">
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Thể tích bồn (L)" value={config.tank_volume_l} onChange={(e: InputEvent) => setConfig({ ...config, tank_volume_l: parseFloat(e.target.value) })} />
              <InputGroup label="Trễ A -> B (s)" step="1" value={config.delay_between_a_and_b_sec} onChange={(e: InputEvent) => setConfig({ ...config, delay_between_a_and_b_sec: parseInt(e.target.value) })} />
              <InputGroup label="Lưu lượng Bơm A (ml/s)" step="0.1" value={config.pump_a_capacity_ml_per_sec} onChange={(e: InputEvent) => setConfig({ ...config, pump_a_capacity_ml_per_sec: parseFloat(e.target.value) })} />
              <InputGroup label="Lưu lượng Bơm B (ml/s)" step="0.1" value={config.pump_b_capacity_ml_per_sec} onChange={(e: InputEvent) => setConfig({ ...config, pump_b_capacity_ml_per_sec: parseFloat(e.target.value) })} />
              <InputGroup label="Lưu lượng Bơm Phụ (ml/s)" step="0.1" value={config.dosing_pump_capacity_ml_per_sec} onChange={(e: InputEvent) => setConfig({ ...config, dosing_pump_capacity_ml_per_sec: parseFloat(e.target.value) })} />
              <InputGroup label="EC Delta / 1ml" step="0.01" value={config.ec_gain_per_ml} onChange={(e: InputEvent) => setConfig({ ...config, ec_gain_per_ml: parseFloat(e.target.value) })} />
              <InputGroup label="Hệ số bù PID (EC)" step="0.1" value={config.ec_step_ratio} onChange={(e: InputEvent) => setConfig({ ...config, ec_step_ratio: parseFloat(e.target.value) })} />
            </div>
          </SubCard>
        </AccordionSection>

        {/* 5. AN TOÀN */}
        <AccordionSection id="safety" title="Bảo Vệ Cơ Học & Hệ Thống" icon={ShieldAlert} color="text-amber-400" isOpen={openSection === 'safety'} onToggle={() => handleToggleSection('safety')}>
          <SubCard title="Ngưỡng Ngắt Mạch Tự Động" className="border-rose-500/20 bg-rose-500/5">
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="EC Báo Động (Dưới)" step="0.1" value={config.min_ec_limit} onChange={(e: InputEvent) => setConfig({ ...config, min_ec_limit: parseFloat(e.target.value) })} />
              <InputGroup label="EC Báo Động (Trên)" step="0.1" value={config.max_ec_limit} onChange={(e: InputEvent) => setConfig({ ...config, max_ec_limit: parseFloat(e.target.value) })} />
              <InputGroup label="pH Báo Động (Dưới)" step="0.1" value={config.min_ph_limit} onChange={(e: InputEvent) => setConfig({ ...config, min_ph_limit: parseFloat(e.target.value) })} />
              <InputGroup label="pH Báo Động (Trên)" step="0.1" value={config.max_ph_limit} onChange={(e: InputEvent) => setConfig({ ...config, max_ph_limit: parseFloat(e.target.value) })} />
              <div className="col-span-2">
                <InputGroup label="Báo động Cạn Bồn (cm)" value={config.water_level_critical_min} onChange={(e: InputEvent) => setConfig({ ...config, water_level_critical_min: parseFloat(e.target.value) })} desc="Hệ thống ngắt toàn bộ Relay nếu rớt dưới mức này." />
              </div>
            </div>
          </SubCard>

          <SubCard title="Chống Quá Tải Bơm" className="mt-4">
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Max ml / Chu kỳ" value={config.max_dose_per_cycle} onChange={(e: InputEvent) => setConfig({ ...config, max_dose_per_cycle: parseFloat(e.target.value) })} />
              <InputGroup label="Max ml / Giờ" value={config.max_dose_per_hour} onChange={(e: InputEvent) => setConfig({ ...config, max_dose_per_hour: parseFloat(e.target.value) })} />
              <InputGroup label="Chặn Nhiễu EC (Δ)" step="0.1" value={config.max_ec_delta} onChange={(e: InputEvent) => setConfig({ ...config, max_ec_delta: parseFloat(e.target.value) })} />
              <InputGroup label="Chặn Nhiễu pH (Δ)" step="0.1" value={config.max_ph_delta} onChange={(e: InputEvent) => setConfig({ ...config, max_ph_delta: parseFloat(e.target.value) })} />
              <div className="col-span-2">
                <InputGroup label="Khóa tản nhiệt Bơm (s)" value={config.cooldown_sec} onChange={(e: InputEvent) => setConfig({ ...config, cooldown_sec: parseInt(e.target.value) })} />
              </div>
            </div>
          </SubCard>

          <SubCard title="Bảo Vệ Máy Bơm Nước" className="mt-4">
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Max số lần Bơm/Giờ" value={config.max_refill_cycles_per_hour} onChange={(e: InputEvent) => setConfig({ ...config, max_refill_cycles_per_hour: parseInt(e.target.value) })} />
              <InputGroup label="T/g Chạy Bơm Max (s)" value={config.max_refill_duration_sec} onChange={(e: InputEvent) => setConfig({ ...config, max_refill_duration_sec: parseInt(e.target.value) })} desc="Chống cháy do hụt nước mồi" />
              <InputGroup label="Max số lần Xả/Giờ" value={config.max_drain_cycles_per_hour} onChange={(e: InputEvent) => setConfig({ ...config, max_drain_cycles_per_hour: parseInt(e.target.value) })} />
              <InputGroup label="T/g Chạy Xả Max (s)" value={config.max_drain_duration_sec} onChange={(e: InputEvent) => setConfig({ ...config, max_drain_duration_sec: parseInt(e.target.value) })} />
            </div>
          </SubCard>
        </AccordionSection>

        {/* 6. HIỆU CHUẨN ĐẦU DÒ */}
        <AccordionSection id="sensor" title="Đầu Dò & Hiệu Chuẩn ADC" icon={Activity} color="text-indigo-400" isOpen={openSection === 'sensor'} onToggle={() => handleToggleSection('sensor')}>
          <SubCard title="Nguồn Mạch Cảm Biến" className="mb-4 bg-indigo-900/20 border-indigo-500/20">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-300">Đầu dò pH</span>
                <Switch isOn={config.enable_ph_sensor} onClick={(val) => setConfig({ ...config, enable_ph_sensor: val })} colorClass="bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-300">Đầu dò Dinh dưỡng (EC)</span>
                <Switch isOn={config.enable_ec_sensor} onClick={(val) => setConfig({ ...config, enable_ec_sensor: val })} colorClass="bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-300">Đầu dò Nhiệt độ</span>
                <Switch isOn={config.enable_temp_sensor} onClick={(val) => setConfig({ ...config, enable_temp_sensor: val })} colorClass="bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-300">Siêu âm Mực nước</span>
                <Switch isOn={config.enable_water_level_sensor} onClick={(val) => setConfig({ ...config, enable_water_level_sensor: val })} colorClass="bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
              </div>
            </div>
          </SubCard>

          <SubCard title="Tần Suất Lấy Mẫu (Telemetry)">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputGroup label="Lấy mẫu mỗi (ms)" step="100" value={config.sampling_interval} onChange={(e: InputEvent) => setConfig({ ...config, sampling_interval: parseInt(e.target.value) })} />
              <InputGroup label="Gửi MQTT mỗi (ms)" step="1000" value={config.publish_interval} onChange={(e: InputEvent) => setConfig({ ...config, publish_interval: parseInt(e.target.value) })} />
              <div className="sm:col-span-2">
                <InputGroup label="Lọc nhiễu M.A Window (Mẫu)" step="1" value={config.moving_average_window} onChange={(e: InputEvent) => setConfig({ ...config, moving_average_window: parseInt(e.target.value) })} />
              </div>
            </div>
          </SubCard>

          <div className="px-5 py-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl mt-5 mb-3 flex items-start space-x-3 shadow-inner">
            <FlaskConical size={20} className="text-indigo-400 flex-shrink-0 animate-pulse" />
            <p className="text-xs text-indigo-200 leading-relaxed font-medium">Khu vực Hiệu Chuẩn Lõi (Calibration): Vui lòng chỉ thay đổi hệ số Voltage/K-Factor khi đang nhúng đầu dò trong dung dịch chuẩn.</p>
          </div>

          <SubCard title="ADC Calibration (Analog)">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputGroup label="Điện áp pH v7 (V)" step="0.01" value={config.ph_v7} onChange={(e: InputEvent) => setConfig({ ...config, ph_v7: parseFloat(e.target.value) })} />
              <InputGroup label="Điện áp pH v4 (V)" step="0.01" value={config.ph_v4} onChange={(e: InputEvent) => setConfig({ ...config, ph_v4: parseFloat(e.target.value) })} />
              <InputGroup label="Hệ số EC (K Factor)" step="1.0" value={config.ec_factor} onChange={(e: InputEvent) => setConfig({ ...config, ec_factor: parseFloat(e.target.value) })} />
              <InputGroup label="Độ Lệch EC tĩnh (Offset)" step="0.1" value={config.ec_offset} onChange={(e: InputEvent) => setConfig({ ...config, ec_offset: parseFloat(e.target.value) })} />
            </div>
          </SubCard>
        </AccordionSection>
      </div>

      {/* 🟢 THANH ĐIỀU KHIỂN FIXED Ở ĐÁY - GLASSMORPHISM */}
      <div className="fixed bottom-[90px] md:bottom-28 left-0 right-0 z-40 pointer-events-none">
        <div className="max-w-4xl mx-auto px-4">
          {/* Lớp nền mờ chìm dần lên trên */}
          <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent -z-10 pointer-events-none"></div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full pointer-events-auto bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 py-4 rounded-2xl font-black text-[13px] uppercase tracking-widest shadow-[0_10px_30px_rgba(16,185,129,0.4)] hover:shadow-[0_10px_40px_rgba(16,185,129,0.6)] hover:scale-[1.01] active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center space-x-2 relative overflow-hidden"
          >
            {/* Vệt sáng chạy ngang nút */}
            <div className="absolute inset-0 bg-white/20 -translate-x-full animate-[shimmer_3s_infinite]"></div>

            {isSaving ? (
              <span className="animate-spin w-5 h-5 border-[3px] border-slate-950/30 border-t-slate-950 rounded-full relative z-10"></span>
            ) : (
              <>
                <Save size={18} className="relative z-10" />
                <span className="relative z-10">LƯU & ĐỒNG BỘ FIRMWARE</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
