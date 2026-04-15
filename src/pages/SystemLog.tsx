import React, { useState } from 'react';
import {
  AlertTriangle, CheckCircle, Info, Droplets,
  Activity, Filter, Clock, Calendar
} from 'lucide-react';
import { useDeviceContext } from '../context/DeviceContext';

const SystemLog = () => {
  const { systemEvents, deviceId } = useDeviceContext();
  const [filter, setFilter] = useState<string>('all');

  // Hàm xác định icon và màu sắc cho từng loại sự kiện
  const getEventStyle = (level: string, title: string) => {
    if (level === 'critical') return { icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/30' };
    if (level === 'warning') return { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/30' };
    if (level === 'success') return { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/30' };
    if (title.includes('Châm Phân') || title.includes('Điều Chỉnh pH')) return { icon: Droplets, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' };
    return { icon: Info, color: 'text-slate-400', bg: 'bg-slate-700/30 border-slate-600' };
  };

  // Logic lọc sự kiện
  const filteredEvents = systemEvents.filter(ev => {
    if (filter === 'all') return true;
    if (filter === 'error') return ev.level === 'critical' || ev.level === 'warning';
    if (filter === 'dosing') return ev.title.includes('Châm Phân') || ev.title.includes('Điều Chỉnh pH') || ev.title.includes('Solana');
    if (filter === 'info') return ev.level === 'info';
    return true;
  });

  return (
    <div className="p-4 space-y-6 pb-24 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col space-y-1">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Clock size={24} className="text-emerald-500" />
          Nhật Ký Hệ Thống
        </h1>
        <p className="text-sm text-slate-400">
          Truy vết hoạt động của trạm {deviceId || 'chưa kết nối'}
        </p>
      </div>

      {/* Thanh công cụ / Bộ lọc */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col space-y-3">
        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1">
          <Filter size={12} /> Lọc sự kiện theo:
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filter === 'all' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            Tất cả
          </button>
          <button
            onClick={() => setFilter('error')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filter === 'error' ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            Cảnh báo Lỗi
          </button>
          <button
            onClick={() => setFilter('dosing')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filter === 'dosing' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            Dinh dưỡng & pH
          </button>
          <button
            onClick={() => setFilter('info')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filter === 'info' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            Bơm nước & Khác
          </button>
        </div>
      </div>

      {/* Khu vực Timeline */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6">
        <div className="relative border-l-2 border-slate-800/80 ml-3 md:ml-4 space-y-8">

          {filteredEvents.length === 0 ? (
            <div className="pl-6 flex flex-col items-center justify-center py-10 opacity-50">
              <Calendar size={40} className="text-slate-500 mb-2" />
              <p className="text-sm text-slate-400">Không có sự kiện nào phù hợp.</p>
            </div>
          ) : (
            filteredEvents.map((ev, idx) => {
              const { icon: Icon, color, bg } = getEventStyle(ev.level, ev.title);
              const date = new Date(ev.timestamp);

              return (
                <div key={idx} className="relative pl-6 md:pl-8 animate-in slide-in-from-bottom-2">
                  {/* Điểm Neo (Node) trên trục thời gian */}
                  <div className={`absolute -left-[13px] top-0 p-1.5 rounded-full border-2 ${bg} bg-slate-900 shadow-sm`}>
                    <Icon size={14} className={color} />
                  </div>

                  {/* Hộp nội dung sự kiện */}
                  <div className="flex flex-col space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h4 className={`text-sm font-bold ${color}`}>{ev.title}</h4>
                      <span className="text-xs text-slate-500 font-medium bg-slate-800/50 px-2 py-0.5 rounded-md">
                        {date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>

                    {/* Ngày tháng nếu khác ngày hiện tại (Optional) */}
                    <p className="text-xs text-slate-400/70">
                      Ngày {date.toLocaleDateString('vi-VN')}
                    </p>

                    <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-3 mt-1">
                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                        {ev.message}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}

        </div>
      </div>

    </div>
  );
};

export default SystemLog;
