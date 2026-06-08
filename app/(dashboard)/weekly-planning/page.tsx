'use client';

import React, { useState, useEffect } from 'react';
import { useProductivityStore } from '@/stores/productivityStore';
import { db, TaskCategory } from '@/lib/db';
import { sounds } from '@/lib/sounds';
import { 
  Plus, 
  Trash2, 
  X, 
  Calendar, 
  ArrowLeft, 
  ArrowRight, 
  Edit3, 
  FolderMinus, 
  BookOpen, 
  Info,
  HelpCircle,
  Hash,
  Sparkles,
  Layers,
  FileText
} from 'lucide-react';

interface TopicFormState {
  id?: string;
  name: string;
  description: string;
  color_id: string; // Color name or ID
}

const PRESET_CRT_COLORS = [
  { id: 'blue', label: 'Azul', hex: '#60a5fa', border: 'border-blue-500/30', bg: 'bg-blue-500/10', text: 'text-blue-400' },
  { id: 'purple', label: 'Roxo', hex: '#c084fc', border: 'border-purple-500/30', bg: 'bg-purple-500/10', text: 'text-purple-400' },
  { id: 'green', label: 'Verde/Sinc', hex: '#33ff33', border: 'border-green-500/30', bg: 'bg-green-500/10', text: 'text-emerald-400' },
  { id: 'red', label: 'Vermelho/Falha', hex: '#ef4444', border: 'border-red-500/30', bg: 'bg-red-500/10', text: 'text-red-400' },
  { id: 'yellow', label: 'Ambar/Foco', hex: '#ffb347', border: 'border-amber-500/30', bg: 'bg-amber-500/10', text: 'text-amber-400' },
  { id: 'cyan', label: 'Ciano', hex: '#00e5ff', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10', text: 'text-cyan-400' },
  { id: 'orange', label: 'Laranja', hex: '#fb923c', border: 'border-orange-500/30', bg: 'bg-orange-500/10', text: 'text-orange-400' }
];

const WEEK_DAYS = [
  { label: 'Segunda-feira', value: 1, short: 'SEG' },
  { label: 'Terça-feira', value: 2, short: 'TER' },
  { label: 'Quarta-feira', value: 3, short: 'QUA' },
  { label: 'Quinta-feira', value: 4, short: 'QUI' },
  { label: 'Sexta-feira', value: 5, short: 'SEX' },
  { label: 'Sábado', value: 6, short: 'SAB' },
  { label: 'Domingo', value: 0, short: 'DOM' },
];

export default function WeeklyPlanningPage() {
  const { 
    settings, 
    categories, 
    weeklyPlans, 
    weeklyPlanTopics, 
    tasks,
    refreshData 
  } = useProductivityStore();

  // Create seamless semantic bridge from categories to existing UI expectations
  const topics = categories.map(cat => ({
    ...cat,
    color_id: cat.color || 'yellow',
    description: cat.description || ''
  }));

  // Weekly Date State
  const [currentMonday, setCurrentMonday] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const m = new Date(today.setDate(diff));
    m.setHours(0, 0, 0, 0);
    return m;
  });

  // UI state
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);
  const [topicForm, setTopicForm] = useState<TopicFormState>({
    name: '',
    description: '',
    color_id: 'yellow'
  });
  const [editingTopic, setEditingTopic] = useState<TaskCategory | null>(null);
  const [schedulingDay, setSchedulingDay] = useState<number | null>(null); // Weekday index for scheduled
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync / load active weekly plan
  useEffect(() => {
    let active = true;
    async function loadPlan() {
      const dateStr = currentMonday.toISOString().split('T')[0];
      try {
        const plan = await db.getOrCreateWeeklyPlan(dateStr);
        if (active) {
          setActivePlanId(plan.id);
          refreshData();
        }
      } catch (err: any) {
        console.error("Error setting weekly plan:", err?.message || err, err);
      }
    }
    loadPlan();
    return () => { active = false; };
  }, [currentMonday, refreshData]);

  // Navigate Weeks
  const handlePrevWeek = () => {
    sounds.playButtonSwitch();
    const prev = new Date(currentMonday);
    prev.setDate(prev.getDate() - 7);
    setCurrentMonday(prev);
  };

  const handleNextWeek = () => {
    sounds.playButtonSwitch();
    const next = new Date(currentMonday);
    next.setDate(next.getDate() + 7);
    setCurrentMonday(next);
  };

  const handleResetToCurrentWeek = () => {
    sounds.playButtonSwitch();
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const m = new Date(today.setDate(diff));
    m.setHours(0, 0, 0, 0);
    setCurrentMonday(m);
  };

  // Formatted date string
  const formatWeekRange = () => {
    const format = (d: Date) => {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };
    const sunday = new Date(currentMonday);
    sunday.setDate(sunday.getDate() + 6);
    return `${format(currentMonday)} - ${format(sunday)}`;
  };

  const getFirstGroup = () => {
    const groups = db.getGroups();
    return groups[0]?.id || 'group-default';
  };

  // CRUD Category Functions mapped to topics form
  const handleAddOrEditTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicForm.name.trim()) return;
    setIsSubmitting(true);
    try {
      sounds.playSuccessIndicator();
      if (editingTopic) {
        await db.updateCategory(editingTopic.id, {
          name: topicForm.name.trim(),
          color: topicForm.color_id,
          description: topicForm.description.trim() || null
        } as any);
      } else {
        const defaultGroupId = getFirstGroup();
        await db.saveCategory(
          defaultGroupId,
          topicForm.name.trim(),
          topicForm.color_id,
          topicForm.description.trim() || null
        );
      }
      
      // Cleanup
      setTopicForm({ name: '', description: '', color_id: 'yellow' });
      setIsCreatingTopic(false);
      setEditingTopic(null);
      refreshData();
    } catch (err) {
      console.error("Failed saving topic/category:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEditTopic = (category: any) => {
    sounds.playButtonSwitch();
    setEditingTopic(category);
    setTopicForm({
      name: category.name,
      description: category.description || '',
      color_id: category.color_id || 'yellow'
    });
    setIsCreatingTopic(true);
  };

  const handleDeleteTopic = async (id: string) => {
    if (!confirm('Deseja realmente remover este assunto/categoria? Todas as tarefas e agendas vinculadas a ele serão liberadas.')) {
      return;
    }
    sounds.playAlarmBreak();
    try {
      await db.deleteCategory(id);
      refreshData();
    } catch (err) {
      console.error("Failed deleting category:", err);
    }
  };

  // Agenda Assignment Functions
  const handleAssignTopicToDay = async (topicId: string, weekday: number) => {
    if (!activePlanId) return;
    sounds.playButtonSwitch();
    try {
      await db.saveWeeklyPlanTopic(activePlanId, topicId, weekday);
      setSchedulingDay(null);
      refreshData();
    } catch (err) {
      console.error("Error scheduling category:", err);
    }
  };

  const handleUnscheduleTopic = async (topicId: string, weekday: number) => {
    if (!activePlanId) return;
    sounds.playAlarmBreak();
    try {
      await db.deleteWeeklyPlanTopic(activePlanId, topicId, weekday);
      refreshData();
    } catch (err) {
      console.error("Error unscheduling category:", err);
    }
  };

  // Styling setups matching theme
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

  const bgHeader = settings.theme_mode === 'AMBER'
    ? 'bg-[#ffe7cc]/5'
    : settings.theme_mode === 'GREEN'
      ? 'bg-[#ccffcc]/5'
      : 'bg-[#ccf7ff]/5';

  const buttonStyle = `border px-4 py-2 text-xs rounded tracking-wider uppercase font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 
    ${settings.theme_mode === 'AMBER' 
      ? 'text-[#ffb347] border-[#ffb347]/40 hover:bg-[#ffb347]/10' 
      : settings.theme_mode === 'GREEN' 
        ? 'text-[#33ff33] border-[#33ff33]/40 hover:bg-[#33ff33]/10' 
        : 'text-[#00e5ff] border-[#00e5ff]/40 hover:bg-[#00e5ff]/10'}`;

  const primaryButtonStyle = `px-4 py-2 text-xs rounded tracking-wider uppercase font-black transition-all duration-200 cursor-pointer flex items-center gap-1.5 text-black
    ${settings.theme_mode === 'AMBER' 
      ? 'bg-[#ffb347] hover:bg-[#ffb347]/90' 
      : settings.theme_mode === 'GREEN' 
        ? 'bg-[#33ff33] hover:bg-[#33ff33]/90' 
        : 'bg-[#00e5ff] hover:bg-[#00e5ff]/90'}`;

  // Count active tasks for category
  const getTasksForTopic = (categoryId: string) => {
    return tasks.filter(t => t.category_id === categoryId);
  };

  const getDayTopicsForPlan = (weekday: number) => {
    if (!activePlanId) return [];
    return weeklyPlanTopics
      .filter(wpt => wpt.weekly_plan_id === activePlanId && wpt.weekday === weekday)
      .map(wpt => {
        const matchingCategory = categories.find(c => c.id === wpt.category_id);
        const mappedCategory = matchingCategory ? {
          ...matchingCategory,
          color_id: matchingCategory.color || 'yellow'
        } : undefined;
        return {
          wptId: wpt.id,
          topicId: wpt.category_id,
          topic: mappedCategory
        };
      })
      .filter(item => item.topic !== undefined);
  };

  return (
    <div className={`space-y-6 flex flex-col h-full animate-fade-in`}>
      {/* HEADER BAR FOR SYSTEM NOTATION */}
      <div className={`border-2 p-5 rounded-xl ${borderStyle} ${bgHeader} flex flex-col md:flex-row justify-between items-center gap-4 relative overflow-hidden`}>
        <div className="flex items-center gap-3 relative z-10">
          <div className={`p-2.5 border rounded-lg ${
            settings.theme_mode === 'AMBER' ? 'border-[#ffb347]/40 text-[#ffb347] bg-[#ffb347]/10' :
            settings.theme_mode === 'GREEN' ? 'border-[#33ff33]/40 text-[#33ff33] bg-[#33ff33]/10' :
            'border-[#00e5ff]/40 text-[#00e5ff] bg-[#00e5ff]/10'
          }`}>
            <Calendar className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-md md:text-lg font-black tracking-widest uppercase flex items-center gap-2">
              [SISTEMA DE PLANO SEMANAL]
            </h2>
            <p className="text-[11px] opacity-75 max-w-xl font-mono">
              Foque no que realmente importa hoje. Agrupe sua semana em Assuntos/Áreas de foco
              e reduza a troca excessiva de contexto diário.
            </p>
          </div>
        </div>

        {/* CONTROLS AREA DATE CHANGER */}
        <div className="flex flex-wrap items-center gap-2 relative z-10">
          <button onClick={handlePrevWeek} className={buttonStyle} title="Semana Anterior">
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <div className={`border px-4 py-2 rounded text-xs text-center font-bold font-mono min-w-[200px] bg-black/40 ${
            settings.theme_mode === 'AMBER' ? 'border-[#ffb347]/30 text-[#ffb347]' :
            settings.theme_mode === 'GREEN' ? 'border-[#33ff33]/30 text-[#33ff33]' :
            'border-[#00e5ff]/30 text-[#00e5ff]'
          }`}>
            {formatWeekRange()}
          </div>

          <button onClick={handleNextWeek} className={buttonStyle} title="Próxima Semana">
            <ArrowRight className="w-4 h-4" />
          </button>

          <button onClick={handleResetToCurrentWeek} className={buttonStyle} title="Resetar para Hoje">
            Hoje
          </button>
        </div>
      </div>

      {/* TWO COLUMNS WORKSPACE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: TOPIC/FOCUS DICTIONARY (col-span-4) */}
        <div className={`lg:col-span-4 border-2 p-4 rounded-xl ${borderStyle} bg-black/40 min-h-[500px] space-y-4`}>
          <div className="flex justify-between items-center border-b border-[var(--color-amber)]/20 pb-2">
            <h3 className="text-xs font-black tracking-wider uppercase flex items-center gap-1.5 opacity-90">
              <BookOpen className="w-4 h-4" /> Assuntos & Áreas
            </h3>
            {!isCreatingTopic && (
              <button 
                onClick={() => {
                  sounds.playButtonSwitch();
                  setIsCreatingTopic(true);
                  setEditingTopic(null);
                  setTopicForm({ name: '', description: '', color_id: 'yellow' });
                }} 
                className="px-2 py-1 text-2xs border border-[var(--color-amber)]/30 rounded text-[var(--color-amber)] hover:bg-[var(--color-amber)]/10 transition flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> NOVO
              </button>
            )}
          </div>

          {/* TOPIC CREATOR FORM OR TOPIC LISTING */}
          {isCreatingTopic ? (
            <form onSubmit={handleAddOrEditTopic} className="border border-[var(--color-amber)]/30 p-3.5 rounded bg-black/45 space-y-3 animate-fade-in">
              <div className="flex justify-between items-center border-b border-[var(--color-amber)]/10 pb-1.5 mb-1">
                <span className={`text-4xs font-bold font-mono tracking-widest ${textStyle}`}>
                  {editingTopic ? 'EDITING_SUBJECT' : 'INITIALIZE_SUBJECT'}
                </span>
                <button 
                  type="button" 
                  onClick={() => {
                    sounds.playButtonSwitch();
                    setIsCreatingTopic(false);
                    setEditingTopic(null);
                  }}
                  className="text-gray-400 hover:text-white transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Title input */}
              <div className="space-y-1">
                <label className="text-4xs block uppercase opacity-70">Título / Nome do Foco</label>
                <input 
                  type="text" 
                  maxLength={50}
                  className="w-full text-xs p-2 bg-black border border-[var(--color-amber)]/30 rounded focus:border-[var(--color-amber)] text-white focus:outline-none"
                  placeholder="Ex: Mandarim, TVA, EFATAH..."
                  value={topicForm.name}
                  onChange={e => setTopicForm({ ...topicForm, name: e.target.value })}
                  required
                />
              </div>

              {/* Description input */}
              <div className="space-y-1">
                <label className="text-4xs block uppercase opacity-70">Descrição / Notas do Assunto</label>
                <textarea 
                  rows={2}
                  maxLength={200}
                  className="w-full text-xs p-2 bg-black border border-[var(--color-amber)]/30 rounded focus:border-[var(--color-amber)] text-white focus:outline-none resize-none"
                  placeholder="O que este foco acarreta?"
                  value={topicForm.description}
                  onChange={e => setTopicForm({ ...topicForm, description: e.target.value })}
                />
              </div>

              {/* Color selectors */}
              <div className="space-y-1">
                <label className="text-4xs block uppercase opacity-70">Sinalização de Cor CRT</label>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {PRESET_CRT_COLORS.map(color => (
                    <button 
                      type="button"
                      key={color.id}
                      onClick={() => {
                        sounds.playButtonSwitch();
                        setTopicForm({ ...topicForm, color_id: color.id });
                      }}
                      className={`w-6 h-6 rounded border transition-all flex items-center justify-center`}
                      style={{ backgroundColor: color.hex + '15', borderColor: topicForm.color_id === color.id ? color.hex : color.hex + '30' }}
                      title={color.label}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color.hex }} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={isSubmitting} className={primaryButtonStyle}>
                  {isSubmitting ? 'Salvando...' : 'Salvar'}
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    sounds.playButtonSwitch();
                    setIsCreatingTopic(false);
                    setEditingTopic(null);
                  }} 
                  className={buttonStyle}
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-2.5 overflow-y-auto max-h-[600px] pr-1">
              {topics.length === 0 ? (
                <div className="border border-dashed border-gray-800 text-center py-10 rounded text-xs text-gray-500 space-y-3">
                  <p>Nenhum assunto encontrado</p>
                  <button
                    onClick={() => {
                      sounds.playButtonSwitch();
                      setIsCreatingTopic(true);
                      setEditingTopic(null);
                      setTopicForm({ name: '', description: '', color_id: 'yellow' });
                    }}
                    className="px-4 py-1.5 border border-[var(--color-amber)] text-[var(--color-amber)] hover:bg-[var(--color-amber)]/10 text-3xs font-black uppercase rounded cursor-pointer"
                  >
                    [ Criar ]
                  </button>
                </div>
              ) : (
                topics.map(topic => {
                  const topicColor_ = PRESET_CRT_COLORS.find(c => c.id === topic.color_id) || PRESET_CRT_COLORS[4];
                  const associatedTasks = getTasksForTopic(topic.id);
                  const openTasks = associatedTasks.filter(t => !t.is_completed);

                  return (
                    <div 
                      key={topic.id} 
                      className={`border p-3 rounded-lg bg-[#0e0c0a]/60 hover:bg-[#1a1510]/55 transition relative overflow-hidden flex flex-col gap-1.5`}
                      style={{ borderColor: topicColor_.hex + '25' }}
                    >
                      {/* Left color bar */}
                      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: topicColor_.hex }} />
                      
                      <div className="flex justify-between items-start pl-1">
                        <div>
                          <h4 className="text-xs font-black tracking-wide text-white uppercase flex items-center gap-1.5">
                            {topic.name}
                            {associatedTasks.length > 0 && (
                              <span className="text-[9px] px-1 py-0.5 border rounded text-gray-400 bg-gray-900 border-gray-800" title="Tarefas associadas">
                                {openTasks.length}/{associatedTasks.length} T
                              </span>
                            )}
                          </h4>
                          {topic.description && (
                            <p className="text-[10px] text-gray-400 font-mono line-clamp-2 mt-0.5" title={topic.description}>
                              {topic.description}
                            </p>
                          )}
                        </div>

                        {/* Actions buttons */}
                        <div className="flex gap-1">
                          <button 
                            onClick={() => handleStartEditTopic(topic)}
                            className="p-1 border border-transparent hover:border-gray-800 hover:bg-gray-950 rounded text-gray-400 hover:text-white transition"
                            title="Editar"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={() => handleDeleteTopic(topic.id)}
                            className="p-1 border border-transparent hover:border-red-950 hover:bg-red-950/20 rounded text-gray-400 hover:text-red-400 transition"
                            title="Excluir"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: 7-DAY AGENDA GRID (col-span-8) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex justify-between items-center border-b border-[var(--color-amber)]/20 pb-2">
            <h3 className="text-xs font-black tracking-wider uppercase flex items-center gap-1.5 opacity-90">
              <Calendar className="w-4 h-4" /> Distribuição da Semana
            </h3>
            <span className="text-4xs uppercase text-gray-500 font-mono">
              [ {WEEK_DAYS.length} DATAPOINTS PROGRAMMED ]
            </span>
          </div>

          {/* Agenda Grid layout - we can layout in standard row format or a clean list columns layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {WEEK_DAYS.map(day => {
              const daySubjects = getDayTopicsForPlan(day.value);
              const isToday = new Date().getDay() === day.value;

              return (
                <div 
                  key={day.value}
                  className={`border-2 rounded-xl p-3.5 bg-black/45 relative flex flex-col gap-3 min-h-[160px] select-none transition-all ${
                    isToday ? `${borderStyle} shadow-[0_0_12px_rgba(255,179,71,0.15)]` : 'border-[var(--color-amber)]/15 hover:border-[var(--color-amber)]/40'
                  }`}
                >
                  {/* Header info */}
                  <div className="flex justify-between items-center border-b border-[var(--color-amber)]/10 pb-1.5">
                    <span className="text-2xs font-extrabold tracking-widest text-white uppercase flex items-center gap-1">
                      {isToday && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping inline-block" />}
                      {day.label}
                    </span>
                    <span className="text-[10px] text-gray-500 font-bold tracking-wider">{day.short}</span>
                  </div>

                  {/* Programmed subjects in day content */}
                  <div className="flex-1 space-y-1.5">
                    {daySubjects.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-4 border border-dashed border-gray-900 rounded-lg text-center h-[70px]">
                        <span className="text-[10px] text-gray-500 italic">Livre de Foco</span>
                      </div>
                    ) : (
                      daySubjects.map(item => {
                        const topicColor = PRESET_CRT_COLORS.find(c => c.id === item.topic!.color_id) || PRESET_CRT_COLORS[4];
                        const openAssociated = getTasksForTopic(item.topicId).filter(t => !t.is_completed).length;

                        return (
                          <div 
                            key={item.wptId}
                            className="border p-2 rounded flex justify-between items-center bg-[#0d0b09]/80 text-xxs transition overflow-hidden relative group"
                            style={{ borderColor: topicColor.hex + '25' }}
                          >
                            <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ backgroundColor: topicColor.hex }} />
                            <div className="flex items-center gap-2 pl-1 max-w-[80%]">
                              <span className="font-extrabold text-white uppercase truncate" title={item.topic!.name}>
                                {item.topic!.name}
                              </span>
                              {openAssociated > 0 && (
                                <span className="text-3xs text-rose-400 px-1 border border-rose-950/40 rounded bg-rose-950/20 font-bold shrink-0">
                                  {openAssociated} T
                                </span>
                              )}
                            </div>
                            <button 
                              onClick={() => handleUnscheduleTopic(item.topicId, day.value)}
                              className="text-gray-500 hover:text-red-400 transition p-0.5 group-hover:opacity-100 opacity-60"
                              title="Remover foco do dia"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Add action */}
                  <div className="pt-1.5 border-t border-[var(--color-amber)]/5 flex justify-end">
                    {schedulingDay === day.value ? (
                      <div className="w-full space-y-1.5 animate-fade-in">
                        <div className="flex justify-between items-center text-3xs text-gray-400 border-b border-gray-900 pb-1">
                          <span>SELECIONE O FOCO:</span>
                          <button onClick={() => setSchedulingDay(null)} className="text-gray-400 hover:text-white">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                        {topics.filter(tp => !daySubjects.some(ds => ds.topicId === tp.id)).length === 0 ? (
                          <div className="text-[10px] text-gray-500 italic py-1 text-center">
                            Nenhum assunto sobressalente
                          </div>
                        ) : (
                          <div className="max-h-[110px] overflow-y-auto space-y-1 pr-1 border border-gray-900 p-1 rounded bg-black/60">
                            {topics
                              .filter(tp => !daySubjects.some(ds => ds.topicId === tp.id))
                              .map(tp => (
                                <button
                                  key={tp.id}
                                  onClick={() => handleAssignTopicToDay(tp.id, day.value)}
                                  className="w-full text-left p-1 rounded hover:bg-[var(--color-amber)]/10 text-3xs uppercase font-extrabold text-[var(--color-amber)] transition truncate"
                                >
                                  + {tp.name}
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <button 
                        onClick={() => {
                          sounds.playButtonSwitch();
                          setSchedulingDay(day.value);
                        }}
                        className="py-1 px-2 text-3xs border border-[var(--color-amber)]/20 rounded hover:border-[var(--color-amber)]/60 text-[var(--color-amber)]/80 hover:text-[var(--color-amber)] transition font-bold flex items-center gap-1"
                      >
                        <Plus className="w-2.5 h-2.5" /> FOCO
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
