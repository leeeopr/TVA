'use client';

import { supabase, isSupabaseConfigured } from './supabase';
import { 
  createTask as createSupabaseTask, 
  updateTask as updateSupabaseTask, 
  deleteTask as deleteSupabaseTask, 
  reorderTasks as reorderSupabaseTasks, 
  mapTaskFromDb
} from './supabase/tasks';

// ==========================================
// RETRO-FUTURISTIC TERMINAL DATABANK ADAPTER
// ==========================================
// No localStorage or sessionStorage allowed for Task, Group, Category, or Session data!
// Persisted 100% in Supabase Cloud if authenticated, or falls back to in-memory secure RAM cycles.

export interface Profile {
  id: string;
  email: string;
  username: string;
  avatar_url: string;
  created_at: string;
}

export interface TaskGroup {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string; // e.g., 'blue', 'purple', 'green', 'red', 'yellow', 'cyan', 'orange'
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TaskCategory {
  id: string;
  user_id: string;
  group_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  group_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null; // ISO Date String
  urgency_level: 'low' | 'moderate' | 'urgent' | 'overdue';
  is_completed: boolean;
  completed_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  
  // Dynamic joins/resolved for UI mapping:
  group_name?: string;
  group_color?: string;
  category_name?: string;
}

export interface PomodoroPreset {
  id: string;
  user_id: string;
  name: string;
  focus_minutes: number;
  short_break_minutes: number;
  long_break_minutes: number;
  cycles_before_long_break: number;
  created_at: string;
}

export interface PomodoroSession {
  id: string;
  user_id: string;
  task_id: string | null;
  mode: string; // 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK'
  focus_minutes: number;
  break_minutes: number;
  started_at: string;
  ended_at: string | null;
  completed: boolean;
}

export interface DailyStatistics {
  id: string;
  user_id: string;
  total_focus_minutes: number;
  total_break_minutes: number;
  completed_tasks: number;
  date: string;
}

export interface Settings {
  user_id: string;
  crt_intensity: number;
  glow_intensity: number;
  scanlines_enabled: boolean;
  sounds_enabled: boolean;
  notifications_enabled: boolean;
  theme_mode: 'AMBER' | 'GREEN' | 'COBALT';
  updated_at: string;
}

export interface SystemTerminalLog {
  id: string;
  timestamp: string;
  text: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'system';
}

// Global RAM fallbacks for total offline operation (No LocalStorage caching of sensitive logs)

const INITIAL_SETTINGS: Settings = {
  user_id: 'user-default',
  crt_intensity: 0.8,
  glow_intensity: 0.7,
  scanlines_enabled: true,
  sounds_enabled: true,
  notifications_enabled: true,
  theme_mode: 'AMBER',
  updated_at: new Date().toISOString()
};

const generateUUID = (): string => {
  if (typeof window !== 'undefined' && typeof window.crypto !== 'undefined' && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export class db {
  private static logs: SystemTerminalLog[] = [];
  private static subscribers: ((logs: SystemTerminalLog[]) => void)[] = [];
  private static cachedUserId: string = 'user-default';
  private static sessionInitialized: boolean = false;
  private static dataRefreshListeners: (() => void)[] = [];
  private static isPulling: boolean = false;
  private static pullError: string | null = null;
  private static colorNameToId: Record<string, string> = {};
  private static colorIdToName: Record<string, string> = {};

  static isLoading(): boolean {
    return this.isPulling;
  }

  static getSyncError(): string | null {
    return this.pullError;
  }

  static async loadCustomColors() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('custom_colors').select('*');
      if (error) {
        this.addLog(`COLOR_SYNC_ERR: COULD NOT FETCH COLOR MAP: ${error.message}`, 'error');
        return;
      }
      if (data) {
        const nameToId: Record<string, string> = {};
        const idToName: Record<string, string> = {};
        data.forEach((c: any) => {
          nameToId[c.name] = c.id;
          idToName[c.id] = c.name;
        });
        this.colorNameToId = nameToId;
        this.colorIdToName = idToName;
        this.addLog(`COLOR_SYNC: ${data.length} COLOR CORRELATIONS COMPILED.`, 'success');
      }
    } catch (err: any) {
      this.addLog(`COLOR_SYNC_CATASTROPHE: ${err.message || err}`, 'error');
    }
  }

  static async retrySync() {
    this.isPulling = true;
    this.pullError = null;
    this.triggerDataRefreshCallbacks();
    await this.pullFromSupabase();
  }

  // Active in-memory arrays (ram fallback when supabase unconfigured/offline)
  private static ramGroups: TaskGroup[] = [];
  private static ramCategories: TaskCategory[] = [];
  private static ramTasks: Task[] = [];
  private static ramSessions: PomodoroSession[] = [];
  private static ramPresets: PomodoroPreset[] = [];

  // Terminal logging
  static addLog(text: string, type: 'info' | 'success' | 'warning' | 'error' | 'system' = 'info') {
    const time = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    const newLog: SystemTerminalLog = {
      id: Math.random().toString(),
      timestamp: time,
      text,
      type
    };
    this.logs = [newLog, ...this.logs].slice(0, 50);
    this.subscribers.forEach(cb => cb(this.logs));
  }

  static subscribeLogs(callback: (logs: SystemTerminalLog[]) => void) {
    this.subscribers.push(callback);
    callback(this.logs);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  static getLogs() {
    return this.logs;
  }

  static isSupabaseBound(): boolean {
    return isSupabaseConfigured();
  }

  static getUserId(): string {
    return this.cachedUserId;
  }

  static subscribeDataRefresh(callback: () => void) {
    this.dataRefreshListeners.push(callback);
    return () => {
      this.dataRefreshListeners = this.dataRefreshListeners.filter(cb => cb !== callback);
    };
  }

  private static triggerDataRefreshCallbacks() {
    this.dataRefreshListeners.forEach(cb => cb());
  }

  private static realtimeChannel: any = null;

  static initRealtime() {
    if (typeof window === 'undefined' || !supabase || this.cachedUserId === 'user-default') return;
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
    }

    this.realtimeChannel = supabase
      .channel('tasks-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => {
          this.pullFromSupabase();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_groups' },
        () => {
          this.pullFromSupabase();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_categories' },
        () => {
          this.pullFromSupabase();
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          this.addLog('REALTIME: SYNC CONNECTIONS ONLINE.', 'success');
        }
      });
  }

  static initAuth() {
    if (typeof window === 'undefined' || !supabase || this.sessionInitialized) return;
    this.sessionInitialized = true;

    supabase.auth.getSession().then((res: any) => {
      const session = res.data?.session;
      if (session?.user) {
        this.cachedUserId = session.user.id;
        this.addLog(`AUTH_AGENT: ACTIVE SESSION FOR ${session.user.email?.toUpperCase()}`, 'success');
        this.pullFromSupabase();
        this.initRealtime();
      } else {
        this.cachedUserId = 'user-default';
        this.addLog(`AUTH_AGENT: ANONYMOUS MEMORY MODE.`, 'info');
      }
    });

    supabase.auth.onAuthStateChange((event: any, session: any) => {
      if (session?.user) {
        const email = session.user.email?.toUpperCase();
        this.cachedUserId = session.user.id;
        this.addLog(`AUTH_AGENT: COGNITIVE UPLINK -> ${email}`, 'success');
        this.pullFromSupabase();
        this.initRealtime();
      } else {
        this.cachedUserId = 'user-default';
        if (this.realtimeChannel) {
          supabase.removeChannel(this.realtimeChannel);
          this.realtimeChannel = null;
        }
        this.addLog(`AUTH_AGENT: DISCONNECTED FROM CLOUD SYNC.`, 'warning');
        this.triggerDataRefreshCallbacks();
      }
    });
  }

  // Calculate task automatic urgency rating
  static calculateUrgency(dueDateStr: string | null): 'low' | 'moderate' | 'urgent' | 'overdue' {
    if (!dueDateStr) return 'low';
    const now = new Date();
    // Neutralize hours for accurate day-level alignment
    now.setHours(0, 0, 0, 0);

    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);

    const diffMs = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'overdue';
    if (diffDays <= 3) return 'urgent';
    if (diffDays <= 5) return 'moderate';
    return 'low';
  }

