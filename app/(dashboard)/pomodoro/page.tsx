'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Play, Pause, RotateCcw, ChevronRight, CheckSquare, X, Clock, HelpCircle } from 'lucide-react';
import { useProductivityStore } from '@/stores/productivityStore';
import { sounds } from '@/lib/sounds';
import { db } from '@/lib/db';

export default function PomodoroPage() {
  const {
    presets,
    settings,
    timerRunning,
    timeLeft,
    totalDuration,
    timerMode,
    currentCycle,
    selectedPresetId,
    linkedTask,
    setTimerRunning,
    setSelectedPresetId,
    setLinkedTask,
    resetTimer,
    nextTimerPhase,
    refreshData
  } = useProductivityStore();

  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => {
      setIsClient(true);
    }, 0);
    return () => clearTimeout(handle);
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  if (!isClient) return null;

  // Convert seconds to human readable clock e.g. 25:00
  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const triggerStartPause = () => {
    sounds.playButtonSwitch();
    setTimerRunning(!timerRunning);
    db.addLog(`CLOCK EMULATOR: TIMER COMMAND -> ${!timerRunning ? 'COMMENCED' : 'INTERRUPTED'}`, !timerRunning ? 'success' : 'warning');
  };

  const triggerReset = () => {
    sounds.playKeyClick();
    resetTimer();
  };

  const triggerNextPhase = () => {
    sounds.playButtonSwitch();
    nextTimerPhase();
  };

  const percentage = (timeLeft / totalDuration) * 100;
  // Circular dash-array calculations
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * percentage) / 100;

  // Render Theme Style Map Helpers
  const borderStyle = settings.theme_mode === 'AMBER' 
    ? 'border-[#ffb347] b_glow_border' 
    : settings.theme_mode === 'GREEN' 
      ? 'border-[#33ff33] g_glow_border'
      : 'border-[#00e5ff] c_glow_border';

  const textStyle = settings.theme_mode === 'AMBER' 
    ? 'text-[#ffb347] amber-glow-text'
    : settings.theme_mode === 'GREEN'
      ? 'text-[#33ff33] green-glow-text'
      : 'text-[#00e5ff] cobalt-glow-text';

  const strokeColor = settings.theme_mode === 'AMBER'
    ? '#ffb347'
    : settings.theme_mode === 'GREEN'
      ? '#33ff33'
      : '#00e5ff';

  const bgStyle = settings.theme_mode === 'AMBER'
    ? 'bg-[#0d0b09]'
    : settings.theme_mode === 'GREEN'
      ? 'bg-[#060e06]'
      : 'bg-[#050b11]';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.25 }}
      className="space-y-5"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* TIMER CORE ANALOG-GLOW CONTROLLER (Big 2/3 column layout) */}
        <div className={`md:col-span-2 border-2 p-6 rounded-xl flex flex-col items-center justify-center relative min-h-[420px] ${bgStyle} ${borderStyle}`}>
          
          <div className="absolute top-2.5 left-4 text-[10px] tracking-widest text-[var(--color-amber)] opacity-60 uppercase">
            [ CHRONOS REGULATOR ENGINE ]
          </div>
          <div className="absolute top-2.5 right-4 flex items-center gap-1.5 bg-[var(--color-amber)]/10 px-2 py-0.5 rounded text-[9px] uppercase border border-[var(--color-amber)]/20">
            <span>Ciclo Foco: #{currentCycle}</span>
          </div>

          {/* SENSATIONAL RADIAL SWEEP TIMER CARD */}
          <div className="relative flex items-center justify-center my-6">
            <svg className="w-56 h-56 transform -rotate-90">
              <circle
                cx="112"
                cy="112"
                r={radius}
                className="stroke-[var(--color-amber)]/10 fill-transparent"
                strokeWidth="6"
              />
              <circle
                cx="112"
                cy="112"
                r={radius}
                className="stroke-[var(--color-amber)] fill-transparent transition-all duration-300"
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{
                  stroke: strokeColor,
                  filter: `drop-shadow(0 0 6px ${strokeColor}77)`
                }}
              />
            </svg>

            {/* INNER TEXT */}
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className={`text-[10px] font-bold tracking-[0.25em] h-4 uppercase ${
                timerMode === 'FOCUS' ? 'text-red-400 animate-pulse' : 'text-emerald-400'
              }`}>
                {timerMode === 'SHORT_BREAK' ? 'PAUSA CURTA' : timerMode === 'LONG_BREAK' ? 'PAUSA LONGA' : 'EM FOCO'}
              </span>
              <span id="digital-chronometer" className={`text-4xl md:text-5xl font-black font-mono tracking-widest my-1 ${textStyle}`}>
                {formatTimer(timeLeft)}
              </span>
              <span className="text-[9px] text-[var(--color-amber)] opacity-60 tracking-widest">
                {Math.round(percentage)}% RESTANTE
              </span>
            </div>
          </div>

          {/* TIMER BUTTON OPERATORS */}
          <div className="flex flex-wrap items-center justify-center gap-4 w-full max-w-md pt-4 border-t border-[var(--color-amber)]/20">
            <button
              onClick={triggerStartPause}
              className={`px-5 py-2.5 rounded font-black text-xs uppercase flex items-center gap-2 border cursor-pointer select-none ${
                timerRunning 
                  ? 'bg-rose-950/20 text-rose-500 border-rose-800' 
                  : 'bg-[var(--color-amber)] text-black border-[var(--color-amber)] hover:bg-[#ffd19a]'
              }`}
            >
              {timerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {timerRunning ? 'Interromper' : 'Disparar'}
            </button>

            <button
              onClick={triggerReset}
              className="px-4 py-2.5 border border-[var(--color-amber)]/50 hover:border-[var(--color-amber)] text-[var(--color-amber)] hover:bg-[var(--color-amber)]/10 text-xs font-bold uppercase rounded flex items-center gap-1.5 cursor-pointer select-none"
              title="Resetar tempo atual"
            >
              <RotateCcw className="w-4 h-4" />
              Recarregar
            </button>

            <button
              onClick={triggerNextPhase}
              className="px-4 py-2.5 border border-[var(--color-amber)]/50 hover:border-[var(--color-amber)] text-[var(--color-amber)] hover:bg-[var(--color-amber)]/10 text-xs font-bold uppercase rounded flex items-center gap-1.5 cursor-pointer select-none"
              title="Pular para próximo período"
            >
              Forçar Próximo
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* ACTIVE LINKED TASK STRAP PANEL */}
          <div className="w-full max-w-md mt-5">
            {linkedTask ? (
              <div className="border border-emerald-500/35 bg-emerald-950/15 p-2 rounded-lg flex items-center justify-between gap-2 text-xxs text-emerald-300">
                <span className="flex items-center gap-1.5 truncate">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
                  </span>
                  <span className="font-bold uppercase tracking-tight">[VINCULADA]:</span>
                  <span className="truncate underline font-mono">{linkedTask.title}</span>
                </span>
                <button
                  onClick={() => { sounds.playAlarmBreak(); setLinkedTask(null); }}
                  className="p-1 border border-emerald-800 hover:border-emerald-500 rounded text-emerald-400 hover:text-white transition-all cursor-pointer"
                  title="Desvincular Tarefa"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="border border-dashed border-[var(--color-amber)]/20 p-2.5 rounded-lg text-center text-xxs text-[var(--color-amber)]/60 uppercase">
                [ NENHUMA TAREFA VINCULADA AO CRONÔMETRO ]
              </div>
            )}
          </div>
        </div>

        {/* PRESET TEMPLATE LOADER MATRIX (1 column sidebar layout) */}
        <div className={`md:col-span-1 border-2 p-4 rounded-xl flex flex-col justify-start relative ${bgStyle} ${borderStyle}`}>
          <div className="border-b border-[var(--color-amber)]/20 pb-2 mb-3 text-xs text-[var(--color-amber)] tracking-wider flex justify-between items-center text-left">
            <span>[ RECEITA CHRONOS DE TEMPO ]</span>
          </div>

          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {presets.length === 0 ? (
              <div className="text-[10px] text-[var(--color-amber)]/60 text-center py-10 uppercase italic h-full flex items-center justify-center border border-dashed border-[var(--color-amber)]/20 rounded">
                Sem receitas configuradas.<br />Acesse os ajustes (F4)<br />para criar receitas!
              </div>
            ) : (
              presets.map((p) => {
                const isActive = p.id === selectedPresetId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPresetId(p.id)}
                    className={`w-full p-3 rounded-lg border-2 text-left transition-all relative select-none cursor-pointer ${
                      isActive
                        ? 'border-[var(--color-amber)] bg-[var(--color-amber)]/10 ' + borderStyle
                        : 'border-[var(--color-amber)]/20 hover:border-[var(--color-amber)]/45 hover:bg-[var(--color-amber)]/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <strong className={`text-xs block tracking-wide uppercase ${isActive ? textStyle : 'text-[var(--color-amber)]'}`}>{p.name}</strong>
                      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-amber)] animate-pulse" />}
                    </div>
                    <div className="text-[10px] text-[var(--color-amber)] opacity-75 mt-2 flex flex-col space-y-0.5">
                      <span>• FOCO: {p.focus_minutes}m</span>
                      <span>• INTERVALOS: {p.short_break_minutes}m | {p.long_break_minutes}m</span>
                      <span>• RE-ALIMENTAR: {p.cycles_before_long_break} ciclos</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

      </div>
    </motion.div>
  );
}
