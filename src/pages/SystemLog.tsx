import React, { useState } from 'react';
import {
  AlertTriangle, CheckCircle, Info, Droplets,
  Filter, Clock, X, ChevronDown, ChevronUp,
  Cpu, Thermometer, Activity, Waves, Server,
  ShieldAlert, Zap, Eye
} from 'lucide-react';
import { useDeviceContext } from '../context/DeviceContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface SystemEvent {
  level: string;
  title: string;
  message: string;
  timestamp: number;
  reason?: string;
  metadata?: Record<string, any> | null;
  device_id?: string;
  category?: string;
}

const getEventStyle = (level: string, title: string) => {
  if (level === 'critical')
    return {
      icon: ShieldAlert,
      color: 'text-rose-400',
      nodeBg: 'bg-rose-500/20 border-rose-400',
      shadow: 'shadow-[0_0_15px_rgba(244,63,94,0.6)]',
      cardBg: 'bg-gradient-to-r from-rose-500/10 to-transparent border-rose-500/20',
      badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    };
  if (level === 'warning')
    return {
      icon: AlertTriangle,
      color: 'text-amber-400',
      nodeBg: 'bg-amber-500/20 border-amber-400',
      shadow: 'shadow-[0_0_15px_rgba(245,158,11,0.6)]',
      cardBg: 'bg-gradient-to-r from-amber-500/10 to-transparent border-amber-500/20',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    };
  if (level === 'success')
    return {
      icon: CheckCircle,
      color: 'text-emerald-400',
      nodeBg: 'bg-emerald-500/20 border-emerald-400',
      shadow: 'shadow-[0_0_15px_rgba(16,185,129,0.6)]',
      cardBg: 'bg-gradient-to-r from-emerald-500/10 to-transparent border-emerald-500/20',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    };
  if (title.includes('Châm Phân') || title.includes('Điều Chỉnh pH'))
    return {
      icon: Droplets,
      color: 'text-cyan-400',
      nodeBg: 'bg-cyan-500/20 border-cyan-400',
      shadow: 'shadow-[0_0_15px_rgba(6,182,212,0.6)]',
      cardBg: 'bg-gradient-to-r from-cyan-500/10 to-transparent border-cyan-500/20',
      badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    };
  return {
    icon: Info,
    color: 'text-indigo-400',
    nodeBg: 'bg-indigo-500/20 border-indigo-400',
    shadow: 'shadow-[0_0_15px_rgba(99,102,241,0.6)]',
    cardBg: 'bg-gradient-to-r from-indigo-500/10 to-transparent border-indigo-500/20',
    badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  };
};

/** Hiển thị giá trị sensor từ metadata */
const SensorMetadataRow = ({ label, value, unit, icon: Icon, color }: any) => {
  if (value === undefined || value === null) return null;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-800/50 last:border-0">
      <div className={`flex items-center gap-2 text-xs text-slate-400`}>
        <Icon size={12} className={color} />
        <span>{label}</span>
      </div>
      <span className={`text-xs font-bold ${color}`}>
        {typeof value === 'number' ? value.toFixed(2) : String(value)} {unit}
      </span>
    </div>
  );
};

