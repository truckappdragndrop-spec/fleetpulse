import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import {
  LayoutDashboard,
  Truck,
  Wrench,
  Fuel,
  Package,
  BarChart3,
  ClipboardCheck,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { getAuth, signOut } from 'firebase/auth';
import { useFirebaseAuth } from '@/hooks/useFirebaseAuth';

const menuItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/trucks', icon: Truck, label: 'Trucks' },
  { path: '/maintenance', icon: Wrench, label: 'Maintenance' },
  { path: '/fuel', icon: Fuel, label: 'Fuel' },
  { path: '/inventory', icon: Package, label: 'Inventory' },
  { path: '/checklists', icon: ClipboardCheck, label: 'Checklists' },
  { path: '/reports', icon: BarChart3, label: 'Reports' },
];

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { user } = useFirebaseAuth();

  // Fecha o menu ao trocar de página (celular)
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Fecha com a tecla Esc
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const handleLogout = async () => {
    await signOut(getAuth());
  };

  return (
    <>
      {/* Botão do menu — só no celular */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isOpen}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-xl transition-colors"
        style={{
          background: 'var(--bg-panel-solid)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--accent-amber)',
        }}
      >
        {isOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      <aside
        className={`fixed left-0 top-0 h-full w-64 z-40 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{
          background: 'var(--bg-panel-solid)',
          borderRight: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex flex-col h-full p-5">
          <div className="mb-8 pl-2" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: 'var(--accent-amber)' }}
            >
              FleetPulse
            </h1>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Drag n' Drop
            </p>
          </div>

          <nav className="space-y-1 flex-1 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path));

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={isActive ? 'page' : undefined}
                  className="relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors"
                  style={{
                    background: isActive ? 'rgba(232, 168, 56, 0.12)' : 'transparent',
                    color: isActive ? 'var(--accent-amber)' : 'var(--text-secondary)',
                    fontWeight: isActive ? 600 : 500,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }
                  }}
                >
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r"
                      style={{ background: 'var(--accent-amber)' }}
                    />
                  )}
                  <Icon size={19} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div
            className="mt-4 pt-4"
            style={{ borderTop: '1px solid var(--border-divider)' }}
          >
            {user?.email && (
              <p
                className="px-4 pb-2 text-xs truncate"
                title={user.email}
                style={{ color: 'var(--text-muted)' }}
              >
                {user.email}
              </p>
            )}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(184, 64, 64, 0.12)';
                e.currentTarget.style.color = 'var(--accent-red)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              <LogOut size={19} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(2px)' }}
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
