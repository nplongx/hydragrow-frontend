// src/pages/ControlPanel.tsx
import { FlaskConical, Droplets, Waves, AlertTriangle, Power } from 'lucide-react';
import { useDeviceSensor } from '../hooks/useDeviceSensor';
import { useDeviceControl } from '../hooks/useDeviceControl';

const DEVICE_ID = "device_001"; // Hardcode tạm cho demo

const ControlPanel = () => {
  const { sensorData, deviceStatus, isLoading, updatePumpStatusOptimistically } = useDeviceSensor(DEVICE_ID);
  const { isProcessing, error, togglePump } = useDeviceControl(DEVICE_ID);

  if (isLoading || !sensorData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fuchsia-500"></div>
      </div>
    );
  }

  const pumps = sensorData.pump_status || {};
  const isOnline = deviceStatus?.is_online || false;
  const isChamberOn = pumps.CHAMBER_PUMP === 'on';

  // ── Component phụ: Nút gạt (Toggle Switch) phong cách iOS ──
  const Switch = ({ isOn, disabled }: { isOn: boolean; disabled: boolean }) => (
    <div className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none shadow-inner ${isOn ? 'bg-emerald-500' : 'bg-slate-700'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
      <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out ${isOn ? 'translate-x-5' : 'translate-x-0'}`} />
    </div>
  );

  const handleToggle = async (pumpId: string, currentStatus: string | undefined, isDosingPump: boolean = false) => {
    const isOn = currentStatus === 'on';
    const targetAction = isOn ? 'off' : 'on';

    if (isDosingPump && !isOn && !isChamberOn) {
      alert("⚠️ CẢNH BÁO AN TOÀN:\nVui lòng bật 'Bơm buồng trộn' trước khi châm dinh dưỡng hoặc pH!");
      return;
    }

    // A. OPTIMISTIC UPDATE: Cập nhật UI ngay lập tức cho người dùng thấy mượt mà
    updatePumpStatusOptimistically(pumpId, targetAction);

    const success = await togglePump(pumpId, targetAction);

    if (!success) {
      updatePumpStatusOptimistically(pumpId, isOn ? 'on' : 'off');
    }
  };

  // ── Component phụ: Thẻ thiết bị (Bento Card) nâng cấp ──
  const ControlCard = ({
    title, icon: Icon, colorClass, borderClass, isOn, onToggle, lockedMessage, isCompact = false
  }: {
    title: string; icon: any; colorClass: string; borderClass: string; isOn: boolean; onToggle: () => void; lockedMessage?: string; isCompact?: boolean
  }) => {
    // Thẻ bị khóa nếu có lockedMessage VÀ đang tắt (Vẫn cho phép tắt nếu lỡ đang bật)
    const isLocked = lockedMessage && !isOn;

    const handleClick = () => {
      if (!isOnline) {
        alert("Thiết bị đang Offline. Không thể điều khiển!");
        return;
      }
      if (isProcessing) return;

      onToggle();
    };

    return (
      <div
        onClick={handleClick}
        className={`relative overflow-hidden bg-slate-900/80 backdrop-blur-sm border-2 rounded-3xl ${isCompact ? 'p-3' : 'p-4'} flex items-center justify-between transition-all duration-300 active:scale-[0.98] cursor-pointer
          ${isOn ? `border-${borderClass} shadow-[0_0_15px_rgba(0,0,0,0.2)] shadow-${borderClass}/20` : 'border-slate-800 hover:border-slate-700'}
          ${isLocked ? 'opacity-60 grayscale-[0.3]' : ''}
        `}
      >
        <div className={`flex items-center ${isCompact ? 'space-x-2' : 'space-x-4'} z-10 overflow-hidden`}>
          {/* Icon Box */}
          <div className={`p-2.5 rounded-2xl shrink-0 transition-colors duration-300 ${isOn ? `bg-${borderClass}/10 ${colorClass}` : 'bg-slate-800 text-slate-500'}`}>
            <Icon size={isCompact ? 20 : 24} />
          </div>

          {/* Thông tin thiết bị */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center space-x-2">
              <span className={`font-semibold truncate transition-colors duration-300 ${isCompact ? 'text-sm' : ''} ${isOn ? 'text-white' : 'text-slate-300'}`}>
                {title}
              </span>
              {isOn && (
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </div>

            {isLocked && (
              <span className={`text-[11px] font-medium text-orange-400 mt-0.5 flex items-center ${isCompact ? 'truncate whitespace-nowrap' : ''}`}>
                <AlertTriangle size={10} className="mr-1 shrink-0" /> <span className="truncate">{lockedMessage}</span>
              </span>
            )}
          </div>
        </div>

        {/* Nút gạt */}
        <div className="z-10 shrink-0 ml-2">
          <Switch isOn={isOn} disabled={isProcessing || !isOnline} />
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Bảng Điều Khiển</h1>
          <p className="text-sm text-slate-400">Quản lý thủ công trạm bơm thủy canh.</p>
        </div>
        {/* Trạng thái Online/Offline thu gọn */}
        <div className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center space-x-2 ${isOnline ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
          <div className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-500'}`}></div>
          <span>{isOnline ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      {/* Cảnh báo lỗi từ Rust backend (Nếu có) */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-4 flex items-start space-x-3 animate-in fade-in zoom-in duration-300 shadow-lg shadow-red-500/5">
          <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="text-sm font-semibold text-red-400">Lệnh bị từ chối</h4>
            <p className="text-sm text-red-300/80 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* ── Nhóm 2: Tuần hoàn & Cấp Xả ── */}
      <section className="space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-2">Hệ Thống Chính</h3>
        <div className="grid grid-cols-1 gap-3">
          <ControlCard
            title="Bơm Tuần Hoàn" icon={Waves} colorClass="text-cyan-400" borderClass="cyan-500"
            isOn={pumps.CIRCULATION === 'on'}
            onToggle={() => handleToggle('CIRCULATION', pumps.CIRCULATION)} // Dùng hàm handleToggle mới
          />
          <ControlCard
            title="Bơm Buồng Trộn" icon={Waves} colorClass="text-blue-400" borderClass="blue-500"
            isOn={pumps.CHAMBER_PUMP === 'on'}
            onToggle={() => handleToggle('CHAMBER_PUMP', pumps.CHAMBER_PUMP)}
          />
          <ControlCard
            title="Bơm Cấp Nước" icon={Power} colorClass="text-emerald-400" borderClass="emerald-500"
            isOn={pumps.WATER_PUMP === 'on'}
            onToggle={() => handleToggle('WATER_PUMP', pumps.WATER_PUMP)}
          />
          <ControlCard
            title="Bơm Xả Nước" icon={Waves} colorClass="text-red-400" borderClass="red-500"
            isOn={pumps.DRAIN_PUMP === 'on'}
            onToggle={() => handleToggle('DRAIN_PUMP', pumps.DRAIN_PUMP)}
          />
        </div>
      </section>

      {/* ── Nhóm 1: Bơm Dinh Dưỡng & pH ── */}
      <section className="space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-2">Châm Dinh Dưỡng (Dosing)</h3>
        <div className="grid grid-cols-1 gap-3">
          <ControlCard
            title="Bơm Dinh Dưỡng A" icon={FlaskConical} colorClass="text-fuchsia-400" borderClass="fuchsia-500"
            isOn={pumps.A === 'on'}
            onToggle={() => handleToggle('A', pumps.A, true)} // Thêm true ở cuối báo hiệu là bơm Dosing
            lockedMessage={!isChamberOn ? "Yêu cầu bật Bơm buồng trộn" : undefined}
          />
          <ControlCard
            title="Bơm Dinh Dưỡng B" icon={FlaskConical} colorClass="text-purple-400" borderClass="purple-500"
            isOn={pumps.B === 'on'}
            onToggle={() => handleToggle('B', pumps.B, true)}
            lockedMessage={!isChamberOn ? "Yêu cầu bật Bơm buồng trộn" : undefined}
          />
          <ControlCard
            title="pH UP (+)" icon={Droplets} colorClass="text-orange-400" borderClass="orange-500"
            isOn={pumps.PH_UP === 'on'}
            onToggle={() => handleToggle('PH_UP', pumps.PH_UP, true)}
            lockedMessage={!isChamberOn ? "Khóa an toàn: Cần bật Bơm buồng trộn" : undefined}
          />
          <ControlCard
            title="pH DOWN (-)" icon={Droplets} colorClass="text-pink-500" borderClass="pink-500"
            isOn={pumps.PH_DOWN === 'on'}
            onToggle={() => handleToggle('PH_DOWN', pumps.PH_DOWN, true)}
            lockedMessage={!isChamberOn ? "Khóa an toàn: Cần bật Bơm buồng trộn" : undefined}
          />
        </div>
      </section>
    </div>
  );
};

export default ControlPanel;
