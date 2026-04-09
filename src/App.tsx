import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast'; // 🟢 1. Import Toaster

import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import './App.css';
import ControlPanel from './pages/ControlPanel';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import BlockchainHistory from './pages/BlockchainHistory';
import { useFCM } from './hooks/useFCM';

function App() {
  // 🟢 2. Luồng lắng nghe WebSocket chạy ngầm toàn hệ thống
  // Dù user chuyển qua trang Settings hay Analytics, App vẫn đang nghe Alert!

  useFCM();

  return (
    <BrowserRouter>
      {/* 🟢 3. Đặt Toaster ở đây để popup thông báo có thể đè lên mọi trang */}
      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{
          duration: 5000,
          style: {
            background: '#1e293b', // Hợp với theme dark của bạn
            color: '#fff',
            border: '1px solid #334155',
          },
        }}
      />

      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="control" element={<ControlPanel />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="blockchain" element={<BlockchainHistory />} /> {/* Sửa lại path bỏ dấu / ở đầu cho chuẩn nested route */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