/** Modal hiển thị chi tiết sự kiện */
const EventDetailModal = ({ event, onClose }: { event: SystemEvent; onClose: () => void }) => {
  const style = getEventStyle(event.level, event.title);
  const Icon = style.icon;

  const meta = event.metadata as any;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" />

      {/* Modal */}
      <div
        className="relative w-full sm:max-w-lg bg-slate-900 border border-slate-700/80 rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl z-10 animate-in slide-in-from-bottom-8 duration-300 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow top bar theo màu level */}
        <div className={`h-1 w-full ${event.level === 'critical' ? 'bg-rose-500' :
          event.level === 'warning' ? 'bg-amber-500' :
            event.level === 'success' ? 'bg-emerald-500' : 'bg-indigo-500'
          } shadow-[0_0_15px_currentColor]`} />

        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${style.nodeBg} border ${style.shadow}`}>
              <Icon size={20} className={style.color} />
            </div>
            <div>
              <h3 className={`font-black text-base tracking-wide ${style.color}`}>{event.title}</h3>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                {new Date(event.timestamp).toLocaleString('vi-VN')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="px-5 pb-6 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Nội dung thông báo */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Nội dung</p>
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">{event.message}</p>
          </div>

          {/* Lý do (reason) – hiển thị nổi bật */}
          {event.reason && (
            <div className={`border rounded-2xl p-4 ${event.level === 'critical'
              ? 'bg-rose-500/10 border-rose-500/30'
              : event.level === 'warning'
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-slate-800/50 border-slate-700/50'
              }`}>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <AlertTriangle size={10} className={style.color} /> Nguyên nhân / Mã lỗi
              </p>
              <p className={`text-sm font-bold ${style.color} font-mono break-all`}>{event.reason}</p>
            </div>
          )}

          {/* Metadata – số liệu cảm biến tại thời điểm xảy ra sự kiện */}
          {meta && (
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-4">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Cpu size={10} className="text-indigo-400" /> Số liệu cảm biến tại thời điểm xảy ra
              </p>

              <div className="space-y-0.5">
                <SensorMetadataRow label="EC" value={meta.ec_value} unit="mS/cm" icon={Activity} color="text-blue-400" />
                <SensorMetadataRow label="pH" value={meta.ph_value} unit="" icon={Droplets} color="text-fuchsia-400" />
                <SensorMetadataRow label="Nhiệt độ" value={meta.temp_value} unit="°C" icon={Thermometer} color="text-orange-400" />
                <SensorMetadataRow label="Mực nước" value={meta.water_level} unit="cm" icon={Waves} color="text-cyan-400" />

                {/* Các lỗi cảm biến */}
                {(meta.err_ec || meta.err_ph || meta.err_temp || meta.err_water) && (
                  <div className="pt-2 mt-2 border-t border-slate-700/50">
                    <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-2">Cảm biến báo lỗi</p>
                    <div className="flex flex-wrap gap-2">
                      {meta.err_ec && <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 text-[10px] font-bold rounded-full border border-rose-500/30">EC</span>}
                      {meta.err_ph && <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 text-[10px] font-bold rounded-full border border-rose-500/30">pH</span>}
                      {meta.err_temp && <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 text-[10px] font-bold rounded-full border border-rose-500/30">Nhiệt độ</span>}
                      {meta.err_water && <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 text-[10px] font-bold rounded-full border border-rose-500/30">Mực nước</span>}
                    </div>
                  </div>
                )}

                {/* Thông tin kết nối */}
                {(meta.rssi !== undefined || meta.free_heap !== undefined || meta.uptime !== undefined) && (
                  <div className="pt-2 mt-2 border-t border-slate-700/50">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Thông tin kết nối</p>
                    {meta.rssi !== undefined && (
                      <SensorMetadataRow label="RSSI WiFi" value={meta.rssi} unit="dBm" icon={Server} color="text-emerald-400" />
                    )}
                    {meta.free_heap !== undefined && (
                      <SensorMetadataRow label="RAM còn lại" value={(meta.free_heap / 1024).toFixed(1)} unit="KB" icon={Cpu} color="text-indigo-400" />
                    )}
                    {meta.uptime !== undefined && (
                      <SensorMetadataRow label="Uptime" value={meta.uptime} unit="s" icon={Clock} color="text-slate-400" />
                    )}
                  </div>
                )}

                {/* Pump status */}
                {meta.pump_status && typeof meta.pump_status === 'object' && (
                  <div className="pt-2 mt-2 border-t border-slate-700/50">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Trạng thái bơm khi xảy ra</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(meta.pump_status).map(([key, val]) =>
                        val ? (
                          <span key={key} className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-[10px] font-bold rounded-full border border-orange-500/30">
                            {key.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        ) : null
                      )}
                    </div>
                  </div>
                )}

                {/* JSON thô nếu có trường khác */}
                {meta && Object.keys(meta).some(k =>
                  !['ec_value', 'ph_value', 'temp_value', 'water_level',
                    'err_ec', 'err_ph', 'err_temp', 'err_water',
                    'rssi', 'free_heap', 'uptime', 'pump_status'].includes(k)
                ) && (
                    <div className="pt-2 mt-2 border-t border-slate-700/50">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Dữ liệu thêm</p>
                      <pre className="text-[10px] text-slate-400 font-mono overflow-x-auto bg-slate-950/50 p-2 rounded-lg border border-slate-800">
                        {JSON.stringify(
                          Object.fromEntries(
                            Object.entries(meta).filter(([k]) =>
                              !['ec_value', 'ph_value', 'temp_value', 'water_level',
                                'err_ec', 'err_ph', 'err_temp', 'err_water',
                                'rssi', 'free_heap', 'uptime', 'pump_status'].includes(k)
                            )
                          ),
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* Khi không có metadata nào */}
          {!meta && !event.reason && (
            <div className="text-center py-4 text-slate-600 text-xs font-medium">
              Không có dữ liệu chi tiết bổ sung.
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const SystemLog = () => {
  const { systemEvents, deviceId } = useDeviceContext();
  const [filter, setFilter] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<SystemEvent | null>(null);

  const filteredEvents: SystemEvent[] = (systemEvents as SystemEvent[]).filter(ev => {
    if (filter === 'all') return true;
    if (filter === 'error') return ev.level === 'critical' || ev.level === 'warning';
    if (filter === 'dosing')
      return ev.title.includes('Châm Phân') || ev.title.includes('Điều Chỉnh pH') || ev.title.includes('Solana');
    if (filter === 'info') return ev.level === 'info' || ev.level === 'success';
    return true;
  });

  const hasDetail = (ev: SystemEvent) =>
    !!(ev.reason || (ev.metadata && Object.keys(ev.metadata).length > 0));

  return (
    <div className="p-4 space-y-6 pb-28 min-h-screen">

      {/* Header */}
      <div className="flex flex-col space-y-1 animate-in slide-in-from-top-4 duration-500">
        <h1 className="text-3xl font-extrabold flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <Clock size={24} className="text-emerald-400" />
          </div>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500">
            Nhật Ký Hệ Thống
          </span>
        </h1>
        <p className="text-sm text-slate-400 ml-1">
          Lịch sử vận hành trạm thủy canh {deviceId || ''}
        </p>
      </div>

      {/* Bộ lọc */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-4 flex flex-col space-y-3 shadow-lg animate-in fade-in duration-700">
        <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 flex items-center gap-1.5 ml-1">
          <Filter size={12} /> Bộ lọc thông minh
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${filter === 'all' ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)] scale-105' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            Tất cả ({systemEvents.length})
          </button>
          <button
            onClick={() => setFilter('error')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${filter === 'error' ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.5)] scale-105' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            Lỗi & Cảnh báo
          </button>
          <button
            onClick={() => setFilter('dosing')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${filter === 'dosing' ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.5)] scale-105' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            Dinh dưỡng & pH
          </button>
          <button
            onClick={() => setFilter('info')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${filter === 'info' ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] scale-105' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            Thông tin
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-[19px] top-4 bottom-0 w-0.5 bg-gradient-to-b from-slate-700 via-slate-800 to-transparent" />

        <div className="space-y-5">
          {filteredEvents.length === 0 ? (
            <div className="pl-12 flex flex-col items-center justify-center py-16 opacity-50 animate-in zoom-in">
              <Zap size={48} className="text-slate-600 mb-3" />
              <p className="text-sm text-slate-400 font-medium">Hệ thống đang chờ lệnh mới...</p>
            </div>
          ) : (
            filteredEvents.map((ev, idx) => {
              const { icon: Icon, color, nodeBg, shadow, cardBg, badge } = getEventStyle(ev.level, ev.title);
              const date = new Date(ev.timestamp);
              const canExpand = hasDetail(ev);

              // Trích xuất mã lỗi từ reason (nếu có) để hiện ngắn trên card
              const shortReason = ev.reason
                ? ev.reason.length > 60 ? ev.reason.slice(0, 60) + '…' : ev.reason
                : null;

              return (
                <div
                  key={idx}
                  className="relative pl-12 group animate-in slide-in-from-bottom-4 fade-in"
                  style={{ animationFillMode: 'both', animationDuration: '600ms', animationDelay: `${idx * 60}ms` }}
                >
                  {/* Node trên timeline */}
                  <div
                    className={`absolute left-2.5 top-3.5 p-1.5 rounded-full border-2 ${nodeBg} bg-slate-950 ${shadow} transition-all duration-300 group-hover:scale-125 z-10`}
                  >
                    <Icon size={12} className={color} strokeWidth={2.5} />
                  </div>

                  {/* Card */}
                  <div
                    className={`flex flex-col space-y-2 p-4 rounded-2xl border ${cardBg} backdrop-blur-md transition-all duration-300 group-hover:translate-x-1`}
                  >
                    {/* Header card */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-sm font-extrabold tracking-wide ${color} truncate`}>{ev.title}</h4>

                        {/* EmergencyStop: luôn hiện reason nổi bật ngay dưới tiêu đề */}
                        {ev.level === 'critical' && ev.reason && (
                          <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 text-[10px] font-bold rounded-lg border ${badge}`}>
                            <ShieldAlert size={10} />
                            {shortReason}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-slate-300 font-bold bg-slate-900/80 border border-slate-700/50 px-2 py-1 rounded-lg whitespace-nowrap shadow-sm">
                          {date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    {ev.message}

                    {/* Nội dung rút gọn */}
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line font-medium opacity-90">
                    </p>

                    {/* Warning level: hiện reason nếu có */}
                    {ev.level === 'warning' && shortReason && (
                      <div className="flex items-center gap-1.5 text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5 font-mono">
                        <AlertTriangle size={10} />
                        {shortReason}
                      </div>
                    )}

                    {/* Nút xem chi tiết */}
                    {canExpand && (
                      <button
                        onClick={() => setSelectedEvent(ev)}
                        className={`flex items-center gap-1.5 self-start px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 border ${ev.level === 'critical'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                          : ev.level === 'warning'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                            : 'bg-slate-800/60 text-slate-400 border-slate-700/50 hover:bg-slate-700/60 hover:text-slate-200'
                          }`}
                      >
                        <Eye size={12} />
                        Xem chi tiết
                        {ev.metadata && <span className="ml-1 px-1.5 py-0.5 bg-current/20 rounded text-[9px]">+metadata</span>}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal Chi Tiết */}
      {selectedEvent && (
        <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}

    </div>
  );
};

export default SystemLog;
