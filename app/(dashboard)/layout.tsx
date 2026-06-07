'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Terminal, Clock, CheckSquare, Sliders, Monitor, Cpu, Power, Briefcase, Calendar } from 'lucide-react';
import { db } from '@/lib/db';
import { sounds } from '@/lib/sounds';
import { useProductivityStore } from '@/stores/productivityStore';
import { useAuthStore } from '@/stores/authStore';
import DailyMoodCheck from '@/components/daily-mood-check';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Zustand bindings
  const { 
    settings, 
    timerRunning, 
    tick, 
    refreshData 
  } = useProductivityStore();

  const { 
    user, 
    initialize, 
    signOut 
  } = useAuthStore();

  // Clock state
  const [currentTime, setCurrentTime] = useState('');
  const [utcTime, setUtcTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  // Clock effect
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setUtcTime(now.toISOString().substring(11, 19) + ' UTC');
      setCurrentDate(now.toLocaleDateString('pt-BR', { weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric' }).toUpperCase());
    };
    updateTime();
    const clockInt = setInterval(updateTime, 1000);
    return () => clearInterval(clockInt);
  }, []);

  // Sync auth store
  useEffect(() => {
    const unsubAuth = initialize();
    return () => unsubAuth();
  }, [initialize]);

  // Sync db and productivity data
  useEffect(() => {
    db.initAuth();

    const unsubRefresh = db.subscribeDataRefresh(() => {
      refreshData();
    });

    // Run initial pull and refresh
    refreshData();

    return () => {
      unsubRefresh();
    };
  }, [refreshData, user]);

  // Global Pomodoro Ticker
  useEffect(() => {
    let timerInt: NodeJS.Timeout | null = null;
    if (timerRunning) {
      timerInt = setInterval(() => {
        tick();
      }, 1000);
    }
    return () => {
      if (timerInt) clearInterval(timerInt);
    };
  }, [timerRunning, tick]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        sounds.playButtonSwitch();
        router.push('/dashboard');
      } else if (e.key === 'F2') {
        e.preventDefault();
        sounds.playButtonSwitch();
        router.push('/pomodoro');
      } else if (e.key === 'F3') {
        e.preventDefault();
        sounds.playButtonSwitch();
        router.push('/projects');
      } else if (e.key === 'F4') {
        e.preventDefault();
        sounds.playButtonSwitch();
        router.push('/settings');
      } else if (e.key === 'F5') {
        e.preventDefault();
        sounds.playButtonSwitch();
        router.push('/weekly-planning');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  // CSS variables injector for theme custom values
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme_mode === 'AMBER') {
      root.style.setProperty('--color-amber', '#ffb347');
      root.style.setProperty('--color-amber-glow', 'rgba(255, 179, 71, 0.45)');
      root.style.setProperty('--color-amber-bg', '#0d0b09');
      root.style.setProperty('--color-amber-dark', '#331d05');
    } else if (settings.theme_mode === 'GREEN') {
      root.style.setProperty('--color-amber', '#33ff33');
      root.style.setProperty('--color-amber-glow', 'rgba(51, 255, 51, 0.45)');
      root.style.setProperty('--color-amber-bg', '#060e06');
      root.style.setProperty('--color-amber-dark', '#082c08');
    } else if (settings.theme_mode === 'COBALT') {
      root.style.setProperty('--color-amber', '#00e5ff');
      root.style.setProperty('--color-amber-glow', 'rgba(0, 229, 255, 0.45)');
      root.style.setProperty('--color-amber-bg', '#050b11');
      root.style.setProperty('--color-amber-dark', '#052c4c');
    }
    sounds.setEnabled(settings.sounds_enabled);
  }, [settings.theme_mode, settings.sounds_enabled]);

  // Styles helpers
  const borderStyle = settings.theme_mode === 'AMBER' 
    ? 'border-[#ffb347] amber-glow-border' 
    : settings.theme_mode === 'GREEN' 
      ? 'border-[#33ff33] green-glow-border'
      : 'border-[#00e5ff] cobalt-glow-border';

  const textStyle = settings.theme_mode === 'AMBER' 
    ? 'text-[#ffb347] amber-glow-text'
    : settings.theme_mode === 'GREEN'
      ? 'text-[#33ff33] green-glow-text'
      : 'text-[#00e5ff] cobalt-glow-text';

  const bgStyle = settings.theme_mode === 'AMBER'
    ? 'bg-[#0d0b09]'
    : settings.theme_mode === 'GREEN'
      ? 'bg-[#060e06]'
      : 'bg-[#050b11]';

  const handleSignOutUser = async () => {
    sounds.playAlarmBreak();
    await signOut();
    router.push('/login');
  };

  return (
    <div className={`min-h-screen ${bgStyle} selection:bg-[var(--color-amber)] selection:text-black p-4 md:p-6 font-mono crt-container transition-colors duration-500`}>
      {/* Scanline layer overlays */}
      {settings.scanlines_enabled && <div className="crt-scanlines" />}
      <div className="crt-vignette" />
      <div className="phosphor-beam" />

      {/* GLOBAL DIARY EMOTION CHECK-IN SYSTEM */}
      <DailyMoodCheck />

      {/* Retro background tech gridding */}
      <div className={`absolute inset-0 opacity-40 pointer-events-none ${
        settings.theme_mode === 'AMBER' ? 'tech-grid-bg' : settings.theme_mode === 'GREEN' ? 'tech-grid-bg-green' : 'tech-grid-bg-cobalt'
      }`} />

      {/* MAIN APPLICATION CONSOLE DISPLAY */}
      <div id="cathode-outer-shell" className="max-w-7xl mx-auto flex flex-col gap-5 h-full relative z-10">
        
        {/* TOP STATUS HEADER HUD */}
        <header id="hud-top-bar" className={`border-2 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between ${bgStyle} ${borderStyle} transition-all`}>
          <div className="flex items-center gap-3">
            <div className="p-2 border border-[var(--color-amber)] rounded bg-[var(--color-amber)]/10 animate-pulse">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <h1 className={`text-lg md:text-xl font-black tracking-widest flex items-center gap-2 ${textStyle}`}>
                RETRO_OS TERMINAL
                <span className="text-[10px] border px-1.5 py-0.5 rounded text-[var(--color-amber)]/80 inline-block font-normal tracking-normal animate-bounce">
                  SYNCED
                </span>
              </h1>
              <p className="text-[10px] text-[var(--color-amber)] opacity-80 uppercase">
                Estilo Analógico / Conforto & Foco Máximo
              </p>
            </div>
          </div>

          {/* DYNAMIC REAL-TIME CHRONOMETER WIDGET */}
          <div id="terminal-chronometer" className="flex items-center gap-6 border-l-0 md:border-l-2 border-[var(--color-amber)]/30 pl-0 md:pl-6 text-right w-full md:w-auto justify-between md:justify-end gap-x-8">
            <div className="text-left md:text-right">
              <div className={`text-xs uppercase font-semibold text-[var(--color-amber)] opacity-70`}>Local Time</div>
              <div className={`text-md md:text-lg font-bold tracking-widest font-mono ${textStyle}`}>
                {currentTime || "00:00:00"}
              </div>
            </div>
            <div className="hidden sm:block text-right">
              <div className="text-xs uppercase text-[var(--color-amber)] opacity-70">TVA Matrix Cycle</div>
              <div className="text-xs text-[var(--color-amber)] font-mono">{utcTime || "00:00:00 UTC"}</div>
            </div>
            <div className="text-right flex items-center gap-6">
              <div>
                <div className="text-xs uppercase text-[var(--color-amber)] opacity-70">{currentDate ? currentDate.split(',')[0] : 'HOJE'}</div>
                <div className="text-[11px] text-[var(--color-amber)] font-mono opacity-80">{currentDate ? currentDate.split(',')[1] : ''}</div>
              </div>
              
              {user && (
                <button 
                  onClick={handleSignOutUser}
                  title="Desconectar do Supabase"
                  className="p-2 border border-rose-900 bg-rose-950/20 hover:bg-rose-900 border-rose-500 rounded text-rose-500 hover:text-white transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Power className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* WORKSPACE DECKS */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 items-start">
          
          {/* LEFT SIDEBAR COMMAND RAIL */}
          <nav id="left-sidebar-navigation" className={`lg:col-span-1 border-2 p-4 rounded-xl flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible ${bgStyle} ${borderStyle}`}>
            <div className="hidden lg:block pb-2 mb-2 border-b border-[var(--color-amber)]/20 text-xs text-center tracking-widest text-[var(--color-amber)] opacity-60">
              [ NAV SYSTEM RAIL ]
            </div>

            <Link
              href="/dashboard"
              onClick={() => sounds.playButtonSwitch()}
              className={`flex-1 lg:flex-none py-2 px-3 text-left rounded flex items-center justify-between gap-2 border text-xs tracking-wider transition-all uppercase ${
                pathname === '/dashboard' 
                  ? 'bg-[var(--color-amber)] text-black border-[var(--color-amber)] font-black' 
                  : 'bg-transparent text-[var(--color-amber)] border-[var(--color-amber)]/30 hover:bg-[var(--color-amber)]/10'
              }`}
            >
              <span className="flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                HUD Dashboard
              </span>
              <span className="hidden lg:inline text-[9px] opacity-70">[F1]</span>
            </Link>

            <Link
              href="/pomodoro"
              onClick={() => sounds.playButtonSwitch()}
              className={`flex-1 lg:flex-none py-2 px-3 text-left rounded flex items-center justify-between gap-2 border text-xs tracking-wider transition-all uppercase ${
                pathname === '/pomodoro' 
                  ? 'bg-[var(--color-amber)] text-black border-[var(--color-amber)] font-black' 
                  : 'bg-transparent text-[var(--color-amber)] border-[var(--color-amber)]/30 hover:bg-[var(--color-amber)]/10'
              }`}
            >
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Pomodoro CRT
              </span>
              <span className="hidden lg:inline text-[9px] opacity-70">[F2]</span>
            </Link>

            <Link
              href="/projects"
              onClick={() => sounds.playButtonSwitch()}
              className={`flex-1 lg:flex-none py-2 px-3 text-left rounded flex items-center justify-between gap-2 border text-xs tracking-wider transition-all uppercase ${
                pathname === '/projects' 
                  ? 'bg-[var(--color-amber)] text-black border-[var(--color-amber)] font-black' 
                  : 'bg-transparent text-[var(--color-amber)] border-[var(--color-amber)]/30 hover:bg-[var(--color-amber)]/10'
              }`}
            >
              <span className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Projetos DEV
              </span>
              <span className="hidden lg:inline text-[9px] opacity-70">[F3]</span>
            </Link>

            <Link
              href="/weekly-planning"
              onClick={() => sounds.playButtonSwitch()}
              className={`flex-1 lg:flex-none py-2 px-3 text-left rounded flex items-center justify-between gap-2 border text-xs tracking-wider transition-all uppercase ${
                pathname === '/weekly-planning' 
                  ? 'bg-[var(--color-amber)] text-black border-[var(--color-amber)] font-black' 
                  : 'bg-transparent text-[var(--color-amber)] border-[var(--color-amber)]/30 hover:bg-[var(--color-amber)]/10'
              }`}
            >
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Foco Semanal
              </span>
              <span className="hidden lg:inline text-[9px] opacity-70">[F5]</span>
            </Link>

            <Link
              href="/settings"
              onClick={() => sounds.playButtonSwitch()}
              className={`flex-1 lg:flex-none py-2 px-3 text-left rounded flex items-center justify-between gap-2 border text-xs tracking-wider transition-all uppercase ${
                pathname === '/settings' 
                  ? 'bg-[var(--color-amber)] text-black border-[var(--color-amber)] font-black' 
                  : 'bg-transparent text-[var(--color-amber)] border-[var(--color-amber)]/30 hover:bg-[var(--color-amber)]/10'
              }`}
            >
              <span className="flex items-center gap-2">
                <Sliders className="w-4 h-4" />
                Ajustes Monitor
              </span>
              <span className="hidden lg:inline text-[9px] opacity-70">[F4]</span>
            </Link>

            <div className="hidden lg:flex flex-col gap-2 mt-4 pt-4 border-t border-[var(--color-amber)]/20 text-[10px] text-[var(--color-amber)] opacity-70 space-y-1 bg-[#1a140f]/20 p-2.5 rounded border border-[var(--color-amber)]/15">
              <div className="font-bold border-b border-[var(--color-amber)]/20 pb-1 mb-1 text-[var(--color-amber)] flex items-center gap-1.5 uppercase text-xxs">
                <Cpu className="w-3.5 h-3.5" /> Core Parameters
              </div>
              <div className="flex justify-between"><span>MEM:</span> <span>STABLE</span></div>
              <div className="flex justify-between"><span>CLK:</span> <span>3000 Hz</span></div>
              <div className="flex justify-between"><span>DISK:</span> <span className="text-[var(--color-amber)] text-right font-black tracking-widest">CLOUD_SVR</span></div>
              <div className="flex justify-between"><span>OPERATOR:</span> <span className="text-right truncate max-w-[90px]" title={user?.email || 'N/A'}>{user?.email ? user.email.split('@')[0].toUpperCase() : 'N/A'}</span></div>
            </div>
          </nav>

          {/* MAIN TAB SWITCH DECKS CONTENT */}
          <main id="tab-decks-content" className="lg:col-span-3 flex flex-col gap-5">
            {children}
          </main>
        </div>
        
        {/* BOTTOM HUD LEGAL BRANDINGS FOOTER */}
        <footer id="hud-bottom-footer" className="text-center opacity-70 text-[10px] p-4 font-mono tracking-widest border border-[var(--color-amber)]/20 rounded-xl mt-5 bg-[#090706]">
          <span>© 2026 RETRO CHRONOS CORE // ANCIENT MATRIX // BANK COGNITOR // TVA TIME MONITOR V4.02</span>
          <span className="hidden sm:inline mx-3">{"//"}</span>
          <span className="hidden sm:inline uppercase">[ RELIABILITY PROBABILITY LIMIT: EXCELLENT ]</span>
        </footer>
      </div>
    </div>
  );
}
