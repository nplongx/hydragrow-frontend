// src/pages/BlockchainHistory.tsx
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { fetch } from '@tauri-apps/plugin-http'; // <--- Import Native HTTP
import { ShieldCheck, Clock, ExternalLink, Box, Server, AlertTriangle } from 'lucide-react';

const DEVICE_ID = "device_001"; // Hardcode tạm cho demo

interface BlockchainRecord {
  id: number;
  device_id: string;
  action: string;
  tx_id: string;
  created_at: string;
}

const BlockchainHistory = () => {
  const [history, setHistory] = useState<BlockchainRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Lấy cấu hình máy chủ từ Store
      const settings: any = await invoke('load_settings').catch(() => null);
      if (!settings || !settings.backend_url) {
        throw new Error("Chưa cấu hình URL máy chủ. Vui lòng vào Cài đặt.");
      }

      const url = `${settings.backend_url}/api/blockchain/devices/${DEVICE_ID}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': settings.api_key
        }
      });

      if (!response.ok) throw new Error(`Lỗi máy chủ: HTTP ${response.status}`);

      const resData = await response.json();
      // Bóc vỏ data 
      const actualData = resData.data ? resData.data : resData;
      setHistory(actualData);
    } catch (err: any) {
      console.error("Lỗi tải lịch sử blockchain:", err);
      setError(err.message || (typeof err === 'string' ? err : "Không thể tải dữ liệu"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (txId: string) => {
    try {
      const settings: any = await invoke('load_settings').catch(() => null);
      if (!settings || !settings.backend_url) throw new Error("Missing config");

      const url = `${settings.backend_url}/api/blockchain/verify/${txId}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': settings.api_key
        }
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const resData = await response.json();
      const data = resData.data ? resData.data : resData;

      // Mở trình duyệt web của OS để xem trên Solscan
      window.open(data.verification_links.solscan, '_blank');
    } catch (err: any) {
      alert("Lỗi khi lấy link xác thực: " + (err.message || err));
    }
  };

  // Hàm rút gọn Transaction ID cho đỡ dài
  const truncateTx = (tx: string) => {
    if (!tx || tx.length < 15) return tx;
    return `${tx.slice(0, 6)}...${tx.slice(-6)}`;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        <p className="text-sm text-slate-400 font-medium animate-pulse">Đang đồng bộ sổ cái Solana...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 animate-in fade-in duration-500 pb-24">

      {/* Header */}
      <div className="flex items-start justify-between bg-slate-900/50 p-5 rounded-3xl border border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.05)]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1 flex items-center">
            <ShieldCheck className="text-indigo-400 mr-2" size={26} />
            Nhật Ký Niêm Phong
          </h1>
          <p className="text-sm text-slate-400">
            Dữ liệu thiết bị được mã hóa và lưu trữ vĩnh viễn trên mạng lưới Solana.
          </p>
        </div>
        <div className="hidden sm:flex items-center space-x-2 bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20">
          <Server size={14} className="text-indigo-400" />
          <span className="text-xs font-semibold text-indigo-300">Solana Devnet</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-4 flex items-start space-x-3 text-red-400">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Danh sách Timeline */}
      <div className="space-y-4 relative">
        {/* Đường line dọc chạy dọc theo danh sách */}
        <div className="absolute left-6 top-4 bottom-4 w-px bg-slate-800 -z-10"></div>

        {history.length === 0 && !error ? (
          <div className="text-center py-10 text-slate-500 text-sm">Chưa có dữ liệu nào được niêm phong.</div>
        ) : (
          history.map((record, index) => (
            <div key={record.id || index} className="flex items-start space-x-4">

              {/* Icon / Node trên timeline */}
              <div className="shrink-0 mt-1">
                <div className="h-12 w-12 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center shadow-lg">
                  <Box size={20} className="text-indigo-400" />
                </div>
              </div>

              {/* Card nội dung */}
              <div className="flex-1 bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-2xl p-4 hover:border-indigo-500/30 transition-colors group">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">

                  <div>
                    <h4 className="text-white font-semibold text-sm capitalize">
                      {record.action.replace(/_/g, ' ')}
                    </h4>
                    <div className="flex items-center space-x-3 mt-1.5 text-xs text-slate-400">
                      <span className="flex items-center">
                        <Clock size={12} className="mr-1" />
                        {new Date(record.created_at).toLocaleString('vi-VN')}
                      </span>
                    </div>
                  </div>

                  {/* Phần hiển thị Tx và Nút check */}
                  <div className="flex items-center bg-slate-950 rounded-xl p-1.5 border border-slate-800">
                    <span className="px-3 font-mono text-[11px] text-slate-400">
                      {truncateTx(record.tx_id)}
                    </span>
                    <button
                      onClick={() => handleVerify(record.tx_id)}
                      className="flex items-center space-x-1 bg-indigo-500 hover:bg-indigo-400 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-lg shadow-indigo-500/20"
                    >
                      <ExternalLink size={12} />
                      <span>Xác thực</span>
                    </button>
                  </div>

                </div>
              </div>

            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default BlockchainHistory;
