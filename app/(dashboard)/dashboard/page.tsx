'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock, 
  Activity, 
  CheckSquare, 
  Sparkles, 
  Terminal, 
  ShieldAlert, 
  Play, 
  Check, 
  Edit2, 
  Trash2, 
  Plus, 
  Sliders, 
  Calendar, 
  AlertTriangle,
  Folder,
  AlertOctagon,
  X
} from 'lucide-react';
import { useProductivityStore } from '@/stores/productivityStore';
import { useAuthStore } from '@/stores/authStore';
import { sounds } from '@/lib/sounds';
import { db, Task, TaskPeriod, TaskGroup, TaskCategory } from '@/lib/db';

interface Topic {
  id: string;
  name: string;
  description?: string | null;
  color_id?: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  
  // Zustand reactive stores
  const { 
    tasks, 
    periods,
    stats,
    settings, 
    categories: storeCategories,
    weeklyPlans,
    weeklyPlanTopics,
    refreshData,
    setLinkedTask,
    setTimerMode,
    setTimerRunning,
    setTimeLeft,
    setExpandedTask,
    hideCompleted,
    setHideCompleted
  } = useProductivityStore();

  const topics = storeCategories.map(cat => ({
    ...cat,
    color_id: cat.color || 'yellow',
    description: cat.description || ''
  })) as Topic[];

  const { user } = useAuthStore();

