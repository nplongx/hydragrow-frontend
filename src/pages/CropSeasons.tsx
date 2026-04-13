import React, { useState } from 'react';
import { useCropSeason } from '../hooks/useCropSeason';
import { Sprout, Calendar, Leaf, Play, StopCircle, CheckCircle2, History } from 'lucide-react';

export const CropSeasons = () => {
  const { activeSeason, history, isLoading, createSeason, endSeason } = useCropSeason();
  const [newName, setNewName] = useState('');
  const [newPlant, setNewPlant] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    const success = await createSeason(newName, newPlant);
    if (success) {
      setNewName('');
      setNewPlant('');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 text-slate-400">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <Sprout size={32} className="text-indigo-400" />
          <p>Đang tải dữ liệu mùa vụ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6 text-slate-50">
      <div className="flex items-center gap-2 mb-2">
        <Sprout className="text-indigo-400" size={26} />
        <h1 className="text-2xl font-bold">Quản lý Mùa vụ</h1>
      </div>

      {/* --- PHẦN 1: MÙA VỤ ĐANG CHẠY HOẶC FORM TẠO MỚI --- */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        {activeSeason ? (
          <div className="p-5 md:p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-emerald-400 flex items-center gap-2">
                <Play size={20} className="fill-emerald-400/20" />
                Mùa vụ đang chạy
              </h2>
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">
              <div className="space-y-1">
                <p className="text-xs text-slate-400">Tên mùa vụ</p>
                <p className="text-sm font-medium">{activeSeason.name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-400">Giống cây trồng</p>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Leaf size={14} className="text-emerald-500" />
                  {activeSeason.plant_type || 'Không xác định'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-400">Thời gian bắt đầu</p>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Calendar size={14} className="text-blue-400" />
                  {new Date(activeSeason.start_time).toLocaleString('vi-VN')}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                if (window.confirm('Bạn chắc chắn muốn kết thúc mùa vụ này?')) endSeason()
              }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition-colors font-medium"
            >
              <StopCircle size={18} />
              Kết thúc Mùa vụ
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="p-5 md:p-6 space-y-5">
            <h2 className="text-lg font-semibold text-indigo-400 flex items-center gap-2">
              <Sprout size={20} />
              Bắt đầu mùa vụ mới
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Tên mùa vụ *</label>
                <input
                  type="text"
                  placeholder="VD: Dưa lưới vụ Xuân 2026"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-50 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Giống cây trồng</label>
                <input
                  type="text"
                  placeholder="VD: Dưa lưới, Cà chua..."
                  value={newPlant}
                  onChange={(e) => setNewPlant(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-50 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-900/20 font-medium transition-colors"
            >
              Khởi tạo ngay
            </button>
          </form>
        )}
      </div>

      {/* --- PHẦN 2: LỊCH SỬ MÙA VỤ --- */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-5 border-b border-slate-800">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <History size={20} className="text-slate-400" />
            Lịch sử Mùa vụ
          </h2>
        </div>

        <div className="divide-y divide-slate-800/50">
          {history.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              Chưa có dữ liệu mùa vụ nào.
            </div>
          ) : (
            history.map((season) => (
              <div key={season.id} className="p-4 hover:bg-slate-800/30 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-slate-200">{season.name}</h3>
                  {season.status === 'active' ? (
                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[10px] font-medium uppercase tracking-wider">
                      Đang chạy
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded text-[10px] font-medium uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle2 size={10} />
                      Hoàn tất
                    </span>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Leaf size={12} className="text-slate-500" />
                    {season.plant_type || 'Không xác định'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar size={12} className="text-slate-500" />
                    {new Date(season.start_time).toLocaleDateString('vi-VN')}
                    {season.end_time ? ` - ${new Date(season.end_time).toLocaleDateString('vi-VN')}` : ' - Nay'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
