import React from 'react';
import { LayoutDashboard, Server, Settings, ShieldAlert } from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
  currentTab: 'dashboard' | 'hosts' | 'settings';
  onTabChange: (tab: 'dashboard' | 'hosts' | 'settings') => void;
  currentUser?: { username: string } | null;
  onLogout?: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  currentTab,
  onTabChange,
  currentUser,
  onLogout,
}) => {
  const navItems = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'hosts' as const, label: 'Hosts', icon: Server },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-slate-100 flex flex-col lg:flex-row">
      {/* Desktop Sidebar (>= 1024px) */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-indigo-900/20 bg-[#0f1119]/80 backdrop-blur-md p-4 fixed h-full z-20">
        <div className="flex items-center gap-3 px-3 py-4 mb-6 border-b border-indigo-900/20">
          <div className="w-10 h-10 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold text-xl shadow-[0_0_15px_rgba(99,102,241,0.3)]">
            W
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wider text-slate-100 uppercase font-mono">Warlock</h1>
            <span className="text-xs text-cyan-400 font-medium tracking-wide">Fleet Manager</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                  active
                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.15)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer with user and logout */}
        <div className="pt-4 border-t border-indigo-900/20 space-y-2">
          {currentUser && (
            <div className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs">
              <span className="font-mono text-slate-300 truncate">@{currentUser.username}</span>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="text-[11px] text-rose-400 hover:underline cursor-pointer"
                >
                  Sign Out
                </button>
              )}
            </div>
          )}
          <div className="p-2.5 bg-indigo-950/20 border border-indigo-900/30 rounded-lg text-[11px] text-slate-400 flex items-center gap-2">
            <ShieldAlert size={14} className="text-indigo-400 shrink-0" />
            <span>Fleet Connected</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-64 p-4 lg:p-8 mb-20 lg:mb-0 max-w-7xl mx-auto w-full">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar (< 1024px) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0f1119]/95 backdrop-blur-lg border-t border-indigo-900/30 flex items-center justify-around px-2 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center flex-1 h-full min-h-[48px] py-1 transition-colors cursor-pointer ${
                active ? 'text-indigo-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon size={20} />
              <span className="text-[11px] mt-1 tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
