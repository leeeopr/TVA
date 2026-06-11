'use client';

import React, { useState, useEffect } from 'react';
import { useProductivityStore } from '@/stores/productivityStore';
import { db, AgendaBlock, AgendaTodo } from '@/lib/db';
import { sounds } from '@/lib/sounds';
import { 
  Plus, 
  Trash2, 
  X, 
  Calendar, 
  Edit3, 
  Copy, 
  CheckSquare, 
  Square,
  Sparkles,
  Layers,
  Folder,
  Tag,
  Clock,
  ArrowRightLeft,
  Settings as SettingsIcon
} from 'lucide-react';

const CRT_COLOR_PRESETS = [
  { id: 'blue', label: 'Azul', hex: '#60a5fa', border: 'border-blue-500/35', bg: 'bg-blue-500/10', text: 'text-blue-400' },
  { id: 'purple', label: 'Roxo', hex: '#c084fc', border: 'border-purple-500/35', bg: 'bg-purple-500/10', text: 'text-purple-400' },
  { id: 'green', label: 'Verde', hex: '#33ff33', border: 'border-green-500/35', bg: 'bg-green-500/10', text: 'text-emerald-400' },
  { id: 'red', label: 'Vermelho', hex: '#ef4444', border: 'border-red-500/35', bg: 'bg-red-500/10', text: 'text-red-400' },
  { id: 'amber', label: 'Ambar', hex: '#ffb347', border: 'border-amber-500/35', bg: 'bg-amber-500/10', text: 'text-amber-400' },
  { id: 'cyan', label: 'Ciano', hex: '#00e5ff', border: 'border-cyan-500/35', bg: 'bg-cyan-500/10', text: 'text-cyan-400' },
  { id: 'orange', label: 'Laranja', hex: '#fb923c', border: 'border-orange-500/35', bg: 'bg-orange-500/10', text: 'text-orange-400' }
];

const WEEK_DAYS = [
  { label: 'Segunda', value: 0, short: 'SEG' },
  { label: 'Terça', value: 1, short: 'TER' },
  { label: 'Quarta', value: 2, short: 'QUA' },
  { label: 'Quinta', value: 3, short: 'QUI' },
  { label: 'Sexta', value: 4, short: 'SEX' },
  { label: 'Sábado', value: 5, short: 'SAB' },
  { label: 'Domingo', value: 6, short: 'DOM' },
];

