import { create } from 'zustand';
import { db, Task, PomodoroPreset, DailyStatistics, Settings, SystemTerminalLog, TaskPeriod } from '@/lib/db';
import { sounds } from '@/lib/sounds';

interface ProductivityState {
  tasks: Task[];
  presets: PomodoroPreset[];
  periods: TaskPeriod[];
  stats: DailyStatistics | null;
  settings: Settings;
  terminalLogs: SystemTerminalLog[];
  
  // Timer state
  timerRunning: boolean;
  timeLeft: number;
  totalDuration: number;
  timerMode: 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';
  currentCycle: number;
  selectedPresetId: string;
  selectedPresetName: string;
  linkedTask: Task | null;
  expandedTask: Task | null;

  // Actions
  refreshData: () => void;
  setTimerRunning: (running: boolean) => void;
  setTimeLeft: (time: number) => void;
  setTimerMode: (mode: 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK') => void;
  setCurrentCycle: (cycle: number) => void;
  setSelectedPresetId: (id: string) => void;
  setLinkedTask: (task: Task | null) => void;
  setExpandedTask: (task: Task | null) => void;
  tick: () => void;
  resetTimer: () => void;
  nextTimerPhase: () => void;
}

export const useProductivityStore = create<ProductivityState>((set, get) => ({
  tasks: [],
  presets: [],
  periods: [],
  stats: null,
  settings: {
    user_id: 'user-default',
    crt_intensity: 0.8,
    glow_intensity: 0.7,
    scanlines_enabled: true,
    sounds_enabled: true,
    notifications_enabled: true,
    theme_mode: 'AMBER',
    updated_at: ''
  },
  terminalLogs: [],

  timerRunning: false,
  timeLeft: 25 * 60,
  totalDuration: 25 * 60,
  timerMode: 'FOCUS',
  currentCycle: 1,
  selectedPresetId: 'preset-standard',
  selectedPresetName: 'Estudo Padrão (25m)',
  linkedTask: null,
  expandedTask: null,

  refreshData: () => {
    set({
      tasks: db.getTasks(),
      presets: db.getPresets(),
      periods: db.getTaskPeriods(),
      stats: db.getStats(),
      settings: db.getSettings(),
      terminalLogs: db.getLogs(),
    });
  },

  setTimerRunning: (running) => {
    set({ timerRunning: running });
  },

  setTimeLeft: (time) => {
    set({ timeLeft: time });
  },

  setTimerMode: (mode) => {
    set({ timerMode: mode });
  },

  setCurrentCycle: (cycle) => {
    set({ currentCycle: cycle });
  },

  setSelectedPresetId: (id) => {
    const presets = get().presets;
    const active = presets.find(p => p.id === id) || db.getPresets().find(p => p.id === id);
    if (active) {
      set({
        selectedPresetId: id,
        selectedPresetName: active.name,
        timerMode: 'FOCUS',
        timeLeft: active.focus_minutes * 60,
        totalDuration: active.focus_minutes * 60,
        timerRunning: false
      });
    }
  },

  setLinkedTask: (task) => {
    set({ linkedTask: task });
  },

  setExpandedTask: (task) => {
    set({ expandedTask: task });
  },

  tick: () => {
    const { timeLeft, timerRunning, timerMode, totalDuration, currentCycle, selectedPresetId, presets, linkedTask } = get();
    if (!timerRunning) return;

    if (timeLeft <= 1) {
      // Finished!
      set({ timerRunning: false });
      const durationMins = Math.round(totalDuration / 60);

      if (timerMode === 'FOCUS') {
        sounds.playAlarmFocusComplete();
        db.addSessionMinutes(durationMins, false);

        if (linkedTask) {
          db.updateTask(linkedTask.id, {
            description: linkedTask.description + `\n[SESSÃO DE FOCO CONCLUÍDA EM 2026: +${durationMins}m]`
          });
          db.addLog(`LINKED TASK CONTEXT: "${linkedTask.title}" UPDATED.`, 'success');
        }

        db.addLog(`CHRONOMETRICAL MILESTONE: FOCUS RUN #${currentCycle} CONCLUÍDO!`, 'success');

        const activePreset = presets.find(p => p.id === selectedPresetId) || db.getPresets()[0];
        const limitBeforeLong = activePreset?.cycles_before_long_break || 4;

        if (currentCycle >= limitBeforeLong) {
          const longSecs = (activePreset?.long_break_minutes || 15) * 60;
          set({
            timerMode: 'LONG_BREAK',
            timeLeft: longSecs,
            totalDuration: longSecs
          });
          db.addLog('SYSTEM TRANSITION: ENTERING COOLDOWN (PAUSA LONGA)', 'warning');
        } else {
          const shortSecs = (activePreset?.short_break_minutes || 5) * 60;
          set({
            timerMode: 'SHORT_BREAK',
            timeLeft: shortSecs,
            totalDuration: shortSecs
          });
          db.addLog('SYSTEM TRANSITION: ENTERING INTERVAL (PAUSA CURTA)', 'warning');
        }
      } else {
        // Break over
        sounds.playAlarmBreak();
        db.addSessionMinutes(durationMins, true);
        db.addLog(`CHRONOMETRICAL MILESTONE: BREAK RUN CONCLUÍDA.`, 'info');

        const nextCycle = timerMode === 'LONG_BREAK' ? 1 : currentCycle + 1;
        const activePreset = presets.find(p => p.id === selectedPresetId) || db.getPresets()[0];
        const focusSec = (activePreset?.focus_minutes || 25) * 60;

        set({
          currentCycle: nextCycle,
          timerMode: 'FOCUS',
          timeLeft: focusSec,
          totalDuration: focusSec
        });
        db.addLog('SYSTEM TRANSITION: READY FOR FOCUS INPUT MATRIX.', 'success');
      }

      // Refresh quantities
      set({
        tasks: db.getTasks(),
        stats: db.getStats()
      });
    } else {
      set({ timeLeft: timeLeft - 1 });
      if ((timeLeft - 1) % 2 === 0) {
        sounds.playTick();
      }
    }
  },

  resetTimer: () => {
    const { selectedPresetId, presets, timerMode } = get();
    const activePreset = presets.find(p => p.id === selectedPresetId) || db.getPresets()[0];
    if (activePreset) {
      let mins = activePreset.focus_minutes;
      if (timerMode === 'SHORT_BREAK') mins = activePreset.short_break_minutes;
      if (timerMode === 'LONG_BREAK') mins = activePreset.long_break_minutes;

      set({
        timeLeft: mins * 60,
        totalDuration: mins * 60,
        timerRunning: false
      });
      db.addLog(`CLOCK STATE RE-CALIBRATED TO: ${mins}M.`, 'info');
    }
  },

  nextTimerPhase: () => {
    const { timerMode, selectedPresetId, presets } = get();
    const activePreset = presets.find(p => p.id === selectedPresetId) || db.getPresets()[0];
    if (!activePreset) return;

    if (timerMode === 'FOCUS') {
      const shortSecs = activePreset.short_break_minutes * 60;
      set({
        timerMode: 'SHORT_BREAK',
        timeLeft: shortSecs,
        totalDuration: shortSecs,
        timerRunning: false
      });
      db.addLog(`DECK CONTROL OVERRIDE -> FORCE SHORT BREAK`, 'warning');
    } else if (timerMode === 'SHORT_BREAK') {
      const longSecs = activePreset.long_break_minutes * 60;
      set({
        timerMode: 'LONG_BREAK',
        timeLeft: longSecs,
        totalDuration: longSecs,
        timerRunning: false
      });
      db.addLog(`DECK CONTROL OVERRIDE -> FORCE LONG BREAK`, 'warning');
    } else {
      const focusSecs = activePreset.focus_minutes * 60;
      set({
        timerMode: 'FOCUS',
        timeLeft: focusSecs,
        totalDuration: focusSecs,
        timerRunning: false
      });
      db.addLog(`DECK CONTROL OVERRIDE -> FORCE FOCUS CYCLE`, 'warning');
    }
  }
}));
