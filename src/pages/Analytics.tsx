import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Download, Activity, Droplets, Thermometer, Waves } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { SensorData } from '../types/models';

const DEVICE_ID = "device_001";

// type response từ Rust
type SensorHistoryResponse = {
  data: SensorData[];
  status: string;
};

const Analytics = () => {
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Lấy dữ liệu 24h
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setIsLoading(true);

        const end = new Date();
        const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

        const response = await invoke<SensorHistoryResponse>(
          'get_sensor_history',
          {
            deviceId: DEVICE_ID,
            start: start.toISOString(),
            end: end.toISOString(),
            limit: 100
          }
        );

        console.log("Dữ liệu thô từ Rust:", JSON.stringify(response, null, 2));

        const formattedData = response.data.map((d) => ({
          ...d,
          formattedTime: new Date(d.timestamp).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
          })
        }));

        setHistoryData(formattedData.reverse());

      } catch (error) {
        console.error("Lỗi lấy lịch sử:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, []);

  // Export CSV
  const handleExportCSV = async () => {
    setIsExporting(true);

    try {
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

      const csvString = await invoke<string>('export_csv', {
        deviceId: DEVICE_ID,
        start: start.toISOString(),
        end: end.toISOString()
      });

      const blob = new Blob([csvString], {
        type: 'text/csv;charset=utf-8;'
      });

      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `hydro_export_${Date.now()}.csv`);

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error("Lỗi xuất CSV:", error);
    } finally {
      setIsExporting(false);
    }
  };

  // Tooltip cho chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 p-3 rounded-xl shadow-xl">
          <p className="text-slate-300 text-xs mb-2 font-medium">
            {label}
          </p>

          {payload.map((entry: any, index: number) => (
            <div
              key={index}
              className="flex items-center space-x-2 text-sm font-bold"
              style={{ color: entry.color }}
            >
              <span>{entry.name}:</span>
              <span>{entry.value.toFixed(2)}</span>
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
            Phân Tích
          </h1>
          <p className="text-sm text-slate-400">
            Dữ liệu 24 giờ qua
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={isExporting}
          className="bg-slate-800 hover:bg-slate-700 text-white p-2.5 rounded-2xl transition-all active:scale-95 disabled:opacity-50"
        >
          {isExporting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Download size={20} />
          )}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="space-y-6">

          {/* EC Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 pt-6">
            <div className="flex items-center space-x-2 mb-4 px-2">
              <Activity className="text-blue-400" size={20} />
              <h3 className="text-white font-semibold">
                Biến thiên EC
              </h3>
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorEc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="formattedTime" stroke="#64748b" fontSize={12} tickMargin={10} minTickGap={30} />
                  <YAxis stroke="#64748b" fontSize={12} domain={['auto', 'auto']} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="ec_value" name="EC" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorEc)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* PH Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 pt-6">
            <div className="flex items-center space-x-2 mb-4 px-2">
              <Droplets className="text-fuchsia-400" size={20} />
              <h3 className="text-white font-semibold">
                Biến thiên pH
              </h3>
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPh" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d946ef" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#d946ef" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="formattedTime" stroke="#64748b" fontSize={12} tickMargin={10} minTickGap={30} />
                  <YAxis stroke="#64748b" fontSize={12} domain={[0, 14]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="ph_value" name="pH" stroke="#d946ef" strokeWidth={3} fillOpacity={1} fill="url(#colorPh)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* NHIỆT ĐỘ Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 pt-6">
            <div className="flex items-center space-x-2 mb-4 px-2">
              <Thermometer className="text-orange-400" size={20} />
              <h3 className="text-white font-semibold">
                Biến thiên Nhiệt độ (°C)
              </h3>
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="formattedTime" stroke="#64748b" fontSize={12} tickMargin={10} minTickGap={30} />
                  <YAxis stroke="#64748b" fontSize={12} domain={['auto', 'auto']} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="temp_value" name="Nhiệt độ" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorTemp)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* MỰC NƯỚC Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 pt-6">
            <div className="flex items-center space-x-2 mb-4 px-2">
              <Waves className="text-cyan-400" size={20} />
              <h3 className="text-white font-semibold">
                Mực Nước Hệ Thống (%)
              </h3>
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorWater" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="formattedTime" stroke="#64748b" fontSize={12} tickMargin={10} minTickGap={30} />
                  <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="water_level" name="Mực nước" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#colorWater)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}

      <div className="h-6"></div>
    </div>
  );
};

export default Analytics;