  // Local state contexts
  const [isClient, setIsClient] = useState(false);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  
  // Creation/Editing context overlays
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // New task form fields
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskTimePeriod, setNewTaskTimePeriod] = useState('');
  const [newTaskGroupId, setNewTaskGroupId] = useState('');
  const [newTaskCategoryId, setNewTaskCategoryId] = useState('');
  const [newTaskTopicId, setNewTaskTopicId] = useState('');

  // Local filtering states
  const [filterGroupId, setFilterGroupId] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterPeriodId, setFilterPeriodId] = useState('');
  const [filterUrgency, setFilterUrgency] = useState('');

  // Dynamic operational periods manager state
  const [showPeriodsModal, setShowPeriodsModal] = useState(false);
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [periodToDelete, setPeriodToDelete] = useState<string | null>(null);
  const [deleteMode, setDeleteMode] = useState<'move' | 'unassign' | 'delete'>('unassign');
  const [deleteTargetId, setDeleteTargetId] = useState('');
  const [periodFormName, setPeriodFormName] = useState('');
  const [periodFormIcon, setPeriodFormIcon] = useState('☀️');
  const [periodFormColor, setPeriodFormColor] = useState('#60a5fa');
  const [formError, setFormError] = useState<string | null>(null);
  const [taskFormError, setTaskFormError] = useState<string | null>(null);

  // Inline creation states for first run
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('blue');

  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryGroupId, setNewCategoryGroupId] = useState('');

  // Initialize view telemetry
  useEffect(() => {
    const handle = setTimeout(() => {
      setIsClient(true);
    }, 0);
    db.initAuth();
    refreshData();
    return () => clearTimeout(handle);
  }, [refreshData, user]);

  // Load extras (groups, categories) for tasks
  const loadDbExtras = useCallback(() => {
    const list = db.getGroups();
    setGroups(list);
    setCategories(db.getCategories());
    if (list.length > 0 && !newTaskGroupId) {
      setNewTaskGroupId(list[0].id);
    }
  }, [newTaskGroupId]);

  useEffect(() => {
    const handle = setTimeout(() => {
      loadDbExtras();
    }, 0);
    const unsub = db.subscribeDataRefresh(() => {
      loadDbExtras();
    });
    return () => {
      clearTimeout(handle);
      unsub();
    };
  }, [loadDbExtras]);

  // Trigger feedback sound
  const feedbackTap = () => {
    sounds.playKeyClick();
  };

  const handleToggleTaskChecked = async (taskId: string, currentVal: boolean) => {
    sounds.playButtonSwitch();
    await db.updateTask(taskId, { is_completed: !currentVal });
    if (!currentVal) {
      db.incrementCompletedTasks();
      db.addLog('TASK CONCLUDED AND LOGGED TO CLOUD METADATA MEMRICS.', 'success');
    } else {
      db.addLog('TASK RESET BACK TO THE ACTIVE ACTION PIPELINE.', 'warning');
    }
    refreshData();
  };

  const handleDeleteTask = async (taskId: string) => {
    sounds.playAlarmBreak();
    if (confirm('Tem certeza de que deseja excluir permanentemente esta tarefa?')) {
      await db.deleteTask(taskId);
      refreshData();
      db.addLog('DELETION COMPLETED: TASK DEPOSITED TO SCRAP STORAGE.', 'error');
    }
  };

  const handleStartFocusOnTask = (task: Task) => {
    sounds.playButtonSwitch();
    setLinkedTask(task);
    setTimerMode('FOCUS');
    setTimeLeft(25 * 60); // 25 standard minutes
    setTimerRunning(true);
    setExpandedTask(null);
    router.push('/pomodoro');
    db.addLog(`POMODORO_SYNC: ENGAGED CRADLE FOCOS FOR TASK [${task.title.toUpperCase()}]`, 'success');
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    feedbackTap();

    try {
      setTaskFormError(null);
      let gid = newTaskGroupId;
      if (!gid && groups.length > 0) {
        gid = groups[0].id;
      }
      if (!gid) {
        setTaskFormError("Não é possível criar tarefas sem um Grupo / Dossiê cadastrado. Crie um grupo primeiro.");
        sounds.playAlarmBreak();
        return;
      }

      await db.saveTask(
        gid,
        newTaskCategoryId || newTaskTopicId || null,
        newTaskTitle,
        newTaskDesc || null,
        newTaskDueDate || null,
        null, // 6th parameter (timePeriod string) is null since we align with the taskPeriodId UUID
        newTaskTimePeriod || null // 7th parameter (taskPeriodId UUID)
      );

      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskDueDate('');
      setNewTaskCategoryId('');
      setNewTaskTopicId('');
      setNewTaskTimePeriod('');
      setTaskFormError(null);
      setIsCreatingTask(false);
      refreshData();
      db.addLog('SYSTEM: ENFORCED NEW OPERATION IN PIPELINE SUITE.', 'success');
    } catch (err: any) {
      console.error("Erro ao criar tarefa:", err);
      setTaskFormError(err.message || 'Erro ao salvar tarefa.');
    }
  };

  const handleCreateGroupInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      setFormError(null);
      await db.saveGroup(newGroupName.trim(), newGroupDesc.trim() || null, newGroupColor);
      setIsCreatingGroup(false);
      setNewGroupName('');
      setNewGroupDesc('');
      loadDbExtras();
      refreshData();
      db.addLog(`SYSTEM: GRUPO DIRECT INTEL CREATED INLINE.`, 'success');
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Erro ao criar grupo.');
    }
  };

  const handleCreateCategoryInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim() || !newCategoryGroupId) return;
    try {
      setFormError(null);
      await db.saveCategory(newCategoryGroupId, newCategoryName.trim(), null);
      setIsCreatingCategory(false);
      setNewCategoryName('');
      setNewCategoryGroupId('');
      loadDbExtras();
      refreshData();
      db.addLog(`SYSTEM: CATEGORIA DIRECT INTEL CREATED INLINE.`, 'success');
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Erro ao criar categoria.');
    }
  };

  // --- MATHEMATICAL CRITERIA SORTING ---
  // Urgência (overdue > urgent > moderate > low), Prazo (earliest due_date), Posição (period, task position)
  const getRecommendedTask = (allTasks: Task[], allPeriods: TaskPeriod[]): Task | null => {
    const pending = allTasks.filter(t => !t.is_completed);
    if (pending.length === 0) return null;

    return [...pending].sort((a, b) => {
      const urgencyRank = { overdue: 4, urgent: 3, moderate: 2, low: 1 };
      const rankA = urgencyRank[a.urgency_level] || 1;
      const rankB = urgencyRank[b.urgency_level] || 1;
      
      if (rankB !== rankA) {
        return rankB - rankA; // Higher urgency rating first
      }

      if (a.due_date && b.due_date) {
        const dateA = new Date(a.due_date).getTime();
        const dateB = new Date(b.due_date).getTime();
        if (dateA !== dateB) return dateA - dateB; // Earlier limit comes first
      } else if (a.due_date) {
        return -1;
      } else if (b.due_date) {
        return 1;
      }

      const periodA = allPeriods.find(p => p.id === a.task_period_id);
      const periodB = allPeriods.find(p => p.id === b.task_period_id);
      const posA = periodA ? periodA.position : 9999;
      const posB = periodB ? periodB.position : 9999;
      
      if (posA !== posB) {
        return posA - posB; // Earlier operational time block first
      }

      return a.position - b.position;
    })[0];
  };

  // Theme support bindings
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

  // Stats calculation
  const COLOR_NAME_TO_HEX: Record<string, string> = {
    blue: '#60a5fa',
    purple: '#c084fc',
    green: '#34d399',
    red: '#f87171',
    yellow: '#fbbf24',
    cyan: '#22d3ee',
    orange: '#fb923c'
  };

  const ColorToHex = (colorName: string): string => {
    if (!colorName) return '#60a5fa';
    return COLOR_NAME_TO_HEX[colorName.toLowerCase()] || colorName || '#60a5fa';
  };

  // Local filtered collection of tasks
  const filteredTasks = tasks.filter(t => {
    if (filterGroupId && t.group_id !== filterGroupId) return false;
    if (filterCategoryId && t.category_id !== filterCategoryId) return false;
    if (filterPeriodId && t.task_period_id !== filterPeriodId) return false;
    if (filterUrgency && t.urgency_level !== filterUrgency) return false;
    return true;
  });

  const totalPending = db.getTaskStats().filter(t => !t.is_completed).length;
  const totalCompletedToday = db.getTaskStats().filter(t => t.is_completed).length; 
  const totalTasks = totalPending + totalCompletedToday;
  const progressPercent = totalTasks > 0 ? Math.round((totalCompletedToday / totalTasks) * 100) : 0;

  const recommendedTask = getRecommendedTask(filteredTasks, periods);

  if (!isClient) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.25 }}
      className="space-y-6 text-left"
    >
      {/* 2. HEADER CONTAINER IN DISPLAY TYPOGRAPHY */}
      <div className="flex justify-between items-center border-b-2 border-dashed border-[var(--color-amber)]/25 pb-3">
        <div>
          <h2 className={`text-xl md:text-2xl font-black tracking-widest flex items-center gap-2 uppercase ${textStyle}`}>
            <Sparkles className="w-5 h-5 animate-pulse" />
            Hoje
          </h2>
          <p className="text-[10px] text-[var(--color-amber)]/80 uppercase mt-0.5 tracking-wider font-mono">
            Painel Central Automatizado de Execução de Metas
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { sounds.playButtonSwitch(); setIsCreatingTask(!isCreatingTask); }}
            className="px-3 py-1.5 bg-[var(--color-amber)] text-black text-[10px] hover:bg-[#ffd19a] font-extrabold uppercase rounded tracking-wider flex items-center gap-1 transition-all cursor-pointer shadow-[0_0_10px_var(--color-amber-glow)]"
          >
            <Plus className="w-3.5 h-3.5" />
            {isCreatingTask ? 'Ocultar Form' : 'Nova Tarefa'}
          </button>
        </div>
      </div>

      {/* 7. HUD RESUMO SUPERIOR - 5 INDICADORES CRT OBRIGATÓRIOS */}
      {(() => {
        // Calculate date of current week's Monday
        const calculateMonday = () => {
          const today = new Date();
          const day = today.getDay();
          const diff = today.getDate() - day + (day === 0 ? -6 : 1);
          const m = new Date(today.setDate(diff));
          m.setHours(0, 0, 0, 0);
          return m;
        };

        const mondayStr = calculateMonday().toISOString().split('T')[0];
        const dayIdx = new Date().getDay(); 
        const currentActivePlan = weeklyPlans.find(wp => wp.week_start_date === mondayStr);

        const scheduledWptsToday = currentActivePlan
          ? weeklyPlanTopics.filter(wpt => wpt.weekly_plan_id === currentActivePlan.id && wpt.weekday === dayIdx)
          : [];

        const todaysTopicsCount = scheduledWptsToday
          .map(wpt => topics.find(tp => tp.id === wpt.category_id))
          .filter(tp => tp !== undefined).length;

        const openTasksCount = db.getTaskStats().filter(t => !t.is_completed).length;
        const urgentTasksCount = db.getTaskStats().filter(t => !t.is_completed && t.urgency_level === 'urgent').length;
        const completedTodayCount = db.getTaskStats().filter(t => t.is_completed).length; 

        const todaysDateFormatted = new Date().toLocaleDateString('pt-BR', { 
          weekday: 'long', 
          day: '2-digit', 
          month: '2-digit' 
        }).toUpperCase();

        return (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {/* INDICADOR 1: DATA HOJE */}
            <div className={`border-2 p-3 rounded-xl bg-black/80 flex flex-col justify-between h-[85px] uppercase font-mono ${borderStyle}`}>
              <span className="opacity-60 text-[8px] tracking-widest block font-extrabold uppercase">📅 Virtual Date</span>
              <span className={`text-[10px] md:text-[11px] font-black truncate text-emerald-400`} title={todaysDateFormatted}>
                {todaysDateFormatted}
              </span>
              <span className="text-[7.5px] opacity-40 font-mono tracking-widest">[ SYSTEM_CLOCK ]</span>
            </div>

            {/* INDICADOR 2: SCHEDULED SUBJECTS (ASSUNTOS AGENDADOS) */}
            <div className={`border-2 p-3 rounded-xl bg-black/80 flex flex-col justify-between h-[85px] uppercase font-mono ${borderStyle}`}>
              <span className="opacity-60 text-[8px] tracking-widest block font-extrabold uppercase">📚 Focos Hoje</span>
              <span className={`text-lg font-black ${textStyle}`}>
                {todaysTopicsCount}
              </span>
              <span className="text-[7.5px] opacity-40 font-mono tracking-widest">[ PLAN_TOPICS ]</span>
            </div>

            {/* INDICADOR 3: OPEN TASKS (TAREFA ABERTA) */}
            <div className={`border-2 p-3 rounded-xl bg-black/80 flex flex-col justify-between h-[85px] uppercase font-mono ${borderStyle}`}>
              <span className="opacity-60 text-[8px] tracking-widest block font-extrabold uppercase">⏺ Metas Abertas</span>
              <span className={`text-lg font-black ${textStyle}`}>
                {openTasksCount}
              </span>
              <span className="text-[7.5px] opacity-40 font-mono tracking-widest">[ QUEUE_LIMIT ]</span>
            </div>

            {/* INDICADOR 4: URGENT TASKS (TAREFA URGENTE) */}
            <div className={`border-2 p-3 rounded-xl bg-black/80 flex flex-col justify-between h-[85px] uppercase font-mono ${borderStyle}`}>
              <span className="opacity-60 text-[8px] tracking-widest block font-extrabold uppercase">⚡ Urgentes</span>
              <span className={`text-lg font-black ${urgentTasksCount > 0 ? 'text-rose-400' : textStyle}`}>
                {urgentTasksCount}
              </span>
              <span className="text-[7.5px] opacity-40 font-mono tracking-widest">[ DANGER_INDEX ]</span>
            </div>

            {/* INDICADOR 5: COMPLETED TODAY */}
            <div className={`border-2 p-3 rounded-xl bg-black/80 flex flex-col justify-between h-[85px] uppercase font-mono ${borderStyle}`}>
              <span className="opacity-60 text-[8px] tracking-widest block font-extrabold uppercase">✓ Concluídas</span>
              <span className={`text-lg font-black ${textStyle}`}>
                {completedTodayCount}
              </span>
              <span className="text-[7.5px] opacity-40 font-mono tracking-widest">[ COMPLETED_DAY ]</span>
            </div>
          </div>
        );
      })()}

      {/* METRICS BY OPERATIONAL PERIOD ACCORDION BOX */}
      <div className={`border-2 p-4 rounded-xl space-y-3 bg-black/80 font-mono text-xs text-white ${borderStyle}`}>
        <div className="text-[9px] font-black uppercase text-[var(--color-amber)]/75 tracking-widest">
          📂 [ Estatísticas por Período Operacional ]
        </div>
        {periods.length === 0 ? (
          <div className="opacity-40 text-[10px] uppercase italic">Nenhum período operacional carregado do Supabase.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {periods.map(p => {
              const periodTasks = db.getTaskStats().filter(t => t.task_period_id === p.id);
              const pending = periodTasks.filter(t => !t.is_completed).length;
              const completed = periodTasks.filter(t => t.is_completed).length;
              const total = pending + completed;
              const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
              const pColor = p.color || '#60a5fa';

              return (
                <div key={p.id} className="border border-white/5 bg-zinc-950/60 p-2.5 rounded flex flex-col justify-between gap-1.5 uppercase font-mono text-[9.5px]">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold flex items-center gap-1.5 font-mono" style={{ color: pColor }}>
                      <span className="text-xs leading-none">{p.icon || '☀️'}</span>
                      {p.name}
                    </span>
                    <span className="opacity-55 tracking-widest">[ {pending}P // {completed}D ]</span>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] opacity-70 font-mono">
                      <span>Tarefas: {total}</span>
                      <span>Progresso: {percent}%</span>
                    </div>
                    <div className="w-full bg-black border border-white/10 h-1.5 p-px rounded-sm">
                      <div className="h-full rounded-sm transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: pColor, boxShadow: `0 0 5px ${pColor}` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CENTRALIZED TASK REGISTER MODAL */}
      <AnimatePresence>
        {isCreatingTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 overflow-y-auto backdrop-blur-sm"
          >
            <div className={`max-w-2xl w-full border-2 rounded-xl p-6 bg-zinc-950 text-left space-y-6 ${borderStyle}`}>
              
              {/* MODAL HEADER */}
              <div className="border-b border-white/10 pb-3 flex justify-between items-center text-xs text-white/90 font-mono tracking-widest font-black">
                <span className="font-extrabold flex items-center gap-1.5 uppercase">
                  <Plus className="w-4 h-4 text-[var(--color-amber)]" /> [ NOVA TAREFA - OPERAÇÃO RETRO ]
                </span>
                <button
                  onClick={() => { sounds.playButtonSwitch(); setIsCreatingTask(false); setTaskFormError(null); }}
                  className="p-1 text-white hover:text-rose-400 transition-colors uppercase cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* MODAL ERROR SYSTEM */}
              {taskFormError && (
                <div className="p-3 border border-rose-500/30 bg-rose-950/20 text-rose-400 font-mono text-[10px] uppercase rounded flex items-start gap-2">
                  <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5 animate-pulse" />
                  <div className="space-y-1">
                    <span className="font-bold block">[! ADVERTÊNCIA DE INTERFACE]:</span>
                    <span className="opacity-90">{taskFormError}</span>
                  </div>
                </div>
              )}

              {/* MODAL FORM */}
              <form onSubmit={handleCreateTask} className="space-y-4 font-mono text-xs text-white">
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] text-white/70 uppercase tracking-widest mb-1.5 font-bold">Título do Elemento Operacional (O que precisa ser feito?)</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Atualizar prontuários médicos, Cadastrar nova consulta"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      className="w-full bg-black border border-white/20 p-2.5 text-xs text-white focus:border-[var(--color-amber)] focus:outline-none rounded"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] text-white/70 uppercase tracking-widest mb-1.5 font-bold">Descrição / Observações Adicionais</label>
                    <textarea
                      placeholder="Identificadores, detalhes táteis ou resumos..."
                      value={newTaskDesc}
                      rows={3}
                      onChange={(e) => setNewTaskDesc(e.target.value)}
                      className="w-full bg-black border border-white/20 p-2.5 text-xs text-white focus:border-[var(--color-amber)] focus:outline-none rounded resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] text-white/70 uppercase tracking-widest mb-1.5 font-bold">Dossiê / Grupo de Trabalho</label>
                      <select
                        value={newTaskGroupId}
                        onChange={(e) => {
                          setNewTaskGroupId(e.target.value);
                          setNewTaskCategoryId(''); // Reset selected category on group shift
                        }}
                        className="w-full bg-black border border-white/20 p-2.5 text-xs text-white focus:border-[var(--color-amber)] focus:outline-none rounded cursor-pointer uppercase"
                      >
                        {groups.map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] text-white/70 uppercase tracking-widest mb-1.5 font-bold">Categoria</label>
                      <select
                        value={newTaskCategoryId}
                        onChange={(e) => setNewTaskCategoryId(e.target.value)}
                        className="w-full bg-black border border-white/20 p-2.5 text-xs text-white focus:border-[var(--color-amber)] focus:outline-none rounded cursor-pointer uppercase"
                      >
                        <option value="">Sem Categoria</option>
                        {categories
                          .filter(c => c.group_id === newTaskGroupId)
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
                        value={newTaskTimePeriod}
                        onChange={(e) => setNewTaskTimePeriod(e.target.value)}
                        className="w-full bg-black border border-white/20 p-2.5 text-xs text-white focus:border-[var(--color-amber)] focus:outline-none rounded cursor-pointer uppercase"
                      >
                        <option value="">Selecione o Bloco...</option>
                        {periods.map(p => (
                          <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] text-white/70 uppercase tracking-widest mb-1.5 font-bold">Prazo Limite / Deadline</label>
                      <input
                        type="date"
                        value={newTaskDueDate}
                        onChange={(e) => setNewTaskDueDate(e.target.value)}
                        className="w-full bg-black border border-white/20 p-2.5 text-xs text-white focus:border-[var(--color-amber)] focus:outline-none rounded cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] text-white/70 uppercase tracking-widest mb-1.5 font-bold">Assunto / Foco na Agenda Semanal</label>
                      <select
                        value={newTaskTopicId}
                        onChange={(e) => setNewTaskTopicId(e.target.value)}
                        className="w-full bg-black border border-white/20 p-2.5 text-xs text-white focus:border-[var(--color-amber)] focus:outline-none rounded cursor-pointer truncate uppercase"
                      >
                        <option value="">Livre / Sem Assunto</option>
                        {topics.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      {(() => {
                        const urgency = db.calculateUrgency(newTaskDueDate);
                        const badgeColors: Record<string, string> = {
                          low: 'border-emerald-500/30 bg-emerald-950/20 text-emerald-400',
                          moderate: 'border-yellow-500/30 bg-yellow-950/20 text-yellow-400',
                          urgent: 'border-amber-500/30 bg-[#331d05]/30 text-[var(--color-amber)] animate-pulse',
                          overdue: 'border-rose-500/30 bg-rose-950/20 text-rose-400 animate-pulse'
                        };
                        const labels: Record<string, string> = {
                          low: '[ BAIXA ] - Sem prazo crítico',
                          moderate: '[ MODERADA ] - Menos de 5 dias',
                          urgent: '[ CRÍTICA / URGENTE ] - Próximos 3 dias',
                          overdue: '[ ALERTA: ATRASADA ] - Prazo Ultrapassado'
                        };
                        return (
                          <div className="h-full flex flex-col justify-end">
                            <label className="block text-[9px] text-white/50 uppercase tracking-widest mb-1.5 font-bold">Nível de Urgência de Registro</label>
                            <div className={`p-2.5 border rounded uppercase font-bold text-center text-[10px] ${badgeColors[urgency] || 'border-white/20 text-white/75'}`}>
                              {labels[urgency] || urgency}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => { sounds.playButtonSwitch(); setIsCreatingTask(false); setTaskFormError(null); }}
                    className="px-5 py-2.5 bg-zinc-850 hover:bg-zinc-800 text-white font-extrabold uppercase text-[10px] tracking-widest rounded cursor-pointer transition-all border border-white/10"
                  >
                    Desistir / Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-[var(--color-amber)] text-black font-extrabold uppercase text-[10px] tracking-widest rounded cursor-pointer hover:bg-[#ffd19a] transition-all"
                  >
                    Gravar na Matrix
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
         {/* --- ADVANCED FILTERS PANEL --- */}
      <div className={`border-2 p-4 rounded-xl space-y-3 bg-black/60 font-mono text-xs ${borderStyle}`}>
        <div className="flex items-center justify-between border-b border-white/5 pb-2 text-[10px] text-[var(--color-amber)] uppercase font-black tracking-widest">
          <span>⚡ [ SISTEMA DE FILTRAGEM AVANÇADA ]</span>
          {(filterGroupId || filterCategoryId || filterPeriodId || filterUrgency) && (
            <button
              onClick={() => {
                sounds.playKeyClick();
                setFilterGroupId('');
                setFilterCategoryId('');
                setFilterPeriodId('');
                setFilterUrgency('');
              }}
              className="text-[9px] text-rose-400 hover:text-rose-300 font-extrabold cursor-pointer"
            >
              [ LIMPAR FILTROS ]
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[9px] text-white/50 uppercase mb-1 font-bold">Bloco / Período</label>
            <select
              value={filterPeriodId}
              onChange={(e) => {
                sounds.playKeyClick();
                setFilterPeriodId(e.target.value);
              }}
              className="w-full bg-black border border-white/15 p-1.5 text-xs text-white uppercase focus:border-[var(--color-amber)] focus:outline-none rounded cursor-pointer uppercase"
            >
              <option value="">Todos os Períodos</option>
              {periods.map(p => (
                <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[9px] text-white/50 uppercase mb-1 font-bold">Grupo de Sinergia</label>
            <select
              value={filterGroupId}
              onChange={(e) => {
                sounds.playKeyClick();
                setFilterGroupId(e.target.value);
                setFilterCategoryId(''); // Reset category when group shifts
              }}
              className="w-full bg-black border border-white/15 p-1.5 text-xs text-white uppercase focus:border-[var(--color-amber)] focus:outline-none rounded cursor-pointer"
            >
              <option value="">Todos os Grupos</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[9px] text-white/50 uppercase mb-1 font-bold">Categoria</label>
            <select
              value={filterCategoryId}
              onChange={(e) => {
                sounds.playKeyClick();
                setFilterCategoryId(e.target.value);
              }}
              className="w-full bg-black border border-white/15 p-1.5 text-xs text-white uppercase focus:border-[var(--color-amber)] focus:outline-none rounded cursor-pointer"
            >
              <option value="">Todas as Categorias</option>
              {categories
                .filter(c => !filterGroupId || c.group_id === filterGroupId)
                .map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-[9px] text-white/50 uppercase mb-1 font-bold">Urgência</label>
            <select
              value={filterUrgency}
              onChange={(e) => {
                sounds.playKeyClick();
                setFilterUrgency(e.target.value);
              }}
              className="w-full bg-black border border-white/15 p-1.5 text-xs text-white uppercase focus:border-[var(--color-amber)] focus:outline-none rounded cursor-pointer"
            >
              <option value="">Todas</option>
              <option value="low">Tranquila</option>
              <option value="moderate">Moderada</option>
              <option value="urgent">Urgente</option>
              <option value="overdue">Atrasada</option>
            </select>
          </div>
        </div>

        {/* Toggle Ocultar Concluídas */}
        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none text-[10px] text-white/80 uppercase font-bold font-mono">
            <input
              type="checkbox"
              id="toggle-hide-completed"
              checked={hideCompleted}
              onChange={(e) => {
                sounds.playButtonSwitch();
                setHideCompleted(e.target.checked);
              }}
              className="w-3.5 h-3.5 cursor-pointer accent-[var(--color-amber)]"
            />
            Ocultar Concluídas
          </label>
          <span className="text-[9px] text-zinc-500 font-mono select-none">
            {hideCompleted ? '[✓] Ocultar concluídas (ATIVADO)' : '[ ] Mostrar concluídas'}
          </span>
        </div>
      </div>

      {/* 8. MODO EXECUÇÃO (PRÓXIMA AÇÃO RECOMENDADA) */}
      {recommendedTask ? (
        <div className={`border-2 p-5 rounded-xl border-dashed relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${bgStyle} ${borderStyle} overflow-hidden`}>
          {/* Subtle blinking indicator */}
          <div className="absolute top-2.5 right-4 flex items-center gap-1 font-mono text-[9px] uppercase font-bold text-[var(--color-amber)] animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-amber)]" />
            [ RECOMENDAÇÃO INTELIGENTE ]
          </div>

          <div className="space-y-2.5 max-w-xl text-left font-mono">
            <span className="text-[10px] uppercase font-extrabold text-[var(--color-amber)] opacity-70 tracking-widest flex items-center gap-1.5">
              🎯 Próxima Ação
            </span>

            {/* Hierarchical metadata labels for the recommended task (Period -> Group -> Category) */}
            <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase">
              {recommendedTask.period_name && (
                <span 
                  className="font-bold px-1.5 py-0.5 rounded border flex items-center gap-1"
                  style={{ borderColor: `${recommendedTask.period_color}35`, color: recommendedTask.period_color, backgroundColor: `${recommendedTask.period_color}10` }}
                >
                  <span>{recommendedTask.period_icon || '☀️'}</span>
                  <span>{recommendedTask.period_name}</span>
                </span>
              )}
              {recommendedTask.group_name && (
                <>
                  <span className="text-white/40">/</span>
                  <span className="font-extrabold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${recommendedTask.group_color_hex || ColorToHex(recommendedTask.group_color || '')}15`, color: recommendedTask.group_color_hex || ColorToHex(recommendedTask.group_color || '') }}>
                    {recommendedTask.group_name}
                  </span>
                </>
              )}
              {recommendedTask.category_name && (
                <>
                  <span className="text-white/40">/</span>
                  <span className="font-bold text-white/80 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                    {recommendedTask.category_name}
                  </span>
                </>
              )}
            </div>

            <h3 className={`text-base md:text-lg font-black tracking-normal uppercase ${textStyle}`}>
              {recommendedTask.title}
            </h3>
            {recommendedTask.description && (
              <p className="text-xs text-white/70 line-clamp-2 italic leading-relaxed font-mono">
                {recommendedTask.description}
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-0.5">
              <span className={`text-[9px] px-1.5 py-0.5 uppercase font-semibold ${
                recommendedTask.urgency_level === 'urgent' || recommendedTask.urgency_level === 'overdue'
                  ? 'bg-rose-950/40 text-rose-400 border border-rose-800'
                  : 'bg-[var(--color-amber)]/10 text-[var(--color-amber)] border border-[var(--color-amber)]/30'
              }`}>
                {recommendedTask.urgency_level}
              </span>
              {recommendedTask.due_date && (
                <span className="text-[9px] px-1.5 py-0.5 bg-[var(--color-amber)]/15 text-[var(--color-amber)] font-mono border border-[var(--color-amber)]/20 uppercase flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Prazo: {new Date(recommendedTask.due_date).toLocaleDateString('pt-BR')}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => handleStartFocusOnTask(recommendedTask)}
            className="w-full md:w-auto px-6 py-3 bg-[var(--color-amber)] text-black font-black text-xs hover:bg-[#ffd19a] uppercase rounded tracking-wider flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-[0_0_15px_rgba(255,179,71,0.25)] shrink-0"
          >
            <Play className="w-4 h-4 fill-black" />
            Iniciar Agora
          </button>
        </div>
      ) : (
        <div className={`border-2 border-dashed p-6 rounded-xl text-center font-mono text-xs ${bgStyle} ${borderStyle} text-[var(--color-amber)]/60 uppercase select-none`}>
          ⚡ EXCELENTE TRABALHO! COGNITIVE BUFFER DO REATOR TOTALMENTE LIMPO.<br/>TODAS AS TAREFAS SELECIONADAS FORAM CONCLUÍDAS.
        </div>
      )}

      {/* SEÇÃO ADICIONAL: CAMADA SUPERIOR DE PLANEJAMENTO SEMANAL (ASSUNTOS DE HOJE) */}
      <div className="space-y-4 font-mono">
        <div className="flex justify-between items-center border-b border-[var(--color-amber)]/20 pb-1.5 font-mono">
          <h2 className="text-xs font-black text-[var(--color-amber)] tracking-widest uppercase flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            📅 Focos de Trabalho Planejados para Hoje
          </h2>
          <span className="text-xxs uppercase text-gray-500 font-bold">
            [ Camada Superior de Consciência Semanal ]
          </span>
        </div>

        {(() => {
          // Compute today's active subjects
          const getMonday = () => {
            const today = new Date();
            const day = today.getDay();
            const diff = today.getDate() - day + (day === 0 ? -6 : 1);
            const m = new Date(today.setDate(diff));
            m.setHours(0, 0, 0, 0);
            return m;
          };

          const mondayOffsetStr = getMonday().toISOString().split('T')[0];
          const todayIndex = new Date().getDay(); 
          const activeWeeklyPlan = weeklyPlans.find(wp => wp.week_start_date === mondayOffsetStr);

          const todaysScheduledWpts = activeWeeklyPlan
            ? weeklyPlanTopics.filter(wpt => wpt.weekly_plan_id === activeWeeklyPlan.id && wpt.weekday === todayIndex)
            : [];

          const todaysTopics = todaysScheduledWpts
            .map(wpt => topics.find(tp => tp.id === wpt.category_id))
            .filter(tp => tp !== undefined) as Topic[];

          if (todaysTopics.length === 0) {
            return (
              <div className="border border-dashed border-zinc-800/65 bg-[#120e0a]/20 p-6 rounded-lg text-center text-xs text-gray-500 font-mono uppercase">
                Sabático / Sem Assunto Focado para Hoje. <br />
                <span className="text-[10px] opacity-70">Defina focos na aba [ Foco Semanal ] (F5) para gerenciar o Planejamento.</span>
              </div>
            );
          }

          const colorsMapping: Record<string, { hex: string }> = {
            blue: { hex: '#60a5fa' },
            purple: { hex: '#c084fc' },
            green: { hex: '#34d399' },
            red: { hex: '#f87171' },
            yellow: { hex: '#fbbf24' },
            cyan: { hex: '#22d3ee' },
            orange: { hex: '#fb923c' }
          };

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {todaysTopics.map(topic => {
                const confColor = colorsMapping[topic.color_id || 'yellow'] || colorsMapping.yellow;
                const associatedTasks = tasks.filter(t => t.category_id === topic.id);
                const openTasks = associatedTasks.filter(t => !t.is_completed);

                return (
                  <div 
                    key={topic.id}
                    className="border-2 rounded-xl p-4 bg-black/60 relative overflow-hidden flex flex-col gap-3 transition-colors"
                    style={{ borderColor: confColor.hex + '25', minHeight: '140px' }}
                  >
                    {/* Left colored status wire */}
                    <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: confColor.hex }} />

                    {/* Topic details header */}
                    <div className="flex justify-between items-start pl-1 border-b border-white/5 pb-2">
                      <div>
                        <h3 className="text-xs font-black tracking-wide uppercase text-white flex items-center gap-1.5" style={{ color: confColor.hex }}>
                          {topic.name}
                        </h3>
                        {topic.description && (
                          <p className="text-[10px] text-gray-550 font-mono mt-0.5 line-clamp-1">
                            {topic.description}
                          </p>
                        )}
                      </div>
                      <span className="text-xxs px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-gray-400 font-mono uppercase font-black">
                        {openTasks.length} ABERTAS
                      </span>
                    </div>

                    {/* Listed related tasks */}
                    <div className="flex-1 space-y-1.5 overflow-y-auto pl-1" style={{ maxHeight: '220px' }}>
                      {associatedTasks.length === 0 ? (
                        <div className="text-center py-4 border border-dashed border-zinc-900/60 rounded text-[10px] text-gray-500 font-mono uppercase">
                          Nenhuma tarefa para este foco.
                        </div>
                      ) : (
                        associatedTasks.map(task => (
                          <div 
                            key={task.id}
                            className={`border p-2 rounded flex justify-between items-center bg-black/40 text-3xs font-mono transition-all ${
                              task.is_completed ? 'opacity-40 border-emerald-950/20' : 'border-zinc-900 hover:border-zinc-800'
                            }`}
                          >
                            <div className="flex items-center gap-2 overflow-hidden max-w-[70%]">
                              <button
                                onClick={() => handleToggleTaskChecked(task.id, task.is_completed)}
                                className={`w-3.5 h-3.5 border flex items-center justify-center text-[10px] rounded shrink-0 transition-all font-black cursor-pointer ${
                                  task.is_completed 
                                    ? 'border-emerald-500 bg-emerald-500 text-black' 
                                    : 'border-white/30 hover:border-[var(--color-amber)] text-transparent bg-transparent'
                                }`}
                              >
                                ✓
                              </button>
                              <span className={`text-xxs font-bold uppercase truncate ${task.is_completed ? 'line-through text-gray-500' : 'text-gray-200'}`} title={task.title}>
                                {task.title}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              {!task.is_completed && (
                                <button
                                  onClick={() => handleStartFocusOnTask(task)}
                                  className="p-1 text-[var(--color-amber)] hover:text-white transition"
                                  title="Iniciar Pomodoro"
                                >
                                  <Play className="w-3 h-3 fill-current" />
                                </button>
                              )}
                              <button
                                onClick={() => setEditingTask(task)}
                                className="p-1 text-gray-400 hover:text-white transition"
                                title="Editar"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                className="p-1 text-gray-400 hover:text-red-400 transition"
                                title="Excluir"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* 4. EXECUTION PIPELINE HIERARCHY (Synergy Group -> Category -> Period) */}
      <div className="space-y-5">
        <div className="flex justify-between items-center border-b border-[var(--color-amber)]/20 pb-2">
          <h2 className="text-sm font-black text-[var(--color-amber)] tracking-wider uppercase flex items-center gap-2 font-mono">
            <CheckSquare className="w-4 h-4 animate-pulse" />
            Matriz Operacional de Metas
          </h2>
          <button
            onClick={() => { sounds.playButtonSwitch(); setShowPeriodsModal(true); setFormError(null); }}
            className="px-2.5 py-1 text-[10px] border border-[var(--color-amber)]/40 hover:bg-[var(--color-amber)]/10 text-[var(--color-amber)] rounded uppercase tracking-wider font-extrabold flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Sliders className="w-3.5 h-3.5" />
            Gerenciar Períodos
          </button>
        </div>

        {(() => {
          // Process hierarchical lists dynamically: Period -> Group -> Category -> Task
          const groupedStructure: {
            period: TaskPeriod | null;
            groups: {
              group: TaskGroup;
              categories: {
                category: TaskCategory | null;
                tasks: Task[];
              }[];
            }[];
          }[] = [];

          // 1. Gather all periods
          const sortedPeriods: (TaskPeriod | null)[] = [...periods].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
          
          // Check if there are tasks with unassigned/null periods
          const hasUnassignedPeriodTasks = filteredTasks.some(
            t => !t.task_period_id || !periods.some(p => p.id === t.task_period_id)
          );
          if (hasUnassignedPeriodTasks) {
            sortedPeriods.push(null);
          }

          sortedPeriods.forEach(period => {
            // Find tasks for this period
            const tasksForPeriod = filteredTasks.filter(t => {
              if (period === null) {
                return !t.task_period_id || !periods.some(p => p.id === t.task_period_id);
              }
              return t.task_period_id === period.id;
            });

            if (tasksForPeriod.length === 0) return;

            // 2. Gather groups for this period, sorted by position
            const sortedGroups: (TaskGroup)[] = [...groups].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
            const hasUnassignedGroupTasks = tasksForPeriod.some(
              t => !t.group_id || !groups.some(g => g.id === t.group_id)
            );
            
            const groupOptions = [...sortedGroups];
            if (hasUnassignedGroupTasks) {
              const virtualGroup: TaskGroup = {
                id: 'null_group',
                user_id: 'user-default',
                name: 'Geral / Outros',
                description: '',
                color: 'blue',
                position: 9999,
                created_at: '',
                updated_at: ''
              };
              groupOptions.push(virtualGroup);
            }

            const periodGroups: {
              group: TaskGroup;
              categories: {
                category: TaskCategory | null;
                tasks: Task[];
              }[];
            }[] = [];

            groupOptions.forEach(group => {
              // Find tasks in this group for this period
              const tasksForGroup = tasksForPeriod.filter(t => {
                if (group.id === 'null_group') {
                  return !t.group_id || !groups.some(g => g.id === t.group_id);
                }
                return t.group_id === group.id;
              });

              if (tasksForGroup.length === 0) return;

              // 3. Gather categories for this group
              const groupCats = categories
                .filter(c => c.group_id === group.id)
                .sort((a: any, b: any) => {
                  if (a.position !== undefined && b.position !== undefined) {
                    return a.position - b.position;
                  }
                  return a.name.localeCompare(b.name);
                });

              const hasUnassignedCategoryTasks = tasksForGroup.some(
                t => !t.category_id || !categories.some(c => c.id === t.category_id && c.group_id === group.id)
              );

              const categoryOptions: (TaskCategory | null)[] = [...groupCats];
              if (hasUnassignedCategoryTasks) {
                categoryOptions.push(null);
              }

              const groupCategories: {
                category: TaskCategory | null;
                tasks: Task[];
              }[] = [];

              categoryOptions.forEach(category => {
                const tasksForCat = tasksForGroup.filter(t => {
                  if (category === null) {
                    return !t.category_id || !categories.some(c => c.id === t.category_id && c.group_id === group.id);
                  }
                  return t.category_id === category.id;
                });

                if (tasksForCat.length === 0) return;

                // Sort tasks strictly by position
                const sortedTasks = [...tasksForCat].sort((a, b) => a.position - b.position);

                groupCategories.push({
                  category,
                  tasks: sortedTasks
                });
              });

              periodGroups.push({
                group,
                categories: groupCategories
              });
            });

            groupedStructure.push({
              period,
              groups: periodGroups
            });
          });

          if (groups.length === 0 || categories.length === 0 || tasks.length === 0) {
            return (
              <div className="space-y-4">
                {groups.length === 0 && (
                  <div className={`border-2 border-dashed p-6 rounded-xl text-center font-mono text-xs ${bgStyle} ${borderStyle} text-[var(--color-amber)]/80 uppercase space-y-3`}>
                    <p className="font-bold">Nenhum grupo encontrado</p>
                    {isCreatingGroup ? (
                      <form onSubmit={handleCreateGroupInline} className="max-w-md mx-auto space-y-3 text-left border border-white/10 p-4 rounded bg-black/80">
                        <div>
                          <label className="block text-[9px] text-white/70 uppercase tracking-widest mb-1 font-bold">Nome do Grupo</label>
                          <input 
                            type="text" 
                            required 
                            value={newGroupName} 
                            onChange={e => setNewGroupName(e.target.value)} 
                            className="w-full bg-zinc-950 border border-white/25 p-2 text-xs focus:border-[var(--color-amber)] focus:outline-none rounded text-white"
                            placeholder="Ex: Metas Gerais"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-white/70 uppercase tracking-widest mb-1 font-bold">Descrição</label>
                          <input 
                            type="text" 
                            value={newGroupDesc} 
                            onChange={e => setNewGroupDesc(e.target.value)} 
                            className="w-full bg-zinc-950 border border-white/25 p-2 text-xs focus:border-[var(--color-amber)] focus:outline-none rounded text-white"
                            placeholder="Descrição opcional..."
                          />
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" className="px-3 py-1 bg-[var(--color-amber)] text-black text-[9px] font-extrabold uppercase rounded cursor-pointer">
                            [ Salvar ]
                          </button>
                          <button type="button" onClick={() => setIsCreatingGroup(false)} className="px-3 py-1 border border-white/25 text-white text-[9px] font-extrabold uppercase rounded cursor-pointer">
                            [ Cancelar ]
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button 
                        onClick={() => { sounds.playButtonSwitch(); setIsCreatingGroup(true); }}
                        className="px-4 py-1.5 border border-[var(--color-amber)] text-[var(--color-amber)] hover:bg-[var(--color-amber)]/10 text-[9px] font-black uppercase rounded cursor-pointer"
                      >
                        [ Criar ]
                      </button>
                    )}
                  </div>
                )}

                {groups.length > 0 && categories.length === 0 && (
                  <div className={`border-2 border-dashed p-6 rounded-xl text-center font-mono text-xs ${bgStyle} ${borderStyle} text-[var(--color-amber)]/80 uppercase space-y-3`}>
                    <p className="font-bold">Nenhuma categoria encontrada</p>
                    {isCreatingCategory ? (
                      <form onSubmit={handleCreateCategoryInline} className="max-w-md mx-auto space-y-3 text-left border border-white/10 p-4 rounded bg-black/80">
                        <div>
                          <label className="block text-[9px] text-white/70 uppercase tracking-widest mb-1 font-bold">Nome da Categoria</label>
                          <input 
                            type="text" 
                            required 
                            value={newCategoryName} 
                            onChange={e => setNewCategoryName(e.target.value)} 
                            className="w-full bg-zinc-950 border border-white/25 p-2 text-xs focus:border-[var(--color-amber)] focus:outline-none rounded text-white"
                            placeholder="Ex: Urgentes"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-white/70 uppercase tracking-widest mb-1 font-bold">Grupo Alvo (Dossiê)</label>
                          <select 
                            required
                            value={newCategoryGroupId} 
                            onChange={e => setNewCategoryGroupId(e.target.value)} 
                            className="w-full bg-zinc-950 border border-white/25 p-2 text-xs focus:border-[var(--color-amber)] focus:outline-none rounded cursor-pointer uppercase text-white"
                          >
                            <option value="" className="bg-black text-white">Selecione o Grupo...</option>
                            {groups.map(g => (
                              <option key={g.id} value={g.id} className="bg-black text-white">{g.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" className="px-3 py-1 bg-[var(--color-amber)] text-black text-[9px] font-extrabold uppercase rounded cursor-pointer">
                            [ Salvar ]
                          </button>
                          <button type="button" onClick={() => setIsCreatingCategory(false)} className="px-3 py-1 border border-white/25 text-white text-[9px] font-extrabold uppercase rounded cursor-pointer">
                            [ Cancelar ]
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button 
                        onClick={() => { sounds.playButtonSwitch(); setIsCreatingCategory(true); }}
                        className="px-4 py-1.5 border border-[var(--color-amber)] text-[var(--color-amber)] hover:bg-[var(--color-amber)]/10 text-[9px] font-black uppercase rounded cursor-pointer"
                      >
                        [ Criar ]
                      </button>
                    )}
                  </div>
                )}

                {groups.length > 0 && categories.length > 0 && tasks.length === 0 && (
                  <div className={`border-2 border-dashed p-6 rounded-xl text-center font-mono text-xs ${bgStyle} ${borderStyle} text-[var(--color-amber)]/80 uppercase space-y-3`}>
                    <p className="font-bold">Nenhuma meta encontrada</p>
                    <button 
                      onClick={() => { sounds.playButtonSwitch(); setIsCreatingTask(true); }}
                      className="px-4 py-1.5 border border-[var(--color-amber)] text-[var(--color-amber)] hover:bg-[var(--color-amber)]/10 text-[9px] font-black uppercase rounded cursor-pointer"
                    >
                      [ Criar ]
                    </button>
                  </div>
                )}
              </div>
            );
          }

          if (groupedStructure.length === 0) {
            return (
              <div className={`border-2 border-dashed p-10 rounded-xl text-center font-mono text-xs ${bgStyle} ${borderStyle} text-[var(--color-amber)]/60 uppercase select-none`}>
                NENHUMA OPERAÇÃO ATIVA CORRESPONDE AOS CRITÉRIOS DE FILTRAGEM.
              </div>
            );
          }

          return (
            <div className="space-y-6">
              {groupedStructure.map((pBlock, pIdx) => {
                const pColor = pBlock.period?.color || '#a1a1aa';
                
                return (
                  <div key={pBlock.period?.id || `period-null-${pIdx}`} className="space-y-4">
                    {/* Period Level Divider Banner */}
                    <div className="border-b-2 border-dashed border-white/10 pb-2.5 pt-2 flex items-center justify-between">
                      <h3 className="text-sm md:text-sm font-black tracking-widest flex items-center gap-2 uppercase font-mono" style={{ color: pColor }}>
                        <span className="text-base leading-none">{pBlock.period?.icon || '⏱️'}</span>
                        <span>{pBlock.period?.name || 'Sem Período / Livre'}</span>
                      </h3>
                      <span className="text-[9px] font-mono opacity-50 font-bold bg-zinc-900/80 px-2 py-0.5 rounded border border-white/5">
                        {pBlock.groups.reduce((sum, g) => sum + g.categories.reduce((s2, c) => s2 + c.tasks.length, 0), 0)} metas
                      </span>
                    </div>

                    {/* Groups under this Period */}
                    <div className="space-y-4 pl-0 sm:pl-3">
                      {pBlock.groups.map((gBlock, gIdx) => {
                        const groupColorHex = ColorToHex(gBlock.group.color);
                        
                        return (
                          <div 
                            key={gBlock.group.id || `group-null-${gIdx}`}
                            className={`border-2 rounded-xl overflow-hidden ${bgStyle} ${borderStyle} transition-all p-4 space-y-3`}
                            style={{ borderLeft: `5px solid ${groupColorHex}` }}
                          >
                            {/* Group Header */}
                            <div className="flex items-center justify-between border-b border-white/5 pb-2">
                              <span className="font-extrabold flex items-center gap-1.5 font-mono text-[11px] uppercase" style={{ color: groupColorHex }}>
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: groupColorHex, boxShadow: `0 0 6px ${groupColorHex}` }} />
                                {gBlock.group.name}
                              </span>
                              {gBlock.group.description && (
                                <span className="text-[9.5px] text-white/40 italic font-mono max-w-[200px] sm:max-w-xs truncate uppercase">
                                  {gBlock.group.description}
                                </span>
                              )}
                            </div>

                            {/* Categories under this Group */}
                            <div className="space-y-3">
                              {gBlock.categories.map((cBlock, cIdx) => {
                                const catName = cBlock.category?.name || 'Geral';
                                
                                return (
                                  <div key={cBlock.category?.id || `cat-null-${cIdx}`} className="space-y-2">
                                    {/* Category Subheader */}
                                    <div className="flex items-center gap-2 text-[9.5px] font-mono text-white/70 uppercase font-black tracking-wider">
                                      <span className="opacity-40">└─</span>
                                      <Folder className="w-3.5 h-3.5 opacity-60 text-white/50" />
                                      <span className="bg-white/5 px-1.5 py-0.5 rounded border border-white/10 shrink-0 select-none">
                                        {catName}
                                      </span>
                                      <span className="h-px bg-white/5 flex-1" />
                                      <span className="opacity-35 text-[8.5px]">{cBlock.tasks.length} {cBlock.tasks.length === 1 ? 'meta' : 'metas'}</span>
                                    </div>

                                    {/* Checklist Tasks in this Category */}
                                    <div className="pl-4 sm:pl-6 space-y-4">
                                      {(() => {
                                        const pendingTasks = cBlock.tasks.filter(t => !t.is_completed);
                                        const completedTasks = cBlock.tasks.filter(t => t.is_completed);

                                        const renderTaskCard = (task: any, isCompletedRow: boolean) => (
                                          <div 
                                            key={task.id}
                                            className={`border p-3.5 rounded-lg bg-black/45 hover:bg-black/85 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group transition-all ${
                                              isCompletedRow ? 'border-emerald-500/10 opacity-40' : 'border-white/10'
                                            }`}
                                          >
                                            <div className="flex items-start gap-3 overflow-hidden text-left font-mono">
                                              <button
                                                onClick={() => handleToggleTaskChecked(task.id, task.is_completed)}
                                                className={`w-5 h-5 border flex items-center justify-center text-xs rounded shrink-0 transition-all font-black mt-0.5 cursor-pointer ${
                                                  task.is_completed 
                                                    ? 'border-emerald-500 bg-emerald-500 text-black' 
                                                    : 'border-white/30 hover:border-[var(--color-amber)] text-transparent bg-transparent'
                                                }`}
                                              >
                                                ✓
                                              </button>
                                              
                                              <div className="overflow-hidden space-y-1">
                                                <h4 className={`text-xs font-bold uppercase tracking-wide leading-tight ${
                                                  task.is_completed ? 'line-through text-white/40 font-normal' : 'text-white'
                                                }`}>
                                                  {task.title}
                                                </h4>
                                                
                                                {task.description && (
                                                  <p className="text-[10px] text-white/50 leading-relaxed font-mono">
                                                    {task.description}
                                                  </p>
                                                )}

                                                {/* Badges on Tasks inside Categories */}
                                                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                                  <span className={`text-[8.5px] px-1.5 py-0.5 uppercase font-extrabold tracking-widest inline-block ${
                                                    task.urgency_level === 'urgent' || task.urgency_level === 'overdue' 
                                                      ? 'bg-rose-950/40 text-rose-400 border border-rose-800' 
                                                      : 'bg-[var(--color-amber)]/20 text-[var(--color-amber)] border border-[var(--color-amber)]/30'
                                                  }`}>
                                                    {task.urgency_level}
                                                  </span>

                                                  {task.due_date && (
                                                    <span className="text-[8.5px] text-white/50 font-mono font-bold uppercase flex items-center gap-1 border border-white/5 bg-white/5 px-1 py-px rounded">
                                                      <Calendar className="w-2.5 h-2.5" /> {new Date(task.due_date).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            </div>

                                            {/* Trigger Actions */}
                                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto pt-2 sm:pt-0 border-t border-white/5 sm:border-0 w-full sm:w-auto justify-end">
                                              {!task.is_completed && (
                                                <button
                                                  onClick={() => handleStartFocusOnTask(task)}
                                                  title="Iniciar Foco"
                                                  className="p-1.5 rounded bg-white/5 text-[var(--color-amber)] hover:bg-[var(--color-amber)] hover:text-black transition-all cursor-pointer"
                                                >
                                                  <Play className="w-3.5 h-3.5 fill-current" />
                                                </button>
                                              )}

                                              <button
                                                onClick={() => { feedbackTap(); setEditingTask(task); }}
                                                title="Editar"
                                                className="p-1.5 rounded bg-white/5 text-slate-300 hover:bg-white/15 transition-all cursor-pointer"
                                              >
                                                <Edit2 className="w-3.5 h-3.5" />
                                              </button>

                                              <button
                                                onClick={() => handleDeleteTask(task.id)}
                                                title="Excluir"
                                                className="p-1.5 rounded bg-white/5 text-rose-400 hover:text-white hover:bg-rose-950/50 transition-all cursor-pointer"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          </div>
                                        );

                                        return (
                                          <div className="space-y-4">
                                            {/* PENDING PORTION */}
                                            {pendingTasks.length > 0 && (
                                              <div className="space-y-2">
                                                {!hideCompleted && completedTasks.length > 0 && (
                                                  <div className="text-[9px] font-extrabold text-[var(--color-amber)] tracking-wider uppercase font-mono flex items-center gap-2 mb-2 select-none">
                                                    <span>⊞</span>
                                                    <span>Pendentes</span>
                                                    <span className="h-px bg-white/5 flex-1" />
                                                    <span className="opacity-40 text-[8px]">{pendingTasks.length} tarefas</span>
                                                  </div>
                                                )}
                                                {pendingTasks.map(t => renderTaskCard(t, false))}
                                              </div>
                                            )}

                                            {/* COMPLETED PORTION */}
                                            {!hideCompleted && completedTasks.length > 0 && (
                                              <div className="space-y-2">
                                                <div className="text-[9px] font-extrabold text-emerald-400 tracking-wider uppercase font-mono flex items-center gap-2 mb-2 select-none">
                                                  <span>☑</span>
                                                  <span>Concluídas</span>
                                                  <span className="h-px bg-white/5 flex-1" />
                                                  <span className="opacity-40 text-[8px]">{completedTasks.length} tarefas</span>
                                                </div>
                                                {completedTasks.map(t => renderTaskCard(t, true))}
                                              </div>
                                            )}

                                            {pendingTasks.length === 0 && (completedTasks.length === 0 || hideCompleted) && (
                                              <div className="text-center py-4 border border-dashed border-white/5 rounded-lg text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                                                [ Nenhuma meta listada neste quadrante ]
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* TAREFA EDIT CONTOUR MODAL */}
      <AnimatePresence>
        {editingTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 overflow-y-auto"
          >
            <div className={`max-w-md w-full border-2 rounded-xl p-6 bg-zinc-950 font-mono text-xs text-white space-y-4 ${borderStyle}`}>
              <div className="border-b border-white/10 pb-2 flex justify-between items-center text-[10px] uppercase font-black text-[var(--color-amber)] tracking-widest">
                <span>[ EDITAR PARÂMETROS DA TAREFA ]</span>
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="p-1 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!editingTask.title.trim()) return;
                  sounds.playKeyClick();
                  try {
                    await db.updateTask(editingTask.id, {
                      title: editingTask.title,
                      description: editingTask.description,
                      task_period_id: editingTask.task_period_id || null,
                      group_id: editingTask.group_id,
                      category_id: editingTask.category_id || null,
                      urgency_level: editingTask.urgency_level,
                      due_date: editingTask.due_date || null
                    });
                    setEditingTask(null);
                    refreshData();
                    db.addLog('SYSTEM: ATUALIZADO REGISTRO DE TAREFA.', 'success');
                  } catch (err: any) {
                    console.error(err);
                    db.addLog(`CRITICAL: ERRO AO SALVAR TAREFA: ${err.message}`, 'error');
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-[9px] text-white/60 uppercase tracking-widest mb-1.5 font-bold">Título da Tarefa</label>
                  <input
                    type="text"
                    required
                    value={editingTask.title}
                    onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                    className="w-full bg-black border border-white/20 p-2 text-xs focus:border-[var(--color-amber)] focus:outline-none rounded"
                  />
                </div>

                <div>
                  <label className="block text-[9px] text-white/60 uppercase tracking-widest mb-1.5 font-bold">Descrição / Notas</label>
                  <textarea
                    value={editingTask.description || ''}
                    rows={2}
                    onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                    className="w-full bg-black border border-white/20 p-2 text-xs focus:border-[var(--color-amber)] focus:outline-none rounded resize-none"
                    placeholder="Descrição opcional..."
                  />
                </div>

                {/* Synergy Group & Category update dropdowns */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] text-white/60 uppercase tracking-widest mb-1.5 font-bold">Dossiê / Grupo</label>
                    <select
                      value={editingTask.group_id || ''}
                      onChange={(e) => setEditingTask({ ...editingTask, group_id: e.target.value, category_id: null })}
                      className="w-full bg-black border border-white/20 p-2 text-xs focus:border-[var(--color-amber)] focus:outline-none rounded cursor-pointer uppercase"
                    >
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] text-white/60 uppercase tracking-widest mb-1.5 font-bold">Categoria</label>
                    <select
                      value={editingTask.category_id || ''}
                      onChange={(e) => setEditingTask({ ...editingTask, category_id: e.target.value || null })}
                      className="w-full bg-black border border-white/20 p-2 text-xs focus:border-[var(--color-amber)] focus:outline-none rounded cursor-pointer uppercase"
                    >
                      <option value="">Sem Categoria</option>
                      {categories
                        .filter(c => c.group_id === editingTask.group_id)
                        .map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] text-white/60 uppercase tracking-widest mb-1.5 font-bold">Período Operacional</label>
                    <select
                      value={editingTask.task_period_id || ''}
                      onChange={(e) => setEditingTask({ ...editingTask, task_period_id: e.target.value || null })}
                      className="w-full bg-black border border-white/20 p-2 text-xs focus:border-[var(--color-amber)] focus:outline-none rounded cursor-pointer"
                    >
                      <option value="">Sem Período (Orfã)</option>
                      {periods.map(p => (
                        <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] text-white/60 uppercase tracking-widest mb-1.5 font-bold">Nível de Urgência</label>
                    <select
                      value={editingTask.urgency_level}
                      onChange={(e) => setEditingTask({ ...editingTask, urgency_level: e.target.value as any })}
                      className="w-full bg-black border border-white/20 p-2 text-xs focus:border-[var(--color-amber)] focus:outline-none rounded cursor-pointer"
                    >
                      <option value="low">Tranquila</option>
                      <option value="moderate">Moderada</option>
                      <option value="urgent">Urgente</option>
                      <option value="overdue">Atrasada</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] text-white/65 uppercase tracking-widest mb-1.5 font-bold">Prazo Limite (Opcional)</label>
                    <input
                      type="date"
                      value={editingTask.due_date ? editingTask.due_date.substring(0, 10) : ''}
                      onChange={(e) => setEditingTask({ ...editingTask, due_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
                      className="w-full bg-black border border-white/20 p-2 text-xs focus:border-[var(--color-amber)] focus:outline-none rounded cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] text-white/65 uppercase tracking-widest mb-1.5 font-bold">Assunto / Foco</label>
                    <select
                      value={editingTask.category_id || ''}
                      onChange={(e) => setEditingTask({ ...editingTask, category_id: e.target.value || null })}
                      className="w-full bg-black border border-white/20 p-2 text-xs focus:border-[var(--color-amber)] focus:outline-none rounded cursor-pointer uppercase text-white"
                    >
                      <option value="">Livre / Sem Assunto</option>
                      {topics.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="w-full py-2 bg-[var(--color-amber)] text-black uppercase font-bold hover:bg-[#ffd19a] rounded transition-all cursor-pointer"
                  >
                    Salvar Alterações
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTask(null)}
                    className="w-full py-2 bg-zinc-800 text-white uppercase font-bold hover:bg-zinc-700 rounded transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DYNAMIC PERIODS DECENTRALIZED MANAGEMENT MODAL */}
      <AnimatePresence>
        {showPeriodsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-45 bg-black/95 flex items-center justify-center p-4 overflow-y-auto animate-fade"
          >
            <div className={`max-w-2xl w-full border-2 rounded-xl p-6 bg-zinc-950 text-left space-y-6 ${borderStyle}`}>
              
              {/* OPERATIONAL PERIODS MODAL HEADER */}
              <div className="border-b border-white/10 pb-3 flex justify-between items-center text-xs text-white/90 font-mono tracking-widest font-black">
                <span className="font-extrabold flex items-center gap-1.5"><Sliders className="w-4 h-4" /> [ CONFIGURAÇÃO E MANUTENÇÃO DE PERÍODOS TEMPORAIS ]</span>
                <button
                  onClick={() => { sounds.playButtonSwitch(); setShowPeriodsModal(false); setEditingPeriodId(null); setPeriodToDelete(null); setFormError(null); }}
                  className="p-1 text-white hover:text-rose-400 transition-colors uppercase cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3 border border-rose-500/30 bg-rose-950/20 text-rose-400 font-mono text-[10px] uppercase rounded flex items-start gap-2">
                  <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5 animate-pulse" />
                  <div className="space-y-1">
                    <span className="font-bold block">[! ERRO NO BANCO DE DADOS DETECTADO]:</span>
                    <span className="opacity-90">{formError}</span>
                  </div>
                </div>
              )}

              {/* MODAL SYSTEM ALARM UNITS */}
              {periodToDelete ? (
                /* DELETION WIZARD WITH TASKS MIGRATION SELECTS */
                <div className="space-y-4 font-mono text-xs text-white bg-rose-950/20 p-5 rounded border border-rose-500/30 animate-pulse-once">
                  <span className="text-[10px] uppercase font-bold text-rose-400 block tracking-wider flex items-center gap-1.5">
                    <AlertOctagon className="w-4 h-4 animate-bounce" />
                    [ ALERTA DE EXCLUSÃO: PROCEDIMENTO DE TRANSICIONAMENTO DE MATRIX PARA TAREFAS ]
                  </span>
                  
                  <p className="opacity-90 leading-relaxed text-[11px]">
                    O período selecionado será removido permanentemente. Para proteger a integridade táctica do seu fluxo de dados, selecione o algoritmo de contingência para as tarefas que estão atualmente sob este período:
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-white/60 uppercase tracking-widest mb-1.5">Algoritmo de Contingência</label>
                      <select
                        value={deleteMode}
                        onChange={(e) => setDeleteMode(e.target.value as any)}
                        className="w-full bg-black border border-white/20 p-2 text-xs text-white font-mono focus:border-rose-400 focus:outline-none cursor-pointer"
                      >
                        <option value="unassign">Nenhum Período (Retirar associação do período mantendo a tarefa)</option>
                        <option value="move">Re-alocar em outro período ativo</option>
                        <option value="delete">Auto-destruição síncrona (Excluir permanentemente todas as tarefas associadas)</option>
                      </select>
                    </div>

                    {deleteMode === 'move' && (
                      <div>
                        <label className="block text-[10px] text-white/60 uppercase tracking-widest mb-1.5 font-bold">Período de Destino</label>
                        <select
                          value={deleteTargetId}
                          onChange={(e) => setDeleteTargetId(e.target.value)}
                          className="w-full bg-black border border-white/20 p-2 text-xs text-white font-mono focus:border-emerald-400 focus:outline-none cursor-pointer"
                        >
                          <option value="">Selecione o Período Operacional...</option>
                          {periods
                            .filter(p => p.id !== periodToDelete)
                            .map(p => (
                              <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
                            ))
                          }
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={async () => {
                        if (deleteMode === 'move' && !deleteTargetId) {
                          setFormError('Por favor selecione um período de destino válido.');
                          return;
                        }
                        sounds.playButtonSwitch();
                        try {
                          await db.deleteTaskPeriod(
                            periodToDelete,
                            deleteMode,
                            deleteMode === 'move' ? deleteTargetId : undefined
                          );
                          db.addLog('SYSTEM: REMOÇÃO CONCLUÍDA DA MATRIX OPERACIONAL.', 'success');
                          setPeriodToDelete(null);
                          setDeleteTargetId('');
                          refreshData();
                        } catch (err: any) {
                          setFormError(err.message || 'Erro ao deletar o período.');
                        }
                      }}
                      className="py-2 px-4 bg-rose-600 hover:bg-rose-500 font-extrabold tracking-wider uppercase rounded text-white text-[10px] cursor-pointer"
                    >
                      Confirmar Decisão
                    </button>
                    <button
                      onClick={() => { sounds.playKeyClick(); setPeriodToDelete(null); }}
                      className="py-2 px-4 bg-zinc-800 hover:bg-zinc-700 font-extrabold tracking-wider uppercase rounded text-white text-[10px] cursor-pointer"
                    >
                      Desistir
                    </button>
                  </div>
                </div>
              ) : (
                /* MAIN MANAGEMENT CRUD DUAL COLUMN PANELS */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs text-white">
                  
                  {/* CREATE / EDIT MODULE */}
                  <div className="space-y-4 bg-white/[0.02] p-4 rounded border border-white/5">
                    <span className="text-[10px] uppercase font-bold text-amber-400 block tracking-wider font-mono">
                      {editingPeriodId ? `// ATUALIZAR PERÍODO TEMPORAL` : `// CRIAR NOVO PERÍODO OPERACIONAL`}
                    </span>

                    <form 
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!periodFormName.trim()) return;
                        sounds.playKeyClick();
                        try {
                          if (editingPeriodId) {
                            await db.updateTaskPeriod(editingPeriodId, {
                              name: periodFormName,
                              icon: periodFormIcon,
                              color: periodFormColor
                            });
                            db.addLog('SYSTEM: ATUALIZADO REGISTRO DE PERÍODO TEMPORAL.', 'success');
                            setEditingPeriodId(null);
                          } else {
                            await db.saveTaskPeriod(
                              periodFormName,
                              periodFormIcon,
                              periodFormColor
                            );
                            db.addLog('SYSTEM: CRIADO NOVO REGISTRO DE PERÍODO OPERACIONAL.', 'success');
                          }
                          setPeriodFormName('');
                          setPeriodFormIcon('☀️');
                          setPeriodFormColor('#60a5fa');
                          refreshData();
                        } catch (err: any) {
                          setFormError(err.message || 'Erro ao persistir período.');
                        }
                      }}
                      className="space-y-3"
                    >
                      <div className="space-y-1">
                        <label className="text-[9px] block text-white/70 font-mono text-xxs uppercase font-black">NOME DO BLOCO</label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: Treino Diário, Estágio Crítico"
                          value={periodFormName}
                          onChange={(e) => setPeriodFormName(e.target.value)}
                          className="w-full bg-black border border-white/20 p-2 text-xs text-white focus:outline-none focus:border-amber-400 rounded font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] block text-white/70 font-mono text-xxs uppercase font-black">EMOJI / ÍCONE</label>
                        <input
                          type="text"
                          required
                          placeholder="☀️, 🌤, 🌙, 📅, 🎯..."
                          value={periodFormIcon}
                          maxLength={5}
                          onChange={(e) => setPeriodFormIcon(e.target.value)}
                          className="w-full bg-black border border-white/25 p-2 text-xs text-white focus:outline-none focus:border-amber-500 rounded font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] block text-white/70 font-mono text-xxs uppercase font-black">PALETA DE COR</label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={periodFormColor}
                            onChange={(e) => setPeriodFormColor(e.target.value)}
                            className="bg-black border border-white/20 p-1 w-10 h-8 rounded shrink-0 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={periodFormColor}
                            placeholder="#60a5fa"
                            onChange={(e) => setPeriodFormColor(e.target.value)}
                            className="w-full bg-black border border-white/25 p-2 text-xs text-white focus:outline-none focus:border-amber-500 rounded font-mono font-black"
                          />
                        </div>
                        {/* Preset Color Swatches for Quick Access */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {['#3b82f6', '#8b5cf6', '#10b981', '#ef4444', '#f59e0b', '#06b6d4', '#f97316', '#ff007f'].map(color => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setPeriodFormColor(color)}
                              style={{ backgroundColor: color }}
                              className={`w-4 h-4 rounded-full border cursor-pointer ${periodFormColor.toLowerCase() === color.toLowerCase() ? 'border-white scale-110' : 'border-transparent'}`}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="submit"
                          className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black uppercase text-[10px] font-black tracking-wider rounded cursor-pointer"
                        >
                          {editingPeriodId ? 'Atualizar Período' : 'Registrar Período'}
                        </button>
                        {editingPeriodId && (
                          <button
                            type="button"
                            onClick={() => {
                              sounds.playKeyClick();
                              setEditingPeriodId(null);
                              setPeriodFormName('');
                              setPeriodFormIcon('☀️');
                              setPeriodFormColor('#60a5fa');
                            }}
                            className="py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-white uppercase text-[10px] font-black tracking-wider rounded cursor-pointer"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </form>
                  </div>

                  {/* ACTIVE CONFIGS LIST */}
                  <div className="space-y-4 bg-white/[0.01] p-4 rounded border border-white/5 flex flex-col h-[320px] overflow-hidden">
                    <span className="text-[10px] uppercase font-bold text-[var(--color-amber)] block tracking-wider font-mono">
                      {"// COMPONENTES ATIVOS NA MATRIX"}
                    </span>

                    <div className="overflow-y-auto space-y-2 flex-1 pr-1">
                      {periods.length === 0 ? (
                        <div className="text-center py-10 opacity-40 font-mono text-[10px] uppercase">
                          Nenhum bloco cadastrado.
                        </div>
                      ) : (
                        periods.map((p, idx) => (
                          <div 
                            key={p.id} 
                            className="bg-black/40 border border-white/10 p-2.5 rounded-lg flex items-center justify-between gap-3 text-xs"
                            style={{ borderLeft: `3px solid ${p.color}` }}
                          >
                            <div className="font-mono truncate">
                              <span className="mr-1.5">{p.icon || '☀️'}</span>
                              <span className="font-extrabold text-white">{p.name}</span>
                              <div className="text-[9px] opacity-40 uppercase tracking-widest font-black">Posição: {p.position}</div>
                            </div>

                            {/* REORDERING AND EDIT/DELETE DIRECT ACTION CONTROLS */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Position Up */}
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={async () => {
                                  if (idx === 0) return;
                                  sounds.playKeyClick();
                                  try {
                                    const newPeriods = [...periods];
                                    const temp = newPeriods[idx];
                                    newPeriods[idx] = newPeriods[idx - 1];
                                    newPeriods[idx - 1] = temp;
                                    await db.reorderTaskPeriods(newPeriods);
                                    refreshData();
                                  } catch (err: any) {
                                    setFormError(err.message);
                                  }
                                }}
                                className={`p-1 rounded bg-white/5 text-white hover:bg-white/10 transition-colors disabled:opacity-20 cursor-pointer`}
                              >
                                ↑
                              </button>
                              
                              {/* Position Down */}
                              <button
                                type="button"
                                disabled={idx === periods.length - 1}
                                onClick={async () => {
                                  if (idx === periods.length - 1) return;
                                  sounds.playKeyClick();
                                  try {
                                    const newPeriods = [...periods];
                                    const temp = newPeriods[idx];
                                    newPeriods[idx] = newPeriods[idx + 1];
                                    newPeriods[idx + 1] = temp;
                                    await db.reorderTaskPeriods(newPeriods);
                                    refreshData();
                                  } catch (err: any) {
                                    setFormError(err.message);
                                  }
                                }}
                                className={`p-1 rounded bg-white/5 text-white hover:bg-white/10 transition-colors disabled:opacity-20 cursor-pointer`}
                              >
                                ↓
                              </button>

                              {/* Edit Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  sounds.playKeyClick();
                                  setEditingPeriodId(p.id);
                                  setPeriodFormName(p.name);
                                  setPeriodFormIcon(p.icon || '☀️');
                                  setPeriodFormColor(p.color);
                                }}
                                className="p-1 rounded bg-white/5 text-amber-400 hover:bg-white/10 transition-colors cursor-pointer"
                              >
                                ✎
                              </button>

                              {/* Delete Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  sounds.playKeyClick();
                                  setPeriodToDelete(p.id);
                                  setDeleteMode('unassign');
                                  setDeleteTargetId('');
                                }}
                                className="p-1 rounded bg-white/5 text-rose-400 hover:bg-white/10 hover:bg-rose-950/20 transition-colors cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