  // Pull records from Supabase into active cached tracks, with zero localStorage fallback for tasks
  static async pullFromSupabase() {
    if (!supabase || this.cachedUserId === 'user-default') {
      this.isPulling = false;
      this.pullError = null;
      return;
    }

    this.isPulling = true;
    this.pullError = null;
    this.addLog('CLOUD_SYNC: ACQUIRING SUPABASE STORAGE ARCHIVES...', 'system');

    try {
      // 1. Settings
      const { data: settingsData, error: settingsErr } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', this.cachedUserId)
        .single();
      
      if (!settingsErr && settingsData) {
        localStorage.setItem('RETRO_OS_settings', JSON.stringify(settingsData));
        this.addLog('CLOUD_SYNC: MASTER SETTINGS PULLED.', 'success');
      } else if (settingsErr && settingsErr.code === 'PGRST116') {
        const payload = {
          ...INITIAL_SETTINGS,
          user_id: this.cachedUserId
        };
        await supabase.from('settings').upsert(payload);
        this.addLog('CLOUD_SYNC: DEPOSITED INITIAL OPTIONS SCHEMATIC.', 'success');
      }

      // 2. Fetch presets
      const { data: presetsData, error: presetsErr } = await supabase
        .from('pomodoro_presets')
        .select('*')
        .eq('user_id', this.cachedUserId)
        .order('created_at', { ascending: true });
      if (!presetsErr && presetsData) {
        this.ramPresets = presetsData;
      }

      // 3. Reconcile Color Map
      await this.loadCustomColors();

      // 4. Fetch Task Groups with colors and categories
      const { data: groupsData, error: groupsErr } = await supabase
        .from('task_groups')
        .select(`
          *,
          color:custom_colors(*),
          categories:task_categories(
            *,
            color:custom_colors(*)
          )
        `)
        .eq('user_id', this.cachedUserId)
        .order('position', { ascending: true });
      
      if (groupsErr) throw groupsErr;

      if (groupsData) {
        this.ramGroups = groupsData.map((g: any) => ({
          id: g.id,
          user_id: g.user_id,
          name: g.name,
          description: g.description,
          color: g.color?.name || 'blue',
          position: g.position ?? 0,
          created_at: g.created_at,
          updated_at: g.updated_at
        }));

        const allCategories: TaskCategory[] = [];
        groupsData.forEach((g: any) => {
          if (Array.isArray(g.categories)) {
            const sortedCats = [...g.categories].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
            sortedCats.forEach((c: any) => {
              allCategories.push({
                id: c.id,
                user_id: c.user_id,
                group_id: c.group_id,
                name: c.name,
                color: c.color?.name || 'cyan',
                created_at: c.created_at
              });
            });
          }
        });

        this.ramCategories = allCategories;
        this.addLog(`CLOUD_SYNC: ${groupsData.length} TASK GROUPS SYNCHRONIZED RELATIONAL.`, 'success');
      }

      // 5. Fetch Tasks
      const { data: tasksData, error: tasksErr } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', this.cachedUserId)
        .order('position', { ascending: true });

      if (!tasksErr && tasksData) {
        this.ramTasks = (tasksData as any[]).map(t => {
          const mapped = mapTaskFromDb(t);
          return {
            ...mapped,
            urgency_level: mapped.is_completed ? 'low' : this.calculateUrgency(mapped.due_date)
          };
        });
        this.addLog(`CLOUD_SYNC: ${tasksData.length} INTEGRATED TASKS POSITIONED IN RAM.`, 'success');
      }

      // 6. Fetch Pomodoro Sessions
      const { data: sData, error: sErr } = await supabase
        .from('pomodoro_sessions')
        .select('*')
        .eq('user_id', this.cachedUserId)
        .order('started_at', { ascending: false });
      
      if (!sErr && sData) {
        this.ramSessions = sData;
      }

      // 7. Today Tally Outpost
      const todayString = new Date().toISOString().split('T')[0];
      const { data: statsData, error: statsErr } = await supabase
        .from('daily_statistics')
        .select('*')
        .eq('user_id', this.cachedUserId)
        .eq('date', todayString)
        .maybeSingle();

      if (!statsErr && statsData) {
        localStorage.setItem(`RETRO_OS_stats_${this.cachedUserId}`, JSON.stringify(statsData));
      }

      this.triggerDataRefreshCallbacks();
    } catch (err: any) {
      const errMsg = err?.message || err || 'Unknown Supabase connection error';
      this.pullError = errMsg;
      this.addLog(`CLOUD_SYNC_ERR: EXPIRED CERTIFICATE OUPUT: ${errMsg}`, 'error');
    } finally {
      this.isPulling = false;
      this.triggerDataRefreshCallbacks();
    }
  }

