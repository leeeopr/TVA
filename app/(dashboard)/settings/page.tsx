'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Sliders, Plus, Trash2, Power, Terminal, Play, Cpu, ShieldAlert, FileDown, FileUp, Sparkles, Copy, ToggleLeft, ToggleRight, CheckSquare, Square, RefreshCcw, Info, Link as LinkIcon, Edit2, Database, Server } from 'lucide-react';
import { useProductivityStore } from '@/stores/productivityStore';
import { useAuthStore } from '@/stores/authStore';
import { sounds } from '@/lib/sounds';
import { db } from '@/lib/db';
import { supabase } from '@/lib/supabase';

export default function SettingsPage() {
  const {
    presets,
    settings,
    refreshData,
    agendaBlocks,
    planningTodos
  } = useProductivityStore();

  const { user, signOut } = useAuthStore();

  const [isClient, setIsClient] = useState(false);

  // Custom Preset forms
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetFocus, setNewPresetFocus] = useState(25);
  const [newPresetShort, setNewPresetShort] = useState(5);
  const [newPresetLong, setNewPresetLong] = useState(15);
  const [newPresetCycles, setNewPresetCycles] = useState(4);

  // Planning Pack forms & state
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [planningTitle, setPlanningTitle] = useState('');
  const [selectedBlockName, setSelectedBlockName] = useState('');
  const [requiresLink, setRequiresLink] = useState(true);
  const [editPlanningId, setEditPlanningId] = useState<string | null>(null);
  const [customBlockMode, setCustomBlockMode] = useState(false);

  // External Sources CRUD state
  const [externalSources, setExternalSources] = useState<any[]>([]);
  const [sourceName, setSourceName] = useState('');
  const [secretAlias, setSecretAlias] = useState('');
  const [sourceActive, setSourceActive] = useState(true);
  const [editSourceId, setEditSourceId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ status: 'idle', message: '' });
  const [showDeleteModalId, setShowDeleteModalId] = useState<string | null>(null);

  // External Source Mapping states
  const [sourceMappings, setSourceMappings] = useState<any[]>([]);
  const [mappingSourceId, setMappingSourceId] = useState('');
  const [mappingGroupId, setMappingGroupId] = useState('');
  const [mappingCategoryId, setMappingCategoryId] = useState('');
  const [mappingBlockId, setMappingBlockId] = useState('');
  const [isSavingMapping, setIsSavingMapping] = useState(false);

  // Encontrar blocos em comum para os dias selecionados
  const getCommonBlockNames = () => {
    if (selectedDays.length === 0) return [];
    
    const blocksByDay = selectedDays.map(day => {
      const dayBlocks = agendaBlocks.filter(b => b.day_of_week === day);
      return new Set(dayBlocks.map(b => b.name.trim().toUpperCase()));
    });
    
    const commonBlockNamesSet = blocksByDay.reduce((acc, currentSet) => {
      return new Set([...acc].filter(x => currentSet.has(x)));
    }, blocksByDay[0] || new Set<string>());

    return Array.from(commonBlockNamesSet).map(upperName => {
      const match = agendaBlocks.find(b => b.name.trim().toUpperCase() === upperName);
      return match ? match.name : upperName;
    });
  };

  const commonBlocks = getCommonBlockNames();

  const fetchExternalSources = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('external_sources')
        .select('*')
        .order('name', { ascending: true });
      if (error) {
        db.addLog(`FONTES_ERR: Erro ao buscar fontes: ${error.message}`, 'error');
      } else {
        setExternalSources(data || []);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const fetchSourceMappings = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('external_source_mappings')
        .select('*');
      if (error) {
        db.addLog(`MAPPING_ERR: Erro ao buscar mapeamentos: ${error.message}`, 'error');
      } else {
        setSourceMappings(data || []);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleSaveMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mappingSourceId || !mappingGroupId || !mappingCategoryId) {
      db.addLog('REQUISITO NEGADO: Selecione fonte, grupo e categoria.', 'warning');
      return;
    }
    clickFeedback();
    setIsSavingMapping(true);

    const payload = {
      user_id: user?.id,
      source_id: mappingSourceId,
      target_group_id: mappingGroupId,
      target_category_id: mappingCategoryId,
      default_block_id: mappingBlockId || null,
      active: true
    };

    try {
      const { error } = await supabase
        .from('external_source_mappings')
        .upsert([payload], { onConflict: 'source_id' });

      if (error) throw error;
      db.addLog('MAPEAMENTO: Mapeamento configurado com sucesso para a fonte.', 'success');
      
      setMappingSourceId('');
      setMappingGroupId('');
      setMappingCategoryId('');
      setMappingBlockId('');
      await fetchSourceMappings();
    } catch (err: any) {
      db.addLog(`MAPEAMENTO_ERR: Falha ao salvar mapeamento: ${err.message}`, 'error');
    } finally {
      setIsSavingMapping(false);
    }
  };

  const handleDeleteMapping = async (id: string) => {
    clickFeedback();
    try {
      const { error } = await supabase
        .from('external_source_mappings')
        .delete()
        .eq('id', id);

      if (error) throw error;
      db.addLog('MAPEAMENTO: Mapeamento removido com sucesso.', 'info');
      await fetchSourceMappings();
    } catch (err: any) {
      db.addLog(`MAPEAMENTO_ERR: Falha ao apagar mapeamento: ${err.message}`, 'error');
    }
  };

  const handleSaveExternalSource = async (e: React.FormEvent) => {
    e.preventDefault();
    const aliasValue = secretAlias.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    if (!sourceName.trim() || !aliasValue) {
      db.addLog('REGISTRO NEGADO: Preencha todos os campos da fonte (Nome e Secret Alias).', 'warning');
      return;
    }
    clickFeedback();

    const payload = {
      name: sourceName.trim(),
      secret_alias: aliasValue,
      active: sourceActive,
      user_id: user?.id
    };

    try {
      if (editSourceId) {
        const { error } = await supabase
          .from('external_sources')
          .update({
            name: payload.name,
            secret_alias: payload.secret_alias,
            active: payload.active
          })
          .eq('id', editSourceId);

        if (error) throw error;
        db.addLog(`FONTES: FONTE [${payload.name}] ATUALIZADA COM SUCESSO.`, 'success');
      } else {
        const { error } = await supabase
          .from('external_sources')
          .insert([payload]);

        if (error) throw error;
        db.addLog(`FONTES: FONTE [${payload.name}] CADASTRADA COM SUCESSO.`, 'success');
      }

      setSourceName('');
      setSecretAlias('');
      setSourceActive(true);
      setEditSourceId(null);
      await fetchExternalSources();
    } catch (err: any) {
      db.addLog(`FONTES_ERR: FALHA AO SALVAR FONTE: ${err.message}`, 'error');
    }
  };

  const handleEditExternalSourceInit = (src: any) => {
    clickFeedback();
    setEditSourceId(src.id);
    setSourceName(src.name);
    setSecretAlias(src.secret_alias || '');
    setSourceActive(src.active);
  };

  const handleDeleteExternalSource = async (id: string, name: string) => {
    sounds.playAlarmBreak();
    try {
      const { error } = await supabase
        .from('external_sources')
        .delete()
        .eq('id', id);

      if (error) throw error;
      db.addLog(`FONTES: FONTE [${name}] REMOVIDA.`, 'info');
      setShowDeleteModalId(null);
      await fetchExternalSources();
    } catch (err: any) {
      db.addLog(`FONTES_ERR: FALHA AO APAGAR FONTE: ${err.message}`, 'error');
    }
  };

  const handleSyncNow = async () => {
    clickFeedback();
    setIsSyncing(true);
    setSyncFeedback({ status: 'loading', message: 'Sincronizando fontes externas...' });

    try {
      const res = await fetch('/api/sync-external', {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro desconhecido');
      }

      const total = data.report?.totalSources || 0;
      const success = data.report?.successful || 0;
      const failed = data.report?.failed || 0;

      if (failed > 0) {
        setSyncFeedback({ 
          status: 'error', 
          message: `Sincronização concluída com avisos: ${success} ok, ${failed} falhas.` 
        });
        db.addLog(`SYNC_EXTERNAL: Sincronização parcial. ${success} ok, ${failed} falhas.`, 'warning');
      } else {
        setSyncFeedback({ 
          status: 'success', 
          message: `Sincronização concluída com sucesso! ${success} de ${total} fontes ok.` 
        });
        db.addLog(`SYNC_EXTERNAL: Sincronização concluída para todas as fontes.`, 'success');
      }

      await fetchExternalSources();
      await db.pullFromSupabase();
      await refreshData();
    } catch (err: any) {
      setSyncFeedback({ status: 'error', message: `Falha na sincronização: ${err.message}` });
      db.addLog(`SYNC_EXTERNAL_ERR: ${err.message}`, 'error');
    } finally {
      setIsSyncing(false);
      setTimeout(() => {
        setSyncFeedback(prev => prev.status === 'loading' ? prev : { status: 'idle', message: '' });
      }, 6000);
    }
  };

  useEffect(() => {
    const handle = setTimeout(() => {
      setIsClient(true);
    }, 0);
    return () => clearTimeout(handle);
  }, []);

  useEffect(() => {
    if (isClient) {
      refreshData();
    }
  }, [isClient, refreshData]);

  useEffect(() => {
    if (isClient && user) {
      const loadAsync = async () => {
        // Yield execution to the browser microtask queue to avoid synchronous state triggers during render
        await Promise.resolve();
        fetchExternalSources();
        fetchSourceMappings();
      };
      loadAsync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, user]);

  if (!isClient) return null;

  const clickFeedback = () => {
    sounds.playKeyClick();
  };

  const handleCreateCustomPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;
    clickFeedback();
    
    db.savePreset(
      newPresetName, 
      newPresetFocus, 
      newPresetShort, 
      newPresetLong, 
      newPresetCycles
    );
    
    setNewPresetName('');
    setNewPresetFocus(25);
    setNewPresetShort(5);
    setNewPresetLong(15);
    setNewPresetCycles(4);
    refreshData();
  };

  const handleDeletePreset = (id: string) => {
    sounds.playAlarmBreak();
    db.deletePreset(id);
    refreshData();
  };

  const handleExportPresets = () => {
    clickFeedback();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(presets, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "tva_foco_presets.json");
    dlAnchorElem.click();
    db.addLog('EXPORT COMPLETED. PRESETS DUMPED TO LOCAL STORAGE FILES.', 'success');
  };

  const handleImportPresets = () => {
    clickFeedback();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const imported = JSON.parse(evt.target?.result as string);
          if (Array.isArray(imported)) {
            imported.forEach(p => {
              if (p.name && p.focus_minutes) {
                db.savePreset(
                  p.name, 
                  p.focus_minutes, 
                  p.short_break_minutes || 5, 
                  p.long_break_minutes || 15, 
                  p.cycles_before_long_break || 4
                );
              }
            });
            refreshData();
            db.addLog('CHRONOS INGESTION READY: CUSTOM BATCH IMPORTED OK.', 'success');
          }
        } catch (err) {
          db.addLog('CRITICAL: IMPORT SCHEMA REJECTED. JSON FILE CORPLACE.', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const toggleScanlines = () => {
    const updated = db.saveSettings({ scanlines_enabled: !settings.scanlines_enabled });
    clickFeedback();
    refreshData();
  };

  const toggleSoundState = () => {
    const nextVal = !settings.sounds_enabled;
    const updated = db.saveSettings({ sounds_enabled: nextVal });
    sounds.setEnabled(nextVal);
    sounds.playButtonSwitch();
    refreshData();
  };

  const toggleNotifications = () => {
    const updated = db.saveSettings({ notifications_enabled: !settings.notifications_enabled });
    clickFeedback();
    refreshData();
  };

  const changeThemeMode = (mode: 'AMBER' | 'GREEN' | 'COBALT') => {
    const updated = db.saveSettings({ theme_mode: mode });
    sounds.playButtonSwitch();
    db.addLog(`THEME TRANSFECTION COMPLETED: INTERFACE MODIFIED TO [${mode}]`, 'success');
    refreshData();
  };

  const changeIntensity = (key: 'crt_intensity' | 'glow_intensity', value: number) => {
    db.saveSettings({ [key]: value });
    refreshData();
  };

  // ==========================================
  // BRUTAL PLANNING PACK CONTROLLER ACTIONS
  // ==========================================

  // Salvar (Criar ou Editar)
  const handleSavePlanningTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planningTitle.trim()) return;
    if (selectedDays.length === 0) {
      db.addLog("REGISTRO NEGADO: Selecione ao menos um dia da semana.", "warning");
      return;
    }
    if (!selectedBlockName) {
      db.addLog("REGISTRO NEGADO: Selecione um bloco comum.", "warning");
      return;
    }

    clickFeedback();

    const payload = {
      title: planningTitle.trim(),
      days_of_week: selectedDays,
      block_name: selectedBlockName,
      requires_link: requiresLink,
      link: null, // Começa imaculada se exigir link
      active: true,
      completed: false
    };

    try {
      if (editPlanningId) {
        const originalItem = planningTodos.find(t => t.id === editPlanningId);
        let finalLink = originalItem?.link || null;
        let finalCompleted = originalItem?.completed ?? false;

        if (!requiresLink) {
          finalLink = null;
        }

        await db.updatePlanningTodo(editPlanningId, {
          title: payload.title,
          days_of_week: payload.days_of_week,
          block_name: payload.block_name,
          requires_link: payload.requires_link,
          link: finalLink,
          completed: finalCompleted
        });
        db.addLog(`PLANNING: PENDÊNCIA [${payload.title}] ATUALIZADA COM SUCESSO.`, 'success');
      } else {
        await db.createPlanningTodo(payload);
        db.addLog(`PLANNING: PENDÊNCIA [${payload.title}] INSERIDA COM SUCESSO.`, 'success');
      }

      // Reset form
      setPlanningTitle('');
      setSelectedDays([]);
      setSelectedBlockName('');
      setRequiresLink(true);
      setEditPlanningId(null);
      setCustomBlockMode(false);
      refreshData();
    } catch (err: any) {
      db.addLog(`PLANNING_ERR: FALHA AO SALVAR ITEM: ${err.message}`, 'error');
    }
  };

  const handleEditPlanningTodoInit = (item: any) => {
    clickFeedback();
    setEditPlanningId(item.id);
    setPlanningTitle(item.title);
    setSelectedDays(item.days_of_week);
    setSelectedBlockName(item.block_name);
    setRequiresLink(item.requires_link);
    
    // Check if the block exists in the user's agenda. If not, auto-enable manual typing.
    const allAgendaBlockNames = agendaBlocks.map(b => b.name.trim().toUpperCase());
    const exists = allAgendaBlockNames.includes(item.block_name.trim().toUpperCase());
    setCustomBlockMode(!exists);
  };

  const handleDeletePlanningTodo = async (id: string, name: string) => {
    sounds.playAlarmBreak();
    try {
      await db.deletePlanningTodo(id);
      db.addLog(`PLANNING: PENDÊNCIA [${name}] APAGADA.`, 'info');
      refreshData();
    } catch (err: any) {
      db.addLog(`PLANNING_ERR: FALHA AO APAGAR ITEM: ${err.message}`, 'error');
    }
  };

  const handleDuplicatePlanningTodo = async (item: any) => {
    clickFeedback();
    const payload = {
      title: `${item.title} (CÓPIA)`,
      days_of_week: [...item.days_of_week],
      block_name: item.block_name,
      requires_link: item.requires_link,
      link: item.link || null,
      active: item.active,
      completed: item.completed
    };

    try {
      await db.createPlanningTodo(payload);
      db.addLog(`PLANNING: DUPLICADA PENDÊNCIA DE [${item.title}].`, 'success');
      refreshData();
    } catch (err: any) {
      db.addLog(`PLANNING_ERR: FALHA AO DUPLICAR: ${err.message}`, 'error');
    }
  };

  const handleToggleActivePlanningTodo = async (item: any) => {
    clickFeedback();
    try {
      await db.updatePlanningTodo(item.id, { active: !item.active });
      db.addLog(`PLANNING: PENDÊNCIA [${item.title}] ${!item.active ? 'HABILITADA' : 'DESABILITADA'}.`, 'info');
      refreshData();
    } catch (err: any) {
      db.addLog(`PLANNING_ERR: FALHA NO TOGGLE DE ATIVAÇÃO: ${err.message}`, 'error');
    }
  };

  const handleToggleDaySelection = (dayVal: number) => {
    clickFeedback();
    if (selectedDays.includes(dayVal)) {
      setSelectedDays(selectedDays.filter(d => d !== dayVal));
    } else {
      setSelectedDays([...selectedDays, dayVal].sort());
    }
  };

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.25 }}
      className="space-y-5 text-left"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* MONITOR ELECTRON SWEETS ADJUSTER (2/3 columns layout) */}
        <div className={`lg:col-span-2 border-2 p-5 rounded-xl space-y-6 ${bgStyle} ${borderStyle}`}>
          <div className="border-b border-[var(--color-amber)]/20 pb-2 mb-3 text-xs text-[var(--color-amber)] tracking-wider">
            <span>[ CALIBRAÇÃO DOS FEIXES DE ELÉTRON ]</span>
          </div>

          {/* CHOOSE THEMATIC COLOR SWATCHES */}
          <div className="space-y-2.5">
            <span className="text-xxs tracking-widest text-[var(--color-amber)] opacity-75 uppercase block font-bold">Matriz de Cor Monocromática</span>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => changeThemeMode('AMBER')}
                className={`py-2 text-[10px] uppercase font-black tracking-widest rounded border cursor-pointer select-none ${
                  settings.theme_mode === 'AMBER'
                    ? 'bg-[#ffb347] text-black border-[#ffb347] font-black'
                    : 'bg-transparent text-[#ffb347] border-[#ffb347]/30 hover:bg-[#ffb347]/10'
                }`}
              >
                Âmbar (TVA Retro)
              </button>
              <button
                type="button"
                onClick={() => changeThemeMode('GREEN')}
                className={`py-2 text-[10px] uppercase font-black tracking-widest rounded border cursor-pointer select-none ${
                  settings.theme_mode === 'GREEN'
                    ? 'bg-[#33ff33] text-black border-[#33ff33] font-black'
                    : 'bg-transparent text-[#33ff33] border-[#33ff33]/30 hover:bg-[#33ff33]/10'
                }`}
              >
                Verde Phosphor
              </button>
              <button
                type="button"
                onClick={() => changeThemeMode('COBALT')}
                className={`py-2 text-[10px] uppercase font-black tracking-widest rounded border cursor-pointer select-none ${
                  settings.theme_mode === 'COBALT'
                    ? 'bg-[#00e5ff] text-black border-[#00e5ff] font-black'
                    : 'bg-transparent text-[#00e5ff] border-[#00e5ff]/30 hover:bg-[#00e5ff]/10'
                }`}
              >
                Cobalto Matrix
              </button>
            </div>
          </div>

          {/* DUAL SLIDERS FOR INTENSITY */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xxs font-bold uppercase tracking-wider text-[var(--color-amber)]/80">
                <span>Intensidade CRT</span>
                <span>{Math.round(settings.crt_intensity * 100)}%</span>
              </div>
              <input 
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={settings.crt_intensity}
                onChange={(e) => changeIntensity('crt_intensity', Number(e.target.value))}
                className="w-full accent-[var(--color-amber)] bg-[#1a130e] h-2.5 rounded-lg appearance-none border border-[var(--color-amber)]/25 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xxs font-bold uppercase tracking-wider text-[var(--color-amber)]/80">
                <span>Intensidade Glow</span>
                <span>{Math.round(settings.glow_intensity * 100)}%</span>
              </div>
              <input 
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={settings.glow_intensity}
                onChange={(e) => changeIntensity('glow_intensity', Number(e.target.value))}
                className="w-full accent-[var(--color-amber)] bg-[#1a130e] h-2.5 rounded-lg appearance-none border border-[var(--color-amber)]/25 cursor-pointer"
              />
            </div>
          </div>

          {/* TOGGLE OPTIONS CHECKS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[var(--color-amber)]/10">
            <button
              onClick={toggleScanlines}
              className={`py-2 px-3 border text-[10px] font-bold uppercase tracking-wider rounded transition-all flex items-center justify-between cursor-pointer select-none ${
                settings.scanlines_enabled
                  ? 'bg-[var(--color-amber)]/10 text-[var(--color-amber)] ' + borderStyle
                  : 'bg-black/25 text-[var(--color-amber)]/50 border-[var(--color-amber)]/20'
              }`}
            >
              <span>Scanlines</span>
              <span>{settings.scanlines_enabled ? '[ATIVO]' : '[OFF]'}</span>
            </button>

            <button
              onClick={toggleSoundState}
              className={`py-2 px-3 border text-[10px] font-bold uppercase tracking-wider rounded transition-all flex items-center justify-between cursor-pointer select-none ${
                settings.sounds_enabled
                  ? 'bg-[var(--color-amber)]/10 text-[var(--color-amber)] ' + borderStyle
                  : 'bg-black/25 text-[var(--color-amber)]/50 border-[var(--color-amber)]/20'
              }`}
            >
              <span>Sons Teclado</span>
              <span>{settings.sounds_enabled ? '[ATIVO]' : '[OFF]'}</span>
            </button>

            <button
              onClick={toggleNotifications}
              className={`py-2 px-3 border text-[10px] font-bold uppercase tracking-wider rounded transition-all flex items-center justify-between cursor-pointer select-none ${
                settings.notifications_enabled
                  ? 'bg-[var(--color-amber)]/10 text-[var(--color-amber)] ' + borderStyle
                  : 'bg-black/25 text-[var(--color-amber)]/50 border-[var(--color-amber)]/20'
              }`}
            >
              <span>Alertas</span>
              <span>{settings.notifications_enabled ? '[ATIVO]' : '[OFF]'}</span>
            </button>
          </div>

          {/* PRESETS BACKUP IMPORT & EXPORT DOCKS */}
          <div className="pt-4 border-t border-[var(--color-amber)]/10 space-y-2">
            <span className="text-xxs tracking-widest text-[var(--color-amber)] opacity-75 uppercase block font-bold">Gerenciador de Backups</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleExportPresets}
                className="py-2.5 border border-[var(--color-amber)]/50 hover:bg-[var(--color-amber)]/15 font-bold text-xs uppercase flex items-center justify-center gap-2 rounded-lg cursor-pointer transition-all active:scale-95"
              >
                <FileDown className="w-4 h-4" /> Exportar Receitas
              </button>
              <button
                onClick={handleImportPresets}
                className="py-2.5 border border-[var(--color-amber)]/50 hover:bg-[var(--color-amber)]/15 font-bold text-xs uppercase flex items-center justify-center gap-2 rounded-lg cursor-pointer transition-all active:scale-95"
              >
                <FileUp className="w-4 h-4" /> Importar Receitas (.json)
              </button>
            </div>
          </div>
        </div>

        {/* ACTIVE OPERATOR SUPABASE STATUS CARD (1 column sidebar layout) */}
        <div className={`border-2 p-5 rounded-xl space-y-5 ${bgStyle} ${borderStyle} self-start`}>
          <div className="border-b border-[var(--color-amber)]/20 pb-2 text-xs text-[var(--color-amber)] tracking-wider">
            <span>[ CONEXÃO DO OPERADOR ]</span>
          </div>

          <div className="space-y-4 text-center">
            <div className="mx-auto w-16 h-16 rounded-full border-2 border-[var(--color-amber)] bg-[var(--color-amber)]/10 flex items-center justify-center relative">
              <Cpu className="w-8 h-8 animate-pulse text-[var(--color-amber)]" />
              <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-black absolute bottom-0 right-0 animate-ping" />
              <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-black absolute bottom-0 right-0" />
            </div>

            <div className="space-y-1.5">
              <strong className={`block text-xs uppercase font-extrabold tracking-wider ${textStyle}`}>OPERADOR_TVA</strong>
              <span className="block text-[10px] text-[var(--color-amber)]/80 font-mono select-all truncate" title={user?.email || 'Nenhum'}>
                {user?.email || "CONECTOR_OFFLINE_OPERATOR"}
              </span>
            </div>

            <div className="p-3 border border-emerald-500/15 bg-emerald-950/20 text-xxs text-emerald-400 capitalize text-left rounded-lg space-y-1">
              <span className="font-bold uppercase tracking-widest text-[#00e5ff] text-[9px] block border-b border-emerald-500/10 pb-0.5">Sessão Supabase Ativa</span>
              <span>• Status: Handshake ok</span>
              <span>• Database: cloud sync read/write</span>
            </div>
          </div>
        </div>
      </div>

      {/* CUSTOM CYCLES CONFIGURATION MAKER PANEL */}
      <div className={`border-2 p-5 rounded-xl space-y-4 ${bgStyle} ${borderStyle}`}>
        <div className="border-b border-[var(--color-amber)]/20 pb-2 mb-3 text-xs text-[var(--color-amber)] tracking-wider flex justify-between items-center">
          <span>[ FORMULÁRIO DE GESTÃO - CRIE SEU PRESET CHRONOS ]</span>
        </div>

        <form onSubmit={handleCreateCustomPreset} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xxs text-[var(--color-amber)] opacity-75 uppercase block tracking-wider font-bold">Identificação do Preset</label>
              <input
                type="text"
                required
                placeholder="ex: Foco Pesquisador"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                className="w-full bg-[#0d0b09] border border-[var(--color-amber)]/45 focus:border-[var(--color-amber)] px-3 py-2 text-xs text-[var(--color-amber)] focus:outline-none rounded"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-xxs text-[var(--color-amber)] opacity-75 uppercase block tracking-wider font-bold">Foco (min)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={newPresetFocus}
                  onChange={(e) => setNewPresetFocus(Number(e.target.value))}
                  className="w-full bg-[#0d0b09] border border-[var(--color-amber)]/45 focus:border-[var(--color-amber)] px-2 py-2 text-xs text-[var(--color-amber)] focus:outline-none rounded"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xxs text-[var(--color-amber)] opacity-75 uppercase block tracking-wider font-bold">Pausa (Curto)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={newPresetShort}
                  onChange={(e) => setNewPresetShort(Number(e.target.value))}
                  className="w-full bg-[#0d0b09] border border-[var(--color-amber)]/45 focus:border-[var(--color-amber)] px-2 py-2 text-xs text-[var(--color-amber)] focus:outline-none rounded"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xxs text-[var(--color-amber)] opacity-75 uppercase block tracking-wider font-bold">Pausa (Longo)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={newPresetLong}
                  onChange={(e) => setNewPresetLong(Number(e.target.value))}
                  className="w-full bg-[#0d0b09] border border-[var(--color-amber)]/45 focus:border-[var(--color-amber)] px-2 py-2 text-xs text-[var(--color-amber)] focus:outline-none rounded"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xxs text-[var(--color-amber)] opacity-75 block tracking-wider font-bold">Ciclos de Foco antes do Cooldown Longo</label>
              <input
                type="number"
                min="1"
                required
                value={newPresetCycles}
                onChange={(e) => setNewPresetCycles(Number(e.target.value))}
                className="w-full bg-[#0d0b09] border border-[var(--color-amber)]/45 focus:border-[var(--color-amber)] px-3 py-1.5 text-xs text-[var(--color-amber)] focus:outline-none rounded"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-2 border bg-[var(--color-amber)] text-black font-extrabold text-xs hover:bg-[#ffd19a] uppercase rounded flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Gravar em Disco
              </button>
            </div>
          </div>
        </form>

        {/* REGISTERED LIST PRESETS WITH REMOVE ACTIONS */}
        <div className="space-y-2 mt-4 pt-4 border-t border-[var(--color-amber)]/20">
          <div className="text-xs uppercase text-[var(--color-amber)] opacity-75 tracking-wider font-bold">[ PRESETS ARQUIVADOS ]</div>
          <div className="space-y-2 max-h-[150px] overflow-y-auto">
            {presets.map(p => (
              <div key={p.id} className="border border-[var(--color-amber)]/20 p-2 text-xs flex justify-between items-center rounded-lg bg-[#0d0b09]/50">
                <div>
                  <strong className={`${textStyle}`}>{p.name}</strong> 
                  <span className="opacity-70 ml-2">{"//"} Foco: {p.focus_minutes}m | Pausa: {p.short_break_minutes}m {"//"} {p.cycles_before_long_break} ciclos</span>
                </div>
                {p.id !== 'preset-standard' && p.id !== 'preset-super' && p.id !== 'preset-quick' && (
                  <button
                    onClick={() => handleDeletePreset(p.id)}
                    className="p-1 border border-rose-900 text-rose-450 hover:bg-rose-950/20 text-rose-400 hover:border-rose-600 transition-all rounded cursor-pointer"
                    title="Deletar Preset"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SEÇÃO INTEGRAL: PACK DE PENDÊNCIAS DE PLANEJAMENTO (CRUD) */}
      {/* ========================================================= */}
      <div className={`border-2 p-6 rounded-xl space-y-4 mt-6 ${bgStyle} ${borderStyle}`}>
        <div className="border-b border-[var(--color-amber)]/35 pb-3">
          <h2 className={`text-xs uppercase tracking-widest font-extrabold flex items-center gap-2 ${textStyle}`}>
            <CheckSquare className="w-4 h-4 animate-pulse text-[var(--color-amber)]" /> [ PACK DE PENDÊNCIAS DE PLANEJAMENTO - CRUD SUPABASE ]
          </h2>
          <p className="text-[10px] text-[var(--color-amber)]/75 mt-1 font-mono">
            Cadastre materiais, listas de exercícios, recursos ou PDFs recorrentes vinculados a blocos da sua agenda semanal.
          </p>
        </div>

        {db.checkPlanningTableMissing() && (
          <div className="border border-rose-900/50 bg-rose-950/25 rounded-lg p-4 font-mono text-xs text-rose-300 space-y-3 font-mono">
            <div className="flex items-center gap-2 text-rose-450 font-extrabold tracking-wider">
              <ShieldAlert className="w-4 h-4 text-rose-500 animate-bounce animate-pulse" />
              <span>[ BANCO DE DADOS: TABELA &apos;planning_todos&apos; AUSENTE OU COLUNA &apos;completed&apos; INCOMPATÍVEL ]</span>
            </div>
            <p className="text-[10px] text-rose-400/80 leading-relaxed">
              Detectamos que seu banco de dados Supabase não possui a tabela de pendências de planejamento ou está com um esquema desatualizado (faltando a coluna <code className="text-emerald-400 font-bold">completed</code>).
              Para solucionar o erro, copie e execute o script abaixo no seu **SQL Editor** do Supabase:
            </p>
            <div className="relative">
              <pre className="p-3 bg-black/80 rounded border border-rose-900/30 text-[9px] text-rose-400/90 overflow-x-auto max-h-56 leading-normal select-all whitespace-pre-wrap">
{`-- 1. Garante a criação da tabela
CREATE TABLE IF NOT EXISTS public.planning_todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    days_of_week INTEGER[] NOT NULL,
    block_name TEXT NOT NULL,
    requires_link BOOLEAN DEFAULT TRUE NOT NULL,
    link TEXT DEFAULT NULL,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    completed BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Alinha a coluna completed caso a tabela já existisse
ALTER TABLE public.planning_todos ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT FALSE NOT NULL;

-- 3. Habilita segurança de linha (RLS)
ALTER TABLE public.planning_todos ENABLE ROW LEVEL SECURITY;

-- 4. Cria política de acesso do usuário
DROP POLICY IF EXISTS "Users can manage their own planning todos" ON public.planning_todos;
CREATE POLICY "Users can manage their own planning todos" ON public.planning_todos
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Cria índices de performance
CREATE INDEX IF NOT EXISTS idx_planning_todos_user_id ON public.planning_todos(user_id);
CREATE INDEX IF NOT EXISTS idx_planning_todos_active ON public.planning_todos(user_id, active);

-- 6. Recarrega o cache de esquemas do Supabase
NOTIFY pgrst, 'reload schema';`}
              </pre>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`-- 1. Garante a criação da tabela
CREATE TABLE IF NOT EXISTS public.planning_todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    days_of_week INTEGER[] NOT NULL,
    block_name TEXT NOT NULL,
    requires_link BOOLEAN DEFAULT TRUE NOT NULL,
    link TEXT DEFAULT NULL,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    completed BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Alinha a coluna completed caso a tabela já existisse
ALTER TABLE public.planning_todos ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT FALSE NOT NULL;

-- 3. Habilita segurança de linha (RLS)
ALTER TABLE public.planning_todos ENABLE ROW LEVEL SECURITY;

-- 4. Cria política de acesso do usuário
DROP POLICY IF EXISTS "Users can manage their own planning todos" ON public.planning_todos;
CREATE POLICY "Users can manage their own planning todos" ON public.planning_todos
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Cria índices de performance
CREATE INDEX IF NOT EXISTS idx_planning_todos_user_id ON public.planning_todos(user_id);
CREATE INDEX IF NOT EXISTS idx_planning_todos_active ON public.planning_todos(user_id, active);

-- 6. Recarrega o cache de esquemas do Supabase
NOTIFY pgrst, 'reload schema';`);
                  sounds.playKeyClick();
                  db.addLog("SQL SCHEMA COPIED TO CLIPBOARD.", "success");
                }}
                className="absolute top-2 right-2 px-2 py-1 bg-rose-950 hover:bg-rose-900 border border-rose-900 rounded text-[8px] uppercase font-bold tracking-widest text-rose-300 cursor-pointer"
              >
                Copiar SQL
              </button>
            </div>
            <p className="text-[9px] text-rose-400/50">
              * Nota: Após executar o comando no Supabase, a interface sincronizará automaticamente.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 pt-2">
          {/* COLUNA ESQUERDA: CADASTRO/EDIÇÃO (xl:col-span-12 lg:col-span-5) */}
          <div className="space-y-4 xl:col-span-5 border border-[var(--color-amber)]/15 p-4 rounded-lg bg-[#0d0b09]/30">
            <div className="border-b border-[var(--color-amber)]/10 pb-2 text-[10px] text-[var(--color-amber)] tracking-wider uppercase font-extrabold flex justify-between items-center font-mono">
              <span>{editPlanningId ? '» EDITAR PENDÊNCIA EXISTENTE' : '» NOVA PENDÊNCIA DE PLANEJAMENTO'}</span>
              {editPlanningId && (
                <button 
                  type="button"
                  className="text-[9px] text-rose-400 hover:underline cursor-pointer uppercase font-bold"
                  onClick={() => {
                    clickFeedback();
                    setEditPlanningId(null);
                    setPlanningTitle('');
                    setSelectedDays([]);
                    setSelectedBlockName('');
                    setRequiresLink(true);
                  }}
                >
                  Cancelar
                </button>
              )}
            </div>

            <form onSubmit={handleSavePlanningTodo} className="space-y-4">
              {/* PASSO 1: Dias da Semana */}
              <div className="space-y-2">
                <label className="text-xxs text-[var(--color-amber)] opacity-85 uppercase block tracking-wider font-extrabold flex items-center gap-1.5">
                  <span className="bg-[var(--color-amber)]/20 text-[var(--color-amber)] px-1 py-0.5 rounded text-[8px]">01</span> Dias da Semana
                </label>
                <div className="flex flex-wrap gap-1">
                  {[
                    { value: 0, label: 'SEG' },
                    { value: 1, label: 'TER' },
                    { value: 2, label: 'QUA' },
                    { value: 3, label: 'QUI' },
                    { value: 4, label: 'SEX' },
                    { value: 5, label: 'SÁB' },
                    { value: 6, label: 'DOM' }
                  ].map(day => {
                    const isSelected = selectedDays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => handleToggleDaySelection(day.value)}
                        className={`px-2.5 py-1 text-xxs font-extrabold border transition-all rounded-md cursor-pointer ${
                          isSelected 
                            ? 'bg-[var(--color-amber)] text-black border-[var(--color-amber)]' 
                            : 'border-[var(--color-amber)]/30 text-[var(--color-amber)]/80 hover:bg-[var(--color-amber)]/10'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PASSO 2: Bloco Associado */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xxs text-[var(--color-amber)] opacity-85 uppercase block tracking-wider font-extrabold flex items-center gap-1.5">
                    <span className="bg-[var(--color-amber)]/20 text-[var(--color-amber)] px-1 py-0.5 rounded text-[8px]">02</span> Bloco Associado
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      clickFeedback();
                      setCustomBlockMode(!customBlockMode);
                    }}
                    className="text-[9px] text-[#00e5ff] hover:underline cursor-pointer uppercase font-mono font-bold"
                  >
                    {customBlockMode ? "[ Selecionar da Lista ]" : "[ Digitar Nome Livre ]"}
                  </button>
                </div>

                {customBlockMode ? (
                  <div className="space-y-1">
                    <input
                      type="text"
                      required
                      placeholder="Ex: Estudos, Física, Revisão..."
                      value={selectedBlockName}
                      onChange={(e) => setSelectedBlockName(e.target.value)}
                      className="w-full bg-[#0d0b09] border border-[var(--color-amber)]/45 focus:border-[var(--color-amber)] px-3 py-2 text-xs text-[var(--color-amber)] focus:outline-none rounded font-mono"
                    />
                    <p className="text-[9px] text-[var(--color-amber)]/50 italic font-mono leading-tight">
                      *Digite o nome exato do bloco na sua agenda física. Não precisa existir em comum ainda.
                    </p>
                  </div>
                ) : selectedDays.length === 0 ? (
                  <div className="p-2 border border-dashed border-[var(--color-amber)]/25 text-[10px] text-[var(--color-amber)]/65 bg-[#0d0b09]/20 italic rounded font-mono">
                    Selecione os dias da semana acima para listar as opções.
                  </div>
                ) : (
                  <select
                    required
                    value={selectedBlockName}
                    onChange={(e) => setSelectedBlockName(e.target.value)}
                    className="w-full bg-[#0d0b09] border border-[var(--color-amber)]/45 focus:border-[var(--color-amber)] px-3 py-2 text-xs text-[var(--color-amber)] focus:outline-none rounded"
                  >
                    <option value="" disabled>-- Selecione o Bloco --</option>
                    {commonBlocks.length > 0 && (
                      <optgroup label="Blocos em Comum nos Dias Selecionados">
                        {commonBlocks.map(name => (
                          <option key={`common-${name}`} value={name}>{name}</option>
                        ))}
                      </optgroup>
                    )}
                    {Array.from(new Set(agendaBlocks.map(b => b.name.trim()))).filter(name => !commonBlocks.includes(name)).length > 0 && (
                      <optgroup label="Outros Blocos Encontrados na Agenda">
                        {Array.from(new Set(agendaBlocks.map(b => b.name.trim())))
                          .filter(name => !commonBlocks.includes(name))
                          .sort()
                          .map(name => (
                            <option key={`other-${name}`} value={name}>{name}</option>
                          ))}
                      </optgroup>
                    )}
                  </select>
                )}
              </div>

              {/* PASSO 4: Definir Título */}
              <div className="space-y-1.5">
                <label className="text-xxs text-[var(--color-amber)] opacity-85 uppercase block tracking-wider font-extrabold flex items-center gap-1.5">
                  <span className="bg-[var(--color-amber)]/20 text-[var(--color-amber)] px-1 py-0.5 rounded text-[8px]">03</span> Título da Pendência
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  placeholder="Ex: Lista de Exercícios 03, Revisão Aula 12..."
                  value={planningTitle}
                  onChange={(e) => setPlanningTitle(e.target.value)}
                  className="w-full bg-[#0d0b09] border border-[var(--color-amber)]/45 focus:border-[var(--color-amber)] px-3 py-2 text-xs text-[var(--color-amber)] placeholder-[var(--color-amber)]/30 focus:outline-none rounded"
                />
                {/* Quick Title Tags */}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {["Aula", "Lista de Exercícios", "PDF", "Revisão", "Correção", "Simulado"].map(q => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        clickFeedback();
                        setPlanningTitle(q);
                      }}
                      className="px-2 py-0.5 border border-[var(--color-amber)]/10 hover:border-[var(--color-amber)]/40 text-[9px] font-mono text-[var(--color-amber)]/70 rounded cursor-pointer hover:bg-[var(--color-amber)]/5 transition-all"
                    >
                      +{q}
                    </button>
                  ))}
                </div>
              </div>

              {/* PASSO 5: Perguntar se exige Link */}
              <div className="space-y-2 border-t border-[var(--color-amber)]/10 pt-3">
                <label className="text-xxs text-[var(--color-amber)] opacity-85 uppercase block tracking-wider font-extrabold font-mono">
                  Exige Link de Apoio para conclusão?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      clickFeedback();
                      setRequiresLink(true);
                    }}
                    className={`p-2 border text-xxs font-extrabold flex items-center justify-center gap-1.5 rounded-lg cursor-pointer transition-all ${
                      requiresLink 
                        ? 'border-[var(--color-amber)] bg-[var(--color-amber)]/15 text-[var(--color-amber)]' 
                        : 'border-[var(--color-amber)]/15 text-[var(--color-amber)]/50 hover:bg-[var(--color-amber)]/5'
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5" /> SIM (Navega Imaculada)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clickFeedback();
                      setRequiresLink(false);
                    }}
                    className={`p-2 border text-xxs font-extrabold flex items-center justify-center gap-1.5 rounded-lg cursor-pointer transition-all ${
                      !requiresLink 
                        ? 'border-[var(--color-amber)] bg-[var(--color-amber)]/15 text-[var(--color-amber)]' 
                        : 'border-[var(--color-amber)]/15 text-[var(--color-amber)]/50 hover:bg-[var(--color-amber)]/5'
                    }`}
                  >
                    <Square className="w-3.5 h-3.5" /> NÃO (Direto p/ Estudo)
                  </button>
                </div>
                <p className="text-[9px] text-[var(--color-amber)]/55 italic leading-relaxed font-mono">
                  {requiresLink 
                    ? "Nasce nula (IMACULADA), aparecendo em todos os horários. Vira Estudo (PREPARADA) ao preencher o Link." 
                    : "Nasce cadastrada diretamente no bloco e dias correspondentes sem passar p/ estado imaculado."}
                </p>
              </div>

              <button
                type="submit"
                className="w-full mt-4 py-2 border bg-[var(--color-amber)] text-black font-extrabold text-xs hover:bg-[#ffd19a] uppercase rounded flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {editPlanningId ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {editPlanningId ? 'Atualizar Item de Planejamento' : 'Alinhar Nova Malha'}
              </button>
            </form>
          </div>

          {/* COLUNA DIREITA: LISTAGEM E OPERAÇÕES CRUD COMPLETO (xl:col-span-7) */}
          <div className="space-y-4 xl:col-span-7 border border-[var(--color-amber)]/15 p-4 rounded-lg bg-[#0d0b09]/30 flex flex-col justify-between">
            <div className="border-b border-[var(--color-amber)]/10 pb-2 text-[10px] text-[var(--color-amber)] tracking-wider uppercase font-extrabold flex justify-between items-center font-mono">
              <span>» REGISTROS DE PENDÊNCIAS CARREGADOS ({planningTodos.length})</span>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[360px] flex-1 pr-1 font-mono">
              {planningTodos.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center border border-dashed border-[var(--color-amber)]/15 rounded-lg text-center p-4">
                  <Info className="w-8 h-8 text-[var(--color-amber)]/35 mb-2" />
                  <p className="text-xs text-[var(--color-amber)] uppercase font-extrabold mb-1">Órbita Limpa</p>
                  <p className="text-[9px] text-[var(--color-amber)]/50 max-w-[280px]">Nenhuma regra pendente cadastrada. Suas pendências de planejamento aparecerão aqui.</p>
                </div>
              ) : (
                planningTodos.map((item) => {
                  const formattedDays = item.days_of_week
                    .map(d => ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'][d])
                    .join(' • ');

                  const isImmaculate = item.requires_link && !item.link;

                  return (
                    <div 
                      key={item.id} 
                      className={`border p-2.5 text-xs rounded-lg transition-all rounded bg-[#0d0b09]/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
                        !item.active 
                          ? 'border-[var(--color-amber)]/10 opacity-40' 
                          : isImmaculate 
                            ? 'border-rose-900/40 bg-rose-950/10 hover:border-rose-800' 
                            : 'border-[var(--color-amber)]/20 hover:border-[var(--color-amber)]/45'
                      }`}
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`text-[8px] font-mono font-bold uppercase px-1 py-0.5 rounded ${
                            isImmaculate 
                              ? 'bg-rose-950 text-rose-400 border border-rose-900/50' 
                              : 'bg-emerald-950 text-emerald-400 border border-emerald-900/50'
                          }`}>
                            {isImmaculate ? 'IMACULADA' : 'PREPARADA'}
                          </span>
                          {!item.active && (
                            <span className="text-[8px] font-mono bg-stone-900 text-stone-500 border border-stone-800/55 px-1 py-0.5 rounded font-bold">
                              SLEEP
                            </span>
                          )}
                          <span className="text-[9px] text-[var(--color-amber)] opacity-60">
                            [{formattedDays}]
                          </span>
                          <span className="text-[9px] font-extrabold text-[#00e5ff]">
                            @{item.block_name}
                          </span>
                        </div>

                        <h4 className="font-bold text-xs truncate text-[var(--color-amber)]/90" title={item.title}>
                          {item.title}
                        </h4>

                        {item.requires_link ? (
                          <div className="flex items-center gap-1 text-[10px]">
                            <LinkIcon className="w-3 h-3 text-[var(--color-amber)] opacity-50" />
                            {item.link ? (
                              <a 
                                href={item.link} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-[9px] text-emerald-400 hover:underline font-mono truncate max-w-[200px]"
                              >
                                {item.link}
                              </a>
                            ) : (
                              <span className="text-[9px] text-rose-400 font-mono italic">
                                [Pendente - Imaculada]
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="text-[9px] text-[var(--color-amber)]/50 font-mono italic">
                            [Sem link obrigatório]
                          </div>
                        )}
                      </div>

                      {/* AÇÕES DE LINHA */}
                      <div className="flex items-center gap-1 sm:w-auto w-full justify-end border-t sm:border-t-0 border-[var(--color-amber)]/10 pt-1.5 sm:pt-0">
                        <button
                          type="button"
                          onClick={() => handleToggleActivePlanningTodo(item)}
                          className={`p-1 border rounded transition-all cursor-pointer ${
                            item.active 
                              ? 'border-emerald-900 text-emerald-400 hover:bg-emerald-950/20' 
                              : 'border-stone-800 text-stone-500 hover:bg-stone-950/20'
                          }`}
                          title={item.active ? 'Suspender Item' : 'Habilitar Item'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleEditPlanningTodoInit(item)}
                          className="p-1 border border-[var(--color-amber)]/20 text-[var(--color-amber)] hover:bg-[var(--color-amber)]/10 transition-all rounded cursor-pointer"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDuplicatePlanningTodo(item)}
                          className="p-1 border border-indigo-900 text-indigo-400 hover:bg-indigo-950/20 transition-all rounded cursor-pointer"
                          title="Duplicar"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeletePlanningTodo(item.id, item.title)}
                          className="p-1 border border-rose-900 text-rose-400 hover:bg-rose-950/25 transition-all rounded cursor-pointer"
                          title="Remover"
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
      </div>

      {/* ========================================================= */}
      {/* SEÇÃO INTEGRAL: FONTES DE DADOS EXTERNAS (SINC_EXT)       */}
      {/* ========================================================= */}
      <div className={`border-2 p-6 rounded-xl space-y-4 mt-6 ${bgStyle} ${borderStyle}`}>
        <div className="border-b border-[var(--color-amber)]/35 pb-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h2 className={`text-xs uppercase tracking-widest font-extrabold flex items-center gap-2 ${textStyle}`}>
              <Database className="w-4 h-4 animate-pulse text-[var(--color-amber)]" /> [ ASSOCIAÇÃO DE FONTES DE DADOS SUPABASE DE CLIENTES ]
            </h2>
            <p className="text-[10px] text-[var(--color-amber)]/75 mt-1 font-mono">
              Consolide conexões externas exclusivas Server-Side. Tarefas dos clientes serão extraídas e unificadas sem expor credenciais ao navegador.
            </p>
          </div>
          <button
            type="button"
            disabled={isSyncing || externalSources.length === 0}
            onClick={handleSyncNow}
            className={`px-4 py-2 border font-mono font-bold text-xxs uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer select-none ${
              isSyncing 
                ? 'border-yellow-700 text-yellow-450 bg-yellow-950/20' 
                : externalSources.length === 0
                  ? 'border-stone-800 text-stone-600 cursor-not-allowed opacity-50 bg-black/10'
                  : 'border-[#00e5ff] text-[#00e5ff] hover:bg-[#00e5ff]/10'
            }`}
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
          </button>
        </div>

        {syncFeedback.status !== 'idle' && (
          <div className={`p-3 border rounded-lg text-xxs font-mono flex items-start gap-2 ${
            syncFeedback.status === 'loading' 
              ? 'border-yellow-600/30 bg-yellow-950/15 text-yellow-400' 
              : syncFeedback.status === 'success' 
                ? 'border-emerald-600/30 bg-emerald-950/15 text-emerald-400' 
                : 'border-rose-600/30 bg-rose-950/15 text-rose-400'
          }`}>
            <Info className="w-3.5 h-3.5 mt-0.5" />
            <span>{syncFeedback.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 pt-2">
          {/* COLUNA ESQUERDA: CADASTRO/EDIÇÃO */}
          <div className="space-y-4 xl:col-span-5 border border-[var(--color-amber)]/15 p-4 rounded-lg bg-[#0d0b09]/30">
            <div className="border-b border-[var(--color-amber)]/10 pb-2 text-[10px] text-[var(--color-amber)] tracking-wider uppercase font-extrabold flex justify-between items-center font-mono">
              <span>{editSourceId ? '» EDITAR CONEXÃO EXISTENTE' : '» NOVA CONEXÃO CLIENTE (SUPABASE)'}</span>
              {editSourceId && (
                <button 
                  type="button"
                  className="text-[9px] text-rose-400 hover:underline cursor-pointer uppercase font-bold text-rose-450"
                  onClick={() => {
                    clickFeedback();
                    setEditSourceId(null);
                    setSourceName('');
                    setSecretAlias('');
                    setSourceActive(true);
                  }}
                >
                  Cancelar
                </button>
              )}
            </div>

            <form onSubmit={handleSaveExternalSource} className="space-y-4 font-mono">
              <div className="space-y-1.5">
                <label className="text-xxs text-[var(--color-amber)] opacity-85 uppercase block tracking-wider font-extrabold flex items-center gap-1.5">
                  Identificador / Nome do Cliente
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Cliente Alpha, Empreendimento Beta"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  className="w-full bg-[#0d0b09] border border-[var(--color-amber)]/45 focus:border-[var(--color-amber)] px-3 py-2 text-xs text-[var(--color-amber)] placeholder-[var(--color-amber)]/30 focus:outline-none rounded font-mono text-left"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xxs text-[var(--color-amber)] opacity-85 uppercase block tracking-wider font-extrabold flex items-center gap-1.5">
                  Secret Alias para Resolução de Ambiente
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: CELP, CLIENTE_A, CLIENTE_B"
                  value={secretAlias}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '');
                    setSecretAlias(val);
                  }}
                  className="w-full bg-[#0d0b09] border border-[var(--color-amber)]/45 focus:border-[var(--color-amber)] px-3 py-2 text-xs text-[var(--color-amber)] placeholder-[var(--color-amber)]/30 focus:outline-none rounded font-mono text-left"
                />
                <span className="text-[9px] text-[var(--color-amber)]/50 block font-mono">
                  Mapeia para as variáveis de ambiente <code className="text-emerald-400 font-bold">{secretAlias ? `${secretAlias}_SUPABASE_URL` : 'ALIAS_SUPABASE_URL'}</code> e <code className="text-emerald-400 font-bold">{secretAlias ? `${secretAlias}_SUPABASE_KEY` : 'ALIAS_SUPABASE_KEY'}</code> no servidor do Next.js.
                </span>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      clickFeedback();
                      setSourceActive(!sourceActive);
                    }}
                    className="text-[var(--color-amber)] focus:outline-none cursor-pointer"
                  >
                    {sourceActive ? (
                      <ToggleRight className={`w-8 h-8 ${textStyle}`} />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-neutral-600" />
                    )}
                  </button>
                  <div className="text-left font-mono">
                    <span className="text-xxs font-extrabold uppercase tracking-widest block text-[var(--color-amber)]">Status da Ingestão</span>
                    <span className="text-[9px] text-[var(--color-amber)]/60">Sincroniza automaticamente se ativo</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-4 py-2 border bg-[var(--color-amber)] text-black font-extrabold text-xs hover:bg-[#ffd19a] uppercase rounded flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {editSourceId ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {editSourceId ? 'Atualizar Ajuste do Cliente' : 'Acoplar Novo Supabase'}
              </button>
            </form>
          </div>

          {/* COLUNA DIREITA: LISTAGEM E OPERAÇÕES */}
          <div className="space-y-4 xl:col-span-7 border border-[var(--color-amber)]/15 p-4 rounded-lg bg-[#0d0b09]/30 flex flex-col justify-between relative min-h-[350px]">
            {/* Custom confirmation deletion overlay modal so we NEVER use confirm() or alert() */}
            {showDeleteModalId && (
              <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 text-center font-mono rounded">
                <div className="border border-rose-900/60 bg-rose-950/20 p-5 rounded-xl max-w-sm space-y-4">
                  <ShieldAlert className="w-10 h-10 text-rose-500 animate-pulse mx-auto" />
                  <div className="space-y-1">
                    <h3 className="text-rose-400 font-extrabold text-xs uppercase tracking-wider">APAGAR CONEXÃO DE CLIENTE?</h3>
                    <p className="text-[9px] text-rose-400/80 leading-relaxed">
                      Esta ação removerá a credencial de segurança de <span className="font-bold underline text-white">
                        {externalSources.find(s => s.id === showDeleteModalId)?.name || 'Fonte'}
                      </span> do TVA. Históricos e conexões associadas serão permanentemente removidos.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        clickFeedback();
                        setShowDeleteModalId(null);
                      }}
                      className="py-1.5 border border-stone-800 text-stone-400 hover:bg-stone-900 rounded text-xxs font-extrabold uppercase transition-all cursor-pointer"
                    >
                      Voltar (Abortar)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const target = externalSources.find(s => s.id === showDeleteModalId);
                        if (target) handleDeleteExternalSource(target.id, target.name);
                      }}
                      className="py-1.5 border border-rose-900 bg-rose-950/20 text-rose-300 hover:bg-rose-900 hover:text-white rounded text-xxs font-extrabold uppercase transition-all cursor-pointer"
                    >
                      Confirmar Remoção
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="border-b border-[var(--color-amber)]/10 pb-2 text-[10px] text-[var(--color-amber)] tracking-wider uppercase font-extrabold flex justify-between items-center font-mono">
              <span>» CLIENTES EXTERNOS ACOPLADOS ({externalSources.length})</span>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[300px] flex-1 pr-1 font-mono">
              {externalSources.length === 0 ? (
                <div className="h-56 flex flex-col items-center justify-center border border-dashed border-[var(--color-amber)]/15 rounded-lg text-center p-4">
                  <Server className="w-8 h-8 text-[var(--color-amber)]/35 mb-2" />
                  <p className="text-xs text-[var(--color-amber)] uppercase font-extrabold mb-1">Mesa Coletora Limpa</p>
                  <p className="text-[9px] text-[var(--color-amber)]/50 max-w-[280px]">Nenhum Supabase externo acoplado. Use o painel à esquerda para cadastrar dados obtidos de seus clientes.</p>
                </div>
              ) : (
                externalSources.map((src) => {
                  return (
                    <div 
                      key={src.id} 
                      className={`border p-3 text-xs rounded-lg transition-all rounded bg-[#0d0b09]/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
                        !src.active 
                          ? 'border-[var(--color-amber)]/10 opacity-40' 
                          : 'border-[var(--color-amber)]/20 hover:border-[var(--color-amber)]/45'
                      }`}
                    >
                      <div className="space-y-1 flex-1 min-w-0 text-left">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`text-[8px] font-mono font-bold uppercase px-1 py-0.5 rounded ${
                            src.active 
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' 
                              : 'bg-stone-900 text-stone-500 border border-stone-800'
                          }`}>
                            {src.active ? 'MUTUAL ONLINE' : 'DETACHED'}
                          </span>
                        </div>

                        <h4 className="font-bold text-xs truncate text-[var(--color-amber)]/90" title={src.name}>
                          {src.name}
                        </h4>

                        <div className="text-[9px] text-[var(--color-amber)]/60 font-mono truncate" title={src.secret_alias}>
                          Alias: <code className="text-emerald-400 font-bold">{src.secret_alias}</code>
                        </div>

                        <div className="text-[9px] text-[#00e5ff] font-mono">
                          Último Sync: {src.last_synced_at ? new Date(src.last_synced_at).toLocaleString('pt-BR') : 'Nunca sincronizado'}
                        </div>
                      </div>

                      {/* AÇÕES */}
                      <div className="flex items-center gap-1.5 sm:w-auto w-full justify-end border-t sm:border-t-0 border-[var(--color-amber)]/10 pt-1.5 sm:pt-0 font-mono">
                        <button
                          type="button"
                          onClick={() => handleEditExternalSourceInit(src)}
                          className="p-1.5 border border-[var(--color-amber)]/20 text-[var(--color-amber)] hover:bg-[var(--color-amber)]/10 transition-all rounded cursor-pointer"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            clickFeedback();
                            setShowDeleteModalId(src.id);
                          }}
                          className="p-1.5 border border-rose-900 text-rose-450 hover:bg-rose-955/25 transition-all rounded cursor-pointer"
                          title="Remover"
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

        {/* ========================================================= */}
        {/* SEÇÃO ADICIONAL: MAPEAMENTO TVA (ETAPA 4)                 */}
        {/* ========================================================= */}
        <div className="border-t border-[var(--color-amber)]/15 pt-6 space-y-4">
          <div>
            <h3 className="text-xs uppercase font-extrabold tracking-widest flex items-center gap-2 text-[var(--color-amber)]">
              <LinkIcon className="w-4 h-4 text-[#00e5ff] animate-pulse" /> [ MAPEAMENTO DE FONTES EXTERNAS PARA OS NATIVOS DO TVA ]
            </h3>
            <p className="text-[10px] text-[var(--color-amber)]/60 font-mono mt-1">
              Defina o destino definitivo de cada fonte externa cadastrada acima dentro da árvore organizacional do seu TVA. Fontes sem mapeamento serão omitidas para proteger a integridade do sistema nativo.
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* CRIAR MAPEAMENTO */}
            <form onSubmit={handleSaveMapping} className="xl:col-span-5 p-4 border border-[var(--color-amber)]/10 bg-black/15 rounded-lg space-y-3 font-mono">
              <span className="text-[9px] font-black uppercase text-[var(--color-amber)] block border-b border-[var(--color-amber)]/10 pb-1.5 mb-2">
                » CONECTAR OU EDITAR DIRECIONAMENTO
              </span>

              <div className="space-y-1 text-left">
                <label className="text-[9px] uppercase font-bold text-[var(--color-amber)]/80 block">Selecione Fonte Externa</label>
                <select
                  value={mappingSourceId}
                  onChange={(e) => {
                    clickFeedback();
                    setMappingSourceId(e.target.value);
                  }}
                  className="w-full bg-[#050403] border border-[var(--color-amber)]/25 text-xs text-[var(--color-amber)] px-2.5 py-1.5 focus:outline-none focus:border-[#00e5ff] rounded"
                  required
                >
                  <option value="">-- SELECIONE FONTES DISPONÍVEIS --</option>
                  {externalSources.map(s => (
                    <option key={s.id} value={s.id}>{s.name} {s.active ? '' : '(INATIVA)'}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 text-left">
                  <label className="text-[9px] uppercase font-bold text-[var(--color-amber)]/80 block">Grupo TVA Destino</label>
                  <select
                    value={mappingGroupId}
                    onChange={(e) => {
                      clickFeedback();
                      setMappingGroupId(e.target.value);
                      setMappingCategoryId(''); // Reset categories
                    }}
                    className="w-full bg-[#050403] border border-[var(--color-amber)]/25 text-xs text-[var(--color-amber)] px-2.5 py-1.5 focus:outline-none focus:border-[#00e5ff] rounded"
                    required
                  >
                    <option value="">-- SELECIONE GRUPO --</option>
                    {db.getGroups().map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1 text-left">
                  <label className="text-[9px] uppercase font-bold text-[var(--color-amber)]/80 block">Categoria TVA Destino</label>
                  <select
                    value={mappingCategoryId}
                    onChange={(e) => {
                      clickFeedback();
                      setMappingCategoryId(e.target.value);
                    }}
                    className="w-full bg-[#050403] border border-[var(--color-amber)]/25 text-xs text-[var(--color-amber)] px-2.5 py-1.5 focus:outline-none focus:border-[#00e5ff] rounded"
                    disabled={!mappingGroupId}
                    required
                  >
                    <option value="">-- SELECIONE CATEGORIA --</option>
                    {db.getCategories()
                      .filter(c => c.group_id === mappingGroupId)
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))
                    }
                  </select>
                </div>
              </div>

              <div className="space-y-1 text-left">
                <label className="text-[9px] uppercase font-bold text-[var(--color-amber)]/80 block">Bloco Diário / Semanal Destino (Opcional)</label>
                <select
                  value={mappingBlockId}
                  onChange={(e) => {
                    clickFeedback();
                    setMappingBlockId(e.target.value);
                  }}
                  className="w-full bg-[#050403] border border-[var(--color-amber)]/25 text-xs text-[var(--color-amber)] px-2.5 py-1.5 focus:outline-none focus:border-[#00e5ff] rounded"
                >
                  <option value="">-- SEM MAPEAMENTO DE BLOCO (APENAS FOCO) --</option>
                  {db.getAgendaBlocks().map(b => (
                    <option key={b.id} value={b.id}>
                      {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'][b.day_of_week]} - {b.start_time} - {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={isSavingMapping}
                className="w-full mt-2 py-2 border border-[#00e5ff]/40 bg-black text-[#00e5ff] hover:bg-[#00e5ff]/20 font-extrabold text-xs uppercase rounded flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                {isSavingMapping ? 'Gravando Mapeamento...' : 'Vincular Destinação TVA'}
              </button>
            </form>

            {/* LISTAGEM DE MAPEAMENTOS ATIVOS */}
            <div className="xl:col-span-7 p-4 border border-[var(--color-amber)]/10 bg-black/15 rounded-lg space-y-2 font-mono">
              <span className="text-[9px] font-black uppercase text-[var(--color-amber)] block border-b border-[var(--color-amber)]/10 pb-1.5 mb-2">
                » DIRECIONAMENTOS ATIVOS ({sourceMappings.length})
              </span>

              <div className="space-y-2 overflow-y-auto max-h-[250px] pr-1">
                {sourceMappings.length === 0 ? (
                  <div className="h-44 border border-dashed border-[var(--color-amber)]/5 flex flex-col items-center justify-center text-center p-3">
                    <LinkIcon className="w-6 h-6 text-[var(--color-amber)]/20 mb-1" />
                    <p className="text-[10px] text-[var(--color-amber)]/55 uppercase font-bold">Nenhum Mapeamento Vinculado</p>
                    <p className="text-[8px] text-[var(--color-amber)]/40 max-w-[250px]">Atrele canais a categorias e blocos à esquerda para habilitar o sincronismo operacional.</p>
                  </div>
                ) : (
                  sourceMappings.map((m) => {
                    const source = externalSources.find(s => s.id === m.source_id);
                    const group = db.getGroups().find(g => g.id === m.target_group_id);
                    const category = db.getCategories().find(c => c.id === m.target_category_id);
                    const block = db.getAgendaBlocks().find(b => b.id === m.default_block_id);

                    return (
                      <div key={m.id} className="border border-[var(--color-amber)]/10 p-2.5 rounded bg-black/30 flex items-center justify-between gap-3 text-[10px]">
                        <div className="space-y-1 flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold uppercase text-[#00e5ff] text-xs">
                              {source?.name || 'Mapeamento Desconhecido'}
                            </span>
                          </div>
                          <div className="text-[9px] text-[var(--color-amber)]/70 leading-normal">
                            GRUPO: <span className="font-bold text-white uppercase">{group?.name || 'Desconhecido'}</span> 
                            {' | '} CATEGORIA: <span className="font-bold text-white uppercase">{category?.name || 'Desconhecida'}</span>
                          </div>
                          {block && (
                            <div className="text-[8.5px] text-[#24f2b6]">
                              BLOCO: <span className="uppercase font-bold">{block.name}</span> ({['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'][block.day_of_week]} às {block.start_time})
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteMapping(m.id)}
                          className="p-1 border border-rose-950 text-rose-450 hover:bg-rose-950/20 rounded cursor-pointer transition-colors"
                          title="Remover Mapeamento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