export default function WeeklyPlanningPage() {
  const { 
    settings, 
    agendaBlocks, 
    agendaTodos, 
    categories, 
    refreshData 
  } = useProductivityStore();

  const [isClient, setIsClient] = useState(false);

  // Modal / Form state for Block CRUD
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<AgendaBlock | null>(null);
  
  const [blockName, setBlockName] = useState('');
  const [blockDay, setBlockDay] = useState(0);
  const [blockStart, setBlockStart] = useState('08:00');
  const [blockEnd, setBlockEnd] = useState('10:00');
  const [blockColor, setBlockColor] = useState('blue');

  // Visão Micro State: Bloco ativo para detalhamento das pendências
  const [activeMicroBlock, setActiveMicroBlock] = useState<AgendaBlock | null>(null);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [selectedTodoGroupId, setSelectedTodoGroupId] = useState('');
  const [selectedTodoCategoryId, setSelectedTodoCategoryId] = useState('');
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingTodoTitle, setEditingTodoTitle] = useState('');

  // Duplicate states
  const [duplicatingBlockId, setDuplicatingBlockId] = useState<string | null>(null);
  const [duplicateTargetDay, setDuplicateTargetDay] = useState<number>(0);

  useEffect(() => {
    setTimeout(() => {
      setIsClient(true);
    }, 0);
    db.initAuth();
  }, []);

  // Sync refresh of micro views when data updates
  useEffect(() => {
    if (activeMicroBlock) {
      const updated = agendaBlocks.find(b => b.id === activeMicroBlock.id);
      setTimeout(() => {
        if (updated) {
          setActiveMicroBlock(updated);
        } else {
          setActiveMicroBlock(null);
        }
      }, 0);
    }
  }, [agendaBlocks, activeMicroBlock]);

  // Styling Setups (matching terminal theme settings)
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

  const headingStyle = settings.theme_mode === 'AMBER'
    ? 'text-[#ffb347] font-black'
    : settings.theme_mode === 'GREEN'
      ? 'text-[#33ff33] font-black'
      : 'text-[#00e5ff] font-black';

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

  // ==========================================
  // BLOCKS CRUD HANDLERS
  // ==========================================
  const handleOpenAddBlock = (dayIndex: number) => {
    sounds.playButtonSwitch();
    setEditingBlock(null);
    setBlockName('');
    setBlockDay(dayIndex);
    setBlockStart('08:00');
    setBlockEnd('10:00');
    setBlockColor('blue');
    setIsBlockModalOpen(true);
  };

  const handleOpenEditBlock = (block: AgendaBlock, e: React.MouseEvent) => {
    e.stopPropagation();
    sounds.playButtonSwitch();
    setEditingBlock(block);
    setBlockName(block.name);
    setBlockDay(block.day_of_week);
    setBlockStart(block.start_time);
    setBlockEnd(block.end_time);
    setBlockColor(block.color || 'blue');
    setIsBlockModalOpen(true);
  };

  const handleSaveBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockName.trim()) return;

    try {
      sounds.playSuccessIndicator();
      if (editingBlock) {
        await db.updateAgendaBlock(editingBlock.id, {
          name: blockName.trim(),
          day_of_week: blockDay,
          start_time: blockStart,
          end_time: blockEnd,
          color: blockColor
        });
      } else {
        await db.saveAgendaBlock(blockDay, blockStart, blockEnd, blockName.trim(), blockColor);
      }
      setIsBlockModalOpen(false);
      refreshData();
    } catch (err) {
      console.error("Save block error:", err);
    }
  };

  const handleDeleteBlock = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Excluir este bloco removerá todas as pendências vinculadas a ele. Confirmar?")) {
      return;
    }
    sounds.playAlarmBreak();
    try {
      await db.deleteAgendaBlock(id);
      if (activeMicroBlock?.id === id) {
        setActiveMicroBlock(null);
      }
      refreshData();
    } catch (err) {
      console.error("Delete block error:", err);
    }
  };

  const handleOpenDuplicate = (blockId: string, day: number, e: React.MouseEvent) => {
    e.stopPropagation();
    sounds.playButtonSwitch();
    setDuplicatingBlockId(blockId);
    setDuplicateTargetDay(day);
  };

  const handleConfirmDuplicate = async () => {
    if (!duplicatingBlockId) return;
    try {
      sounds.playSuccessIndicator();
      await db.duplicateAgendaBlock(duplicatingBlockId, duplicateTargetDay);
      setDuplicatingBlockId(null);
      refreshData();
    } catch (err) {
      console.error("Duplicate block error:", err);
    }
  };

  // ==========================================
  // TODOS (PENDÊNCIAS) CRUD HANDLERS
  // ==========================================
  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMicroBlock || !newTodoTitle.trim()) return;

    try {
      sounds.playButtonSwitch();
      await db.saveAgendaTodo(
        activeMicroBlock.id,
        newTodoTitle.trim(),
        selectedTodoGroupId || null,
        selectedTodoCategoryId || null
      );
      setNewTodoTitle('');
      setSelectedTodoGroupId('');
      setSelectedTodoCategoryId('');
      refreshData();
    } catch (err) {
      console.error("Add todo error:", err);
    }
  };

  const handleToggleTodo = async (todo: AgendaTodo) => {
    try {
      sounds.playSuccessIndicator();
      await db.updateAgendaTodo(todo.id, { completed: !todo.completed });
      refreshData();
    } catch (err) {
      console.error("Toggle todo error:", err);
    }
  };

  const handleStartEditTodo = (todo: AgendaTodo) => {
    sounds.playButtonSwitch();
    setEditingTodoId(todo.id);
    setEditingTodoTitle(todo.title);
  };

  const handleSaveEditTodo = async (id: string) => {
    if (!editingTodoTitle.trim()) return;
    try {
      sounds.playSuccessIndicator();
      await db.updateAgendaTodo(id, { title: editingTodoTitle.trim() });
      setEditingTodoId(null);
      refreshData();
    } catch (err) {
      console.error("Save edit todo error:", err);
    }
  };

  const handleDeleteTodo = async (id: string) => {
    try {
      sounds.playAlarmBreak();
      await db.deleteAgendaTodo(id);
      refreshData();
    } catch (err) {
      console.error("Delete todo error:", err);
    }
  };

  // Helpers to resolve categories & groups
  const groups = db.getGroups();
  const availableCategories = categories;

  if (!isClient) return null;

  return (
    <div className="space-y-6 flex flex-col h-full animate-fade-in pb-12 select-none">
      
      {/* 1. HUD TOP BAR (Aesthetic & Contextual) */}
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
            <h2 className={`text-md md:text-lg font-black tracking-widest uppercase flex items-center gap-2 ${headingStyle}`}>
              [NÚCLEO CENTRAL: AGENDA DE EXECUÇÃO]
            </h2>
            <p className="text-[11px] opacity-75 max-w-2xl font-mono">
              A agenda fixa e recorrente estipula <strong className={textStyle}>QUANDO</strong> os blocos ocorrem. As pendências internas determinam de forma mutável <strong className={textStyle}>O QUE</strong> será executado.
            </p>
          </div>
        </div>
        <button
          onClick={() => handleOpenAddBlock(0)}
          className={primaryButtonStyle}
        >
          <Plus className="w-4 h-4" /> NOVO BLOCO
        </button>
      </div>

      {/* 2. GOOGLE CALENDAR-STYLE WEEK MATRIX (VISÃO MACRO) */}
      <div className={`border-2 p-4 rounded-xl ${borderStyle} bg-black/40 relative`}>
        <div className="flex justify-between items-center border-b border-[var(--color-amber)]/20 pb-2 mb-4">
          <h3 className="text-xs font-black tracking-wider uppercase flex items-center gap-1.5 opacity-90">
            <Layers className="w-4 h-4" /> CRONOGRAMA MACRO SEMANAL
          </h3>
          <span className="text-[9px] text-gray-500 font-mono">[ BLOCOS RECORRENTES SEM DATA ]</span>
        </div>

        {/* 7 Columns Stack/Grid */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-start overflow-x-auto">
          {WEEK_DAYS.map((day) => {
            // Find blocks for this day_of_week and sort by start_time
            const dayBlocks = agendaBlocks
              .filter(b => b.day_of_week === day.value)
              .sort((a, b) => a.start_time.localeCompare(b.start_time));

            const isCurrentWeekday = new Date().getDay() === (day.value === 6 ? 0 : day.value + 1);

            return (
              <div 
                key={day.value}
                className={`flex flex-col gap-3 min-w-[140px] p-2.5 rounded-lg border bg-black/25 transition-all relative ${
                  isCurrentWeekday ? `${borderStyle} bg-emerald-950/5` : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {/* Day title header */}
                <div className="flex justify-between items-center border-b border-zinc-850 pb-1">
                  <span className={`text-[10px] font-black tracking-wider uppercase ${isCurrentWeekday ? textStyle : 'text-zinc-300'}`}>
                    {day.label}
                  </span>
                  <button 
                    onClick={() => handleOpenAddBlock(day.value)}
                    className="p-1 text-zinc-500 hover:text-white rounded border border-transparent hover:border-zinc-800 hover:bg-black/40 transition"
                    title={`Adicionar bloco ao dia ${day.label}`}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Day Blocks Listing */}
                <div className="space-y-2.5 min-h-[180px]">
                  {dayBlocks.length === 0 ? (
                    <div className="h-full flex items-center justify-center py-10 opacity-40 text-center">
                      <span className="text-[9px] italic font-mono text-zinc-500">Sem Blocos</span>
                    </div>
                  ) : (
                    dayBlocks.map((block) => {
                      const colorDef = CRT_COLOR_PRESETS.find(c => c.id === block.color) || CRT_COLOR_PRESETS[0];
                      const subsetTodos = agendaTodos.filter(t => t.block_id === block.id);
                      const doneTodos = subsetTodos.filter(t => t.completed).length;
                      const activeTodos = subsetTodos.length - doneTodos;

                      return (
                        <div
                          key={block.id}
                          onClick={() => {
                            sounds.playButtonSwitch();
                            setActiveMicroBlock(block);
                          }}
                          className={`p-2 border rounded-md cursor-pointer transition relative overflow-hidden flex flex-col justify-between group ${
                            colorDef.border
                          } ${colorDef.bg} ${
                            activeMicroBlock?.id === block.id ? 'ring-1 ring-white/50 border-white/60' : 'hover:scale-[1.02]'
                          }`}
                        >
                          {/* Aesthetic side strip */}
                          <div className={`absolute top-0 bottom-0 left-0 w-1 ${
                            block.color === 'blue' ? 'bg-blue-500' :
                            block.color === 'purple' ? 'bg-purple-500' :
                            block.color === 'green' ? 'bg-green-500' :
                            block.color === 'red' ? 'bg-red-500' :
                            block.color === 'cyan' ? 'bg-cyan-500' :
                            block.color === 'orange' ? 'bg-orange-500' :
                            'bg-amber-500'
                          }`} />

                          <div className="pl-1.5 space-y-1">
                            {/* Block Name */}
                            <h4 className="text-[11px] font-black uppercase text-white truncate break-all block" title={block.name}>
                              {block.name}
                            </h4>

                            {/* Interval */}
                            <div className="flex items-center gap-1.5 text-[9px] text-zinc-400 font-mono">
                              <Clock className="w-2.5 h-2.5 shrink-0" />
                              <span>{block.start_time} - {block.end_time}</span>
                            </div>

                            {/* Todo Count Counters */}
                            <div className="text-[9px] font-mono flex flex-wrap gap-1 leading-none pt-1">
                              {subsetTodos.length > 0 ? (
                                <>
                                  <span className="text-zinc-400">Pnd:</span>
                                  <span className={activeTodos > 0 ? 'text-amber-400 font-bold' : 'text-zinc-500'}>{activeTodos}</span>
                                  <span className="text-zinc-600">/</span>
                                  <span className="text-emerald-400">{doneTodos} ok</span>
                                </>
                              ) : (
                                <span className="text-zinc-650 italic">[sem pendências]</span>
                              )}
                            </div>
                          </div>

                          {/* Block Actions on hover */}
                          <div className="flex items-center justify-end gap-1 mt-2.5 pt-1.5 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => handleOpenDuplicate(block.id, block.day_of_week, e)}
                              className="p-1 bg-black/40 border border-zinc-800 hover:border-zinc-600 rounded text-zinc-400 hover:text-white transition"
                              title="Duplicar para outro dia"
                            >
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                            <button
                              onClick={(e) => handleOpenEditBlock(block, e)}
                              className="p-1 bg-black/40 border border-zinc-800 hover:border-zinc-600 rounded text-zinc-400 hover:text-white transition"
                              title="Editar Bloco"
                            >
                              <Edit3 className="w-2.5 h-2.5" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteBlock(block.id, e)}
                              className="p-1 bg-black/40 border border-red-950/60 hover:bg-red-950/20 rounded text-zinc-400 hover:text-red-400 transition"
                              title="Excluir Bloco"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. COOP VISÃO MICRO & DETAILS DRAWER FOR INTERNAL PENDÊNCIAS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: ACTIVE BLOCK DETAIL VISÃO MICRO (col-span-8) */}
        <div className={`lg:col-span-8 border-2 p-5 rounded-xl ${borderStyle} bg-black/40 space-y-4 min-h-[350px]`}>
          {activeMicroBlock ? (
            <div className="space-y-4">
              
              {/* Micro Context Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800 pb-3 gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 font-bold uppercase rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
                      {WEEK_DAYS.find(w => w.value === activeMicroBlock.day_of_week)?.label}
                    </span>
                    <span className={`text-[10px] font-mono ${textStyle}`}>
                      {activeMicroBlock.start_time} - {activeMicroBlock.end_time}
                    </span>
                  </div>
                  <h3 className="text-md font-black uppercase tracking-wider flex items-center gap-2 text-white">
                    {activeMicroBlock.name}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  <button
                    onClick={(e) => handleOpenEditBlock(activeMicroBlock, e)}
                    className="p-1.5 border border-zinc-700 hover:border-zinc-500 rounded text-xs text-zinc-400 hover:text-white transition flex items-center gap-1 uppercase"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Ajustar Bloco
                  </button>
                  <button
                    onClick={() => setActiveMicroBlock(null)}
                    className="p-1.5 border border-zinc-700 hover:border-zinc-500 rounded text-xs text-zinc-400 hover:text-white transition"
                    title="Fechar detalhe"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* CRUD FORM TO INPUT PENDÊNCIA (O que será feito) */}
              <form onSubmit={handleAddTodo} className="p-3 border border-zinc-800 bg-zinc-950/45 rounded-lg space-y-2.5">
                <span className="text-[9px] font-bold tracking-widest text-[#ffb347]/80 block uppercase">
                  [ INSERIR PENDÊNCIA EXECUTÁVEL ]
                </span>
                
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    required
                    maxLength={100}
                    placeholder="O que será feito neste horário? Ex: Resolver lista 03, Fazer push corrido..."
                    value={newTodoTitle}
                    onChange={e => setNewTodoTitle(e.target.value)}
                    className="flex-1 bg-black text-xs p-2.5 border border-zinc-800 rounded focus:border-[var(--color-amber)] text-white focus:outline-none"
                  />
                  
                  <button type="submit" className={primaryButtonStyle}>
                    <Plus className="w-4 h-4 shrink-0" /> ADICIONAR
                  </button>
                </div>

                {/* Additional optional classification metadata fields (Grupo & Categoria) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <select
                      value={selectedTodoGroupId}
                      onChange={e => setSelectedTodoGroupId(e.target.value)}
                      className="w-full bg-black border border-zinc-800 p-1.5 text-[10px] text-zinc-300 rounded cursor-pointer uppercase focus:border-[var(--color-amber)] focus:outline-none"
                    >
                      <option value="">Sem Dossiê/Grupo (Opcional)</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <select
                      value={selectedTodoCategoryId}
                      onChange={e => setSelectedTodoCategoryId(e.target.value)}
                      className="w-full bg-black border border-zinc-800 p-1.5 text-[10px] text-zinc-300 rounded cursor-pointer uppercase focus:border-[var(--color-amber)] focus:outline-none"
                    >
                      <option value="">Sem Categoria (Opcional)</option>
                      {availableCategories
                        .filter(c => !selectedTodoGroupId || c.group_id === selectedTodoGroupId)
                        .map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                  </div>
                </div>
              </form>

              {/* LIST OF PENDÊNCIAS */}
              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-black tracking-widest text-zinc-500 block uppercase">
                  PENDÊNCIAS CADASTRADAS ({agendaTodos.filter(t => t.block_id === activeMicroBlock.id).length}):
                </span>

                <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
                  {agendaTodos.filter(t => t.block_id === activeMicroBlock.id).length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-zinc-900 rounded text-xs text-zinc-500 font-mono">
                      Este bloco de horário está livre de pendências. Insira uma acima para planejar seu momento.
                    </div>
                  ) : (
                    agendaTodos
                      .filter(t => t.block_id === activeMicroBlock.id)
                      .map((todo) => {
                        const isEditing = editingTodoId === todo.id;
                        const relatedGroup = groups.find(g => g.id === todo.group_id);
                        const relatedCat = availableCategories.find(c => c.id === todo.category_id);

                        return (
                          <div 
                            key={todo.id}
                            className={`p-2.5 rounded border border-zinc-850 bg-zinc-950/70 hover:bg-zinc-900/60 transition flex items-center justify-between gap-3 ${
                              todo.completed ? 'opacity-60' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <button 
                                type="button"
                                onClick={() => handleToggleTodo(todo)}
                                className={`shrink-0 transition-colors ${
                                  todo.completed ? 'text-emerald-400' : 'text-zinc-650 hover:text-zinc-100'
                                }`}
                              >
                                {todo.completed ? (
                                  <CheckSquare className="w-4 h-4" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>

                              {isEditing ? (
                                <div className="flex items-center gap-1.5 flex-1">
                                  <input 
                                    type="text"
                                    value={editingTodoTitle}
                                    onChange={e => setEditingTodoTitle(e.target.value)}
                                    className="flex-1 bg-black text-xs p-1.5 border border-[var(--color-amber)] rounded focus:outline-none text-white font-mono"
                                  />
                                  <button
                                    onClick={() => handleSaveEditTodo(todo.id)}
                                    className="px-2 py-1 bg-emerald-500 text-black rounded font-black uppercase text-4xs"
                                  >
                                    OK
                                  </button>
                                  <button
                                    onClick={() => setEditingTodoId(null)}
                                    className="px-2 py-1 bg-zinc-800 rounded font-black uppercase text-4xs text-zinc-300"
                                  >
                                    X
                                  </button>
                                </div>
                              ) : (
                                <div className="min-w-0 flex-1 space-y-1">
                                  <span className={`text-xs font-mono break-words block ${
                                    todo.completed ? 'line-through text-zinc-500' : 'text-zinc-100'
                                  }`}>
                                    {todo.title}
                                  </span>

                                  {/* Classification tags as metadata */}
                                  {(relatedGroup || relatedCat) && (
                                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                                      {relatedGroup && (
                                        <span className="text-[8px] px-1.5 border border-zinc-800 rounded bg-zinc-900/60 text-zinc-400">
                                          G: {relatedGroup.name}
                                        </span>
                                      )}
                                      {relatedCat && (
                                        <span className="text-[8px] px-1.5 border border-zinc-800 rounded bg-zinc-900/60 text-zinc-400">
                                          C: {relatedCat.name}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Options Buttons */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleStartEditTodo(todo)}
                                className="p-1 hover:bg-black/40 rounded border border-transparent hover:border-zinc-800 text-zinc-400 hover:text-white transition"
                                title="Editar título"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDeleteTodo(todo.id)}
                                className="p-1 hover:bg-red-950/20 rounded border border-transparent hover:border-red-900/40 text-zinc-400 hover:text-red-400 transition"
                                title="Remover pendência"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center py-16 text-zinc-500 space-y-3">
              <Sparkles className="w-8 h-8 opacity-45 animate-pulse" />
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-300">Nenhum Bloco Selecionado</p>
                <p className="text-[11px] max-w-sm">
                  Clique em qualquer bloco de horário no cronograma semanal acima (Visão Macro) para inspecionar, adensar e gerenciar suas pendências de execução (Visão Micro).
                </p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: FAST EXPLANATION NOTES (col-span-4) */}
        <div className={`lg:col-span-4 border-2 p-5 rounded-xl ${borderStyle} bg-black/40 space-y-4`}>
          <h3 className="text-xs font-black tracking-wider uppercase flex items-center gap-1.5 opacity-90">
            <SettingsIcon className="w-4 h-4 text-orange-400 shrink-0" /> REGRAS DO SISTEMA
          </h3>

          <div className="space-y-3 text-[11px] font-mono leading-relaxed text-zinc-400">
            <div className="p-3 border border-zinc-800 bg-zinc-950/30 rounded">
              <strong className={textStyle}>1. ESTRUTURA PERMANENTE:</strong>
              <p className="mt-1">
                Ao contrário da agenda comum de datas, os blocos criados aqui são fixos e recorrentes todas as semanas. Eles representam sua fiação estrutural permanente de tempo.
              </p>
            </div>

            <div className="p-3 border border-zinc-800 bg-zinc-950/30 rounded">
              <strong className={textStyle}>2. MUTABILIDADE DE PENDÊNCIAS:</strong>
              <p className="mt-1">
                O que você faz dentro de cada bloco de horário (as pendências) são variáveis e dinâmicas. Você pode completá-las, criá-las ou limpá-las à medida que conclui suas frentes.
              </p>
            </div>

            <div className="p-3 border border-zinc-800 bg-zinc-950/30 rounded">
              <strong className={textStyle}>3. GRUPOS COMO METADADOS:</strong>
              <p className="mt-1">
                Mantenha a hierarquia dominante de <strong className="text-white">Agenda → Bloco → Pendências</strong>. Seus grupos e categorias de projetos agora funcionam apenas de forma acessória para classificar o teor de suas frentes.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. DUPLICATE BLOCK DIALOG MODAL */}
      {duplicatingBlockId && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md border-2 rounded-xl p-5 ${borderStyle} bg-black text-white space-y-4`}>
            
            <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
              <span className={`text-xs font-black tracking-widest uppercase ${textStyle}`}>
                [ DUPLICAR BLOCO DE AGENDA ]
              </span>
              <button 
                onClick={() => setDuplicatingBlockId(null)}
                className="text-zinc-500 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] text-zinc-400 leading-relaxed font-mono">
                Selecione para qual dia da semana você gostaria de enviar uma réplica exata deste bloco, juntamente com todas as suas pendências internas cadastradas:
              </p>

              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block mb-1">Dia da Semana Alvo</label>
                <select
                  value={duplicateTargetDay}
                  onChange={e => setDuplicateTargetDay(Number(e.target.value))}
                  className="w-full bg-black border border-zinc-800 p-2 text-xs rounded text-white focus:outline-none focus:border-[var(--color-amber)]"
                >
                  {WEEK_DAYS.map(day => (
                    <option key={day.value} value={day.value}>{day.label}-feira</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={handleConfirmDuplicate} className={primaryButtonStyle}>
                CONFIRMAR CÓPIA
              </button>
              <button onClick={() => setDuplicatingBlockId(null)} className={buttonStyle}>
                CANCELAR
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 5. ADD / EDIT BLOCK FORM DIALOG MODAL */}
      {isBlockModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <form 
            onSubmit={handleSaveBlock} 
            className={`w-full max-w-md border-2 rounded-xl p-5 ${borderStyle} bg-black text-white space-y-4`}
          >
            
            <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
              <span className={`text-xs font-black tracking-widest uppercase ${textStyle}`}>
                {editingBlock ? '[ MODIFICAR BLOCO DE AGENDA ]' : '[ ATIVAR NOVO BLOCO DE AGENDA ]'}
              </span>
              <button 
                type="button"
                onClick={() => setIsBlockModalOpen(false)}
                className="text-zinc-500 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Name */}
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block mb-1">Título do Bloco</label>
                <input
                  type="text"
                  required
                  maxLength={50}
                  placeholder="Ex: Aula de Biologia, Estudo de Francês..."
                  value={blockName}
                  onChange={e => setBlockName(e.target.value)}
                  className="w-full bg-black border border-zinc-800 p-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-amber)] rounded"
                />
              </div>

              {/* Day details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block mb-1">Dia da Semana</label>
                  <select
                    value={blockDay}
                    onChange={e => setBlockDay(Number(e.target.value))}
                    className="w-full bg-black border border-zinc-800 p-2.5 text-xs rounded text-white focus:outline-none focus:border-[var(--color-amber)]"
                  >
                    {WEEK_DAYS.map(day => (
                      <option key={day.value} value={day.value}>{day.label}-feira</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block mb-1">Cor CRT Sinalizadora</label>
                  <select
                    value={blockColor}
                    onChange={e => setBlockColor(e.target.value)}
                    className="w-full bg-black border border-zinc-800 p-2.5 text-xs rounded text-white focus:outline-none focus:border-[var(--color-amber)] uppercase"
                  >
                    {CRT_COLOR_PRESETS.map(preset => (
                      <option key={preset.id} value={preset.id}>{preset.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Times intervals */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block mb-1">Horário de Início</label>
                  <input
                    type="time"
                    required
                    value={blockStart}
                    onChange={e => setBlockStart(e.target.value)}
                    className="w-full bg-black border border-zinc-800 p-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-amber)] rounded"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block mb-1">Horário de Término</label>
                  <input
                    type="time"
                    required
                    value={blockEnd}
                    onChange={e => setBlockEnd(e.target.value)}
                    className="w-full bg-black border border-zinc-800 p-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-amber)] rounded"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-zinc-800">
              <button type="submit" className={primaryButtonStyle}>
                GRAVAR BLOCO
              </button>
              <button 
                type="button" 
                onClick={() => setIsBlockModalOpen(false)} 
                className={buttonStyle}
              >
                CANCELAR
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
}