  // --- SETTINGS ---
  static getSettings(): Settings {
    if (typeof window === 'undefined') return INITIAL_SETTINGS;
    const stored = localStorage.getItem('RETRO_OS_settings');
    if (!stored) return INITIAL_SETTINGS;
    try {
      return JSON.parse(stored);
    } catch {
      return INITIAL_SETTINGS;
    }
  }

  static saveSettings(updated: Partial<Settings>): Settings {
    const fresh = { ...this.getSettings(), ...updated, updated_at: new Date().toISOString() };
    if (typeof window !== 'undefined') {
      localStorage.setItem('RETRO_OS_settings', JSON.stringify(fresh));
    }
    
    if (supabase && this.cachedUserId !== 'user-default') {
      supabase.from('settings').upsert({
        user_id: this.cachedUserId,
        crt_intensity: fresh.crt_intensity,
        glow_intensity: fresh.glow_intensity,
        scanlines_enabled: fresh.scanlines_enabled,
        sounds_enabled: fresh.sounds_enabled,
        notifications_enabled: fresh.notifications_enabled,
        theme_mode: fresh.theme_mode,
      }).then(({ error }: any) => {
        if (error) this.addLog(`CLOUD_WRITE_FAIL: SETTINGS SYNC REJECTED: ${error.message}`, 'error');
      });
    }
    return fresh;
  }

