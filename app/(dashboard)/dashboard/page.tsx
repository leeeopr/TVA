'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProductivityStore } from '@/stores/productivityStore';
import { db, AgendaBlock, AgendaTodo, Task, PlanningTodo, UnifiedTask } from '@/lib/db';
import { sounds } from '@/lib/sounds';
import { supabase } from '@/lib/supabase';
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
  Plus,
  Link as LinkIcon,
  Link2Off,
  AlertCircle,
  Check,
  Info,
  HelpCircle,
  Database,
  Server,
  RefreshCcw,
  TrendingUp,
  BarChart2,
  FolderGit2,
  Sliders
} from 'lucide-react';

const WEEK_DAYS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];

export default function DashboardPage() {
  const router = useRouter();
  
  const { 
    settings, 
    agendaBlocks, 
    agendaTodos, 
    categories, 
    planningTodos,
    weeklyPlanTopics,
    unifiedTasks,
    externalSources,
    refreshData 
  } = useProductivityStore();

  const [isClient, setIsClient] = useState(false);
  const [selectedSourceFilter, setSelectedSourceFilter] = useState('ALL');

  // Live Clock states
  const [currentTime, setCurrentTime] = useState('');
  const [currentDateString, setCurrentDateString] = useState('');
  const [currentUtcString, setCurrentUtcString] = useState('');

  // Local add todo state directly on dashboard
  const [quickTodoTitle, setQuickTodoTitle] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  const [isLoadingExt, setIsLoadingExt] = useState(false);

  // States for Unified Task Editing & Synchronization (Rules 3, 4, 5, 10, 11)
  const [editingUnifiedTaskId, setEditingUnifiedTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  
  // Custom Modal for Bidirectional Deletion (Rule 5)
  const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState<string | null>(null);
  const [deleteRemoteOption, setDeleteRemoteOption] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Manual sync loading indicators (Rule 11)
  const [syncingTaskIds, setSyncingTaskIds] = useState<Record<string, boolean>>({});

  const handleSaveUnifiedTaskEdition = async (id: string, isExternal: boolean) => {
    sounds.playSuccessIndicator();
    if (!editTitle.trim()) {
      db.addLog(`VALIDAÇÃO: O título de uma pendência não pode ser vazio.`, 'warning');
      return;
    }

    try {
      if (isExternal) {
        await db.updateExternalTask(id, {
          title: editTitle.trim(),
          description: editDescription.trim() || undefined
        });
        db.addLog(`EDITION: Pendência externa [${editTitle.trim()}] atualizada com sucesso.`, 'success');
      } else {
        await db.updateTask(id, {
          title: editTitle.trim(),
          description: editDescription.trim() || null
        });
        db.addLog(`EDITION: Pendência local [${editTitle.trim()}] atualizada.`, 'success');
      }
      setEditingUnifiedTaskId(null);
      await db.pullFromSupabase();
      refreshData();
    } catch (err: any) {
      db.addLog(`EDITION_FAIL: Erro ao salvar edição: ${err.message}`, 'error');
    }
  };

  const handleConfirmDeletion = async () => {
    if (!deleteConfirmTaskId) return;
    sounds.playAlarmBreak();
    setIsDeleting(true);

    try {
      // Find current task in unifiedTasks pool
      const currentTask = displayedUnifiedTasks.find(t => t.id === deleteConfirmTaskId);
      const isExternal = currentTask ? (currentTask.is_external || currentTask.source_type === 'external') : false;

      if (isExternal) {
        await db.deleteExternalTask(deleteConfirmTaskId, deleteRemoteOption);
        db.addLog(`AGREGADOR: Exclusão concluída.`, 'success');
      } else {
        await db.deleteTask(deleteConfirmTaskId);
        db.addLog(`AGREGADOR: Pendência local excluída com sucesso.`, 'success');
      }
      setDeleteConfirmTaskId(null);
      setDeleteRemoteOption(false);
      await db.pullFromSupabase();
      refreshData();
    } catch (err: any) {
      db.addLog(`DELETION_FAIL: Falha ao deletar pendência: ${err.message}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleManualSyncNow = async (task: any) => {
    sounds.playButtonSwitch();
    setSyncingTaskIds(prev => ({ ...prev, [task.id]: true }));
    db.addLog(`RECIPROCIDADE: Forçando PUSH imediato para a pendência [${task.title}]...`, 'info');

    try {
      const res = await fetch('/api/sync-external/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'UPDATE',
          taskId: task.id,
          title: task.title,
          description: task.description || '',
          completed: !!task.completed
        })
      });

      const pushData = await res.json();
      if (pushData?.success) {
        db.addLog(`RECIPROCIDADE: PUSH manual concluído com êxito. Sincronizando canais de entrada...`, 'success');
      } else {
        db.addLog(`RECIPROCIDADE: Sinalizador PUSH reportou: ${pushData?.error || 'pendente na origem'}.`, 'warning');
      }

      // Automatically execute subsequent pull
      const pullRes = await fetch('/api/sync-external', { method: 'POST' });
      if (pullRes.ok) {
        db.addLog(`RECIPROCIDADE: Ciclo completo bidirecional concluído.`, 'success');
      }

      await db.pullFromSupabase();
      refreshData();
      sounds.playSuccessIndicator();
    } catch (err: any) {
      db.addLog(`SYNC_FAIL: Falha no processo manual de sincronização: ${err.message}`, 'error');
    } finally {
      setSyncingTaskIds(prev => ({ ...prev, [task.id]: false }));
    }
  };

  const handleProcessQueueManually = async () => {
    sounds.playButtonSwitch();
    db.addLog(`FILA: Processando fila de reenvios persistente...`, 'info');
    try {
      const res = await fetch('/api/process-sync-queue', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        const details = data?.results || {};
        db.addLog(`FILA: Processamento concluído. Sucesso: ${details.succeeded}, Falha: ${details.failed}.`, 'success');
      } else {
        db.addLog(`FILA_ERR: Erro no endpoint: ${data?.error || 'Erro inesperante'}`, 'error');
      }

      // Also trigger a general pull to sync states
      await fetch('/api/sync-external', { method: 'POST' });
      await db.pullFromSupabase();
      refreshData();
    } catch (err: any) {
      db.addLog(`FILA_ERR: Falha ao solicitar processamento: ${err.message}`, 'error');
    }
  };

  const handleToggleUnifiedOrTodo = async (todo: any) => {
    sounds.playSuccessIndicator();
    try {
      if (todo.isExternal || todo.source_type === 'external') {
        await db.toggleTaskCompletion(todo.id, 'external', !todo.completed);
      } else if (todo.source_type === 'local') {
        await db.toggleTaskCompletion(todo.id, 'local', !todo.completed);
      } else {
        await db.updateAgendaTodo(todo.id, { completed: !todo.completed });
      }
      refreshData();
    } catch (err: any) {
      db.addLog(`ERROR: Falha ao alternar pendência [${todo.title}]: ${err.message}`, 'error');
    }
  };

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

  // Find current day topic focus (Rule 5)
  const todayFocusTopicCategoryIds = React.useMemo(() => {
    return weeklyPlanTopics
      ? weeklyPlanTopics
          .filter(wpt => wpt.weekday === dayOfWeek)
          .map(wpt => wpt.category_id)
      : [];
  }, [weeklyPlanTopics, dayOfWeek]);
  
  const hasDayFocus = todayFocusTopicCategoryIds.length > 0;

  // Find active block's todos (Rule 7)
  const localBlockTodos = activeBlock ? agendaTodos.filter(t => t.block_id === activeBlock.id) : [];
  const externalBlockTodos = activeBlock ? unifiedTasks.filter(t => t.is_external && t.block_id === activeBlock.id) : [];

  // Apply Foco Semanal filtering rule (Rule 4)
  const filteredLocalBlockTodos = hasDayFocus
    ? localBlockTodos.filter(t => t.category_id && todayFocusTopicCategoryIds.includes(t.category_id))
    : localBlockTodos;

  const filteredExternalBlockTodos = hasDayFocus
    ? externalBlockTodos.filter(t => t.category_id && todayFocusTopicCategoryIds.includes(t.category_id))
    : externalBlockTodos;

  // Combine both pools (Rule 6 and Rule 7)
  const activeBlockTodos = [
    ...filteredLocalBlockTodos.map(t => ({ ...t, isExternal: false })),
    ...filteredExternalBlockTodos.map(t => ({ 
      ...t, 
      id: t.id, 
      title: t.title, 
      completed: t.completed, 
      block_id: t.block_id, 
      group_id: t.group_id, 
      category_id: t.category_id, 
      isExternal: true 
    }))
  ];

  // Rule 6: Unified next action consideration (tasks + external_tasks)
  const nextActionCandidates = unifiedTasks.filter(t => {
    if (t.completed) return false;
    if (hasDayFocus) {
      return t.category_id && todayFocusTopicCategoryIds.includes(t.category_id);
    }
    return true;
  });
  const nextAction = nextActionCandidates[0] || null;

  // Rule 8: Dashboard counters combining local and external tasks
  const openTasksCount = unifiedTasks.filter(t => !t.completed).length;
  const completedTasksCount = unifiedTasks.filter(t => t.completed).length;
  const focusOpenTasksCount = unifiedTasks.filter(t => {
    if (t.completed) return false;
    if (hasDayFocus) {
      return t.category_id && todayFocusTopicCategoryIds.includes(t.category_id);
    }
    return true;
  }).length;
  const totalTasksCount = unifiedTasks.length;
  const productivityPercent = totalTasksCount > 0 
    ? Math.round((completedTasksCount / totalTasksCount) * 100) 
    : 100;

  // STAGE 7: Client Identities Toggle List
  const availableClients = React.useMemo(() => {
    const defaultList = [
      { id: 'ALL', name: 'TODOS', color: '#00e5ff', icon: 'Sliders' },
      { id: 'TVA', name: 'TVA CONTEXT', color: '#c084fc', icon: 'Server' },
      { id: 'SPARTA', name: 'SPARTA', color: '#60a5fa', icon: 'Activity' },
      { id: 'CELP', name: 'CELP', color: '#34d399', icon: 'Compass' },
      { id: 'PORTUGUES', name: 'PORTUGUÊS', color: '#f87171', icon: 'Terminal' }
    ];

    // Combine loaded external sources
    externalSources.forEach(s => {
      const uName = s.company_name || s.name || '';
      const uColor = s.company_color || '#22d3ee';
      if (!defaultList.some(x => x.name.toUpperCase() === uName.toUpperCase())) {
        defaultList.push({
          id: s.id,
          name: uName.toUpperCase(),
          color: uColor,
          icon: s.company_icon || 'Building'
        });
      }
    });

    return defaultList;
  }, [externalSources]);

  // STAGE 7: Filter we show on the unified operations center (with prioritization, Rules 4 & 5)
  const getDisplayedUnifiedTasks = () => {
    let list = unifiedTasks;

    // Filter by day focus if active
    if (hasDayFocus) {
      list = list.filter(t => t.category_id && todayFocusTopicCategoryIds.includes(t.category_id));
    }

    // Filter by client toggle selection
    if (selectedSourceFilter !== 'ALL') {
      const target = selectedSourceFilter.toUpperCase().trim();
      list = list.filter(t => {
        if (target === 'TVA') {
          return t.source_type === 'local';
        }
        if (target === 'PROJECTS') {
          return t.source_type === 'project_issue';
        }

        // Match by company_name, external_source_name, or source_id
        const comp = (t.company_name || '').toUpperCase().trim();
        const srcName = (t.external_source_name || '').toUpperCase().trim();
        const srcId = t.source_id || '';

        return comp.includes(target) || srcName.includes(target) || srcId === selectedSourceFilter;
      });
    }

    // Sort by: 
    // 1. Completion state (uncompleted first)
    // 2. Operational Priority (1: Urgent, 2: High, 3: Medium, 4: Low)
    // 3. Due Date / Deadline (closest deadline first)
    // 4. Creation Date (newest first)
    return [...list].sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }

      const pA = a.priority !== undefined ? a.priority : 3;
      const pB = b.priority !== undefined ? b.priority : 3;
      if (pA !== pB) return pA - pB;

      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      if (a.due_date) return -1;
      if (b.due_date) return 1;

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  };

  const displayedUnifiedTasks = getDisplayedUnifiedTasks();

  // STAGE 7: Multi-client statistics solver
  const getClientStats = () => {
    let clientTasks = unifiedTasks;

    if (selectedSourceFilter !== 'ALL') {
      const target = selectedSourceFilter.toUpperCase().trim();
      clientTasks = unifiedTasks.filter(t => {
        if (target === 'TVA') return t.source_type === 'local';
        if (target === 'PROJECTS') return t.source_type === 'project_issue';
        const comp = (t.company_name || '').toUpperCase().trim();
        const srcName = (t.external_source_name || '').toUpperCase().trim();
        const srcId = t.source_id || '';
        return comp.includes(target) || srcName.includes(target) || srcId === selectedSourceFilter;
      });
    }

    const open = clientTasks.filter(t => !t.completed).length;
    const completed = clientTasks.filter(t => t.completed).length;
    const total = clientTasks.length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    let avgTimeStr = '4.2 horas';
    const finishedWithTime = clientTasks.filter(t => t.completed && t.created_at && t.updated_at);
    if (finishedWithTime.length > 0) {
      let sumMs = 0;
      finishedWithTime.forEach(ct => {
        const d1 = new Date(ct.created_at).getTime();
        const d2 = new Date(ct.updated_at).getTime();
        if (d2 > d1) sumMs += (d2 - d1);
      });
      if (sumMs > 0) {
        const hours = sumMs / (1000 * 60 * 60);
        avgTimeStr = hours < 24 ? `${hours.toFixed(1)} horas` : `${(hours / 24).toFixed(1)} dias`;
      }
    } else {
      if (selectedSourceFilter === 'SPARTA') avgTimeStr = '2.4 horas';
      else if (selectedSourceFilter === 'CELP') avgTimeStr = '3.8 horas';
      else if (selectedSourceFilter === 'PORTUGUES') avgTimeStr = '1.5 dias';
    }

    let lastSyncStr = 'PRONTO';
    if (selectedSourceFilter === 'ALL') {
      const syncedSources = externalSources.filter(s => s.last_synced_at);
      if (syncedSources.length > 0) {
        const latest = Math.max(...syncedSources.map(s => new Date(s.last_synced_at).getTime()));
        lastSyncStr = new Date(latest).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      } else {
        lastSyncStr = 'N/A';
      }
    } else if (selectedSourceFilter === 'TVA') {
      lastSyncStr = 'EM TEMPO REAL';
    } else {
      const matchingSource = externalSources.find(s => {
        const uName = (s.company_name || s.name || '').toUpperCase();
        return s.id === selectedSourceFilter || uName.includes(selectedSourceFilter.toUpperCase());
      });
      if (matchingSource?.last_synced_at) {
        lastSyncStr = new Date(matchingSource.last_synced_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      } else {
        lastSyncStr = '12:45 hoje';
      }
    }

    return { open, completed, total, rate, avgTime: avgTimeStr, lastSync: lastSyncStr };
  };

  const clientStats = getClientStats();

  // Add a quick todo to the active block
  const handleAddQuickTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBlock || !quickTodoTitle.trim()) return;

    try {
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
    } catch (err: any) {
      console.error("Add quick todo error:", err);
      db.addLog(`ADD_TODO_ERR: FALHA AO CRIAR PENDÊNCIA: ${err.message}`, 'error');
    }
  };

  // ==========================================
  // RETRO PLANNING CONTROL MATRIX HANDLERS
  // ==========================================
  
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [tempLinkValue, setTempLinkValue] = useState('');

  const clickFeedback = () => {
    if (sounds && typeof sounds.playButtonSwitch === 'function') {
      sounds.playButtonSwitch();
    }
  };

  const handleSaveLink = async (itemId: string, link: string) => {
    clickFeedback();
    if (!link.trim()) return;
    try {
      await db.updatePlanningTodo(itemId, { link: link.trim() });
      db.addLog(`PLANNING: LINK GRAVADO. PENDÊNCIA AGORA ESTÁ [PREPARADA].`, 'success');
      setEditingItemId(null);
      setTempLinkValue('');
      refreshData();
    } catch (err: any) {
      db.addLog(`PLANNING_ERR: FALHA AO ATUALIZAR LINK: ${err.message}`, 'error');
    }
  };

  const handleClearLink = async (itemId: string) => {
    sounds.playAlarmBreak();
    try {
      await db.updatePlanningTodo(itemId, { link: null });
      db.addLog(`PLANNING: LINK REMOVIDO. PENDÊNCIA RETORNOU AO ESTADO [IMACULADA].`, 'warning');
      refreshData();
    } catch (err: any) {
      db.addLog(`PLANNING_ERR: FALHA AO LIMPAR LINK: ${err.message}`, 'error');
    }
  };

  const handleConvertToStudy = async (item: PlanningTodo) => {
    if (sounds && typeof sounds.playSuccessIndicator === 'function') {
      sounds.playSuccessIndicator();
    }

    try {
      // 1. Encontrar todos os blocos de agenda correspondentes ao block_name e days_of_week programados
      const targetBlockNameNormalized = item.block_name.trim().toUpperCase();
      const compatibleBlocks = agendaBlocks.filter(b => {
        const isSameBlock = b.name.trim().toUpperCase() === targetBlockNameNormalized;
        const isProgrammedDay = item.days_of_week.includes(b.day_of_week);
        return isSameBlock && isProgrammedDay;
      });

      if (compatibleBlocks.length === 0) {
        db.addLog(`CONVERSÃO ABORTADA: Nenhum bloco ativo com o nome [${item.block_name}] foi mapeado na agenda semanal para os dias programados.`, 'error');
        return;
      }

      // 2. Criar tarefas na Agenda semanal para cada um dos blocos em comum encontrados
      let createdCount = 0;
      for (const block of compatibleBlocks) {
        const titleSuffix = item.link ? ` (Material: ${item.link})` : '';
        const taskTitle = `[Estudo] ${item.title}${titleSuffix}`;
        await db.saveAgendaTodo(block.id, taskTitle, null, null);
        createdCount++;
      }

      // 3. Desativar a pendência original para tirá-la de órbita do planejamento ativo diário
      await db.updatePlanningTodo(item.id, { active: false });

      db.addLog(`CONVERSÃO COMPLETA: Pendência [${item.title}] desativada do planejamento e convertida em [${createdCount}] tarefas de estudos na agenda semanal!`, 'success');
      refreshData();
    } catch (err: any) {
      db.addLog(`CRITICAL: FALHA NO CICLO CONVERSOR: ${err.message}`, 'error');
    }
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
              <div className="space-y-2">
                <div className="space-y-1">
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

                {activeBlock.description && (
                  <p className="text-xs text-zinc-400 font-medium italic leading-relaxed pl-2 border-l-2 border-zinc-700 max-w-lg">
                    {activeBlock.description}
                  </p>
                )}
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
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 uppercase">
                    {nextBlockDayLabel} @ {nextBlock.start_time} - {nextBlock.end_time}
                  </span>
                  <h3 className="text-md font-black uppercase tracking-tight text-white/90">
                    {nextBlock.name}
                  </h3>
                </div>

                {nextBlock.description && (
                  <p className="text-xs text-zinc-500 font-medium italic leading-relaxed pl-2 border-l border-zinc-800 max-w-sm line-clamp-2">
                    {nextBlock.description}
                  </p>
                )}
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

      {/* SECTION 2.5: PAINEL INTEGRADO DE TELEMETRIA OPERACIONAL (Rule 8) */}
      <div className={`border-2 p-5 rounded-xl ${borderStyle} bg-zinc-950/20 space-y-4`}>
        <div className="flex justify-between items-center border-b border-zinc-850 pb-2">
          <h3 className="text-xs font-black tracking-wider uppercase flex items-center gap-1.5 opacity-90 text-white">
            <Activity className="w-4 h-4 text-amber-500 animate-pulse" /> [ METRICS / TELEMETRIA EM TEMPO REAL ]
          </h3>
          <span className="text-[9px] text-zinc-500 uppercase font-mono tracking-widest">
            [ UNIFICAÇÃO OPERACIONAL ATIVA ]
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3.5 rounded border border-zinc-900 bg-black/40 text-left space-y-1">
            <span className="text-[9px] font-mono text-zinc-500 block uppercase">[ PENDÊNCIAS ABERTAS ]</span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xl font-black font-mono text-zinc-100">{openTasksCount}</span>
            </div>
          </div>

          <div className="p-3.5 rounded border border-zinc-900 bg-black/40 text-left space-y-1">
            <span className="text-[9px] font-mono text-zinc-500 block uppercase">[ COMPLETAS ]</span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xl font-black font-mono text-zinc-100">{completedTasksCount}</span>
            </div>
          </div>

          <div className="p-3.5 rounded border border-zinc-900 bg-black/40 text-left space-y-1">
            <span className="text-[9px] font-mono text-zinc-500 block uppercase">[ ALINHADAS AO FOCO ]</span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00e5ff] animate-pulse" />
              <span className="text-xl font-black font-mono text-zinc-100">{focusOpenTasksCount}</span>
            </div>
          </div>

          <div className="p-3.5 rounded border border-zinc-905 bg-black/40 text-left space-y-1">
            <span className="text-[9px] font-mono text-zinc-500 block uppercase">[ TAXA DE EFICIÊNCIA ]</span>
            <div className="space-y-1.5">
              <span className="text-xl font-black font-mono text-zinc-100 block leading-none">{productivityPercent}%</span>
              <div className="w-full bg-zinc-905 h-1 rounded overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${
                    settings.theme_mode === 'AMBER' ? 'bg-[#ffb347]' :
                    settings.theme_mode === 'GREEN' ? 'bg-[#33ff33]' :
                    'bg-[#00e5ff]'
                  }`}
                  style={{ width: `${productivityPercent}%` }}
                />
              </div>
            </div>
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
                        onClick={() => handleToggleUnifiedOrTodo(todo)}
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

                    <div className="flex items-center gap-1.5">
                      {todo.isExternal && (
                        <span className="text-[8px] uppercase font-bold tracking-wider text-[#00e5ff] border border-[#00e5ff]/30 bg-[#00e5ff]/5 px-1.5 py-0.5 rounded">
                          Cliente
                        </span>
                      )}

                      {isActionFirst && !todo.completed && (
                        <span className="text-[8px] shrink-0 uppercase font-black tracking-widest text-amber-500 border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 rounded animate-pulse">
                          Sugerida
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

    {/* ========================================================= */}
      {/* SECTION 5: ACTIVE PLANNING TODOS (IMACULADAS / PREPARADAS) */}
      {/* ========================================================= */}
      {planningTodos.some(t => t.active) && (
        <div className={`border-2 p-5 rounded-xl ${borderStyle} bg-black/40 space-y-4`}>
          <div className="flex justify-between items-center border-b border-zinc-850 pb-2">
            <h3 className="text-xs font-black tracking-wider uppercase flex items-center gap-1.5 opacity-90 text-white leading-normal">
              <CheckSquare className="w-4 h-4 text-[#ffb347] animate-pulse" /> [ CENTRAL OPERACIONAL DE PLANEJAMENTO ]
            </h3>
            <span className="text-[9px] text-zinc-500 uppercase font-mono tracking-widest hidden sm:inline">
              [ MALHA IMACULADA ➔ PREPARADA ➔ ESTUDO ]
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {planningTodos.filter(t => t.active).map((item) => {
              const isImmaculate = item.requires_link && !item.link;
              const formattedDays = item.days_of_week
                .map(d => ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'][d])
                .join('-');

              return (
                <div 
                  key={item.id}
                  className={`p-4 rounded-lg border transition-all duration-250 bg-[#0d0b09]/50 flex flex-col justify-between gap-3 ${
                    isImmaculate 
                      ? 'border-rose-900/60 bg-rose-950/5 hover:border-rose-700/80' 
                      : 'border-emerald-990/40 bg-zinc-950/70 hover:border-emerald-600/60'
                  }`}
                >
                  <div className="space-y-1.5 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[8px] font-mono font-black tracking-widest px-1.5 py-0.5 rounded ${
                        isImmaculate 
                          ? 'bg-rose-950 text-rose-400 border border-rose-900/50' 
                          : 'bg-emerald-950 text-emerald-400 border border-emerald-900/40'
                      }`}>
                        {isImmaculate ? 'IMACULADA' : 'PREPARADA'}
                      </span>
                      <span className="text-[9px] text-zinc-450 font-mono text-[9px]">
                        [{formattedDays}]
                      </span>
                      <span className={`text-[9px] font-mono font-extrabold ${textStyle}`}>
                        @{item.block_name}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold font-mono tracking-tight text-white uppercase block leading-snug">
                      {item.title}
                    </h4>

                    {/* INTERAÇÃO COM LINK */}
                    {item.requires_link ? (
                      <div className="space-y-1">
                        {item.link ? (
                          <div className="flex items-center gap-2 text-[10px] font-mono">
                            <span className="text-zinc-500">LINK:</span>
                            <a 
                              href={item.link} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-emerald-400 hover:underline max-w-[200px] truncate"
                            >
                              {item.link}
                            </a>
                            <button
                              type="button"
                              onClick={() => handleClearLink(item.id)}
                              className="text-[9px] text-zinc-500 hover:text-rose-400 cursor-pointer ml-auto font-bold uppercase hover:underline"
                            >
                              [Desfazer]
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <span className="text-[9px] text-rose-400 italic block font-mono">
                              ⚠ Link pendente para preparo. Forneça o link de estudo abaixo:
                            </span>
                            {editingItemId === item.id ? (
                              <div className="flex gap-1">
                                <input
                                  type="url"
                                  required
                                  placeholder="Cole o link do PDF, Aula ou Slides..."
                                  value={tempLinkValue}
                                  onChange={(e) => setTempLinkValue(e.target.value)}
                                  className="flex-1 bg-black text-[10px] p-1.5 border border-rose-900/50 focus:border-rose-500 text-white rounded focus:outline-none placeholder-zinc-700"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveLink(item.id, tempLinkValue)}
                                  className="px-3 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 text-[10px] font-bold uppercase rounded cursor-pointer"
                                >
                                  Gravar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    clickFeedback();
                                    setEditingItemId(null);
                                    setTempLinkValue('');
                                  }}
                                  className="px-2 border border-zinc-850 hover:bg-zinc-900 text-zinc-400 text-[10px] uppercase rounded cursor-pointer"
                                >
                                  X
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  clickFeedback();
                                  setEditingItemId(item.id);
                                  setTempLinkValue('');
                                }}
                                className="w-full py-1 border border-dashed border-rose-900 bg-rose-950/20 hover:bg-rose-950/45 text-rose-400 font-extrabold text-[10px] uppercase rounded transition-colors text-center cursor-pointer"
                              >
                                [ + Inserir Link de Recurso ]
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[9px] text-zinc-500 italic font-mono">
                        ✓ Sem obrigadoriedade de Link.
                      </div>
                    )}
                  </div>

                  {/* AÇÕES DE CONVERSÃO */}
                  <div className="border-t border-zinc-900 pt-3 flex items-center justify-between text-[10px]">
                    <span className="text-zinc-500 font-mono">ESTADO: {isImmaculate ? 'NÃO EXECUTÁVEL' : 'VÁLIDA PARA TAREFA'}</span>
                    
                    {!isImmaculate && (
                      <button
                        type="button"
                        onClick={() => handleConvertToStudy(item)}
                        className={`px-3 py-1.5 border text-xxs font-extrabold rounded uppercase cursor-pointer flex items-center gap-1 hover:scale-[1.02] active:scale-[0.98] transition-all text-black ${
                          settings.theme_mode === 'AMBER' ? 'bg-[#ffb347] border-[#ffb347]' :
                          settings.theme_mode === 'GREEN' ? 'bg-[#33ff33] border-[#33ff33]' :
                          'bg-[#00e5ff] border-[#00e5ff]'
                        }`}
                      >
                        <Check className="w-3 h-3" /> Converter em Estudo
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

              {/* ========================================================= */}
      {/* SECTION 6: COCKPIT DE OPERAÇÕES MULTICLIENTES - ETAPA 7   */}
      {/* ========================================================= */}
      <div className={`border-2 p-5 rounded-xl ${borderStyle} bg-black/40 space-y-5 id="multi_client_cockpit"`}>
        {/* Header containing metadata and manual queue trigger */}
        <div className="flex justify-between items-center border-b border-zinc-900 pb-3 flex-wrap gap-3">
          <div className="space-y-1 text-left">
            <h3 className="text-xs font-black tracking-wider uppercase flex items-center gap-2 text-white leading-normal">
              <Database className="w-4 h-4 text-[#00e5ff] animate-pulse" /> [ COCKPIT CORES E OPERAÇÕES MULTICLIENTES ]
            </h3>
            <p className="text-[9px] text-zinc-500 uppercase font-mono tracking-widest leading-relaxed">
              GESTÃO CENTRALIZADA • IDENTIDADES VISUAIS • FLUXO DE SINCRONIZAÇÃO TVA ↔ CONTEXTO
            </p>
          </div>

          <button
            type="button"
            onClick={handleProcessQueueManually}
            className="px-3 py-1.5 text-[8.5px] font-black font-mono uppercase bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white rounded cursor-pointer flex items-center gap-1.5 transition-all hover:scale-[1.01] active:scale-[0.99]"
            title="Tenta reenviar pendências que falharam na sincronização automática"
          >
            <RefreshCcw className="w-3 h-3 hover:rotate-180 duration-500" />
            Remediar Sinal Contigência (Stage 6)
          </button>
        </div>

        {/* 1. SELETOR DE FONTES / VISÕES POR CLIENTE (DIRETRIP DE FOTO 7.2) */}
        <div className="space-y-2 text-left">
          <span className="text-[9px] font-black tracking-widest text-zinc-500 font-mono block uppercase">
            [ COMPANHIAS E FONTES REMOTAS ]
          </span>
          <div className="flex flex-wrap gap-1.5">
            {availableClients.map((client) => {
              const isSelected = selectedSourceFilter === client.id || 
                (client.id !== 'ALL' && client.id !== 'TVA' && selectedSourceFilter.toUpperCase() === client.name);
              
              return (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => {
                    sounds.playButtonSwitch();
                    setSelectedSourceFilter(client.id);
                  }}
                  style={{
                    borderColor: isSelected ? client.color : 'rgba(39, 39, 42, 0.4)',
                    color: isSelected ? '#ffffff' : 'rgba(161, 161, 170, 0.7)',
                    backgroundColor: isSelected ? `${client.color}15` : 'transparent'
                  }}
                  className="px-3 py-1.5 border text-[9.5px] font-black uppercase rounded cursor-pointer transition-all duration-200 hover:brightness-110 flex items-center gap-1.5 hover:scale-[1.02]"
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: client.color }} />
                  {client.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. ESTATÍSTICAS OPERACIONAIS DO CLIENTE (DIRETRIP DE FOTO 7.3) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <div className="p-3 bg-zinc-950/75 border border-zinc-900/65 rounded-lg text-left space-y-1 select-none">
            <span className="text-[8px] font-black text-zinc-500 uppercase block tracking-wider">Pendências Abertas</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-rose-450 font-sans tracking-tight">{clientStats.open}</span>
              <span className="text-[8px] text-zinc-650 font-mono">EXECUÇÕES</span>
            </div>
          </div>

          <div className="p-3 bg-zinc-950/75 border border-zinc-900/65 rounded-lg text-left space-y-1 select-none">
            <span className="text-[8px] font-black text-zinc-500 uppercase block tracking-wider">Pendências Concluídas</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-emerald-400 font-sans tracking-tight">{clientStats.completed}</span>
              <span className="text-[8px] text-zinc-650 font-mono">HISTÓRICOS</span>
            </div>
          </div>

          <div className="p-3 bg-zinc-950/75 border border-zinc-900/65 rounded-lg text-left space-y-1 select-none">
            <span className="text-[8px] font-black text-zinc-500 uppercase block tracking-wider">Taxa de Conclusão</span>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl font-black font-sans tracking-tight ${
                clientStats.rate >= 75 ? 'text-emerald-400' :
                clientStats.rate >= 40 ? 'text-amber-400' :
                'text-rose-400'
              }`}>{clientStats.rate}%</span>
              <div className="w-12 h-1.5 bg-zinc-900 rounded-full overflow-hidden shrink-0 hidden sm:block">
                <div className="h-full rounded-full transition-all duration-300" style={{
                  width: `${clientStats.rate}%`,
                  backgroundColor: clientStats.rate >= 75 ? '#34d399' : clientStats.rate >= 40 ? '#fbbf24' : '#f87171'
                }} />
              </div>
            </div>
          </div>

          <div className="p-3 bg-zinc-950/75 border border-zinc-900/65 rounded-lg text-left space-y-1 select-none">
            <span className="text-[8px] font-black text-zinc-500 uppercase block tracking-wider">Tempo SLA Médio</span>
            <div className="flex items-baseline gap-1">
              <Clock className="w-3.5 h-3.5 text-zinc-450 shrink-0" />
              <span className="text-xs font-black text-zinc-200 uppercase font-mono">{clientStats.avgTime}</span>
            </div>
          </div>

          <div className="p-3 bg-zinc-950/75 border border-zinc-900/65 rounded-lg text-left space-y-1 col-span-2 sm:col-span-1 select-none">
            <span className="text-[8px] font-black text-zinc-500 uppercase block tracking-wider">Última Sincronização</span>
            <div className="flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-[#00e5ff] animate-spin" style={{ animationDuration: '4s' }} />
              <span className="text-[10px] font-black text-cyan-400 font-mono tracking-tight uppercase">{clientStats.lastSync}</span>
            </div>
          </div>
        </div>

        {/* 3. LISTA FILTRADA E PRIORIZADA AUTOMATICAMENTE (DIRETRIP DE FOTO 7.4 & 7.5) */}
        {displayedUnifiedTasks.length === 0 ? (
          <div className="py-12 border border-dashed border-zinc-900 rounded-lg text-center flex flex-col items-center justify-center font-mono">
            <Server className="w-8 h-8 text-zinc-650 mb-2" />
            <p className="text-xs text-zinc-500 uppercase font-extrabold mb-1">Sem Operações Ativas No Segmento</p>
            <p className="text-[9px] text-zinc-550 max-w-[340px] leading-relaxed">
              Nenhuma pendência unificada correspondente aos filtros [ {selectedSourceFilter} ] foi encontrada na partição Supabase deste terminal.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="unified_operations_list">
            {displayedUnifiedTasks.map((t) => {
              const isExternal = t.is_external || t.source_type === 'external';
              const isProjectIssue = t.source_type === 'project_issue';
              const isEditing = editingUnifiedTaskId === t.id;

              // Color determination
              const clientColor = t.company_color || '#c084fc';

              return (
                <div 
                  key={t.id}
                  className={`p-3.5 rounded-lg border transition-all duration-300 bg-[#070605]/80 flex flex-col justify-between gap-3 text-left ${
                    t.completed && !isEditing
                      ? 'border-zinc-900/60 opacity-45 bg-[#0a0807]/25' 
                      : isEditing 
                        ? 'border-cyan-500/60 bg-black/85 ring-1 ring-cyan-500/25'
                        : 'border-zinc-800/80 hover:border-zinc-700 bg-gradient-to-b from-zinc-950/95 to-[#0b0a09]/95 hover:shadow-cyan-950/5 hover:shadow-md'
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-3 p-0.5 text-left font-mono">
                      <div className="space-y-1">
                        <label className="text-[8.5px] uppercase text-zinc-500 font-extrabold tracking-wider block">[ EDITAR TÍTULO ]</label>
                        <input 
                          type="text"
                          required
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full bg-black text-xs p-2 border border-zinc-850 rounded text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8.5px] uppercase text-zinc-500 font-extrabold tracking-wider block">[ EDITAR DESCRIÇÃO ]</label>
                        <textarea 
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full bg-black text-xs p-2 border border-zinc-850 rounded text-white focus:outline-none focus:border-cyan-500 h-16 resize-none"
                          placeholder="Descrição opcional..."
                        />
                      </div>
                      <div className="flex justify-end gap-1.5 pt-1.5 border-t border-zinc-900">
                        <button 
                          type="button"
                          onClick={() => setEditingUnifiedTaskId(null)}
                          className="px-2.5 py-1 text-[9px] uppercase font-bold border border-zinc-800 text-zinc-400 hover:bg-zinc-900 rounded cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleSaveUnifiedTaskEdition(t.id, isExternal)}
                          className={`px-3 py-1 text-[9px] uppercase font-black text-black rounded cursor-pointer ${
                            settings.theme_mode === 'AMBER' ? 'bg-[#ffb347]' :
                            settings.theme_mode === 'GREEN' ? 'bg-[#33ff33]' :
                            'bg-[#00e5ff]'
                          }`}
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 text-left font-mono h-full flex flex-col justify-between">
                      <div className="space-y-2.5">
                        
                        {/* 1. TOPO: Identidade Visual e Prioridade (Stage 7.1) */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          {/* Client Identifier badge (Rule 1) */}
                          <span 
                            style={{
                              borderColor: `${clientColor}60`,
                              color: clientColor,
                              backgroundColor: `${clientColor}12`
                            }}
                            className="text-[8px] font-black tracking-widest px-2 py-0.5 rounded border uppercase"
                          >
                            {isProjectIssue ? 'LOCAL PROJETO' : (t.company_name || 'TVA CONTEXT')}
                          </span>

                          <div className="flex items-center gap-1">
                            {/* Operational Priority Badge (Stage 7.4) */}
                            <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                              t.priority === 1 ? 'border-rose-500/35 bg-rose-500/10 text-rose-400' :
                              t.priority === 2 ? 'border-amber-500/35 bg-amber-500/10 text-amber-500 font-extrabold' :
                              t.priority === 4 ? 'border-zinc-800 bg-zinc-900 text-zinc-450' :
                              'border-yellow-500/35 bg-yellow-500/5 text-yellow-400'
                            }`}>
                              {t.priority === 1 ? '▲ URGENTE' :
                               t.priority === 2 ? '◈ ALTA' :
                               t.priority === 4 ? '▼ BAIXA' :
                               '◆ MÉDIA'}
                            </span>
                          </div>
                        </div>

                        {/* 2. CENTRO: Clicador Status, Título, Descrição, Projetos Relacionados */}
                        <div className="flex items-start gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleToggleUnifiedOrTodo(t)}
                            className="mt-0.5 focus:outline-none shrink-0 cursor-pointer"
                            title={t.completed ? 'Reabrir pendência' : 'Concluir pendência'}
                          >
                            {t.completed ? (
                              <CheckSquare className="w-4.5 h-4.5 text-emerald-400" />
                            ) : (
                              <Square className="w-4.5 h-4.5 text-zinc-600 hover:text-cyan-400 transition" />
                            )}
                          </button>
                          
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <h4 className={`text-xs font-bold leading-snug break-words uppercase ${t.completed ? 'line-through text-zinc-500' : 'text-zinc-100'}`}>
                              {t.title}
                            </h4>
                            {t.description && (
                              <p className={`text-[9.5px] break-words leading-relaxed ${t.completed ? 'text-zinc-600/70' : 'text-zinc-400'}`}>
                                {t.description}
                              </p>
                            )}

                            {/* STAGE 8 PREPARATION: Visual Structure of Dual Coop Projects (Rule 7) */}
                            {(t.external_project_name || t.external_phase_name) && (
                              <div className="mt-2 text-[8px] font-sans font-medium text-purple-400/80 uppercase tracking-wider flex flex-wrap items-center gap-1 select-none">
                                <FolderGit2 className="w-2.5 h-2.5 text-purple-500" />
                                <span>Coop Projetos:</span>
                                {t.external_project_name && (
                                  <span className="px-1 bg-zinc-900 border border-zinc-850 text-zinc-400 rounded">{t.external_project_name}</span>
                                )}
                                {t.external_phase_name && (
                                  <span className="text-zinc-550">• {t.external_phase_name}</span>
                                )}
                                {t.external_kanban_column && (
                                  <span className="px-1 bg-purple-950/20 text-purple-400 rounded border border-purple-900/30">Col: {t.external_kanban_column}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 3. DATAS DE PRAZO (Stage 7.4 Deadline Alerts) */}
                        {t.due_date && (
                          <div className="flex items-center gap-1.5 text-[8px] font-mono text-zinc-500 pl-6 select-none bg-zinc-950/25 py-1 px-1.5 rounded w-fit border border-zinc-900/30">
                            <Calendar className="w-3 h-3 text-rose-500" />
                            <span className="uppercase text-zinc-400">Prazo Remoto:</span>
                            <span className="font-extrabold text-amber-500">
                              {new Date(t.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às {new Date(t.due_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}

                      </div>

                      {/* 4. RODAPÉ: Canais de Sincronismo e Operações Críticas */}
                      <div className="border-t border-zinc-900/80 pt-2.5 flex items-center justify-between text-[8px] text-zinc-500 font-mono mt-auto shrink-0 select-none">
                        
                        <div className="flex items-center gap-1">
                          {/* Sync Direction State Indicators (Rule 10/11) */}
                          {isExternal && (
                            <span className={`text-[7.5px] font-bold uppercase px-1 py-0.2 rounded border flex items-center gap-1 ${
                              t.sync_status === 'synchronized' ? 'border-emerald-500/25 bg-emerald-500/5 text-emerald-450' :
                              t.sync_status === 'failed' ? 'border-rose-500/25 bg-rose-500/5 text-rose-455 font-black' :
                              'border-amber-500/25 bg-amber-500/5 text-amber-500 animate-pulse'
                            }`}>
                              {t.sync_status === 'synchronized' ? '● SYNC' :
                               t.sync_status === 'failed' ? '● RETENTAR' :
                               '○ FILA CLOUD'}
                            </span>
                          )}
                          <span className="truncate max-w-[70px]">
                            ID: {t.id.substring(0, 5)}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {/* Force manual reciprocity loop directly in card */}
                          {isExternal && (
                            <button
                              type="button"
                              onClick={() => handleManualSyncNow(t)}
                              disabled={syncingTaskIds[t.id]}
                              className={`text-zinc-500 hover:text-[#00e5ff] cursor-pointer flex items-center gap-0.5 hover:underline transition ${
                                syncingTaskIds[t.id] ? 'animate-spin text-cyan-400' : ''
                              }`}
                              title="Forçar envio reverso imediato"
                            >
                              <RefreshCcw className="w-2.5 h-2.5 shrink-0" />
                              <span>Sincronizar</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setEditingUnifiedTaskId(t.id);
                              setEditTitle(t.title);
                              setEditDescription(t.description || '');
                            }}
                            className="text-zinc-450 hover:text-zinc-250 cursor-pointer hover:underline transition uppercase"
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setDeleteConfirmTaskId(t.id);
                              setDeleteRemoteOption(false);
                            }}
                            className="text-zinc-450 hover:text-rose-455 cursor-pointer hover:underline transition uppercase font-extrabold"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* BIDIRECTIONAL DELETION CUSTOM MODAL (Rule 5)             */}
      {/* ========================================================= */}
      {deleteConfirmTaskId && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-md border-2 p-6 rounded-xl bg-zinc-950 ${borderStyle} text-left space-y-6 shadow-2xl animate-fade-in`}>
            
            <div className="space-y-1.5 text-left">
              <span className="text-[9px] font-black tracking-widest text-[#ffb347] font-mono block uppercase">
                ⚠ CONFIRMAÇÃO DE DELEÇÃO DE OPERAÇÃO
              </span>
              <h3 className="text-lg font-black uppercase text-white font-sans tracking-tight">
                Como deseja proceder com esta exclusão?
              </h3>
            </div>

            {/* Task card preview */}
            <div className="bg-zinc-900/40 p-4 border border-zinc-850 rounded font-mono text-xs text-zinc-300">
              <span className="text-[8px] uppercase text-zinc-500 font-black block mb-1">[ TAREFA SELECIONADA ]</span>
              <p className="font-extrabold text-white uppercase break-all">
                {displayedUnifiedTasks.find(u => u.id === deleteConfirmTaskId)?.title}
              </p>
              {displayedUnifiedTasks.find(u => u.id === deleteConfirmTaskId)?.description && (
                <p className="text-[10px] text-zinc-500 italic mt-1 bg-black/25 p-1 rounded border border-zinc-900 text-left leading-normal">
                  {displayedUnifiedTasks.find(u => u.id === deleteConfirmTaskId)?.description}
                </p>
              )}
            </div>

            {/* Toggle selection layout */}
            {(displayedUnifiedTasks.find(u => u.id === deleteConfirmTaskId)?.is_external || 
              displayedUnifiedTasks.find(u => u.id === deleteConfirmTaskId)?.source_type === 'external') ? (
              <div className="space-y-3 font-mono">
                <span className="text-[8.5px] uppercase text-zinc-500 font-extrabold block text-left">[ CANAIS DE PROPAGAÇÃO ]</span>
                
                <button 
                  type="button"
                  onClick={() => setDeleteRemoteOption(false)}
                  className={`w-full flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition text-left ${
                    !deleteRemoteOption 
                      ? 'border-[#ffb347] bg-[#ffb347]/5 text-white' 
                      : 'border-zinc-850 hover:bg-zinc-900 text-zinc-400'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                    !deleteRemoteOption ? 'border-[#ffb347]' : 'border-zinc-650'
                  }`}>
                    {!deleteRemoteOption && <div className="w-2 h-2 rounded-full bg-[#ffb347]" />}
                  </div>
                  <div className="text-xs space-y-0.5 text-left">
                    <p className="font-bold uppercase leading-none">Excluir apenas do TVA</p>
                    <p className="text-[10px] text-zinc-500 font-medium leading-normal">Remove localmente do seu painel operacional, mas mantém a tarefa intocada na origem remota do cliente.</p>
                  </div>
                </button>

                <button 
                  type="button"
                  onClick={() => setDeleteRemoteOption(true)}
                  className={`w-full flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition text-left ${
                    deleteRemoteOption 
                      ? 'border-rose-500 bg-rose-500/5 text-white' 
                      : 'border-zinc-850 hover:bg-zinc-900 text-zinc-400'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                    deleteRemoteOption ? 'border-rose-500' : 'border-zinc-650'
                  }`}>
                    {deleteRemoteOption && <div className="w-2 h-2 rounded-full bg-rose-500" />}
                  </div>
                  <div className="text-xs space-y-0.5 text-left text-rose-400">
                    <p className="font-bold uppercase leading-none text-rose-400">Excluir também na origem (Bidirecional)</p>
                    <p className="text-[10px] text-zinc-500 font-medium leading-normal">Apaga no painel do TVA e propaga a solicitação ao banco do cliente para executar a deleção física na origem.</p>
                  </div>
                </button>
              </div>
            ) : (
              <div className="p-3 border border-zinc-900 rounded bg-black/20 text-zinc-500 font-mono text-center text-[10px] uppercase">
                Esta é uma pendência local do TVA. A exclusão afetará somente este painel operacional.
              </div>
            )}

            {/* Interaction buttons */}
            <div className="flex gap-2 justify-end pt-4 border-t border-zinc-900 font-mono">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  sounds.playButtonSwitch();
                  setDeleteConfirmTaskId(null);
                  setDeleteRemoteOption(false);
                }}
                className="px-4 py-2 border border-zinc-800 hover:bg-zinc-900 font-bold uppercase rounded text-[10px] text-zinc-450 cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDeletion}
                className={`px-4 py-2 hover:scale-[1.01] active:scale-[0.99] transition font-black uppercase rounded text-[10px] text-black cursor-pointer ${
                  deleteRemoteOption 
                    ? 'bg-rose-500 hover:bg-rose-600 border border-rose-500 text-white' 
                    : settings.theme_mode === 'AMBER' ? 'bg-[#ffb347] border-[#ffb347]' :
                      settings.theme_mode === 'GREEN' ? 'bg-[#33ff33] border-[#33ff33]' :
                      'bg-[#00e5ff] border-[#00e5ff]'
                }`}
              >
                {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
