'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckSquare, 
  Trash2, 
  Plus, 
  Terminal, 
  Play, 
  X, 
  Sliders, 
  FolderPlus, 
  Tag, 
  Calendar, 
  TrendingUp, 
  AlertOctagon, 
  ArrowUp, 
  ArrowDown, 
  Sparkles, 
  Folder, 
  Settings2,
  ListFilter
} from 'lucide-react';
import { useProductivityStore } from '@/stores/productivityStore';
import { useAuthStore } from '@/stores/authStore';
import { sounds } from '@/lib/sounds';
import { db, Task, TaskGroup, TaskCategory } from '@/lib/db';
import { supabase } from '@/lib/supabase';

const badgeColorMap: Record<string, string> = {
  blue: 'bg-blue-950/40 text-blue-300 border-blue-900/60',
  purple: 'bg-purple-950/40 text-purple-300 border-purple-900/60',
  green: 'bg-emerald-950/40 text-emerald-300 border-emerald-900/60',
  red: 'bg-rose-950/40 text-rose-300 border-rose-900/60',
  yellow: 'bg-amber-950/40 text-amber-300 border-amber-900/60',
  cyan: 'bg-cyan-950/40 text-cyan-300 border-cyan-900/60',
  orange: 'bg-orange-950/40 text-orange-300 border-orange-900/60'
};