  // --- PRESETS ---
  static getPresets(): PomodoroPreset[] {
    return this.ramPresets;
  }

  static savePreset(name: string, focus: number, short: number, long: number, cycles: number): PomodoroPreset {
    const presetId = generateUUID();
    const newPreset: PomodoroPreset = {
      id: presetId,
      user_id: this.cachedUserId,
      name,
      focus_minutes: focus,
      short_break_minutes: short,
      long_break_minutes: long,
      cycles_before_long_break: cycles,
      created_at: new Date().toISOString()
    };
    
    this.ramPresets.push(newPreset);
    if (supabase && this.cachedUserId !== 'user-default') {
      supabase.from('pomodoro_presets').insert(newPreset).then(({ error }: any) => {
        if (error) this.addLog(`PRESET_FAIL: ${error.message}`, 'error');
      });
    }
    return newPreset;
  }

  static deletePreset(id: string): PomodoroPreset[] {
    this.ramPresets = this.ramPresets.filter(p => p.id !== id);
    if (supabase && this.cachedUserId !== 'user-default') {
      supabase.from('pomodoro_presets').delete().eq('id', id).eq('user_id', this.cachedUserId).then();
    }
    return this.ramPresets;
  }

  // ==========================================
  // TASK GROUPS CRUD
  // ==========================================
  static getGroups(): TaskGroup[] {
    return this.ramGroups.sort((a,b) => a.position - b.position);
  }

