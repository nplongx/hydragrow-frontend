// src/pages/ControlPanel.tsx
import { FlaskConical, Droplets, Waves, AlertTriangle, Power } from 'lucide-react';
import { useDeviceSensor } from '../hooks/useDeviceSensor';
import { useDeviceControl } from '../hooks/useDeviceControl';

const DEVICE_ID = "HYDRO_001"; // Hardcode tạm cho demo

const ControlPanel = () => {
  const { sensorData, deviceStatus, isLoading } = useDeviceSensor(DEVICE_ID);
  const { isProcessing, error, togglePump, toggleValve } = useDeviceControl(DEVICE_ID);

  if (isLoading || !sensorData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fuchsia-500"></div>
      </div>
    );
  }

  const pumps = sensorData.pump_status;
  const isOnline = deviceStatus.is_online;

  // ── Component phụ: Nút gạt (Toggle Switch) phong cách iOS ──
  const Switch = ({ isOn, disabled }: { isOn: boolean; disabled: boolean }) => (
    <div className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/75 ${isOn ? 'bg-emerald-500' : 'bg-slate-700'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${isOn ? 'translate-x-5' : 'translate-x-0'}`} />
    </div>
  );

  // ── Component phụ: Thẻ thiết bị (Bento Card) ──
  const ControlCard = ({
    title, icon: Icon, colorClass, isOn, onToggle
  }: {
    title: string; icon: any; colorClass: string; isOn: boolean; onToggle: () => void
  }) => (
    <div
      onClick={() => { if (!isProcessing && isOnline) onToggle(); }}
      className={`bg-slate-900 border ${isOn ? 'border-slate-600' : 'border-slate-800'} rounded-3xl p-4 flex items-center justify-between cursor-pointer transition-all active:scale-95`}
    >
      <div className="flex items-center space-x-3">
        <div className={`p-3 rounded-2xl bg-slate-800 ${isOn ? colorClass : 'text-slate-500'}`}>
          <Icon size={24} />
        </div>
        <span className="font-semibold text-white">{title}</span>
      </div>
      <Switch isOn={isOn} disabled={isProcessing || !isOnline} />
    </div>
  );

  return (
    <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Bảng Điều Khiển</h1>
        <p className="text-sm text-slate-400">Quản lý thủ công các bơm và van an toàn.</p>
      </div>

      {/* Cảnh báo lỗi từ Rust ValveGuard (Nếu có) */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-4 flex items-start space-x-3 animate-in fade-in zoom-in duration-300">
          <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="text-sm font-semibold text-red-400">Lệnh bị từ chối</h4>
            <p className="text-sm text-red-300/80 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Trạng thái mạng */}
      {!isOnline && (
        <div className="bg-orange-500/10 border border-orange-500/50 rounded-2xl p-4 text-center">
          <p className="text-sm font-medium text-orange-400">Thiết bị đang Offline. Không thể điều khiển.</p>
        </div>
      )}

      {/* ── Nhóm 1: Bơm Dinh Dưỡng & pH ── */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-2">Dosing Pumps</h3>
        <div className="grid grid-cols-1 gap-3">
          <ControlCard
            title="Bơm Dinh Dưỡng A" icon={FlaskConical} colorClass="text-blue-400"
            isOn={pumps.A === 'on'}
            onToggle={() => togglePump('A', pumps.A === 'on' ? 'off' : 'on')}
          />
          <ControlCard
            title="Bơm Dinh Dưỡng B" icon={FlaskConical} colorClass="text-indigo-400"
            isOn={pumps.B === 'on'}
            onToggle={() => togglePump('B', pumps.B === 'on' ? 'off' : 'on')}
          />
          <ControlCard
            title="Bơm pH UP (+)" icon={Droplets} colorClass="text-fuchsia-400"
            isOn={pumps.PH_UP === 'on'}
            onToggle={() => togglePump('PH_UP', pumps.PH_UP === 'on' ? 'off' : 'on')}
          />
          <ControlCard
            title="Bơm pH DOWN (-)" icon={Droplets} colorClass="text-pink-500"
            isOn={pumps.PH_DOWN === 'on'}
            onToggle={() => togglePump('PH_DOWN', pumps.PH_DOWN === 'on' ? 'off' : 'on')}
          />
        </div>
      </section>

      {/* ── Nhóm 2: Tuần hoàn & Cấp Xả ── */}
      <section className="space-y-3 pt-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-2">Main System</h3>
        <div className="grid grid-cols-1 gap-3">
          <ControlCard
            title="Bơm Tuần Hoàn" icon={Waves} colorClass="text-cyan-400"
            isOn={pumps.CIRCULATION === 'on'}
            onToggle={() => togglePump('CIRCULATION', pumps.CIRCULATION === 'on' ? 'off' : 'on')}
          />
          <ControlCard
            title="Bơm Cấp Nước" icon={Power} colorClass="text-emerald-400"
            isOn={pumps.WATER_PUMP === 'on'}
            onToggle={() => togglePump('WATER_PUMP', pumps.WATER_PUMP === 'on' ? 'off' : 'on')}
          />
          <ControlCard
            title="Van Đầu Vào (VAN IN)" icon={Waves} colorClass="text-blue-500"
            isOn={pumps.VAN_IN === 'open'}
            onToggle={() => toggleValve('VAN_IN', pumps.VAN_IN === 'open' ? 'closed' : 'open')}
          />
          <ControlCard
            title="Van Đầu Ra (VAN OUT)" icon={Waves} colorClass="text-orange-500"
            isOn={pumps.VAN_OUT === 'open'}
            onToggle={() => toggleValve('VAN_OUT', pumps.VAN_OUT === 'open' ? 'closed' : 'open')}
          />
        </div>
      </section>

      {/* Padding dưới cùng để không bị che bởi Bottom Nav */}
      <div className="h-6"></div>
    </div>
  );
};

export default ControlPanel;