export default function TasksPage() {
  const router = useRouter();

  const {
    tasks,
    settings,
    expandedTask,
    setLinkedTask,
    setTimerMode,
    setTimeLeft,
    setTimerRunning,
    setExpandedTask,
    refreshData
  } = useProductivityStore();

  const { user } = useAuthStore();

  const [isClient, setIsClient] = useState(false);

  // Database lists
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);

  // Filtering Options
  const [filterGroup, setFilterGroup] = useState<string>('ALL');
  const [filterUrgency, setFilterUrgency] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterCompleted, setFilterCompleted] = useState<string>('PENDING'); // PENDING, COMPLETED, ALL
  const [sortField, setSortField] = useState<'position' | 'due' | 'urgency'>('position');

  // Modal control for adding new Custom Groups & Categories
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('blue');

  const [newCatGroupId, setNewCatGroupId] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('cyan');

  // Edit Group states
  const [editingGroup, setEditingGroup] = useState<TaskGroup | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDesc, setEditGroupDesc] = useState('');
  const [editGroupColor, setEditGroupColor] = useState('blue');

  // Edit Category states
  const [editingCategory, setEditingCategory] = useState<TaskCategory | null>(null);
  const [editCatGroupId, setEditCatGroupId] = useState('');
  const [editCatName, setEditCatName] = useState('');
  const [editCatColor, setEditCatColor] = useState('cyan');

  // Loading, Syncing & Error States
  const [isLoading, setIsLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Task Ingestion States
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskGroupId, setNewTaskGroupId] = useState('');
  const [newTaskCatId, setNewTaskCatId] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskEstimate, setNewTaskEstimate] = useState(25);

  const handleManualDbTest = async () => {
    clickFeedback();
    db.addLog('SYSTEM: INICIANDO TESTE MANUAL DE PERSISTÊNCIA...', 'info');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      console.log("MANUAL TEST AUTH USER", user);
      
      if (!user) {
        const errVal = "User is not authenticated (null). Can't run database write test.";
        console.error(errVal);
        db.addLog(`TEST_FAILED: ${errVal}`, 'error');
        alert("Erro: Usuário não autenticado. Por favor, faça login antes de rodar o teste.");
        return;
      }

      // 4. VALIDATE PAYLOAD & 15. TESTE MANUAL (INSERT REAL)
      const payloadTest = {
        user_id: user.id,
        title: 'Teste de Persistência Manual ' + new Date().toLocaleTimeString(),
        completed: false
      };

      console.log("TESTING PAYLOAD", payloadTest);

      const { data, error, status } = await supabase
        .from('tasks')
        .insert(payloadTest)
        .select();

      console.log("TEST INSERT DATA", data);
      console.log("TEST INSERT ERROR", error);
      console.log("TEST INSERT STATUS", status);

      if (error) {
        db.addLog(`TEST_FAILED: STATUS ${status} - ${error.message}`, 'error');
        alert(`Erro na inserção: ${error.message} (Status: ${status})`);
      } else {
        db.addLog('TEST_SUCCESS: Real-time sync injected new row to postgres bin.', 'success');
        refreshData();
        alert('Teste concluído com Sucesso! Registro inserido e selecionado no Supabase.');
      }
    } catch (err: any) {
      console.error("TEST EXCEPTION", err);
      db.addLog(`TEST_EXCEPTION: ${err.message || err}`, 'error');
    }
  };

  const loadDbExtras = React.useCallback(() => {
    const handle = setTimeout(() => {
      setGroups(db.getGroups());
      setCategories(db.getCategories());
      setIsLoading(db.isLoading());
      setSyncError(db.getSyncError());
      
      // Auto-select first group in form if none selected
      const activeGroups = db.getGroups();
      if (activeGroups.length > 0 && !newTaskGroupId) {
        setNewTaskGroupId(activeGroups[0].id);
      }
    }, 0);
    return () => clearTimeout(handle);
  }, [newTaskGroupId]);

  const handleGroupChangeInForm = (gid: string) => {
    setNewTaskGroupId(gid);
    // Auto-select first category of that group or clear
    const groupCats = categories.filter(c => c.group_id === gid);
    if (groupCats.length > 0) {
      setNewTaskCatId(groupCats[0].id);
    } else {
      setNewTaskCatId('');
    }
  };

  useEffect(() => {
    const handle = setTimeout(() => {
      setIsClient(true);
    }, 0);
    db.initAuth();
    refreshData();
    loadDbExtras();

    const unsubData = db.subscribeDataRefresh(() => {
      loadDbExtras();
    });

    return () => {
      clearTimeout(handle);
      unsubData();
    };
  }, [refreshData, loadDbExtras]);

  useEffect(() => {
    refreshData();
    loadDbExtras();
  }, [user, refreshData, loadDbExtras]);

  const clickFeedback = () => {
    sounds.playKeyClick();
  };

  // CREATE NEW CUSTOM GROUP
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    clickFeedback();
    
    try {
      setFormError(null);
      await db.saveGroup(newGroupName, newGroupDesc || null, newGroupColor);
      setNewGroupName('');
      setNewGroupDesc('');
      loadDbExtras();
      refreshData();
    } catch (err: any) {
      setFormError(err.message || 'Falha ao salvar o grupo de sinergia no Supabase.');
    }
  };

  // CREATE NEW CUSTOM CATEGORY
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || !newCatGroupId) return;
    clickFeedback();

    try {
      setFormError(null);
      await db.saveCategory(newCatGroupId, newCatName, newCatColor);
      setNewCatName('');
      loadDbExtras();
      refreshData();
    } catch (err: any) {
      setFormError(err.message || 'Falha ao salvar a categoria no Supabase.');
    }
  };

  // EDIT AND UPDATE HANDLERS FOR GROUPS & CATEGORIES
  const handleStartEditGroup = (group: TaskGroup) => {
    clickFeedback();
    setEditingGroup(group);
    setEditGroupName(group.name);
    setEditGroupDesc(group.description || '');
    setEditGroupColor(group.color);
    setEditingCategory(null); // Close other editor
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup || !editGroupName.trim()) return;
    clickFeedback();

    try {
      setFormError(null);
      await db.updateGroup(editingGroup.id, {
        name: editGroupName,
        description: editGroupDesc || null,
        color: editGroupColor
      });

      setEditingGroup(null);
      setEditGroupName('');
      setEditGroupDesc('');
      loadDbExtras();
      refreshData();
    } catch (err: any) {
      setFormError(err.message || 'Falha ao atualizar o grupo de sinergia no Supabase.');
    }
  };

  const handleStartEditCategory = (cat: TaskCategory) => {
    clickFeedback();
    setEditingCategory(cat);
    setEditCatGroupId(cat.group_id);
    setEditCatName(cat.name);
    setEditCatColor(cat.color || 'cyan');
    setEditingGroup(null); // Close other editor
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editCatName.trim() || !editCatGroupId) return;
    clickFeedback();

    try {
      setFormError(null);
      await db.updateCategory(editingCategory.id, {
        group_id: editCatGroupId,
        name: editCatName,
        color: editCatColor
      });

      setEditingCategory(null);
      setEditCatName('');
      setEditCatGroupId('');
      loadDbExtras();
      refreshData();
    } catch (err: any) {
      setFormError(err.message || 'Falha ao atualizar a categoria no Supabase.');
    }
  };

  // INGEST NEW TASK
  const handleAddNewTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !newTaskGroupId) return;
    clickFeedback();

    await db.saveTask(
      newTaskGroupId,
      newTaskCatId || null,
      newTaskTitle,
      newTaskDesc || null,
      newTaskDueDate || null
    );

    // Increment estimate to support time tracking
    if (newTaskEstimate !== 25) {
      // In a full implementation, you could save customized task estimates.
    }

    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskDueDate('');
    refreshData();
    loadDbExtras();
  };

  const handleToggleTaskChecked = async (taskId: string, currentVal: boolean) => {
    sounds.playButtonSwitch();
    const updated = await db.updateTask(taskId, { is_completed: !currentVal });
    if (!currentVal) {
      db.incrementCompletedTasks();
      db.addLog('SYSTEM: TASK SOLVED AND REMOVED FROM HEURISTIC RADAR.', 'success');
    } else {
      db.addLog('SYSTEM: TASK BACK UNDER ACTIVE NEURAL FOCUS BUFFER.', 'warning');
    }
    refreshData();

    // Sync expanded modal if open
    if (expandedTask && expandedTask.id === taskId) {
      const activeTask = updated.find(t => t.id === taskId);
      if (activeTask) setExpandedTask(activeTask);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    sounds.playAlarmBreak();
    await db.deleteTask(taskId);
    refreshData();
    if (expandedTask && expandedTask.id === taskId) {
      setExpandedTask(null);
    }
  };

  const handleDeleteGroup = async (gid: string) => {
    sounds.playAlarmBreak();
    if (confirm("Tem certeza que deseja deletar este grupo? Todas as tarefas e categorias associadas serão permanentemente removidas.")) {
      await db.deleteGroup(gid);
      loadDbExtras();
      refreshData();
    }
  };

  const handleDeleteCategory = async (cid: string) => {
    sounds.playKeyClick();
    await db.deleteCategory(cid);
    loadDbExtras();
    refreshData();
  };

  const handleMoveTaskPosition = async (taskId: string, direction: 'up' | 'down') => {
    sounds.playKeyClick();
    const sortedTasks = [...tasks];
    const index = sortedTasks.findIndex(t => t.id === taskId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedTasks.length) return;

    // Swap positions
    const temp = sortedTasks[index];
    sortedTasks[index] = sortedTasks[targetIndex];
    sortedTasks[targetIndex] = temp;

    await db.reorderTasks(sortedTasks);
    refreshData();
  };

  const handleStartFocusOnTask = (task: Task) => {
    sounds.playButtonSwitch();
    setLinkedTask(task);
    setTimerMode('FOCUS');
    
    // Estimate focus minutes
    setTimeLeft(25 * 60);
    setTimerRunning(true);
    setExpandedTask(null);
    router.push('/pomodoro');
    db.addLog(`FOCUS_UP: SYNCED TELEMETRY LINK CRADLE WITH TASK [${task.title.toUpperCase()}]`, 'success');
  };

  // Group Color Mappings
  const colorMap: Record<string, { bg: string, border: string, text: string, glow: string, badgeBg: string }> = {
    blue: {
      bg: 'bg-blue-950/25',
      border: 'border-blue-500/30 hover:border-blue-400 group-hover:border-blue-400',
      text: 'text-blue-400',
      glow: 'shadow-[0_0_15px_rgba(59,130,246,0.25)]',
      badgeBg: 'bg-blue-950/70 text-blue-300 border-blue-900/60'
    },
    purple: {
      bg: 'bg-indigo-950/25',
      border: 'border-purple-500/30 hover:border-purple-400 group-hover:border-purple-400',
      text: 'text-purple-400',
      glow: 'shadow-[0_0_15px_rgba(168,85,247,0.25)]',
      badgeBg: 'bg-purple-950/70 text-purple-300 border-purple-900/60'
    },
    green: {
      bg: 'bg-emerald-950/25',
      border: 'border-emerald-500/30 hover:border-emerald-400 group-hover:border-emerald-400',
      text: 'text-emerald-400',
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.25)]',
      badgeBg: 'bg-emerald-950/70 text-emerald-300 border-emerald-900/60'
    },
    red: {
      bg: 'bg-rose-950/25',
      border: 'border-red-500/30 hover:border-red-400 group-hover:border-red-400',
      text: 'text-red-400',
      glow: 'shadow-[0_0_15px_rgba(239,68,68,0.25)]',
      badgeBg: 'bg-rose-950/70 text-rose-300 border-rose-900/60'
    },
    yellow: {
      bg: 'bg-amber-950/25',
      border: 'border-amber-500/30 hover:border-amber-400 group-hover:border-amber-400',
      text: 'text-amber-400',
      glow: 'shadow-[0_0_15px_rgba(245,158,11,0.25)]',
      badgeBg: 'bg-amber-950/70 text-amber-300 border-amber-900/60'
    },
    cyan: {
      bg: 'bg-cyan-950/25',
      border: 'border-cyan-500/30 hover:border-cyan-400 group-hover:border-cyan-400',
      text: 'text-cyan-400',
      glow: 'shadow-[0_0_15px_rgba(6,182,212,0.25)]',
      badgeBg: 'bg-cyan-950/70 text-cyan-300 border-cyan-900/60'
    },
    orange: {
      bg: 'bg-orange-950/25',
      border: 'border-orange-500/30 hover:border-orange-400 group-hover:border-orange-400',
      text: 'text-orange-400',
      glow: 'shadow-[0_0_15px_rgba(249,115,22,0.25)]',
      badgeBg: 'bg-orange-950/70 text-orange-300 border-orange-900/60'
    }
  };

  // General theme styling
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

  // Apply filtering logic to tasks
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    if (filterGroup !== 'ALL') {
      result = result.filter(t => t.group_id === filterGroup);
    }
    if (filterUrgency !== 'ALL') {
      result = result.filter(t => t.urgency_level === filterUrgency.toLowerCase());
    }
    if (filterCategory !== 'ALL') {
      result = result.filter(t => t.category_id === filterCategory);
    }
    if (filterCompleted === 'PENDING') {
      result = result.filter(t => !t.is_completed);
    } else if (filterCompleted === 'COMPLETED') {
      result = result.filter(t => t.is_completed);
    }

    // Sort order
    if (sortField === 'due') {
      result.sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
    } else if (sortField === 'urgency') {
      const weight = { overdue: 4, urgent: 3, moderate: 2, low: 1 };
      result.sort((a, b) => (weight[b.urgency_level] || 0) - (weight[a.urgency_level] || 0));
    } else {
      result.sort((a, b) => a.position - b.position);
    }

    return result;
  }, [tasks, filterGroup, filterUrgency, filterCategory, filterCompleted, sortField]);

  // Analytics Metrics (Highly styled HUD dials)
  const metrics = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.is_completed).length;
    const pending = total - completed;
    const overdue = tasks.filter(t => t.urgency_level === 'overdue' && !t.is_completed).length;
    const urgent = tasks.filter(t => t.urgency_level === 'urgent' && !t.is_completed).length;

    return { total, completed, pending, overdue, urgent };
  }, [tasks]);

  if (!isClient) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* COCKPIT HEADER WITH STATS HUD */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className={`border-2 p-3 rounded-lg flex flex-col justify-between ${bgStyle} ${borderStyle}`}>
          <span className="text-[9px] uppercase tracking-wider opacity-60">Matrizes Totais</span>
          <span className={`text-xl font-bold font-mono mt-1 ${textStyle}`}>{metrics.total}</span>
        </div>
        <div className={`border-2 p-3 rounded-lg flex flex-col justify-between ${bgStyle} ${borderStyle}`}>
          <span className="text-[9px] uppercase tracking-wider opacity-60">Concluídas</span>
          <span className="text-xl font-bold font-mono mt-1 text-emerald-400">{metrics.completed}</span>
        </div>
        <div className={`border-2 p-3 rounded-lg flex flex-col justify-between ${bgStyle} ${borderStyle}`}>
          <span className="text-[9px] uppercase tracking-wider opacity-60">Pendentes</span>
          <span className="text-xl font-bold font-mono mt-1 text-sky-400">{metrics.pending}</span>
        </div>
        <div className={`border-2 p-3 rounded-lg flex flex-col justify-between ${bgStyle} ${borderStyle} ${metrics.urgent > 0 ? 'border-amber-500 animate-pulse' : ''}`}>
          <span className="text-[9px] uppercase tracking-wider opacity-60">Em Urgência</span>
          <span className="text-xl font-bold font-mono mt-1 text-amber-500">{metrics.urgent}</span>
        </div>
        <div className={`border-2 p-3 rounded-lg flex flex-col justify-between ${bgStyle} ${borderStyle} ${metrics.overdue > 0 ? 'border-rose-500 animate-pulse' : ''} col-span-2 md:col-span-1`}>
          <span className="text-[9px] uppercase tracking-wider opacity-60 text-rose-450 font-bold flex items-center gap-1">
            {metrics.overdue > 0 && <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />} ATRIBUÍDO ATRASIS
          </span>
          <span className="text-xl font-bold font-mono mt-1 text-rose-500">{metrics.overdue}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: INGESTION FORM PANEL & SYSTEM DIAL CODES */}
        <div className="space-y-5 self-start">
          <div className={`border-2 p-5 rounded-xl space-y-4 ${bgStyle} ${borderStyle}`}>
            <div className="border-b border-[var(--color-amber)]/20 pb-2 mb-3 flex justify-between items-center text-xs text-[var(--color-amber)] tracking-wider">
              <span className="flex items-center gap-1.5 font-bold"><Terminal className="w-4 h-4" /> [ INGESTÃO REGISTROS ]</span>
              <button 
                type="button"
                onClick={() => { sounds.playButtonSwitch(); setShowConfigModal(true); }}
                className="text-xxs px-2 py-0.5 border border-dashed border-[var(--color-amber)]/60 hover:border-white transition-all rounded uppercase"
              >
                Configurar Grupos
              </button>
            </div>

            <form onSubmit={handleAddNewTask} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xxs text-[var(--color-amber)] opacity-75 uppercase block tracking-wider font-bold">Título da Matriz</label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full bg-black/50 border border-[var(--color-amber)]/45 focus:border-[var(--color-amber)] px-3 py-2 text-xs text-[var(--color-amber)] focus:outline-none rounded font-mono"
                  placeholder="ex: Fazer Redação de Mandarim"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xxs text-[var(--color-amber)] opacity-75 uppercase block tracking-wider font-bold">Grupo Sinergia</label>
                  <select
                    value={newTaskGroupId}
                    required
                    onChange={(e) => handleGroupChangeInForm(e.target.value)}
                    className="w-full bg-black border border-[var(--color-amber)]/45 px-2 py-1.5 text-xs text-[var(--color-amber)] focus:outline-none rounded font-mono"
                  >
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xxs text-[var(--color-amber)] opacity-75 uppercase block tracking-wider font-bold">Categoria</label>
                  <select
                    value={newTaskCatId}
                    onChange={(e) => setNewTaskCatId(e.target.value)}
                    className="w-full bg-black border border-[var(--color-amber)]/45 px-2 py-1.5 text-xs text-[var(--color-amber)] focus:outline-none rounded font-mono"
                  >
                    <option value="">Nenhuma</option>
                    {categories.filter(c => c.group_id === newTaskGroupId).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xxs text-[var(--color-amber)] opacity-75 block tracking-wider font-bold">Resumo das Especificações</label>
                <textarea
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  className="w-full h-16 bg-black/50 border border-[var(--color-amber)]/45 focus:border-[var(--color-amber)] px-3 py-2 text-xs text-[var(--color-amber)] focus:outline-none rounded font-mono resize-none leading-relaxed"
                  placeholder="Instruções e dados cruciais..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xxs text-[var(--color-amber)] opacity-75 block tracking-wider font-bold">Deadline (Prazo)</label>
                  <input
                    type="date"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="w-full bg-black/50 border border-[var(--color-amber)]/45 focus:border-[var(--color-amber)] px-2 py-1 text-xs text-[var(--color-amber)] focus:outline-none rounded font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xxs text-[var(--color-amber)] opacity-75 block tracking-wider font-bold">Ciclos Pomodoro Estimados</label>
                  <input
                    type="number"
                    min="1"
                    value={newTaskEstimate}
                    onChange={(e) => setNewTaskEstimate(Number(e.target.value))}
                    className="w-full bg-black/50 border border-[var(--color-amber)]/45 focus:border-[var(--color-amber)] px-2 py-1 text-xs text-[var(--color-amber)] focus:outline-none rounded font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 border bg-[var(--color-amber)] text-black font-extrabold text-xs hover:bg-[#ffd19a] uppercase rounded flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Registrar Matriz Tática
              </button>
            </form>
          </div>

          <div className={`border-2 p-4 rounded-xl text-xs font-mono select-none ${bgStyle} ${borderStyle} hidden lg:block`}>
            <span className={`${textStyle} block font-bold mb-2`}>{"// PROTOCOLO DE URGÊNCIA AUTOMÁTICA"}</span>
            <div className="space-y-1 opacity-80 leading-relaxed text-[10px]">
              <p>• <span className="text-rose-400 font-bold">SOBRE DATA / EXCUÇÃO ATRASADA</span>: Urgência &quot;OVERDUE&quot;</p>
              <p>• <span className="text-amber-500 font-bold">PRAZO ENTRE 0 - 3 DIAS</span>: Urgência &quot;URGENT&quot;</p>
              <p>• <span className="text-[#33ff33]/90 font-bold">PRAZO ENTRE 4 - 5 DIAS</span>: Urgência &quot;MODERATE&quot;</p>
              <p>• <span className="text-blue-400 font-bold">PRAZO &gt;= 6 DIAS OU SEM DATA</span>: Urgência &quot;LOW&quot;</p>
            </div>
          </div>

          <div className={`border-2 p-4 rounded-xl text-xs font-mono select-none ${bgStyle} ${borderStyle}`}>
            <span className={`${textStyle} block font-bold mb-2`}>{"// DIAGNÓSTICO DE PERSISTÊNCIA"}</span>
            <p className="text-[10px] opacity-80 leading-relaxed mb-3">Rode um teste de gravação direta para validar latência, credenciais e políticas de RLS no Supabase PostgreSQL.</p>
            <button
              type="button"
              onClick={handleManualDbTest}
              className="w-full py-2 border border-dashed border-[var(--color-amber)]/60 hover:bg-[var(--color-amber)]/10 hover:border-solid text-xxs uppercase rounded font-bold text-[var(--color-amber)] transition-all cursor-pointer"
            >
              [ Executar Teste Supabase ]
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: CORE DIRECTORY WIDGET HUB */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* ADVANCED FILTERING CONTROL BAR */}
          <div className={`border-2 p-4 rounded-xl flex flex-wrap gap-3 items-center justify-between ${bgStyle} ${borderStyle}`}>
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-amber)] font-bold">
              <ListFilter className="w-4 h-4" />
              <span>PAINEL DE FILTRAGEM</span>
            </div>

            <div className="flex flex-wrap gap-2 text-xxs font-mono">
              <select
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
                className="bg-black border border-[var(--color-amber)]/35 text-[var(--color-amber)] px-2 py-1 rounded"
              >
                <option value="ALL">TODOS OS GRUPOS</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name.toUpperCase()}</option>
                ))}
              </select>

              <select
                value={filterUrgency}
                onChange={(e) => setFilterUrgency(e.target.value)}
                className="bg-black border border-[var(--color-amber)]/35 text-[var(--color-amber)] px-2 py-1 rounded"
              >
                <option value="ALL">QUALQUER URGÊNCIA</option>
                <option value="LOW">LOW</option>
                <option value="MODERATE">MODERATE</option>
                <option value="URGENT">URGENT</option>
                <option value="OVERDUE">OVERDUE</option>
              </select>

              <select
                value={filterCompleted}
                onChange={(e) => setFilterCompleted(e.target.value)}
                className="bg-black border border-[var(--color-amber)]/35 text-[var(--color-amber)] px-2 py-1 rounded"
              >
                <option value="PENDING">PENDENTES</option>
                <option value="COMPLETED">CONCLUÍDAS</option>
                <option value="ALL">TODAS OPERAÇÕES</option>
              </select>

              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as any)}
                className="bg-black border border-[var(--color-amber)]/35 text-[var(--color-amber)] px-2 py-1 rounded"
              >
                <option value="position">POSICIONAMENTO DE MATRIX</option>
                <option value="due">DATA DE PRAZO</option>
                <option value="urgency">SEVERIDADE DE URGÊNCIA</option>
              </select>
            </div>
          </div>

          {/* ACTION ERROR DISPLAY (Visual Retro Alarm Unit) */}
          {formError && (
            <div className="p-4 border-2 border-rose-500/40 bg-rose-950/20 rounded-xl flex items-start justify-between gap-4 font-mono text-xs text-rose-300 animate-pulse mb-6">
              <div className="space-y-1">
                <div className="font-bold flex items-center gap-1.5 uppercase tracking-wider text-rose-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                  [ FALHA OPERACIONAL SUPABASE DETECTADA ]
                </div>
                <p className="text-[10px] text-white/70 leading-relaxed max-w-2xl">{formError}</p>
              </div>
              <button
                type="button"
                onClick={() => setFormError(null)}
                className="px-2 py-0.5 border border-rose-700 hover:border-rose-400 text-[9px] uppercase font-bold bg-rose-950/40 text-rose-300 hover:bg-rose-900/40 transition-colors rounded cursor-pointer shrink-0"
              >
                [ dispensar ]
              </button>
            </div>
          )}

          {/* MAIN GROUP SECTIONS (The Core Hub) */}
          <div className="space-y-6">
            {isLoading && groups.length === 0 ? (
              <div className="p-12 border-2 border-dashed border-[var(--color-amber)]/40 bg-black/40 rounded-xl flex flex-col items-center justify-center text-center space-y-4 font-mono">
                <div className="w-8 h-8 rounded-full border-4 border-[var(--color-amber)] border-t-transparent animate-spin" />
                <span className="text-[10px] text-[var(--color-amber)]/80 uppercase tracking-widest animate-pulse">
                  [ CONEXÃO SUPABASE ATIVA... CONCILIANTE DE ENTRADA GRUPOS DE SINERGIA ]
                </span>
              </div>
            ) : syncError ? (
              <div className="p-6 border-2 border-rose-500/50 bg-black/60 rounded-xl space-y-4 text-left font-mono">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  <span>[ PROTOCOLO DE CONEXÃO REJEITADO PELO BANCO SUPABASE ]</span>
                </div>
                <p className="text-[10px] text-white/50 leading-relaxed">
                  A comunicação com o reservatório de dados foi interrompida ou falhou. Erro apresentado: <br />
                  <span className="text-rose-300 font-bold block mt-2 bg-rose-950/20 p-2 border border-rose-900/30 rounded whitespace-pre-wrap">{syncError}</span>
                </p>
                <button
                  type="button"
                  onClick={async () => { clickFeedback(); await db.retrySync(); }}
                  className="px-3 py-1.5 border border-[var(--color-amber)] text-[10px] uppercase font-bold bg-[var(--color-amber)]/10 text-[var(--color-amber)] hover:bg-[var(--color-amber)]/30 transition-colors rounded cursor-pointer"
                >
                  [ FORÇAR RE-SINCRONIZAÇÃO SÔNICA ]
                </button>
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-[var(--color-amber)]/20 rounded-xl">
                <span className="text-xs opacity-50 uppercase leading-relaxed">Nenhum Grupo de Sinergia Cadastrado.<br />Abra a aba de controle operacional na esquerda para construir grupos.</span>
              </div>
            ) : (
              groups.map((grp) => {
                // Filter tasks belonging only to this specific group
                const groupTasks = filteredTasks.filter(t => t.group_id === grp.id);
                
                // Completion metrics inside group
                const allGroupTasksRaw = tasks.filter(t => t.group_id === grp.id);
                const pctCompleted = allGroupTasksRaw.length > 0 
                  ? Math.round((allGroupTasksRaw.filter(t => t.is_completed).length / allGroupTasksRaw.length) * 100)
                  : 0;

                const colorStyles = colorMap[grp.color] || colorMap.blue;

                // Return nothing if we've filtered down and this group has no matches
                if (filterGroup !== 'ALL' && filterGroup !== grp.id) return null;
                if (groupTasks.length === 0 && (filterUrgency !== 'ALL' || filterCompleted !== 'PENDING')) return null;

                return (
                  <motion.div
                    key={grp.id}
                    layoutId={`group-section-${grp.id}`}
                    className={`border-2 rounded-xl p-4 md:p-5 relative overflow-hidden transition-all group ${bgStyle} ${colorStyles.border} ${colorStyles.glow}`}
                  >
                    {/* BACKDROP SHADING DEPT */}
                    <div className={`absolute inset-0 opacity-[0.03] pointer-events-none transition-all group-hover:opacity-[0.06] ${colorStyles.bg}`} />

                    {/* GROUP CONTAINER HEADER */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                      <div>
                        <h3 className={`text-md font-bold tracking-wider flex items-center gap-2 ${colorStyles.text}`}>
                          <span>{grp.name}</span>
                          <span className={`text-[8.5px] px-1.5 py-0.2 select-none border rounded font-mono ${colorStyles.badgeBg}`}>
                            {allGroupTasksRaw.filter(t => !t.is_completed).length} REST
                          </span>
                        </h3>
                        {grp.description && (
                          <p className="text-[10px] text-white/50 font-mono mt-0.5 max-w-xl truncate leading-normal">
                            {grp.description}
                          </p>
                        )}
                      </div>

                      {/* GROUP PROGRESS BAR WIDGET */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right font-mono">
                          <span className="text-[9px] block text-white/40 tracking-widest uppercase">Eficácia Geral</span>
                          <span className={`text-xs font-bold leading-none ${colorStyles.text}`}>{pctCompleted}%</span>
                        </div>
                        <div className="w-24 md:w-32 bg-white/5 h-1.5 rounded-full overflow-hidden border border-white/10">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${pctCompleted}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                            className={`h-full rounded-full ${grp.color === 'blue' ? 'bg-blue-400' : grp.color === 'purple' ? 'bg-purple-400' : grp.color === 'green' ? 'bg-emerald-400' : grp.color === 'red' ? 'bg-red-400' : grp.color === 'yellow' ? 'bg-amber-400' : grp.color === 'cyan' ? 'bg-cyan-400' : 'bg-orange-400'}`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* TASK CARDS INSIDE GROUP */}
                    <div className="mt-4 space-y-2">
                      {groupTasks.length === 0 ? (
                        <div className="text-center py-8 text-[10px] font-mono border border-dashed border-white/5 bg-[#000]/10 rounded whitespace-pre-wrap text-white/40 italic">
                          [ Nenhum cadastro pendente ou completado filtrado hoje neste setor ]
                        </div>
                      ) : (
                        groupTasks.map((t) => {
                          const isTaskOverdue = t.urgency_level === 'overdue' && !t.is_completed;
                          const isTaskUrgent = t.urgency_level === 'urgent' && !t.is_completed;
                          const isTaskModerate = t.urgency_level === 'moderate' && !t.is_completed;

                          return (
                            <motion.div
                              key={t.id}
                              layoutId={`task-card-${t.id}`}
                              className={`border p-3 rounded bg-black/40 hover:bg-black/80 flex flex-col sm:flex-row justify-between sm:items-center gap-3 transition-colors ${
                                t.is_completed 
                                  ? 'border-emerald-500/20 opacity-45' 
                                  : isTaskOverdue 
                                    ? 'border-rose-500/50 hover:border-rose-400 shadow-[0_0_8px_rgba(239,68,68,0.15)]' 
                                    : isTaskUrgent
                                      ? 'border-amber-500/40 hover:border-amber-300'
                                      : 'border-white/10 hover:border-white/20'
                              }`}
                            >
                              <div className="flex items-start gap-3 overflow-hidden text-left">
                                <button
                                  type="button"
                                  onClick={() => handleToggleTaskChecked(t.id, t.is_completed)}
                                  className={`w-4 h-4 mt-0.5 border border-white/30 flex items-center justify-center text-[9px] bg-transparent hover:bg-white/10 shrink-0 font-bold transition-all rounded-xs cursor-pointer ${t.is_completed ? 'border-emerald-500 text-emerald-400' : ''}`}
                                >
                                  {t.is_completed ? "✓" : ""}
                                </button>

                                <div className="space-y-1 overflow-hidden min-w-0">
                                  <span 
                                    onClick={() => { sounds.playButtonSwitch(); setExpandedTask(t); }}
                                    className={`truncate block text-xs cursor-pointer hover:underline font-bold md:max-w-md ${t.is_completed ? 'line-through text-white/40 font-normal' : 'text-white'}`}
                                  >
                                    {t.title}
                                  </span>

                                  {/* Sub details line */}
                                  <div className="flex flex-wrap items-center gap-2 text-[9px] font-mono opacity-80 select-none">
                                    {t.category_name && (() => {
                                      const tCat = categories.find(cat => cat.id === t.category_id);
                                      const catColor = tCat?.color || 'cyan';
                                      return (
                                        <span className={`px-1.5 py-0.5 rounded border text-[8.5px] uppercase tracking-wider font-semibold font-mono ${badgeColorMap[catColor] || badgeColorMap.cyan}`}>
                                          {t.category_name.toUpperCase()}
                                        </span>
                                      );
                                    })()}

                                    {t.due_date && (
                                      <span className={`flex items-center gap-1 leading-none ${isTaskOverdue ? 'text-rose-400 font-bold animate-pulse' : 'text-white/50'}`}>
                                        <Calendar className="w-3 h-3" /> {new Date(t.due_date).toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})}
                                      </span>
                                    )}

                                    {/* URGENCY BADGE */}
                                    {!t.is_completed && (
                                      <span className={`text-[8px] font-bold px-1 rounded border tracking-wider leading-none uppercase ${
                                        isTaskOverdue 
                                          ? 'bg-rose-950/40 text-rose-400 border-rose-800 animate-pulse' 
                                          : isTaskUrgent 
                                            ? 'bg-amber-950/40 text-amber-400 border-amber-800'
                                            : isTaskModerate
                                              ? 'bg-emerald-950/40 text-[#33ff33] border-emerald-900'
                                              : 'bg-white/5 text-white/50 border-white/10'
                                      }`}>
                                        {t.urgency_level}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* TASK ACTION BUTTON DECK */}
                              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                {/* Up Down position movers */}
                                <div className="flex flex-row sm:flex-col gap-0.5 bg-white/5 p-0.5 border border-white/10 rounded">
                                  <button
                                    onClick={() => handleMoveTaskPosition(t.id, 'up')}
                                    className="p-1 hover:bg-white/10 transition-all rounded shrink-0 text-white/60 hover:text-white"
                                    title="Subir Posição"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleMoveTaskPosition(t.id, 'down')}
                                    className="p-1 hover:bg-white/10 transition-all rounded shrink-0 text-white/60 hover:text-white"
                                    title="Descer Posição"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => { sounds.playButtonSwitch(); setExpandedTask(t); }}
                                  className="px-2 py-1 bg-white/5 hover:bg-white/15 border border-white/10 text-[9px] font-bold uppercase tracking-wider rounded cursor-pointer"
                                >
                                  Ficha
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleStartFocusOnTask(t)}
                                  className="p-1.5 border border-emerald-800/60 bg-emerald-950/40 text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all rounded cursor-pointer"
                                  title="Iniciar Fluxo Pomodoro"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteTask(t.id)}
                                  className="p-1.5 border border-red-900 text-red-400 hover:bg-red-500 hover:text-black transition-all rounded cursor-pointer"
                                  title="Eliminar Registro"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </motion.div>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* FULLSCREEN OPERATIONS MODAL */}
      <AnimatePresence>
        {expandedTask && (
          <motion.div
            id="fullscreen-operations-modal"
            key="expanded-task-modal-overlay-tasks"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-45 bg-black/98 flex flex-col justify-start p-4 md:p-8 overflow-y-auto"
          >
            {settings.scanlines_enabled && <div className="crt-scanlines" />}
            <div className="crt-vignette" />
            
            <div className={`max-w-4xl w-full mx-auto border-2 rounded-2xl p-5 md:p-8 bg-zinc-950/98 text-left flex flex-col justify-between h-auto min-h-[520px] shadow-2xl space-y-6 md:space-y-8 my-auto select-none ${borderStyle}`}>
              
              {/* OPERATIONAL TOP BAR */}
              <div className="border-b border-white/10 pb-3 flex justify-between items-center text-xs text-white/90 font-mono tracking-widest">
                <span className="font-extrabold flex items-center gap-1.5 animate-pulse uppercase text-xxs tracking-wider">
                  <Terminal className="w-4 h-4 text-emerald-400" /> [ SYSTEM NEURAL TASK MONITOR_ ]
                </span>
                <button
                  onClick={() => { sounds.playButtonSwitch(); setExpandedTask(null); }}
                  className="px-3 py-1 bg-white hover:bg-neutral-200 text-black uppercase font-black tracking-widest text-[9.5px] rounded select-none cursor-pointer"
                >
                  FECHAR MONITOR [ESC]
                </button>
              </div>

              {/* DOCKET COMMAND DECK */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
                <div className="space-y-6 font-mono">
                  <div className="space-y-2 text-left">
                    <span className="text-[9px] uppercase tracking-widest font-bold opacity-60 text-emerald-400 block">{"// IDENTIFICADOR DA FICHA OPERACIONAL"}</span>
                    <h2 className="text-lg md:text-xl font-bold tracking-widest uppercase border-b border-white/10 pb-2 text-white/90">
                      {expandedTask.group_name} {"//"} {expandedTask.title}
                    </h2>
                    
                    {expandedTask.category_name && (() => {
                      const tCat = categories.find(cat => cat.id === expandedTask.category_id);
                      const catColor = tCat?.color || 'cyan';
                      return (
                        <div className={`inline-flex items-center gap-1.5 text-[9.5px] font-bold px-2 py-0.5 rounded border uppercase mt-2 ${badgeColorMap[catColor] || badgeColorMap.cyan}`}>
                          <Tag className="w-3 h-3" /> {expandedTask.category_name}
                        </div>
                      );
                    })()}
                    
                    <p className="text-xs text-white/80 mt-4 leading-relaxed whitespace-pre-wrap bg-white/[0.02] p-4 rounded border border-white/5 font-mono">
                      {expandedTask.description || "Nenhuma especificação detalhada anexada neste registro."}
                    </p>
                  </div>

                  {/* POMODORO INTEGRATED COUNTERS */}
                  <div className="p-4 border border-emerald-950 bg-emerald-950/15 rounded-xl space-y-3">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">{"// ADERÊNCIA AO SISTEMA POMODORO"}</span>
                    <p className="text-[11px] text-white/70 leading-relaxed">
                      Este registro foi catalogado sob o grupo <span className="underline">{expandedTask.group_name}</span>. Você pode dispará-lo diretamente de volta para a matriz do cronômetro para acumular telemetria de foco mental concentrado.
                    </p>
                  </div>
                </div>

                {/* TELEMETRY DESPATCH METADATA CONTROL */}
                <div className="border border-white/10 p-5 rounded-xl flex flex-col justify-between bg-white/[0.01]">
                  <div className="space-y-4">
                    <div className="border-b border-white/10 pb-2 text-[10px] tracking-widest text-white/70 uppercase font-black font-mono">
                      [ CADASTRO DA CONTROLADORIA ]
                    </div>

                    <div className="space-y-3 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="opacity-60">Status de Execução:</span>
                        <span className={`font-black uppercase ${expandedTask.is_completed ? 'text-emerald-400' : 'text-amber-500 animate-pulse'}`}>
                          {expandedTask.is_completed ? '✓ CONCLUÍDO' : 'PENDENTE EM EXECUÇÃO'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="opacity-60">Urgência Heurística:</span>
                        <span className="font-extrabold text-white uppercase">{expandedTask.urgency_level}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="opacity-60">Início de Registro:</span>
                        <span className="text-white">{new Date(expandedTask.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="opacity-60">Última Modificação:</span>
                        <span className="text-white">{new Date(expandedTask.updated_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="opacity-60">Prazo Programado:</span>
                        <span className="text-rose-400 font-bold underline">
                          {expandedTask.due_date ? new Date(expandedTask.due_date).toLocaleDateString('pt-BR') : 'SEM PRAZO'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-6 border-t border-white/5 mt-6">
                    <button
                      onClick={() => handleStartFocusOnTask(expandedTask)}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase text-center rounded flex items-center justify-center gap-1.5 select-none cursor-pointer"
                    >
                      <Play className="w-4 h-4 animate-pulse" /> INICIAR SESSÃO DE FOCO NESTE REGISTRO
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleToggleTaskChecked(expandedTask.id, expandedTask.is_completed)}
                        className="py-2.5 border border-white/25 hover:bg-white/10 text-[10px] font-bold uppercase rounded select-none cursor-pointer text-white/80"
                      >
                        {expandedTask.is_completed ? 'MARCAR REABERTO' : 'FECHAR MATRIX TÁTICA'}
                      </button>
                      <button
                        onClick={() => handleDeleteTask(expandedTask.id)}
                        className="py-2.5 border border-red-950 bg-red-950/20 hover:bg-red-900/60 text-red-200 text-[10px] font-bold uppercase rounded select-none cursor-pointer"
                      >
                        SQUEEZE / DELETAR
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* FOOTER METRICS INFO */}
              <div className="text-[9px] text-white/50 font-mono flex justify-between border-t pt-3 border-white/10 mt-4 leading-none select-none">
                <span>SECTOR: TASK_MGMT // ID={expandedTask.id}</span>
                <span>TVA RETRO CONSOLE SECURITY HUB</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GROUPS AND CATEGORIES MANAGEMENT PANEL MODAL */}
      <AnimatePresence>
        {showConfigModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-45 bg-black/95 flex items-center justify-center p-4 overflow-y-auto"
          >
            <div className={`max-w-2xl w-full border-2 rounded-xl p-6 bg-zinc-950 text-left space-y-6 ${borderStyle}`}>
              
              {/* OPERATIONAL MODAL HEADER */}
              <div className="border-b border-white/10 pb-3 flex justify-between items-center text-xs text-white/90 font-mono tracking-widest">
                <span className="font-extrabold flex items-center gap-1.5"><Settings2 className="w-4 h-4" /> [ CONFIGURAÇÃO DE SETORES OPERACIONAIS ]</span>
                <button
                  onClick={() => { sounds.playButtonSwitch(); setShowConfigModal(false); }}
                  className="p-1 text-white hover:text-rose-400 transition-colors uppercase cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* GRID CONFIGURATION CELLS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs text-white">
                
                {/* GROUP MODULE */}
                <div className="space-y-3 bg-white/[0.02] p-4 rounded border border-white/5">
                  {editingGroup ? (
                    <>
                      <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">{"// EDITAR GRUPO SINERGIA"}</span>
                      <form onSubmit={handleUpdateGroup} className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[9px] block text-white/70">Nome do Grupo</label>
                          <input
                            type="text"
                            required
                            placeholder="ex: 🎓 Academia"
                            value={editGroupName}
                            onChange={(e) => setEditGroupName(e.target.value)}
                            className="w-full bg-black border border-white/20 px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-400 rounded"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] block text-white/70">Alinhamento de Cor</label>
                          <select
                            value={editGroupColor}
                            onChange={(e) => setEditGroupColor(e.target.value)}
                            className="w-full bg-black border border-white/20 px-2 py-1 text-xs text-white focus:outline-none rounded"
                          >
                            <option value="blue">🔵 AZUL COBALTO</option>
                            <option value="purple">🟣 VIOLETA NEON</option>
                            <option value="green">🟢 ESFERA VERDE</option>
                            <option value="red">🔴 ALERTA VERMELHO</option>
                            <option value="yellow">🟡 LARANJA DOURADO</option>
                            <option value="cyan">🟤 CIANO SÔNICO</option>
                            <option value="orange">🟠 ÔNIX CÁLIDO</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] block text-white/70">Descrição Breve</label>
                          <input
                            type="text"
                            placeholder="Alvo teórico e científico..."
                            value={editGroupDesc}
                            onChange={(e) => setEditGroupDesc(e.target.value)}
                            className="w-full bg-black border border-white/20 px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-400 rounded"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="submit"
                            className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white uppercase text-[10px] font-black tracking-wider rounded cursor-pointer"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={() => { clickFeedback(); setEditingGroup(null); }}
                            className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white uppercase text-[10px] font-black tracking-wider rounded cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">{"// CRIAR NOVO GRUPO"}</span>
                      <form onSubmit={handleCreateGroup} className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[9px] block text-white/70">Nome do Grupo</label>
                          <input
                            type="text"
                            required
                            placeholder="ex: 🎓 Academia"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            className="w-full bg-black border border-white/20 px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-400 rounded"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] block text-white/70">Alinhamento de Cor</label>
                          <select
                            value={newGroupColor}
                            onChange={(e) => setNewGroupColor(e.target.value)}
                            className="w-full bg-black border border-white/20 px-2 py-1 text-xs text-white focus:outline-none rounded"
                          >
                            <option value="blue">🔵 AZUL COBALTO</option>
                            <option value="purple">🟣 VIOLETA NEON</option>
                            <option value="green">🟢 ESFERA VERDE</option>
                            <option value="red">🔴 ALERTA VERMELHO</option>
                            <option value="yellow">🟡 LARANJA DOURADO</option>
                            <option value="cyan">🟤 CIANO SÔNICO</option>
                            <option value="orange">🟠 ÔNIX CÁLIDO</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] block text-white/70">Descrição Breve</label>
                          <input
                            type="text"
                            placeholder="Alvo teórico e científico..."
                            value={newGroupDesc}
                            onChange={(e) => setNewGroupDesc(e.target.value)}
                            className="w-full bg-black border border-white/20 px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-400 rounded"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white uppercase text-[10px] font-black tracking-wider rounded cursor-pointer"
                        >
                          Inserir Grupo
                        </button>
                      </form>
                    </>
                  )}

                  {/* ACTIVE GROUPS LIST */}
                  <div className="space-y-1.5 pt-3 border-t border-white/5 max-h-[140px] overflow-y-auto pr-1">
                    <span className="text-[9px] opacity-40 block">GRUPOS EM MEMÓRIA:</span>
                    {groups.map(g => (
                      <div key={g.id} className="flex justify-between items-center p-1.5 border border-white/5 bg-black/40 rounded text-[10px]">
                        <span className="truncate max-w-[110px] flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${
                            g.color === 'blue' ? 'bg-blue-400' : 
                            g.color === 'purple' ? 'bg-purple-400' : 
                            g.color === 'green' ? 'bg-emerald-400' : 
                            g.color === 'red' ? 'bg-red-400' : 
                            g.color === 'yellow' ? 'bg-amber-400' : 
                            g.color === 'cyan' ? 'bg-cyan-400' : 'bg-orange-400'
                          }`} />
                          {g.name}
                        </span>
                        <div className="flex gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditGroup(g)}
                            className="text-emerald-400 text-[8px] hover:underline uppercase"
                          >
                            EDITAR
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteGroup(g.id)}
                            className="text-rose-450 text-[8px] hover:underline uppercase"
                          >
                            EXCLUIR
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CATEGORIES MODULE */}
                <div className="space-y-3 bg-white/[0.02] p-4 rounded border border-white/5">
                  {editingCategory ? (
                    <>
                      <span className="text-[10px] uppercase font-bold text-sky-400 block tracking-wider">{"// EDITAR CATEGORIA"}</span>
                      <form onSubmit={handleUpdateCategory} className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[9px] block text-white/70">Grupo Dependente</label>
                          <select
                            value={editCatGroupId}
                            required
                            onChange={(e) => setEditCatGroupId(e.target.value)}
                            className="w-full bg-black border border-white/20 px-2 py-1 text-xs text-white focus:outline-none rounded"
                          >
                            <option value="">Selecione o Grupo...</option>
                            {groups.map(g => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] block text-white/70">Nome da Categoria</label>
                          <input
                            type="text"
                            required
                            placeholder="ex: Microcontroladores"
                            value={editCatName}
                            onChange={(e) => setEditCatName(e.target.value)}
                            className="w-full bg-black border border-white/20 px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-400 rounded"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] block text-white/70">Alinhamento de Cor</label>
                          <select
                            value={editCatColor}
                            onChange={(e) => setEditCatColor(e.target.value)}
                            className="w-full bg-black border border-white/20 px-2 py-1 text-xs text-white focus:outline-none rounded"
                          >
                            <option value="blue">🔵 AZUL COBALTO</option>
                            <option value="purple">🟣 VIOLETA NEON</option>
                            <option value="green">🟢 ESFERA VERDE</option>
                            <option value="red">🔴 ALERTA VERMELHO</option>
                            <option value="yellow">🟡 LARANJA DOURADO</option>
                            <option value="cyan">🟤 CIANO SÔNICO</option>
                            <option value="orange">🟠 ÔNIX CÁLIDO</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="submit"
                            className="w-full py-1.5 bg-sky-600 hover:bg-sky-500 text-white uppercase text-[10px] font-black tracking-wider rounded cursor-pointer"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={() => { clickFeedback(); setEditingCategory(null); }}
                            className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white uppercase text-[10px] font-black tracking-wider rounded cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] uppercase font-bold text-sky-400 block tracking-wider">{"// CRIAR NOVA CATEGORIA"}</span>
                      <form onSubmit={handleCreateCategory} className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[9px] block text-white/70">Grupo Dependente</label>
                          <select
                            value={newCatGroupId}
                            required
                            onChange={(e) => setNewCatGroupId(e.target.value)}
                            className="w-full bg-black border border-white/20 px-2 py-1 text-xs text-white focus:outline-none rounded"
                          >
                            <option value="">Selecione o Grupo...</option>
                            {groups.map(g => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] block text-white/70">Nome da Categoria</label>
                          <input
                            type="text"
                            required
                            placeholder="ex: Microcontroladores"
                            value={newCatName}
                            onChange={(e) => setNewCatName(e.target.value)}
                            className="w-full bg-black border border-white/20 px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-400 rounded"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] block text-white/70">Alinhamento de Cor</label>
                          <select
                            value={newCatColor}
                            onChange={(e) => setNewCatColor(e.target.value)}
                            className="w-full bg-black border border-white/20 px-2 py-1 text-xs text-white focus:outline-none rounded"
                          >
                            <option value="blue">🔵 AZUL COBALTO</option>
                            <option value="purple">🟣 VIOLETA NEON</option>
                            <option value="green">🟢 ESFERA VERDE</option>
                            <option value="red">🔴 ALERTA VERMELHO</option>
                            <option value="yellow">🟡 LARANJA DOURADO</option>
                            <option value="cyan">🟤 CIANO SÔNICO</option>
                            <option value="orange">🟠 ÔNIX CÁLIDO</option>
                          </select>
                        </div>

                        <button
                          type="submit"
                          className="w-full py-1.5 bg-sky-600 hover:bg-sky-500 text-white uppercase text-[10px] font-black tracking-wider rounded cursor-pointer"
                        >
                          Inserir Categoria
                        </button>
                      </form>
                    </>
                  )}

                  {/* ACTIVE CATEGORIES LIST */}
                  <div className="space-y-1.5 pt-3 border-t border-white/5 max-h-[140px] overflow-y-auto pr-1">
                    <span className="text-[9px] opacity-40 block">CATEGORIAS EM MEMÓRIA:</span>
                    {categories.map(c => {
                      const parentG = groups.find(g => g.id === c.group_id);
                      const catColor = c.color || 'cyan';
                      return (
                        <div key={c.id} className="flex justify-between items-center p-1.5 border border-white/5 bg-black/40 rounded text-[10px]">
                          <span className="truncate max-w-[125px] flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${
                              catColor === 'blue' ? 'bg-blue-400' : 
                              catColor === 'purple' ? 'bg-purple-400' : 
                              catColor === 'green' ? 'bg-emerald-400' : 
                              catColor === 'red' ? 'bg-red-400' : 
                              catColor === 'yellow' ? 'bg-amber-400' : 
                              catColor === 'cyan' ? 'bg-cyan-400' : 'bg-orange-400'
                            }`} />
                            {c.name} <span className="text-white/40">({parentG?.name || '?'})</span>
                          </span>
                          <div className="flex gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEditCategory(c)}
                              className="text-emerald-400 text-[8px] hover:underline uppercase"
                            >
                              EDITAR
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(c.id)}
                              className="text-rose-455 text-[8px] hover:underline uppercase"
                            >
                              EXCLUIR
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* ACTION LOWER BUTTON CLOSE */}
              <div className="pt-3 border-t border-white/5 flex justify-end">
                <button
                  onClick={() => { sounds.playButtonSwitch(); setShowConfigModal(false); }}
                  className="px-4 py-2 border border-white/20 hover:bg-white/5 text-[11px] font-bold text-white uppercase tracking-widest rounded cursor-pointer"
                >
                  Confirmar e Finalizar
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