  static async saveGroup(name: string, description: string | null, color: string): Promise<TaskGroup> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const errMsg = "Operação bloqueada: Usuário não autenticado no Supabase.";
      this.addLog(`AUTH_ERR: ${errMsg}`, 'error');
      throw new Error(errMsg);
    }
    
    // 1. Resolve custom color mapping
    let colorId = this.colorNameToId[color] || null;
    if (!colorId && Object.keys(this.colorNameToId).length > 0) {
      colorId = Object.values(this.colorNameToId)[0];
    }

    const payload = {
      id: generateUUID(),
      user_id: user.id,
      name,
      description,
      color_id: colorId,
      position: this.ramGroups.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log("USER", user);
    console.log("GROUP PAYLOAD", payload);

    const newGroup: TaskGroup = {
      id: payload.id,
      user_id: payload.user_id,
      name,
      description,
      color,
      position: payload.position,
      created_at: payload.created_at,
      updated_at: payload.updated_at
    };

    this.ramGroups.push(newGroup);
    this.addLog(`GROUP CREATED: [${name}] WITH SYNERGY THEME.`, 'success');

    if (supabase && this.cachedUserId !== 'user-default') {
      const { data, error } = await supabase.from('task_groups').insert(payload).select();
      console.log("SUPABASE RESPONSE", data);
      if (error) {
        console.log("SUPABASE ERROR", error);
        this.addLog(`CLOUD_WRITE_ERR: GROUP RECON FAIL: ${error.message}`, 'error');
        throw error;
      }
    }
    this.triggerDataRefreshCallbacks();
    return newGroup;
  }

  static async updateGroup(id: string, updates: Partial<TaskGroup>): Promise<TaskGroup[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const errMsg = "Operação bloqueada: Usuário não autenticado no Supabase.";
      this.addLog(`AUTH_ERR: ${errMsg}`, 'error');
      throw new Error(errMsg);
    }

    this.ramGroups = this.ramGroups.map(g => {
      if (g.id === id) {
        return { ...g, ...updates, updated_at: new Date().toISOString() };
      }
      return g;
    });

    if (supabase && this.cachedUserId !== 'user-default') {
      const dbPayload: any = { ...updates };
      if (updates.color) {
        dbPayload.color_id = this.colorNameToId[updates.color] || null;
        delete dbPayload.color;
      }
      dbPayload.updated_at = new Date().toISOString();

      console.log("USER", user);
      console.log("GROUP UPDATE PAYLOAD", dbPayload);

      const { data, error } = await supabase
        .from('task_groups')
        .update(dbPayload)
        .eq('id', id)
        .eq('user_id', user.id)
        .select();

      console.log("SUPABASE RESPONSE", data);
      if (error) {
        console.log("SUPABASE ERROR", error);
        this.addLog(`CLOUD_WRITE_ERR: GROUP EDIT FAIL: ${error.message}`, 'error');
        throw error;
      }
    }
    this.triggerDataRefreshCallbacks();
    return this.getGroups();
  }

  static async deleteGroup(id: string): Promise<TaskGroup[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const errMsg = "Operação de exclusão suspensa: Usuário offline.";
      this.addLog(`AUTH_ERR: ${errMsg}`, 'error');
      throw new Error(errMsg);
    }

    this.ramGroups = this.ramGroups.filter(g => g.id !== id);
    this.ramCategories = this.ramCategories.filter(c => c.group_id !== id);
    this.ramTasks = this.ramTasks.filter(t => t.group_id !== id);

    this.addLog(`GROUP SCRUBBED: ID ${id} PURGED FROM STORAGE CELL.`, 'error');

    if (supabase && this.cachedUserId !== 'user-default') {
      const { data, error } = await supabase.from('task_groups').delete().eq('id', id).eq('user_id', user.id).select();
      console.log("SUPABASE DELETE GROUP RESPONSE", data);
      if (error) {
        console.log("SUPABASE DELETE GROUP ERROR", error);
        this.addLog(`CLOUD_WRITE_ERR: GROUP DELETION REJECTED: ${error.message}`, 'error');
        throw error;
      }
    }
    this.triggerDataRefreshCallbacks();
    return this.getGroups();
  }

  static async reorderGroups(reordered: TaskGroup[]): Promise<void> {
    const mapped = reordered.map((g, idx) => ({ ...g, position: idx }));
    this.ramGroups = mapped;

    if (supabase && this.cachedUserId !== 'user-default') {
      const promises = mapped.map(g => 
        supabase.from('task_groups').update({ position: g.position }).eq('id', g.id).eq('user_id', this.cachedUserId)
      );
      await Promise.all(promises);
    }
    this.triggerDataRefreshCallbacks();
  }

  // ==========================================
  // TASK CATEGORIES CRUD
  // ==========================================
  static getCategories(): TaskCategory[] {
    return this.ramCategories;
  }

  static async saveCategory(groupId: string, name: string, color: string | null = null): Promise<TaskCategory> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const errMsg = "Operação bloqueada: Usuário não autenticado no Supabase.";
      this.addLog(`AUTH_ERR: ${errMsg}`, 'error');
      throw new Error(errMsg);
    }

    let colorId = null;
    if (color) {
      colorId = this.colorNameToId[color] || null;
    }

    const payload = {
      id: generateUUID(),
      user_id: user.id,
      group_id: groupId,
      name,
      description: null,
      color_id: colorId,
      position: this.ramCategories.filter(c => c.group_id === groupId).length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log("USER", user);
    console.log("CATEGORY PAYLOAD", payload);

    const newCategory: TaskCategory = {
      id: payload.id,
      user_id: payload.user_id,
      group_id: groupId,
      name,
      color,
      created_at: payload.created_at
    };

    this.ramCategories.push(newCategory);
    this.addLog(`CATEGORY ADDED: [${name}] ASSOCIATED UNDER GROUP ${groupId}`, 'success');

    if (supabase && this.cachedUserId !== 'user-default') {
      const { data, error } = await supabase.from('task_categories').insert(payload).select();
      console.log("SUPABASE RESPONSE", data);
      if (error) {
        console.log("SUPABASE ERROR", error);
        this.addLog(`CLOUD_WRITE_ERR: CATEGORY EXCEPTION: ${error.message}`, 'error');
        throw error;
      }
    }
    this.triggerDataRefreshCallbacks();
    return newCategory;
  }

  static async updateCategory(id: string, updates: Partial<TaskCategory>): Promise<TaskCategory[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const errMsg = "Operação bloqueada: Usuário não autenticado no Supabase.";
      this.addLog(`AUTH_ERR: ${errMsg}`, 'error');
      throw new Error(errMsg);
    }

    this.ramCategories = this.ramCategories.map(c => {
      if (c.id === id) {
        return { ...c, ...updates };
      }
      return c;
    });

    if (supabase && this.cachedUserId !== 'user-default') {
      const dbPayload: any = { ...updates };
      if (updates.color) {
        dbPayload.color_id = this.colorNameToId[updates.color] || null;
        delete dbPayload.color;
      }
      dbPayload.updated_at = new Date().toISOString();

      console.log("USER", user);
      console.log("CATEGORY UPDATE PAYLOAD", dbPayload);

      const { data, error } = await supabase
        .from('task_categories')
        .update(dbPayload)
        .eq('id', id)
        .eq('user_id', user.id)
        .select();

      console.log("SUPABASE RESPONSE", data);
      if (error) {
        console.log("SUPABASE ERROR", error);
        this.addLog(`CLOUD_WRITE_ERR: CATEGORY AMENDMENT REJECTED: ${error.message}`, 'error');
        throw error;
      }
    }
    this.triggerDataRefreshCallbacks();
    return this.getCategories();
  }

  static async deleteCategory(id: string): Promise<TaskCategory[]> {
    this.ramCategories = this.ramCategories.filter(c => c.id !== id);
    // Cascade tasks mapping
    this.ramTasks = this.ramTasks.map(t => {
      if (t.category_id === id) {
        return { ...t, category_id: null };
      }
      return t;
    });

    if (supabase && this.cachedUserId !== 'user-default') {
      const { error } = await supabase.from('task_categories').delete().eq('id', id).eq('user_id', this.cachedUserId);
      if (error) this.addLog(`CLOUD_WRITE_ERR: CATEGORY PURGE REJECTED: ${error.message}`, 'error');
    }
    this.triggerDataRefreshCallbacks();
    return this.getCategories();
  }

  // ==========================================
  // TASKS CRUD
  // ==========================================
  static getTasks(): Task[] {
    // Dynamically calculate urgency on retrieval
    return this.ramTasks.map(t => {
      const groupObj = this.ramGroups.find(g => g.id === t.group_id);
      const catObj = this.ramCategories.find(c => c.id === t.category_id);
      
      return {
        ...t,
        urgency_level: t.is_completed ? 'low' : this.calculateUrgency(t.due_date),
        group_name: groupObj?.name || 'Geral',
        group_color: groupObj?.color || 'blue',
        category_name: catObj?.name || ''
      };
    }).sort((a, b) => a.position - b.position);
  }

  static async saveTask(
    groupId: string, 
    categoryId: string | null, 
    title: string, 
    description: string | null, 
    dueDate: string | null
  ): Promise<Task> {
    const taskId = generateUUID();
    const resolvedUrgency = this.calculateUrgency(dueDate);

    // Calculate maximum position to append at the bottom
    const groupTasks = this.ramTasks.filter(t => t.group_id === groupId);
    const maxPos = groupTasks.length > 0 ? Math.max(...groupTasks.map(t => t.position)) + 1 : 0;

    const newTask: Task = {
      id: taskId,
      user_id: this.cachedUserId,
      group_id: groupId,
      category_id: categoryId,
      title,
      description,
      due_date: dueDate,
      urgency_level: resolvedUrgency,
      is_completed: false,
      completed_at: null,
      position: maxPos,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.ramTasks.push(newTask);
    this.addLog(`TASK CREATED: "${title.slice(0, 15)}..." INSERTED TO RUNTIME ENGINE.`, 'success');

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        const created = await createSupabaseTask({
          id: taskId,
          group_id: groupId,
          category_id: categoryId,
          title,
          description,
          due_date: dueDate,
          is_completed: false,
          position: maxPos
        });
        
        // Update model to match database inputs
        this.ramTasks = this.ramTasks.map(t => t.id === taskId ? created : t);
        this.addLog(`CLOUD_WRITE_SUCCESS: TASK SYNCED TO SUPABASE.`, 'success');
      } catch (err: any) {
        this.addLog(`CLOUD_WRITE_ERR: TASK INSERT EXCEPTION: ${err.message || err}`, 'error');
        throw err;
      }
    }
    
    this.triggerDataRefreshCallbacks();
    return newTask;
  }

  static async updateTask(id: string, updates: Partial<Task>): Promise<Task[]> {
    this.ramTasks = this.ramTasks.map(t => {
      if (t.id === id) {
        const merged = { ...t, ...updates, updated_at: new Date().toISOString() };
        if (updates.is_completed !== undefined) {
          merged.completed_at = updates.is_completed ? new Date().toISOString() : null;
        }
        return merged;
      }
      return t;
    });

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        await updateSupabaseTask(id, updates);
        this.addLog(`CLOUD_WRITE_SUCCESS: TASK UPDATED INSTANCE IN SUPABASE.`, 'success');
      } catch (err: any) {
        this.addLog(`CLOUD_WRITE_ERR: TASK UPDATE EXCEPTION: ${err.message || err}`, 'error');
        throw err;
      }
    }

    this.triggerDataRefreshCallbacks();
    return this.getTasks();
  }

  static async deleteTask(id: string): Promise<Task[]> {
    this.ramTasks = this.ramTasks.filter(t => t.id !== id);
    this.addLog(`TASK ELIMINATED: SECTOR ARCHIVE PURGED.`, 'error');

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        await deleteSupabaseTask(id);
        this.addLog(`CLOUD_WRITE_SUCCESS: TASK DELETED FROM SUPABASE.`, 'success');
      } catch (err: any) {
        this.addLog(`CLOUD_WRITE_ERR: TASK SCRUBBING REJECTED: ${err.message || err}`, 'error');
        throw err;
      }
    }
    
    this.triggerDataRefreshCallbacks();
    return this.getTasks();
  }

  static async reorderTasks(reordered: Task[]): Promise<void> {
    const mapped = reordered.map((t, idx) => ({ ...t, position: idx }));
    
    // Update active memory tasks list, leaving unaffected tasks intact
    const idsToReorder = new Set(reordered.map(t => t.id));
    this.ramTasks = [
      ...this.ramTasks.filter(t => !idsToReorder.has(t.id)),
      ...mapped
    ];

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        await reorderSupabaseTasks(mapped);
        this.addLog(`CLOUD_WRITE_SUCCESS: TASKS REORDERED IN CLOUD SYNC.`, 'success');
      } catch (err: any) {
        this.addLog(`CLOUD_WRITE_FAIL: REORDER REJECTED: ${err.message || err}`, 'error');
      }
    }
    this.triggerDataRefreshCallbacks();
  }

  // ==========================================
  // POMODORO SESSIONS & TELEMETRY CONTROL
  // ==========================================
  static getSessions(): PomodoroSession[] {
    return this.ramSessions;
  }

  static async savePomodoroSession(
    taskId: string | null,
    mode: string,
    focusMinutes: number,
    breakMinutes: number,
    completed: boolean,
    startedAt: string,
    endedAt: string | null
  ): Promise<PomodoroSession> {
    const sessionObj: PomodoroSession = {
      id: generateUUID(),
      user_id: this.cachedUserId,
      task_id: taskId,
      mode,
      focus_minutes: focusMinutes,
      break_minutes: breakMinutes,
      started_at: startedAt,
      ended_at: endedAt,
      completed
    };

    this.ramSessions.unshift(sessionObj);
    this.addLog(`SESSION LOGGED: [${mode}] DURATION: +${focusMinutes}m // FOCUS.`, 'success');

    if (supabase && this.cachedUserId !== 'user-default') {
      const { error } = await supabase.from('pomodoro_sessions').insert(sessionObj);
      if (error) this.addLog(`CLOUD_WRITE_ERR: SESSION EXCEPTION: ${error.message}`, 'error');
    }
    return sessionObj;
  }

  // --- STATS TELEMETRY DISPATCH ---
  static getStats(): DailyStatistics {
    const today = new Date().toISOString().split('T')[0];
    
    const defaultVal: DailyStatistics = {
      id: generateUUID(),
      user_id: this.cachedUserId,
      total_focus_minutes: 0,
      total_break_minutes: 0,
      completed_tasks: 0,
      date: today
    };

    if (typeof window === 'undefined') return defaultVal;
    
    const statsObj = localStorage.getItem(`RETRO_OS_stats_${this.cachedUserId}`);
    if (!statsObj) {
      localStorage.setItem(`RETRO_OS_stats_${this.cachedUserId}`, JSON.stringify(defaultVal));
      return defaultVal;
    }

    try {
      const parsed = JSON.parse(statsObj) as DailyStatistics;
      if (parsed.date !== today) {
        localStorage.setItem(`RETRO_OS_stats_${this.cachedUserId}`, JSON.stringify(defaultVal));
        if (supabase && this.cachedUserId !== 'user-default') {
          supabase.from('daily_statistics').upsert(defaultVal, { onConflict: 'user_id, date' }).then();
        }
        return defaultVal;
      }
      return parsed;
    } catch {
      return defaultVal;
    }
  }

  static addSessionMinutes(focusMins: number, isBreak: boolean = false) {
    const stats = this.getStats();
    if (isBreak) {
      stats.total_break_minutes += focusMins;
    } else {
      stats.total_focus_minutes += focusMins;
    }
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(`RETRO_OS_stats_${this.cachedUserId}`, JSON.stringify(stats));
    }

    if (supabase && this.cachedUserId !== 'user-default') {
      supabase.from('daily_statistics').upsert({
        user_id: this.cachedUserId,
        total_focus_minutes: stats.total_focus_minutes,
        total_break_minutes: stats.total_break_minutes,
        completed_tasks: stats.completed_tasks,
        date: stats.date
      }, { onConflict: 'user_id, date' }).then();
    }
  }

  static incrementCompletedTasks() {
    const stats = this.getStats();
    stats.completed_tasks += 1;

    if (typeof window !== 'undefined') {
      localStorage.setItem(`RETRO_OS_stats_${this.cachedUserId}`, JSON.stringify(stats));
    }

    if (supabase && this.cachedUserId !== 'user-default') {
      supabase.from('daily_statistics').upsert({
        user_id: this.cachedUserId,
        total_focus_minutes: stats.total_focus_minutes,
        total_break_minutes: stats.total_break_minutes,
        completed_tasks: stats.completed_tasks,
        date: stats.date
      }, { onConflict: 'user_id, date' }).then();
    }
  }
}
