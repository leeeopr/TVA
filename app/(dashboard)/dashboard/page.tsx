'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Clock, Activity, CheckSquare, Sparkles, Terminal, ShieldAlert } from 'lucide-react';
import { useProductivityStore } from '@/stores/productivityStore';
import { useAuthStore } from '@/stores/authStore';
import { sounds } from '@/lib/sounds';
import { db } from '@/lib/db';
import EmotionAnalytics from '@/components/EmotionAnalytics';

export default function DashboardPage() {
  const { 
    tasks, 
    stats, 
    terminalLogs, 
    settings, 
    refreshData 
  } = useProductivityStore();

  const { user } = useAuthStore();

  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => {
      setIsClient(true);
    }, 0);
    return () => clearTimeout(handle);
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData, user]);

  const statsFocusMins = stats?.total_focus_minutes || 0;
  const statsBreakMins = stats?.total_break_minutes || 0;
  const statsCompletedNum = stats?.completed_tasks || 0;

  // Render Theme Style Map Helpers
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

  const textDimStyle = settings.theme_mode === 'AMBER'
    ? 'text-[#8a5a16]'
    : settings.theme_mode === 'GREEN'
      ? 'text-[#085a08]'
      : 'text-[#053d5a]';

  const bgStyle = settings.theme_mode === 'AMBER'
    ? 'bg-[#0d0b09]'
    : settings.theme_mode === 'GREEN'
      ? 'bg-[#060e06]'
      : 'bg-[#050b11]';

  const handleToggleTaskChecked = (taskId: string, currentVal: boolean) => {
    sounds.playButtonSwitch();
    db.updateTask(taskId, { is_completed: !currentVal });
    if (!currentVal) {
      db.incrementCompletedTasks();
      db.addLog('TASK COMMITTED TO COMPLETED HEURISTICS MATRIX!', 'success');
    } else {
      db.addLog('TASK REVERTED TO UNCOMPLETED HEURISTICS BUFFER.', 'warning');
    }
    refreshData();
  };

  const highPriorityTasks = tasks.filter(t => !t.is_completed && (t.urgency_level === 'urgent' || t.urgency_level === 'overdue'));
  const normalPriorityTasks = tasks.filter(t => !t.is_completed && t.urgency_level !== 'urgent' && t.urgency_level !== 'overdue');
  const displayedTasks = [...highPriorityTasks, ...normalPriorityTasks].slice(0, 5);

  if (!isClient) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.25 }}
      className="space-y-5"
    >
      {/* HERO BANNER SECTION */}
      <div className={`border-2 p-5 rounded-xl border-dashed flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${bgStyle} ${borderStyle}`}>
        <div>
          <h2 className={`text-lg md:text-xl font-black tracking-widest flex items-center gap-2 ${textStyle}`}>
            <Sparkles className="w-5 h-5 animate-pulse" />
            TERMINAL OPERATOR COCKPIT
          </h2>
          <p className="text-xs text-[var(--color-amber)]/90 mt-1 max-w-xl leading-relaxed">
            Sincronize ciclos neurais através de metodologias vintage de foco Pomodoro. Analise os reatores diários e neutralize tarefas pendentes na interface de elétrons monocromáticos do Supabase Auth.
          </p>
        </div>
        <Link
          href="/pomodoro"
          onClick={() => sounds.playButtonSwitch()}
          className="px-4 py-2 bg-[var(--color-amber)] text-black font-black text-xs hover:bg-[#ffd19a] uppercase rounded items-center self-stretch md:self-auto text-center cursor-pointer"
        >
          Iniciar Foco
        </Link>
      </div>

      {/* QUICK STATS CARRIER MATRIX */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        
        {/* STATS 1: FOCUS PROGRESS */}
        <div className={`border-2 p-4 rounded-xl flex flex-col justify-between ${bgStyle} ${borderStyle}`}>
          <div className="flex justify-between items-start text-[var(--color-amber)] opacity-80 text-xs tracking-widest uppercase">
            <span>Fórmula Foco</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="mt-4 mb-2">
            <span className={`text-3xl md:text-4xl font-black ${textStyle}`}>{statsFocusMins}</span>
            <span className="text-xs text-[var(--color-amber)] opacity-70 ml-2">minutos</span>
          </div>
          <span className="text-[10px] text-[var(--color-amber)] opacity-60 uppercase border-t pt-2 border-[var(--color-amber)]/20">
            Foco mental acumulado hoje
          </span>
        </div>

        {/* STATS 2: BREAK RECHARGE */}
        <div className={`border-2 p-4 rounded-xl flex flex-col justify-between ${bgStyle} ${borderStyle}`}>
          <div className="flex justify-between items-start text-[var(--color-amber)] opacity-80 text-xs tracking-widest uppercase">
            <span>Recarga Reator</span>
            <Activity className="w-4 h-4" />
          </div>
          <div className="mt-4 mb-2">
            <span className={`text-3xl md:text-4xl font-black ${textStyle}`}>{statsBreakMins}</span>
            <span className="text-xs text-[var(--color-amber)] opacity-70 ml-2">minutos</span>
          </div>
          <span className="text-[10px] text-[var(--color-amber)] opacity-60 uppercase border-t pt-2 border-[var(--color-amber)]/20">
            Intervalos de oscilação mental
          </span>
        </div>

        {/* STATS 3: COMMITED MATRIX */}
        <div className={`border-2 p-4 rounded-xl flex flex-col justify-between ${bgStyle} ${borderStyle}`}>
          <div className="flex justify-between items-start text-[var(--color-amber)] opacity-80 text-xs tracking-widest uppercase">
            <span>Checklists Feitas</span>
            <CheckSquare className="w-4 h-4" />
          </div>
          <div className="mt-4 mb-2">
            <span className={`text-3xl md:text-4xl font-black ${textStyle}`}>{statsCompletedNum}</span>
            <span className="text-xs text-[var(--color-amber)] opacity-70 ml-2">tarefas</span>
          </div>
          <span className="text-[10px] text-[var(--color-amber)] opacity-60 uppercase border-t pt-2 border-[var(--color-amber)]/20">
            Metas purificadas do registro
          </span>
        </div>
      </div>

      {/* GRID: HIGH PRIORITY TASKS & ACTIVE SIMULATOR LOGS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* LEFT PANEL: KEY COMMITED PENDING TASKS */}
        <div className={`border-2 p-4 rounded-xl flex flex-col ${bgStyle} ${borderStyle}`}>
          <div className="border-b border-[var(--color-amber)]/20 pb-2 mb-3 flex justify-between items-center text-xs text-[var(--color-amber)] tracking-wider">
            <span>[ TAREFAS CRÍTICAS DE FOCO ]</span>
            <span>URGÊNCIA MÁXIMA</span>
          </div>

          <div className="space-y-2 flex-1 max-h-[290px] overflow-y-auto pr-1">
            {displayedTasks.length === 0 ? (
              <div className="text-xs text-[var(--color-amber)]/60 text-center py-10">
                QUALQUER REATOR EM CHAMA FOI APAGADO.<br />NENHUMA TAREFA PENDENTE ENCONTRADA!
              </div>
            ) : (
              displayedTasks.map((t) => (
                <div 
                  key={t.id} 
                  className="border border-[var(--color-amber)]/30 p-2.5 rounded bg-[#100c08]/40 hover:bg-[#1a140f]/60 flex justify-between items-center gap-2 group transition-all"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                     <button 
                      onClick={() => handleToggleTaskChecked(t.id, t.is_completed)}
                      className="w-4 h-4 border border-[var(--color-amber)] flex items-center justify-center text-[10px] bg-transparent text-[var(--color-amber)] font-bold transition-all hover:bg-[var(--color-amber)]/20"
                    >
                      {t.is_completed ? "✓" : ""}
                    </button>
                    <div className="text-left overflow-hidden">
                      <div className="text-xs text-[var(--color-amber)] font-bold truncate tracking-wide">
                        {t.title}
                      </div>
                      <span className={`text-[8px] px-1 rounded uppercase tracking-widest mt-0.5 inline-block text-xxs ${
                        (t.urgency_level === 'urgent' || t.urgency_level === 'overdue') ? 'bg-rose-950/40 text-rose-400 border border-rose-800' : 'bg-[var(--color-amber)]/10 text-[var(--color-amber)]'
                      }`}>
                        {t.urgency_level} {"//"} {t.category_name || 'Geral'}
                      </span>
                    </div>
                  </div>
                  <Link 
                    href="/tasks"
                    onClick={() => sounds.playKeyClick()}
                    className="text-[10px] text-[var(--color-amber)]/65 group-hover:text-[var(--color-amber)] underline shrink-0 cursor-pointer"
                  >
                    Editar
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT PANEL: TELEMETRY SYSTEM REALTIME LOGS */}
        <div className={`border-2 p-4 rounded-xl flex flex-col ${bgStyle} ${borderStyle}`}>
          <div className="border-b border-[var(--color-amber)]/20 pb-2 mb-3 flex justify-between items-center text-xs text-[var(--color-amber)] tracking-wider">
            <span>[ REAL-TIME DATELOG SECURE TRANSCRIPT ]</span>
            <span className="animate-pulse">STATUS: ACTIVE</span>
          </div>

          <div className="flex-1 max-h-[290px] overflow-y-auto font-mono text-[10px] space-y-1.5 text-left pr-1 select-none">
            {terminalLogs.length === 0 ? (
              <div className="text-[var(--color-amber)]/50 text-center py-10 uppercase italic">
                Nenhum log gravado no buffer de telemetria.
              </div>
            ) : (
              terminalLogs.map((log) => {
                let logColor = textStyle;
                if (log.type === 'success') logColor = 'text-emerald-400';
                else if (log.type === 'error') logColor = 'text-rose-400 animate-pulse';
                else if (log.type === 'warning') logColor = 'text-amber-500';
                else if (log.type === 'system') logColor = 'text-indigo-400';

                return (
                  <div key={log.id} className="leading-tight flex items-start gap-1">
                    <span className={`${textDimStyle}`}>[{log.timestamp}]</span>
                    <span className={logColor}>{log.text}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* CORE EMOTIONAL TELEMETRY DASHBOARD */}
      <EmotionAnalytics />
    </motion.div>

  );
}
