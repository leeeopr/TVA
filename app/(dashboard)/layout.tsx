'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Terminal, Clock, CheckSquare, Sliders, Monitor, Cpu, Power, Briefcase, Calendar, Plus, X, AlertOctagon } from 'lucide-react';
import { db } from '@/lib/db';
import { sounds } from '@/lib/sounds';
import { useProductivityStore } from '@/stores/productivityStore';
import { useAuthStore } from '@/stores/authStore';
import DailyMoodCheck from '@/components/daily-mood-check';
import { motion, AnimatePresence } from 'motion/react';

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

  // Global task creation states
  const [globalModalOpen, setGlobalModalOpen] = useState(false);
  const [globalTitle, setGlobalTitle] = useState('');
  const [globalDesc, setGlobalDesc] = useState('');
  const [globalGroupId, setGlobalGroupId] = useState('');
  const [globalCategoryId, setGlobalCategoryId] = useState('');
  const [globalDueDate, setGlobalDueDate] = useState('');
  const [globalTimePeriod, setGlobalTimePeriod] = useState('');
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalSaving, setGlobalSaving] = useState(false);

  const availableCategories = useProductivityStore(s => s.categories);
  const availablePeriods = useProductivityStore(s => s.periods);
  const groupsList = db.getGroups();

  const handleOpenGlobalModal = () => {
    sounds.playButtonSwitch();
    const currentGroups = db.getGroups();
    if (currentGroups.length > 0) {
      setGlobalGroupId(currentGroups[0].id);
    } else {
      setGlobalGroupId('');
    }
    setGlobalTitle('');
    setGlobalDesc('');
    setGlobalCategoryId('');
    setGlobalDueDate('');
    setGlobalTimePeriod('');
    setGlobalError(null);
    setGlobalSaving(false);
    setGlobalModalOpen(true);
  };

  // Escape key close listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setGlobalModalOpen(false);
      }
    };
    if (globalModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [globalModalOpen]);

  const handleGlobalCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalTitle.trim()) return;
    
    let gid = globalGroupId;
    const currentGroups = db.getGroups();
    if (!gid && currentGroups.length > 0) {
      gid = currentGroups[0].id;
    }
    
    if (!gid) {
      setGlobalError("Não é possível criar tarefas sem um Grupo / Dossiê cadastrado. Crie um grupo primeiro em 'Projetos DEV'.");
      sounds.playAlarmBreak();
      return;
    }

    try {
      setGlobalSaving(true);
      setGlobalError(null);
      
      // Save directly to raw database layer (inserts directly to Supabase and awaits confirmation)
      await db.saveTask(
        gid,
        globalCategoryId || null,
        globalTitle.trim(),
        globalDesc.trim() || null,
        globalDueDate || null,
        null,
        globalTimePeriod || null
      );

      // Force instant Zustand store update
      refreshData();
      
      // Success logs
      db.addLog(`GLOBAL_CAPTURE_SUITE: TASK '${globalTitle.slice(0, 15)}...' CREATED & PERSISTED IN SECURE DECK.`, 'success');
      sounds.playButtonSwitch();

      // Close modal
      setGlobalModalOpen(false);
    } catch (err: any) {
      console.error("Critical global task create exception:", err);
      setGlobalError(err.message || 'Erro crítico de rede ao salvar tarefa no banco remoto.');
      sounds.playAlarmBreak();
    } finally {
      setGlobalSaving(false);
    }
  };

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

      {/* FLOATING ACTION BUTTON (FAB) FOR CENTRAL TASK CAPTURE */}
      <button
        onClick={handleOpenGlobalModal}
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-14 h-14 rounded-full border-2 bg-black hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer transition-all duration-300 shadow-xl ${
          settings.theme_mode === 'AMBER' 
            ? 'border-[#ffb347] text-[#ffb347] hover:bg-[#ffb347]/10 hover:shadow-[#ffb347]/20 amber-glow-border shadow-[0_0_15px_rgba(255,179,71,0.25)]' 
            : settings.theme_mode === 'GREEN' 
              ? 'border-[#33ff33] text-[#33ff33] hover:bg-[#33ff33]/10 hover:shadow-[#33ff33]/20 green-glow-border shadow-[0_0_15px_rgba(51,255,51,0.25)]'
              : 'border-[#00e5ff] text-[#00e5ff] hover:bg-[#00e5ff]/10 hover:shadow-[#00e5ff]/20 cobalt-glow-border shadow-[0_0_15px_rgba(0,229,255,0.25)]'
        }`}
        title="Formulário Rápido de Tarefa"
      >
        <Plus className="w-8 h-8 animate-pulse" />
      </button>

      {/* GLOBAL CENTRALIZED TASK CREATION MODAL */}
      <AnimatePresence>
        {globalModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 overflow-y-auto backdrop-blur-md"
            onClick={() => setGlobalModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className={`max-w-xl w-full border-2 rounded-xl p-6 bg-zinc-950 text-left space-y-6 ${borderStyle}`}
            >
              
              {/* MODAL HEADER */}
              <div className="border-b border-white/10 pb-3 flex justify-between items-center text-xs text-white/90 font-mono tracking-widest font-black">
                <span className="font-extrabold flex items-center gap-1.5 uppercase">
                  <Plus className="w-4 h-4 text-[var(--color-amber)]" /> [ NOVA TAREFA - CAPTURA GLOBAL ]
                </span>
                <button
                  onClick={() => { sounds.playButtonSwitch(); setGlobalModalOpen(false); }}
                  className="p-1 text-white hover:text-rose-400 transition-colors uppercase cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* MODAL ERROR SYSTEM */}
              {globalError && (
                <div className="p-3 border border-rose-500/30 bg-rose-950/20 text-rose-400 font-mono text-[10px] uppercase rounded flex items-start gap-2">
                  <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5 animate-pulse" />
                  <div className="space-y-1">
                    <span className="font-bold block">[! ADVERTÊNCIA DE INTERFACE]:</span>
                    <span className="opacity-90">{globalError}</span>
                  </div>
                </div>
              )}

              {/* FORM */}
              <form onSubmit={handleGlobalCreateTask} className="space-y-4 font-mono text-xs text-white">
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] text-white/70 uppercase tracking-widest mb-1.5 font-bold">Título da Tarefa</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Atualizar prontuários médicos, Cadastrar nova consulta"
                      value={globalTitle}
                      onChange={(e) => setGlobalTitle(e.target.value)}
                      className="w-full bg-black border border-white/20 p-2.5 text-xs text-white focus:border-[var(--color-amber)] focus:outline-none rounded"
                      disabled={globalSaving}
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] text-white/70 uppercase tracking-widest mb-1.5 font-bold">Descrição / Observações Adicionais (Opcional)</label>
                    <textarea
                      placeholder="Detalhes adicionais, identificadores táteis, notas..."
                      value={globalDesc}
                      rows={3}
                      onChange={(e) => setGlobalDesc(e.target.value)}
                      className="w-full bg-black border border-white/20 p-2.5 text-xs text-white focus:border-[var(--color-amber)] focus:outline-none rounded resize-none"
                      disabled={globalSaving}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] text-white/70 uppercase tracking-widest mb-1.5 font-bold">Dossiê / Grupo de Trabalho</label>
                      <select
                        value={globalGroupId}
                        onChange={(e) => {
                          setGlobalGroupId(e.target.value);
                          setGlobalCategoryId(''); // Reset category filter on group change
                        }}
                        className="w-full bg-black border border-white/20 p-2.5 text-xs text-white focus:border-[var(--color-amber)] focus:outline-none rounded cursor-pointer uppercase"
                        disabled={globalSaving}
                      >
                        {groupsList.length === 0 ? (
                          <option value="">Nenhum grupo cadastrado</option>
                        ) : (
                          groupsList.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] text-white/70 uppercase tracking-widest mb-1.5 font-bold">Categoria (Opcional)</label>
                      <select
                        value={globalCategoryId}
                        onChange={(e) => setGlobalCategoryId(e.target.value)}
                        className="w-full bg-black border border-white/20 p-2.5 text-xs text-white focus:border-[var(--color-amber)] focus:outline-none rounded cursor-pointer uppercase"
                        disabled={globalSaving}
                      >
                        <option value="">Sem Categoria</option>
                        {availableCategories
                          .filter(c => c.group_id === globalGroupId)
                          .map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] text-white/70 uppercase tracking-widest mb-1.5 font-bold">Bloco de Período Temporal</label>
                      <select
                        value={globalTimePeriod}
                        onChange={(e) => setGlobalTimePeriod(e.target.value)}
                        className="w-full bg-black border border-white/20 p-2.5 text-xs text-white focus:border-[var(--color-amber)] focus:outline-none rounded cursor-pointer uppercase"
                        disabled={globalSaving}
                      >
                        <option value="">Selecione o Bloco...</option>
                        {availablePeriods.map(p => (
                          <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] text-white/70 uppercase tracking-widest mb-1.5 font-bold">Prazo Limite / Deadline (Opcional)</label>
                      <input
                        type="date"
                        value={globalDueDate}
                        onChange={(e) => setGlobalDueDate(e.target.value)}
                        className="w-full bg-black border border-white/20 p-2.5 text-xs text-white focus:border-[var(--color-amber)] focus:outline-none rounded cursor-pointer"
                        disabled={globalSaving}
                      />
                    </div>
                  </div>

                  {/* AUTOMATIC URGENCY PREVIEW DISPLAYER */}
                  <div className="pt-2">
                    <div className="p-3 border border-zinc-800 bg-zinc-900/40 rounded flex items-center justify-between">
                      <span className="text-[9px] text-white/50 uppercase tracking-widest font-bold">Prioridade Calculada:</span>
                      {(() => {
                        const calculatedUrgency = globalDueDate ? db.calculateUrgency(globalDueDate) : 'low';
                        const badgeColors = {
                          overdue: 'bg-rose-950/40 text-rose-400 border border-rose-800',
                          urgent: 'bg-rose-950/40 text-rose-400 border border-rose-800',
                          moderate: 'bg-amber-950/40 text-amber-400 border border-amber-800',
                          low: 'bg-zinc-950/40 text-zinc-400 border border-zinc-800'
                        };
                        const labels = {
                          overdue: 'CRÍTICA / ATRASADA',
                          urgent: 'ALTA / URGENTE',
                          moderate: 'MÉDIA / MODERADA',
                          low: 'BAIXA / TRANQUILA'
                        };
                        return (
                          <span className={`text-[9px] px-2 py-0.5 uppercase font-bold tracking-wider rounded ${badgeColors[calculatedUrgency]}`}>
                            {labels[calculatedUrgency]}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* ACTION BUTTONS */}
                <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => { sounds.playButtonSwitch(); setGlobalModalOpen(false); }}
                    className="px-4 py-2 bg-transparent hover:bg-white/5 border border-white/20 hover:border-white/40 text-white font-mono text-xs uppercase tracking-widest rounded transition-all cursor-pointer"
                    disabled={globalSaving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className={`px-5 py-2 font-mono text-xs uppercase tracking-widest rounded flex items-center gap-2 font-black transition-all cursor-pointer ${
                      settings.theme_mode === 'AMBER' 
                        ? 'bg-[#ffb347] text-black hover:bg-[#ffb347]/80' 
                        : settings.theme_mode === 'GREEN' 
                          ? 'bg-[#33ff33] text-black hover:bg-[#33ff33]/80'
                          : 'bg-[#00e5ff] text-black hover:bg-[#00e5ff]/80'
                    }`}
                    disabled={globalSaving}
                  >
                    {globalSaving ? 'Inserindo...' : 'Criar Tarefa'}
                  </button>
                </div>
              </form>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
