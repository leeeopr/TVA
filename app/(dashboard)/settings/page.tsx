'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Sliders, Plus, Trash2, Power, Terminal, Play, Cpu, ShieldAlert, FileDown, FileUp, Sparkles } from 'lucide-react';
import { useProductivityStore } from '@/stores/productivityStore';
import { useAuthStore } from '@/stores/authStore';
import { sounds } from '@/lib/sounds';
import { db } from '@/lib/db';

export default function SettingsPage() {
  const {
    presets,
    settings,
    refreshData
  } = useProductivityStore();

  const { user, signOut } = useAuthStore();

  const [isClient, setIsClient] = useState(false);

  // Custom Preset forms
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetFocus, setNewPresetFocus] = useState(25);
  const [newPresetShort, setNewPresetShort] = useState(5);
  const [newPresetLong, setNewPresetLong] = useState(15);
  const [newPresetCycles, setNewPresetCycles] = useState(4);

  useEffect(() => {
    const handle = setTimeout(() => {
      setIsClient(true);
    }, 0);
    return () => clearTimeout(handle);
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData, user]);

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
    </motion.div>
  );
}
