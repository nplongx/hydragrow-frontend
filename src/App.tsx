import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import './App.css';
import ControlPanel from './pages/ControlPanel';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import BlockchainHistory from './pages/BlockchainHistory';
// Import các page khác khi tạo xong...

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="control" element={<ControlPanel />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="/blockchain" element={<BlockchainHistory />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
