import { Link, Outlet, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { LogOut, Menu, User as UserIcon, Settings, Home, Calendar, User, Sun, Moon } from 'lucide-react';
import { useState } from 'react';
import { ProfileModal } from './ProfileModal';

const LOGO_URL = "https://zuwdcmdcrofvfexmbilg.supabase.co/storage/v1/object/public/config/426654866_357201383868846_3491990617951420183_n.jpg";

export function DashboardLayout() {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const location = useLocation();

  const getRoleLabel = () => {
    if (profile?.role === 'admin') return 'Administrador';
    if (profile?.role === 'barber') return 'Barbeiro';
    return profile?.subscription_type === 'clube' ? 'Assinante Premium 👑' : 'Cliente Comum';
  };

  // Define os itens do menu dinamicamente baseado no cargo (role)
  const navItems = profile?.role === 'admin' 
    ? [
        { to: '/admin', icon: Home, label: 'Home' }, // Home mostra o dashboard de Admin
        { to: '/profile', icon: Settings, label: 'Admin' }, // Admin serve como painel de configuração
      ]
    : [
        { to: '/', icon: Home, label: 'Home' },
        { 
          to: profile?.role === 'barber' ? '/barber' : '/booking', 
          icon: Calendar, 
          label: 'Agenda' 
        },
        { to: '/profile', icon: User, label: 'Perfil' },
      ];

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-[#0a0502] dark:text-white pb-24 transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-[#0a0502]/80 backdrop-blur-md border-b border-zinc-200 dark:border-white/5">
        <div className="mx-auto flex h-24 max-w-lg md:max-w-4xl lg:max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <img src={LOGO_URL} alt="Tiago Barber" className="h-16 w-auto" referrerPolicy="no-referrer" />
            
            <nav className="hidden md:flex items-center gap-6">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:text-gold ${
                    location.pathname === item.to ? 'text-gold' : 'text-zinc-500'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          
          <button 
            onClick={() => setMenuOpen(true)}
            className="flex items-center gap-3 hover:bg-white/5 p-1 rounded-2xl transition-colors"
          >
            <div className="flex flex-col text-right">
              <span className="text-[10px] text-zinc-400 leading-none mb-1">Olá, {profile?.name?.split(' ')[0]}!</span>
              <span className="text-[9px] text-gold font-bold uppercase tracking-widest leading-none">{getRoleLabel()}</span>
            </div>
            <div className="h-10 w-10 rounded-full overflow-hidden border border-gold/20">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="h-full w-full bg-zinc-800 flex items-center justify-center">
                  <UserIcon className="h-5 w-5 text-gold" />
                </div>
              )}
            </div>
          </button>
        </div>
      </header>

      {/* Menu Overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center px-4 pb-24 md:pb-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div 
            className="w-full max-w-lg origin-bottom md:origin-center rounded-3xl bg-white dark:bg-[#1a1614] py-4 shadow-2xl ring-1 ring-zinc-200 dark:ring-gold/20 animate-in slide-in-from-bottom-10 md:slide-in-from-top-10 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-2 border-b border-zinc-200 dark:border-white/5 mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold text-gold uppercase tracking-widest">Menu Principal</p>
              <button onClick={() => setMenuOpen(false)} className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Fechar</button>
            </div>
            
            {/* Itens do menu renderizados dinamicamente */}
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center px-6 py-4 text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                >
                  <Icon className="mr-4 h-5 w-5 text-gold" />
                  {item.label}
                </Link>
              );
            })}

            <div className="border-t border-zinc-200 dark:border-white/5 mt-2 pt-2">
              <button
                onClick={() => {
                  toggleTheme();
                }}
                className="flex w-full items-center px-6 py-4 text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="mr-4 h-5 w-5 text-gold" />
                    Modo Claro
                  </>
                ) : (
                  <>
                    <Moon className="mr-4 h-5 w-5 text-gold" />
                    Modo Escuro
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setProfileModalOpen(true);
                }}
                className="flex w-full items-center px-6 py-4 text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
              >
                <Settings className="mr-4 h-5 w-5 text-gold" />
                Configurações da Conta
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  signOut();
                }}
                className="flex w-full items-center px-6 py-4 text-sm font-bold text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="mr-4 h-5 w-5" />
                Sair do Aplicativo
              </button>
            </div>
          </div>
          {/* Backdrop click to close */}
          <div className="absolute inset-0 -z-10" onClick={() => setMenuOpen(false)}></div>
        </div>
      )}

      {/* Profile Modal */}
      <ProfileModal 
        isOpen={profileModalOpen} 
        onClose={() => setProfileModalOpen(false)} 
      />

      {/* Main Content */}
      <main className="mx-auto max-w-lg md:max-w-4xl lg:max-w-6xl px-4 pt-2 pb-6">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-[#0a0502]/90 backdrop-blur-xl border-t border-zinc-200 dark:border-white/5 px-6 py-3 md:hidden">
        <div className="mx-auto max-w-lg md:max-w-4xl lg:max-w-6xl flex items-center justify-between">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`flex flex-col items-center gap-1 transition-all ${
                  isActive ? 'text-gold scale-110' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Icon className={`h-6 w-6 ${isActive ? 'fill-gold/20' : ''}`} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
          
          {/* Menu Button in Nav */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`flex flex-col items-center gap-1 transition-all ${
              menuOpen ? 'text-gold scale-110' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Menu className={`h-6 w-6 ${menuOpen ? 'fill-gold/20' : ''}`} />
            <span className="text-[10px] font-medium">Menu</span>
          </button>
        </div>
      </nav>
    </div>
  );
}