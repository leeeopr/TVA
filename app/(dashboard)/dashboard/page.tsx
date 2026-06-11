'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProductivityStore } from '@/stores/productivityStore';
import { db, AgendaBlock, AgendaTodo, Task } from '@/lib/db';
import { sounds } from '@/lib/sounds';
import { 
  Clock, 
  Calendar, 
  Play, 
  CheckSquare, 
  Square, 
  ArrowRight, 
  Layers, 
  Terminal, 
  Folder, 
  Tag, 
  CheckCircle2, 
  Compass, 
  ChevronRight,
  Activity,
  Plus
} from 'lucide-react';

const WEEK_DAYS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];

export default function DashboardPage() {
  const router = useRouter();
  
  const { 
    settings, 
    agendaBlocks, 
    agendaTodos, 
    categories, 
    refreshData 
  } = useProductivityStore();

  const [isClient, setIsClient] = useState(false);

  // Live Clock states
  const [currentTime, setCurrentTime] = useState('');
  const [currentDateString, setCurrentDateString] = useState('');
  const [currentUtcString, setCurrentUtcString] = useState('');

  // Local add todo state directly on dashboard
  const [quickTodoTitle, setQuickTodoTitle] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  useEffect(() => {
    setTimeout(() => {
      setIsClient(true);
    }, 0);
    db.initAuth();
    refreshData();

    // Clock update ticker
    const tick = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDateString(now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).toUpperCase());
      setCurrentUtcString(now.toISOString().substring(11, 19) + ' UTC');
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Color mappings
  const borderStyle = settings.theme_mode === 'AMBER' 
    ? 'border-[#ffb347] border-glow' 
    : settings.theme_mode === 'GREEN' 
      ? 'border-[#33ff33] border-glow'
      : 'border-[#00e5ff] border-glow';

  const textStyle = settings.theme_mode === 'AMBER' 
    ? 'text-[#ffb347]'
    : settings.theme_mode === 'GREEN'
      ? 'text-[#33ff33]'
      : 'text-[#00e5ff]';

  const glowTextStyle = settings.theme_mode === 'AMBER'
    ? 'text-[#ffb347] amber-glow-text'
    : settings.theme_mode === 'GREEN'
      ? 'text-[#33ff33] green-glow-text'
      : 'text-[#00e5ff] cobalt-glow-text';

  const bgSubHeader = settings.theme_mode === 'AMBER'
    ? 'bg-[#ffe7cc]/5'
    : settings.theme_mode === 'GREEN'
      ? 'bg-[#ccffcc]/5'
      : 'bg-[#ccf7ff]/5';

  const primaryButtonStyle = `px-5 py-2.5 text-xs rounded tracking-wider uppercase font-extrabold transition-all duration-200 cursor-pointer flex items-center gap-1.5 text-black hover:scale-[1.01] active:scale-[0.99]
    ${settings.theme_mode === 'AMBER' 
      ? 'bg-[#ffb347] hover:bg-[#ffb347]/90 shadow-[0_0_10px_rgba(255,179,71,0.25)]' 
      : settings.theme_mode === 'GREEN' 
        ? 'bg-[#33ff33] hover:bg-[#33ff33]/90 shadow-[0_0_10px_rgba(51,255,51,0.25)]' 
        : 'bg-[#00e5ff] hover:bg-[#00e5ff]/90 shadow-[0_0_10px_rgba(0,229,255,0.25)]'}`;

  // Helper dynamic mappings for active & next block
  const now = new Date();
  const jsDay = now.getDay();
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1; // 0 = Segunda, ..., 6 = Domingo
  
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMinutes}`;

  // Find Currently Active Block
  const activeBlock = agendaBlocks.find(b => {
    if (b.day_of_week !== dayOfWeek) return false;
    return b.start_time <= currentTimeStr && b.end_time >= currentTimeStr;
  }) || null;

  // Find Next Block Scheduled
  const getNextScheduledBlock = (): { block: AgendaBlock | null; relativeDay: string } => {
    // 1st: look for any subsequent block today
    const targetsToday = agendaBlocks
      .filter(b => b.day_of_week === dayOfWeek && b.start_time > currentTimeStr)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    if (targetsToday.length > 0) {
      return { block: targetsToday[0], relativeDay: 'Hoje' };
    }

    // 2nd: scan days of the week starting tomorrow
    for (let offset = 1; offset <= 7; offset++) {
      const nextDayIdx = (dayOfWeek + offset) % 7;
      const targetsDay = agendaBlocks
        .filter(b => b.day_of_week === nextDayIdx)
        .sort((a, b) => a.start_time.localeCompare(b.start_time));

      if (targetsDay.length > 0) {
        const relativeDayLabel = offset === 1 ? 'Amanhã' : WEEK_DAYS[nextDayIdx];
        return { block: targetsDay[0], relativeDay: relativeDayLabel };
      }
    }

    return { block: null, relativeDay: '' };
  };

  const { block: nextBlock, relativeDay: nextBlockDayLabel } = getNextScheduledBlock();

  // Find active block's todos and identify next action
  const activeBlockTodos = activeBlock ? agendaTodos.filter(t => t.block_id === activeBlock.id) : [];
  const nextAction = activeBlockTodos.find(t => !t.completed) || null;

  // Handle checked status
  const handleToggleTodo = async (todo: AgendaTodo) => {
    sounds.playSuccessIndicator();
    await db.updateAgendaTodo(todo.id, { completed: !todo.completed });
    refreshData();
  };

  // Add a quick todo to the active block
  const handleAddQuickTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBlock || !quickTodoTitle.trim()) return;

    sounds.playButtonSwitch();
    await db.saveAgendaTodo(
      activeBlock.id,
      quickTodoTitle.trim(),
      selectedGroupId || null,
      selectedCategoryId || null
    );
    setQuickTodoTitle('');
    setSelectedGroupId('');
    setSelectedCategoryId('');
    refreshData();
  };

  const groups = db.getGroups();

  if (!isClient) return null;

  return (
    <div className="space-y-6 flex flex-col h-full animate-fade-in select-none">
      
      {/* SECTION 1: MASTER TIME & HORÁRIO CORRENTE PANEL */}
      <div className={`border-2 p-6 rounded-xl ${borderStyle} ${bgSubHeader} flex flex-col md:flex-row justify-between items-center gap-6 relative`}>
        <div className="flex items-center gap-4">
          <div className={`p-3 border rounded-lg ${
            settings.theme_mode === 'AMBER' ? 'border-[#ffb347]/40 text-[#ffb347] bg-[#ffb347]/10' :
            settings.theme_mode === 'GREEN' ? 'border-[#33ff33]/40 text-[#33ff33] bg-[#33ff33]/10' :
            'border-[#00e5ff]/40 text-[#00e5ff] bg-[#00e5ff]/10'
          }`}>
            <Clock className="w-8 h-8 animate-pulse" />
          </div>
          <div className="text-left space-y-1">
            <span className="text-[10px] uppercase font-black tracking-widest text-zinc-500 font-mono flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" /> [ TERMINAL MONITOR_TIME ]
            </span>
            <h1 className="text-4xl md:text-5xl font-black font-mono tracking-tight leading-none text-white">
              {currentTime || '00:00:00'}
            </h1>
          </div>
        </div>

        <div className="text-right font-mono uppercase space-y-1 self-stretch md:self-center flex flex-col justify-center border-t md:border-t-0 md:border-l border-zinc-800 pt-4 md:pt-0 md:pl-6">
          <div className="flex justify-between md:justify-end gap-3 text-xs">
            <span className="text-zinc-500">DATA VIRTUAL:</span>
            <span className="text-white font-extrabold">{currentDateString}</span>
          </div>
          <div className="flex justify-between md:justify-end gap-3 text-xs">
            <span className="text-zinc-500">OPERATIONAL CLK:</span>
            <span className={textStyle}>{currentUtcString}</span>
          </div>
        </div>
      </div>

      {/* SECTION 2: ROW OF PRESENT STATUS (BLOCO ATIVO vs PRÓXIMO BLOCO) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* PRESENT: CURRENT ACTIVE BLOCK COCKPIT */}
        <div className={`border-2 p-5 rounded-xl ${borderStyle} bg-black/40 flex flex-col justify-between min-h-[180px] relative overflow-hidden transition-all duration-300`}>
          <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-zinc-100" />
          
          <div className="pl-2 space-y-2 text-left">
            <span className="text-[9px] font-black tracking-widest text-zinc-400 block uppercase">
              • PRESENT MOMENT / CURRENT TIME-BLOCK
            </span>

            {activeBlock ? (
              <div className="space-y-1.5">
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white">
                  {activeBlock.name}
                </h2>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className={`px-2 py-0.5 font-bold uppercase rounded border ${
                    activeBlock.color === 'blue' ? 'border-blue-500/35 bg-blue-500/10 text-blue-400' :
                    activeBlock.color === 'purple' ? 'border-purple-500/35 bg-purple-500/10 text-purple-400' :
                    activeBlock.color === 'green' ? 'border-green-500/35 bg-green-500/10 text-emerald-400' :
                    activeBlock.color === 'red' ? 'border-red-500/35 bg-red-500/10 text-red-400' :
                    activeBlock.color === 'cyan' ? 'border-cyan-500/35 bg-cyan-500/10 text-cyan-400' :
                    activeBlock.color === 'orange' ? 'border-orange-500/35 bg-orange-500/10 text-orange-400' :
                    'border-amber-500/35 bg-amber-500/10 text-amber-500'
                  }`}>
                    {activeBlock.color?.toUpperCase() || 'PADRÃO'}
                  </span>
                  <span className="text-zinc-300">{activeBlock.start_time} até {activeBlock.end_time}</span>
                </div>
              </div>
            ) : (
              <div className="py-6 space-y-1">
                <span className="text-zinc-500 italic block font-mono text-xs">[ BLOCO FORA DA AGENDA ]</span>
                <p className="text-[11px] text-zinc-400 max-w-sm">
                  Não há nenhum bloco de horário programado para este horário no dia de hoje. Ajuste a agenda ou desfrute de um recesso bem merecido!
                </p>
              </div>
            )}
          </div>

          <div className="pl-2 pt-4 border-t border-zinc-900 flex justify-between items-center text-[11px] font-mono mt-3">
            <span className="text-zinc-500">CONECTADO À RETRO_MATRIX</span>
            <button 
              onClick={() => { sounds.playButtonSwitch(); router.push('/weekly-planning'); }}
              className={`hover:underline flex items-center gap-1 ${textStyle}`}
            >
              Ir para Agenda <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* FUTURE: NEXT SCHEDULED TIME-BLOCK */}
        <div className={`border-2 p-5 rounded-xl border-zinc-850 bg-black/25 flex flex-col justify-between min-h-[180px] hover:border-zinc-700 transition`}>
          <div className="space-y-2 text-left">
            <span className="text-[9px] font-black tracking-widest text-zinc-500 block uppercase">
              ➔ NEXT SCHEDULED EVENT / TIMELINE
            </span>

            {nextBlock ? (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 uppercase">
                  {nextBlockDayLabel} @ {nextBlock.start_time} - {nextBlock.end_time}
                </span>
                <h3 className="text-md font-black uppercase tracking-tight text-white/90">
                  {nextBlock.name}
                </h3>
              </div>
            ) : (
              <div className="py-6 font-mono text-zinc-500 text-xs italic">
                Nenhum bloco futuro agendado no horizonte semanal.
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-zinc-900/60 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
            <span>SISTEMA DE PRECISÃO CORRENTE</span>
            <span>RECORRENTE SEMANAL</span>
          </div>
        </div>

      </div>

      {/* SECTION 3: NEXT RECOMMEND ATION (PRÓXIMA AÇÃO DO BLOCO ATIVO) */}
      {activeBlock && (
        <div className={`border-2 p-5 rounded-xl border-dashed relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-950/40 ${borderStyle}`}>
          <div className="absolute top-2.5 right-4 flex items-center gap-1 font-mono text-[9px] uppercase font-bold text-amber-500/80 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            [ PIPELINE / PRÓXIMA AÇÃO ]
          </div>

          <div className="space-y-2 text-left font-mono">
            <span className="text-[9px] uppercase font-bold text-zinc-500 block tracking-wider">
              SUA META IMEDIATA NO BLOCO ATUAL:
            </span>

            {nextAction ? (
              <div className="space-y-1">
                <h3 className={`text-base md:text-lg font-black uppercase leading-tight ${textStyle}`}>
                  {nextAction.title}
                </h3>
                
                {/* Linked categorization values */}
                {(nextAction.group_id || nextAction.category_id) && (
                  <div className="flex gap-2 pt-0.5 font-mono text-[8px] uppercase">
                    {nextAction.group_id && (
                      <span className="px-1.5 border border-zinc-800 rounded bg-zinc-900/40 text-zinc-400">
                        Grupo: {groups.find(g => g.id === nextAction.group_id)?.name}
                      </span>
                    )}
                    {nextAction.category_id && (
                      <span className="px-1.5 border border-zinc-800 rounded bg-zinc-900/40 text-zinc-400">
                        Cat: {categories.find(c => c.id === nextAction.category_id)?.name}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <h3 className="text-md font-extrabold text-emerald-400 uppercase italic">
                ✓ TODAS AS PENDÊNCIAS DO BLOCO COMPLETAS!
              </h3>
            )}
          </div>

          {nextAction && (
            <button
              onClick={() => {
                sounds.playButtonSwitch();
                // Engage pomodoro with the title of this agenda action
                const dummyTask: Task = {
                  id: nextAction.id,
                  user_id: nextAction.user_id || 'user-default',
                  group_id: nextAction.group_id || 'group-default',
                  category_id: nextAction.category_id || null,
                  task_period_id: null,
                  title: nextAction.title,
                  description: 'Meta de horário via Agenda Semanal',
                  due_date: null,
                  is_completed: false,
                  completed_at: null,
                  position: 0,
                  time_period: null,
                  urgency_level: 'moderate',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                };
                useProductivityStore.getState().setLinkedTask(dummyTask);
                useProductivityStore.getState().setTimerMode('FOCUS');
                useProductivityStore.getState().setTimeLeft(25 * 60);
                useProductivityStore.getState().setTimerRunning(true);
                router.push('/pomodoro');
              }}
              className={primaryButtonStyle}
            >
              <Play className="w-4 h-4 fill-black text-black" /> ENTRAR EM FOCO POMODORO
            </button>
          )}
        </div>
      )}

      {/* SECTION 4: INTERACTIVE LIST OF INDIVIDUAL PENDÊNCIAS */}
      {activeBlock && (
        <div className={`border-2 p-5 rounded-xl ${borderStyle} bg-black/40 space-y-4`}>
          <div className="flex justify-between items-center border-b border-zinc-850 pb-2">
            <h3 className="text-xs font-black tracking-wider uppercase flex items-center gap-1.5 opacity-90 text-white">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> PENDÊNCIAS DO BLOCO DE HOJE ({activeBlockTodos.length})
            </h3>
            <span className="text-[9px] text-zinc-500 uppercase font-mono tracking-widest">
              [ EXECUTANTE DE TAREFAS EM TEMPO REAL ]
            </span>
          </div>

          {/* Todo insertion inline input */}
          <form onSubmit={handleAddQuickTodo} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              required
              maxLength={100}
              placeholder="Rápido: insira mais uma pendência neste bloco..."
              value={quickTodoTitle}
              onChange={e => setQuickTodoTitle(e.target.value)}
              className="flex-1 bg-black text-xs p-2.5 border border-zinc-800 rounded focus:border-[var(--color-amber)] text-white focus:outline-none placeholder-zinc-650"
            />
            
            <button type="submit" className={primaryButtonStyle}>
              <Plus className="w-4 h-4 shrink-0" /> INSERIR
            </button>
          </form>

          {/* List display */}
          <div className="space-y-1.5">
            {activeBlockTodos.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-zinc-900 rounded-lg text-xs font-mono text-zinc-500 uppercase">
                Não há pendências programadas para o bloco ativo. Cadastre uma acima para iniciar!
              </div>
            ) : (
              activeBlockTodos.map((todo) => {
                const isActionFirst = nextAction?.id === todo.id;
                const associatedGroup = groups.find(g => g.id === todo.group_id);
                const associatedCat = categories.find(c => c.id === todo.category_id);

                return (
                  <div
                    key={todo.id}
                    className={`p-3 rounded border border-zinc-850 bg-zinc-950/65 flex items-center justify-between gap-3 transition-all ${
                      todo.completed ? 'opacity-60 bg-zinc-950/20' : ''
                    } ${isActionFirst ? 'ring-1 ring-amber-500/35 border-amber-500/25' : ''}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <button
                        type="button"
                        onClick={() => handleToggleTodo(todo)}
                        className={`transition-colors shrink-0 ${
                          todo.completed ? 'text-emerald-400' : 'text-zinc-650 hover:text-white'
                        }`}
                        title={todo.completed ? 'Desmarcar' : 'Concluir'}
                      >
                        {todo.completed ? (
                          <CheckSquare className="w-4.5 h-4.5" />
                        ) : (
                          <Square className="w-4.5 h-4.5" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1 space-y-1">
                        <span className={`text-xs font-mono break-words block ${
                          todo.completed ? 'line-through text-zinc-500' : 'text-zinc-200 font-medium'
                        }`}>
                          {todo.title}
                        </span>

                        {/* Classification labels tags */}
                        {(associatedGroup || associatedCat) && (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {associatedGroup && (
                              <span className="text-[8px] px-1.5 border border-zinc-800 rounded bg-zinc-900/60 text-zinc-500">
                                G: {associatedGroup.name}
                              </span>
                            )}
                            {associatedCat && (
                              <span className="text-[8px] px-1.5 border border-zinc-800 rounded bg-zinc-900/60 text-zinc-500">
                                C: {associatedCat.name}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {isActionFirst && !todo.completed && (
                      <span className="text-[8px] shrink-0 uppercase font-black tracking-widest text-amber-500 border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 rounded animate-pulse">
                        Sugerida
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

    </div>
  );
}
