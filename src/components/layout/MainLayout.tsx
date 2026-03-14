import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, SlidersHorizontal, LineChart, Settings } from 'lucide-react';

const MainLayout = () => {
  // Danh sách các tab điều hướng
  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Tổng quan' },
    { path: '/control', icon: SlidersHorizontal, label: 'Điều khiển' },
    { path: '/analytics', icon: LineChart, label: 'Phân tích' },
    { path: '/settings', icon: Settings, label: 'Cài đặt' },
  ];

  return (
    // Nền tối (Dark Mode First), chữ xám sáng
    <div className="flex flex-col h-screen bg-slate-950 text-slate-50 font-sans overflow-hidden pt-[env(safe-area-inset-top)]">

      {/* Khu vực hiển thị nội dung trang (có cuộn) */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 w-full bg-slate-900/80 backdrop-blur-lg border-t border-slate-800 pb-safe pb-[calc(8px+env(safe-area-inset-bottom))]">
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center w-16 space-y-1 transition-colors ${isActive ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
                }`
              }
            >
              <item.icon size={24} strokeWidth={2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

    </div>
  );
};

export default MainLayout;

