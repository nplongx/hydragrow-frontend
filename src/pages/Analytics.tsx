import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { Calendar, Clock, Filter, Activity, Thermometer, Droplets, Waves } from 'lucide-react';
import { useDeviceContext } from '../context/DeviceContext';
import { useCropSeason } from '../hooks/useCropSeason';
import { fetch } from '@tauri-apps/plugin-http';

// Component con để render biểu đồ cho đẹp
const ChartCard = ({ title, data, dataKey, color, unit, icon: Icon }: any) => (
  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center space-x-2">
        <div className={`p-2 rounded-lg bg-${color}-500/10`}>
          <Icon size={18} className={`text-${color}-500`} />
        </div>
        <h3 className="text-sm font-medium text-slate-300">{title}</h3>
      </div>
      <span className="text-xs text-slate-500">{unit}</span>
    </div>
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`color${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color === 'emerald' ? '#10b981' : color === 'blue' ? '#3b82f6' : '#f59e0b'} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color === 'emerald' ? '#10b981' : color === 'blue' ? '#3b82f6' : '#f59e0b'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="time"
            hide
          />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
            itemStyle={{ color: '#f8fafc' }}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color === 'emerald' ? '#10b981' : color === 'blue' ? '#3b82f6' : '#f59e0b'}
            fillOpacity={1}
            fill={`url(#color${dataKey})`}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const Analytics = () => {
  const { deviceId, settings } = useDeviceContext();
  // Lấy data từ hook của bạn
  const { activeSeason, history } = useCropSeason();

  // Gộp activeSeason và history lại, loại bỏ trùng lặp ID (nếu activeSeason nằm sẵn trong history)
  const allSeasons = useMemo(() => {
    const list = [...history];
    if (activeSeason && !list.find(s => s.id === activeSeason.id)) {
      list.unshift(activeSeason);
    }
    // Sắp xếp giảm dần theo ngày tạo để mùa mới nhất nổi lên trên cùng
    return list.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  }, [activeSeason, history]);

  // States cho bộ lọc
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('realtime');
  const [timeRange, setTimeRange] = useState<string>('24h');
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  // Logic lấy dữ liệu lịch sử
  useEffect(() => {
    const loadHistory = async () => {
      if (!deviceId || !settings) return;
      setIsFetching(true);

      let start: string;
      let end = new Date().toISOString();

      if (selectedSeasonId !== 'realtime') {
        // Lấy mùa vụ người dùng đang chọn
        const season = allSeasons.find(s => s.id.toString() === selectedSeasonId);
        if (season) {
          start = season.start_time;
          // Nếu mùa vụ chưa kết thúc (end_date === null), lấy đến thời điểm hiện tại
          end = season.end_time || new Date().toISOString();
        } else {
          start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        }
      } else {
        const now = Date.now();
        const diff = timeRange === '24h' ? 24 : timeRange === '7d' ? 24 * 7 : 24 * 30;
        start = new Date(now - diff * 60 * 60 * 1000).toISOString();
      }

      try {
        const url = `${settings.backend_url}/api/devices/${deviceId}/sensors/history?start=${start}&end=${end}`;

        // Custom hàm fetch an toàn do Tauri dạo này hay bị lỗi stream rỗng
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'X-API-Key': settings.api_key }
        });

        if (response.ok) {
          const text = await response.text();
          if (text && text.trim() !== '') {
            const res = JSON.parse(text);
            // Chuyển đổi format thời gian để Recharts hiển thị HH:mm hoặc DD/MM
            const formatted = (res.data || res).map((d: any) => {
              const dateObj = new Date(d.time);
              return {
                ...d,
                time: selectedSeasonId === 'realtime' && timeRange === '24h'
                  ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
              };
            });
            setHistoryData(formatted);
          } else {
            setHistoryData([]);
          }
        }
      } catch (error) {
        console.error("Lỗi fetch lịch sử:", error);
      } finally {
        setIsFetching(false);
      }
    };

    loadHistory();
  }, [selectedSeasonId, timeRange, deviceId, settings, allSeasons]);

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="flex flex-col space-y-1">
        <h1 className="text-2xl font-bold text-white">Phân Tích Dữ Liệu</h1>
        <p className="text-sm text-slate-400">Theo dõi biến thiên chỉ số môi trường</p>
      </div>

      {/* Bộ lọc (Filter Bar) */}
      <div className="grid grid-cols-2 gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1">
            <Filter size={10} /> Mùa vụ
          </label>
          <select
            value={selectedSeasonId}
            onChange={(e) => setSelectedSeasonId(e.target.value)}
            className="w-full bg-slate-800 border-none text-slate-200 text-sm rounded-xl py-2 px-3 focus:ring-1 focus:ring-emerald-500 outline-none"
          >
            <option value="realtime">Dữ liệu gần đây</option>
            {allSeasons.map((s) => (
              <option key={s.id} value={s.id.toString()}>
                {s.name} {s.end_time ? '(Đã chốt)' : '(Đang trồng)'}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1">
            <Clock size={10} /> Khoảng thời gian
          </label>
          <select
            disabled={selectedSeasonId !== 'realtime'}
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="w-full bg-slate-800 border-none text-slate-200 text-sm rounded-xl py-2 px-3 focus:ring-1 focus:ring-emerald-500 outline-none disabled:opacity-30"
          >
            <option value="24h">24 giờ qua</option>
            <option value="7d">7 ngày qua</option>
            <option value="30d">30 ngày qua</option>
          </select>
        </div>
      </div>

      {/* Loading state */}
      {isFetching ? (
        <div className="h-64 flex flex-col items-center justify-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          <p className="text-slate-500 text-sm">Đang tải dữ liệu lịch sử...</p>
        </div>
      ) : historyData.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-3xl">
          <Activity className="text-slate-700 mb-2" size={40} />
          <p className="text-slate-500 text-sm">Không có dữ liệu trong khoảng này</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 animate-in fade-in duration-700">
          <ChartCard
            title="Dinh dưỡng (EC)"
            data={historyData}
            dataKey="ec_value"
            color="blue"
            unit="mS/cm"
            icon={Activity}
          />
          <ChartCard
            title="Độ pH"
            data={historyData}
            dataKey="ph_value"
            color="emerald"
            unit="pH"
            icon={Droplets}
          />
          <ChartCard
            title="Nhiệt độ"
            data={historyData}
            dataKey="temp_value"
            color="orange"
            unit="°C"
            icon={Thermometer}
          />
          <ChartCard
            title="Mực nước"
            data={historyData}
            dataKey="water_level"
            color="blue"
            unit="cm"
            icon={Waves}
          />
        </div>
      )}
    </div>
  );
};

export default Analytics;
