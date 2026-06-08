'use client';

import { supabase, isSupabaseConfigured } from './supabase';
import { 
  createTask as createSupabaseTask, 
  updateTask as updateSupabaseTask, 
  deleteTask as deleteSupabaseTask, 
  reorderTasks as reorderSupabaseTasks, 
  mapTaskFromDb,
  getTaskPeriods as getSupabaseTaskPeriods,
  createTaskPeriod as createSupabaseTaskPeriod,
  updateTaskPeriod as updateSupabaseTaskPeriod,
  reorderTaskPeriods as reorderSupabaseTaskPeriods,
  deleteTaskPeriod as deleteSupabaseTaskPeriod
} from './supabase/tasks';
import {
  getProjects as getSupabaseProjects,
  createProject as createSupabaseProject,
  updateProject as updateSupabaseProject,
  deleteProject as deleteSupabaseProject,
  getProjectPhases as getSupabaseProjectPhases,
  createProjectPhase as createSupabaseProjectPhase,
  updateProjectPhase as updateSupabaseProjectPhase,
  deleteProjectPhase as deleteSupabaseProjectPhase,
  reorderProjectPhases as reorderSupabaseProjectPhases,
  getProjectIssues as getSupabaseProjectIssues,
  createProjectIssue as createSupabaseProjectIssue,
  updateProjectIssue as updateSupabaseProjectIssue,
  deleteProjectIssue as deleteSupabaseProjectIssue
} from './supabase/projects';
import {
  getWeeklyPlans as getSupabaseWeeklyPlans,
  getOrCreateWeeklyPlan as getOrCreateSupabaseWeeklyPlan,
  getWeeklyPlanTopics as getSupabaseWeeklyPlanTopics,
  saveWeeklyPlanTopic as saveSupabaseWeeklyPlanTopic,
  deleteWeeklyPlanTopic as deleteSupabaseWeeklyPlanTopic,
  clearWeeklyPlanDay as clearSupabaseWeeklyPlanDay
} from './supabase/weeklyPlans';

// ==========================================
// RETRO-FUTURISTIC TERMINAL DATABANK ADAPTER
// ==========================================
// No localStorage or sessionStorage allowed for Task, Group, Category, or Session data!
// Persisted 100% in Supabase Cloud if authenticated, or falls back to in-memory secure RAM cycles.

export interface WeeklyPlan {
  id: string;
  user_id: string;
  week_start_date: string;
  created_at: string;
  updated_at: string;
}

export interface WeeklyPlanTopic {
  id: string;
  weekly_plan_id: string;
  category_id: string;
  weekday: number;
  user_id: string;
  created_at: string;
}


export interface Profile {
  id: string;
  email: string;
  username: string;
  avatar_url: string;
  created_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectPhase {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  description: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectIssue {
  id: string;
  project_id: string;
  phase_id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
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
  description?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface TaskPeriod {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  color: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  group_id: string;
  category_id: string | null;
  task_period_id?: string | null;
  title: string;
  description: string | null;
  due_date: string | null; // ISO Date String
  urgency_level: 'low' | 'moderate' | 'urgent' | 'overdue';
  is_completed: boolean;
  completed_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  notes?: string | null;
  status?: string | null;
  updated_by?: string | null;
  time_period?: string | null;
  
  // Dynamic joins/resolved for UI mapping:
  group_name?: string;
  group_color?: string;
  group_color_hex?: string;
  category_name?: string;
  category_color_hex?: string;
  period_name?: string;
  period_icon?: string;
  period_color?: string;
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
  private static colorIdToHex: Record<string, string> = {};

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
        const idToHex: Record<string, string> = {};
        data.forEach((c: any) => {
          nameToId[c.name] = c.id;
          idToName[c.id] = c.name;
          idToHex[c.id] = c.hex_code;
        });
        this.colorNameToId = nameToId;
        this.colorIdToName = idToName;
        this.colorIdToHex = idToHex;
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
  private static ramPeriods: TaskPeriod[] = [
    { id: 'p-morning', user_id: 'user-default', name: 'Manhã', icon: '☀️', color: '#60a5fa', position: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'p-afternoon', user_id: 'user-default', name: 'Pós-almoço', icon: '🌤', color: '#fbbf24', position: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'p-evening', user_id: 'user-default', name: 'Noite', icon: '🌙', color: '#fb923c', position: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'p-tomorrow', user_id: 'user-default', name: 'Amanhã', icon: '📅', color: '#c084fc', position: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  ];
  private static ramTasks: Task[] = [];
  private static ramSessions: PomodoroSession[] = [];
  private static ramPresets: PomodoroPreset[] = [];
  private static ramProjects: Project[] = [];
  private static ramPhases: ProjectPhase[] = [];
  private static ramIssues: ProjectIssue[] = [];
  private static ramWeeklyPlans: WeeklyPlan[] = [];
  private static ramWeeklyPlanTopics: WeeklyPlanTopic[] = [];

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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'topics' },
        () => {
          this.pullFromSupabase();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'weekly_plans' },
        () => {
          this.pullFromSupabase();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'weekly_plan_topics' },
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
      
      if (groupsErr) throw new Error(`Erro ao recuperar grupos de tarefas do Supabase: ${groupsErr.message} - Code: ${groupsErr.code}`);

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

      // 4B. Fetch Task Periods
      const { data: periodsData, error: periodsErr } = await supabase
        .from('task_periods')
        .select('*')
        .eq('user_id', this.cachedUserId)
        .order('position', { ascending: true });

      if (periodsErr) {
        this.addLog(`CLOUD_SYNC_WARN: COULD NOT FETCH TASK PERIODS: ${periodsErr.message}`, 'warning');
      } else if (periodsData) {
        if (periodsData.length === 0) {
          // Initialize in-memory fallback periods (no Supabase write to prevent silent record auto-creation)
          this.ramPeriods = [
            { id: 'p-morning', user_id: this.cachedUserId, name: 'Manhã', icon: '☀️', color: '#60a5fa', position: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { id: 'p-afternoon', user_id: this.cachedUserId, name: 'Pós-almoço', icon: '🌤', color: '#fbbf24', position: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { id: 'p-evening', user_id: this.cachedUserId, name: 'Noite', icon: '🌙', color: '#fb923c', position: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { id: 'p-tomorrow', user_id: this.cachedUserId, name: 'Amanhã', icon: '📅', color: '#c084fc', position: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          ];
          this.addLog(`CLOUD_SYNC: NO TASK PERIODS DEFINED. LOADED TEMPORARY VIRTUAL BLOCKS.`, 'info');
        } else {
          this.ramPeriods = periodsData;
          this.addLog(`CLOUD_SYNC: ${periodsData.length} TASK PERIODS SYNCHRONIZED.`, 'success');
        }
      }

      // 4C. Fetch Weekly Plans (Step 1B)
      try {
        const plans = await getSupabaseWeeklyPlans();
        this.ramWeeklyPlans = plans;

        if (plans.length > 0) {
          const { data: wpTopics, error: wptErr } = await supabase
            .from('weekly_plan_topics')
            .select('*')
            .eq('user_id', this.cachedUserId);
          if (!wptErr && wpTopics) {
            this.ramWeeklyPlanTopics = wpTopics;
          }
        } else {
          this.ramWeeklyPlanTopics = [];
        }
      } catch (planErr) {
        console.warn("Skipped database loading of weekly planning; tables might not exist yet.", planErr);
      }

      // 5. Fetch Tasks
      const { data: tasksData, error: tasksErr } = await supabase
        .from('tasks')
        .select(`
          *,
          category:task_categories(
            *,
            group:task_groups(
              *,
              color:custom_colors(*)
            ),
            color:custom_colors(*)
          ),
          group:task_groups(
            *,
            color:custom_colors(*)
          ),
          period:task_periods(*)
        `)
        .eq('user_id', this.cachedUserId)
        .order('position', { ascending: true });

      if (!tasksErr && tasksData) {
        this.ramTasks = (tasksData as any[]).map(t => {
          const mapped = mapTaskFromDb(t);
          let pId = mapped.task_period_id;
          if (!pId && mapped.time_period) {
            const foundPeriod = this.ramPeriods.find(p => p.name.toLowerCase().includes(mapped.time_period!.toLowerCase()) || p.id.includes(mapped.time_period!));
            if (foundPeriod) {
              pId = foundPeriod.id;
            }
          }

          // Resolve group and category models
          const categoryObj = t.category;
          const groupObj = t.group || categoryObj?.group;
          
          const colorObj = groupObj?.color;
          const catColorObj = categoryObj?.color;
          const periodObj = t.period || this.ramPeriods.find(p => p.id === pId);

          return {
            ...mapped,
            task_period_id: pId,
            urgency_level: mapped.is_completed ? 'low' : this.calculateUrgency(mapped.due_date),
            group_name: groupObj?.name || undefined,
            group_color: colorObj?.name || undefined,
            group_color_hex: colorObj?.hex_code || undefined,
            category_name: categoryObj?.name || undefined,
            category_color_hex: catColorObj?.hex_code || undefined,
            period_name: periodObj?.name || undefined,
            period_icon: periodObj?.icon || undefined,
            period_color: periodObj?.color || undefined
          };
        });
        this.addLog(`CLOUD_SYNC: ${tasksData.length} INTEGRATED TASKS RELATIONALLY ALIGNED IN RAM.`, 'success');
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

      // 8. Projects module synchronization (fails safely if SQL schemas not loaded)
      try {
        const { data: projectsData, error: projectsErr } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', this.cachedUserId)
          .order('created_at', { ascending: false });
        if (!projectsErr && projectsData) {
          this.ramProjects = projectsData;
        }

        const { data: phasesData, error: phasesErr } = await supabase
          .from('project_phases')
          .select('*')
          .eq('user_id', this.cachedUserId)
          .order('position', { ascending: true });
        if (!phasesErr && phasesData) {
          this.ramPhases = phasesData;
        }

        const { data: issuesData, error: issuesErr } = await supabase
          .from('project_issues')
          .select('*')
          .eq('user_id', this.cachedUserId)
          .order('position', { ascending: true });
        if (!issuesErr && issuesData) {
          this.ramIssues = issuesData;
        }
        
        if (!projectsErr && !phasesErr && !issuesErr) {
          this.addLog(`CLOUD_SYNC: ${projectsData?.length || 0} PROJECTS AND ASSOCIATED WORKSTREAMS ALIGNED.`, 'success');
        }
      } catch (projErr) {
        // Safe skip on unmigrated / outdated database clients
        console.warn("Skipped database loading of projects; tables might not exist yet.", projErr);
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
        throw new Error(`Erro ao deletar grupo (task_groups): ${error.message} - Code: ${error.code}`);
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

  static async saveCategory(groupId: string, name: string, color: string | null = null, description: string | null = null): Promise<TaskCategory> {
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
      description,
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
      description,
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
        throw new Error(`Erro ao criar categoria (task_categories): ${error.message} - Code: ${error.code}`);
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
        throw new Error(`Erro ao atualizar categoria (task_categories): ${error.message} - Code: ${error.code}`);
      }
    }
    this.triggerDataRefreshCallbacks();
    return this.getCategories();
  }

  static async deleteCategory(id: string): Promise<TaskCategory[]> {
    this.ramCategories = this.ramCategories.filter(c => c.id !== id);
    this.ramWeeklyPlanTopics = this.ramWeeklyPlanTopics.filter(wpt => wpt.category_id !== id);
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
    const COLOR_NAME_TO_HEX: Record<string, string> = {
      blue: '#60a5fa',
      purple: '#c084fc',
      green: '#34d399',
      red: '#f87171',
      yellow: '#fbbf24',
      cyan: '#22d3ee',
      orange: '#fb923c'
    };

    return this.ramTasks.map(t => {
      const catObj = this.ramCategories.find(c => c.id === t.category_id);
      const targetGroupId = t.group_id || catObj?.group_id;
      const groupObj = this.ramGroups.find(g => g.id === targetGroupId);
      const periodObj = this.ramPeriods.find(p => p.id === t.task_period_id);
      
      const computedGroupColorName = t.group_color || groupObj?.color || 'blue';
      const computedGroupColorHex = t.group_color_hex || COLOR_NAME_TO_HEX[computedGroupColorName] || '#60a5fa';
      const computedCategoryColorHex = t.category_color_hex || (catObj?.color ? COLOR_NAME_TO_HEX[catObj.color] : undefined);

      return {
        ...t,
        urgency_level: t.is_completed ? 'low' : this.calculateUrgency(t.due_date),
        group_name: t.group_name || groupObj?.name || 'Geral',
        group_color: computedGroupColorName,
        group_color_hex: computedGroupColorHex,
        category_name: t.category_name || catObj?.name || '',
        category_color_hex: computedCategoryColorHex,
        period_name: t.period_name || periodObj?.name || '',
        period_icon: t.period_icon || periodObj?.icon || '',
        period_color: t.period_color || periodObj?.color || ''
      };
    }).sort((a, b) => a.position - b.position);
  }

  static async saveTask(
    groupId: string, 
    categoryId: string | null, 
    title: string, 
    description: string | null, 
    dueDate: string | null,
    timePeriod: string | null = null,
    taskPeriodId: string | null = null
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
      task_period_id: taskPeriodId,
      title,
      description,
      due_date: dueDate,
      urgency_level: resolvedUrgency,
      is_completed: false,
      completed_at: null,
      position: maxPos,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      time_period: timePeriod
    };

    this.ramTasks.push(newTask);
    this.addLog(`TASK CREATED: "${title.slice(0, 15)}..." INSERTED TO RUNTIME ENGINE.`, 'success');

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        const created = await createSupabaseTask({
          id: taskId,
          group_id: groupId,
          category_id: categoryId,
          task_period_id: taskPeriodId,
          title,
          description,
          due_date: dueDate,
          is_completed: false,
          position: maxPos,
          time_period: timePeriod
        });
        
        // Update model to match database inputs
        this.ramTasks = this.ramTasks.map(t => t.id === taskId ? created : t);
        this.addLog(`CLOUD_WRITE_SUCCESS: TASK SYNCED TO SUPABASE.`, 'success');
      } catch (err: any) {
        // Rollback optimistic update
        this.ramTasks = this.ramTasks.filter(t => t.id !== taskId);
        const processedErr = err instanceof Error ? err : new Error(err?.message || JSON.stringify(err) || String(err));
        this.addLog(`CLOUD_WRITE_ERR: TASK INSERT EXCEPTION: ${processedErr.message}`, 'error');
        throw processedErr;
      }
    }
    
    this.triggerDataRefreshCallbacks();
    return newTask;
  }

  static async updateTask(id: string, updates: Partial<Task>): Promise<Task[]> {
    const previousTasks = [...this.ramTasks];
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
        // Rollback optimistic update
        this.ramTasks = previousTasks;
        const processedErr = err instanceof Error ? err : new Error(err?.message || JSON.stringify(err) || String(err));
        this.addLog(`CLOUD_WRITE_ERR: TASK UPDATE EXCEPTION: ${processedErr.message}`, 'error');
        throw processedErr;
      }
    }

    this.triggerDataRefreshCallbacks();
    return this.getTasks();
  }

  static async deleteTask(id: string): Promise<Task[]> {
    const previousTasks = [...this.ramTasks];
    this.ramTasks = this.ramTasks.filter(t => t.id !== id);
    this.addLog(`TASK ELIMINATED: SECTOR ARCHIVE PURGED.`, 'error');

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        await deleteSupabaseTask(id);
        this.addLog(`CLOUD_WRITE_SUCCESS: TASK DELETED FROM SUPABASE.`, 'success');
      } catch (err: any) {
        // Rollback optimistic delete
        this.ramTasks = previousTasks;
        const processedErr = err instanceof Error ? err : new Error(err?.message || JSON.stringify(err) || String(err));
        this.addLog(`CLOUD_WRITE_ERR: TASK SCRUBBING REJECTED: ${processedErr.message}`, 'error');
        throw processedErr;
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

  // ==========================================
  // TASK PERIODS CRUD
  // ==========================================
  static getTaskPeriods(): TaskPeriod[] {
    return this.ramPeriods.sort((a, b) => a.position - b.position);
  }

  static async saveTaskPeriod(name: string, icon: string, color: string): Promise<TaskPeriod> {
    const id = generateUUID();
    const position = this.ramPeriods.length;

    const newPeriod: TaskPeriod = {
      id,
      user_id: this.cachedUserId,
      name,
      icon,
      color,
      position,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.ramPeriods.push(newPeriod);
    this.addLog(`PERIOD CREATED: "${name}" REGISTERED IN SCHEDULER.`, 'success');

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        const created = await createSupabaseTaskPeriod({
          id,
          name,
          icon,
          color,
          position
        });
        this.ramPeriods = this.ramPeriods.map(p => p.id === id ? created : p);
        this.addLog(`CLOUD_WRITE_SUCCESS: PERIOD SYNCED.`, 'success');
      } catch (err: any) {
        this.ramPeriods = this.ramPeriods.filter(p => p.id !== id);
        this.addLog(`CLOUD_WRITE_ERR: PERIOD EXCEPTION: ${err.message}`, 'error');
        throw err;
      }
    }

    this.triggerDataRefreshCallbacks();
    return newPeriod;
  }

  static async updateTaskPeriod(id: string, updates: Partial<TaskPeriod>): Promise<TaskPeriod[]> {
    const previousPeriods = [...this.ramPeriods];
    this.ramPeriods = this.ramPeriods.map(p => {
      if (p.id === id) {
        return { ...p, ...updates, updated_at: new Date().toISOString() };
      }
      return p;
    });

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        await updateSupabaseTaskPeriod(id, updates);
        this.addLog(`CLOUD_WRITE_SUCCESS: PERIOD UPDATE SYNCED.`, 'success');
      } catch (err: any) {
        this.ramPeriods = previousPeriods;
        this.addLog(`CLOUD_WRITE_ERR: PERIOD UPDATE EXCEPTION: ${err.message}`, 'error');
        throw err;
      }
    }

    this.triggerDataRefreshCallbacks();
    return this.getTaskPeriods();
  }

  static async deleteTaskPeriod(
    id: string,
    transitionMode: 'move' | 'unassign' | 'delete',
    targetPeriodId?: string
  ): Promise<TaskPeriod[]> {
    const previousPeriods = [...this.ramPeriods];
    const previousTasks = [...this.ramTasks];

    // Optimistic cache update
    if (transitionMode === 'move' && targetPeriodId) {
      this.ramTasks = this.ramTasks.map(t => t.task_period_id === id ? { ...t, task_period_id: targetPeriodId } : t);
    } else if (transitionMode === 'unassign') {
      this.ramTasks = this.ramTasks.map(t => t.task_period_id === id ? { ...t, task_period_id: null } : t);
    } else if (transitionMode === 'delete') {
      this.ramTasks = this.ramTasks.filter(t => t.task_period_id !== id);
    }

    this.ramPeriods = this.ramPeriods.filter(p => p.id !== id);
    this.addLog(`PERIOD REMOVED: ARCHIVE RETIRED FROM SERVICE.`, 'error');

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        await deleteSupabaseTaskPeriod(id, transitionMode, targetPeriodId);
        this.addLog(`CLOUD_WRITE_SUCCESS: PERIOD DELETION COMPLETED IN SUPABASE.`, 'success');
      } catch (err: any) {
        this.ramPeriods = previousPeriods;
        this.ramTasks = previousTasks;
        this.addLog(`CLOUD_WRITE_ERR: PERIOD DELETE EXCEPTION: ${err.message}`, 'error');
        throw err;
      }
    }

    this.triggerDataRefreshCallbacks();
    return this.getTaskPeriods();
  }

  static async reorderTaskPeriods(reordered: TaskPeriod[]): Promise<void> {
    const mapped = reordered.map((p, idx) => ({ ...p, position: idx }));
    this.ramPeriods = mapped;

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        await reorderSupabaseTaskPeriods(mapped);
        this.addLog(`CLOUD_WRITE_SUCCESS: PERIOD SEQUENCE OPTIMIZED.`, 'success');
      } catch (err: any) {
        this.addLog(`CLOUD_WRITE_ERR: PERIOD REORDER EXCEPTION: ${err.message}`, 'error');
      }
    }
    this.triggerDataRefreshCallbacks();
  }

  // ==========================================
  // PROJECTS MODULE ACTIONS
  // ==========================================

  static getProjects(includeArchived = false): Project[] {
    return includeArchived 
      ? this.ramProjects 
      : this.ramProjects.filter(p => !p.is_archived);
  }

  static async saveProject(name: string, description: string | null = null): Promise<Project> {
    const pId = generateUUID();
    const newProject: Project = {
      id: pId,
      user_id: this.cachedUserId,
      name,
      description,
      is_archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.ramProjects.unshift(newProject);
    this.addLog(`PROJECT LOGGED: "${name}" IN CENTRAL TERMINAL`, 'success');

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        await createSupabaseProject(newProject);
      } catch (err: any) {
        this.addLog(`CLOUD_WRITE_ERR: PROJECT LOG FAIL: ${err.message}`, 'error');
      }
    }
    this.triggerDataRefreshCallbacks();
    return newProject;
  }

  static async updateProject(id: string, updates: Partial<Project>): Promise<Project[]> {
    this.ramProjects = this.ramProjects.map(p => {
      if (p.id === id) {
        return { ...p, ...updates, updated_at: new Date().toISOString() };
      }
      return p;
    });

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        await updateSupabaseProject(id, updates);
      } catch (err: any) {
        this.addLog(`CLOUD_WRITE_ERR: PROJECT UPDATE FAIL: ${err.message}`, 'error');
      }
    }
    this.triggerDataRefreshCallbacks();
    return this.ramProjects;
  }

  static async deleteProject(id: string): Promise<Project[]> {
    this.ramProjects = this.ramProjects.filter(p => p.id !== id);
    this.ramPhases = this.ramPhases.filter(ph => ph.project_id !== id);
    this.ramIssues = this.ramIssues.filter(iss => iss.project_id !== id);

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        await deleteSupabaseProject(id);
      } catch (err: any) {
        this.addLog(`CLOUD_WRITE_ERR: PROJECT DELETE FAIL: ${err.message}`, 'error');
      }
    }
    this.triggerDataRefreshCallbacks();
    return this.ramProjects;
  }

  // PHASES
  static getProjectPhases(projectId: string): ProjectPhase[] {
    return this.ramPhases
      .filter(ph => ph.project_id === projectId)
      .sort((a, b) => a.position - b.position);
  }

  static async saveProjectPhase(projectId: string, name: string, description: string | null = null): Promise<ProjectPhase> {
    const id = generateUUID();
    const position = this.ramPhases.filter(p => p.project_id === projectId).length;
    const newPhase: ProjectPhase = {
      id,
      project_id: projectId,
      user_id: this.cachedUserId,
      name,
      description,
      position,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.ramPhases.push(newPhase);
    this.addLog(`PHASE REGISTERED: "${name}" DIRECTED FOR PROJECT`, 'success');

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        await createSupabaseProjectPhase(newPhase);
      } catch (err: any) {
        this.addLog(`CLOUD_WRITE_ERR: PHASE WRITE FAIL: ${err.message}`, 'error');
      }
    }
    this.triggerDataRefreshCallbacks();
    return newPhase;
  }

  static async updateProjectPhase(id: string, updates: Partial<ProjectPhase>): Promise<ProjectPhase[]> {
    this.ramPhases = this.ramPhases.map(ph => {
      if (ph.id === id) {
        return { ...ph, ...updates, updated_at: new Date().toISOString() };
      }
      return ph;
    });

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        await updateSupabaseProjectPhase(id, updates);
      } catch (err: any) {
        this.addLog(`CLOUD_WRITE_ERR: PHASE EDIT FAIL: ${err.message}`, 'error');
      }
    }
    this.triggerDataRefreshCallbacks();
    return this.ramPhases;
  }

  static async deleteProjectPhase(id: string): Promise<ProjectPhase[]> {
    this.ramPhases = this.ramPhases.filter(ph => ph.id !== id);
    this.ramIssues = this.ramIssues.filter(iss => iss.phase_id !== id);

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        await deleteSupabaseProjectPhase(id);
      } catch (err: any) {
        this.addLog(`CLOUD_WRITE_ERR: PHASE PURGE FAIL: ${err.message}`, 'error');
      }
    }
    this.triggerDataRefreshCallbacks();
    return this.ramPhases;
  }

  static async reorderProjectPhases(projectId: string, reorderedPhases: ProjectPhase[]): Promise<void> {
    const mapped = reorderedPhases.map((phase, idx) => ({ ...phase, position: idx }));
    const idsToReorder = new Set(reorderedPhases.map(p => p.id));
    this.ramPhases = [
      ...this.ramPhases.filter(p => !idsToReorder.has(p.id)),
      ...mapped
    ];

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        await reorderSupabaseProjectPhases(mapped);
      } catch (err: any) {
        this.addLog(`CLOUD_WRITE_FAIL: PHASES REORDER REJECTED: ${err.message || err}`, 'error');
      }
    }
    this.triggerDataRefreshCallbacks();
  }

  // ISSUES (PENDÊNCIAS)
  static getProjectIssues(projectId: string): ProjectIssue[] {
    return this.ramIssues
      .filter(iss => iss.project_id === projectId)
      .sort((a, b) => a.position - b.position);
  }

  static async saveProjectIssue(projectId: string, phaseId: string, title: string, description: string | null = null): Promise<ProjectIssue> {
    const id = generateUUID();
    const position = this.ramIssues.filter(iss => iss.phase_id === phaseId).length;
    const newIssue: ProjectIssue = {
      id,
      project_id: projectId,
      phase_id: phaseId,
      user_id: this.cachedUserId,
      title,
      description,
      is_completed: false,
      position,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.ramIssues.push(newIssue);
    this.addLog(`ISSUE ADDED: "${title}" SEEDED INTO WORKSTREAM`, 'success');

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        await createSupabaseProjectIssue(newIssue);
      } catch (err: any) {
        this.addLog(`CLOUD_WRITE_ERR: ISSUE WRITE FAIL: ${err.message}`, 'error');
      }
    }
    this.triggerDataRefreshCallbacks();
    return newIssue;
  }

  static async updateProjectIssue(id: string, updates: Partial<ProjectIssue>): Promise<ProjectIssue[]> {
    this.ramIssues = this.ramIssues.map(iss => {
      if (iss.id === id) {
        return { ...iss, ...updates, updated_at: new Date().toISOString() };
      }
      return iss;
    });

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        await updateSupabaseProjectIssue(id, updates);
      } catch (err: any) {
        this.addLog(`CLOUD_WRITE_ERR: ISSUE EDIT FAIL: ${err.message}`, 'error');
      }
    }
    this.triggerDataRefreshCallbacks();
    return this.ramIssues;
  }

  static async deleteProjectIssue(id: string): Promise<ProjectIssue[]> {
    this.ramIssues = this.ramIssues.filter(iss => iss.id !== id);

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        await deleteSupabaseProjectIssue(id);
      } catch (err: any) {
        this.addLog(`CLOUD_WRITE_ERR: ISSUE SCRUB FAIL: ${err.message}`, 'error');
      }
    }
    this.triggerDataRefreshCallbacks();
    return this.ramIssues;
  }

  // GENERATE TASK FROM ISSUE
  static async generateTasksFromIssue(
    issueId: string,
    tasksData: Array<{
      title: string;
      description?: string | null;
      groupId: string;
      categoryId: string | null;
      taskPeriodId: string | null;
      dueDate: string | null;
      timePeriod: string | null;
    }>
  ) {
    const issue = this.ramIssues.find(iss => iss.id === issueId);
    if (!issue) throw new Error("Pendência não encontrada");

    this.addLog(`GENERATING ${tasksData.length} OPERATIONAL TASKS FOR ISSUE "${issue.title}"...`, 'info');

    for (const t of tasksData) {
      const taskId = generateUUID();
      const resolvedUrgency = this.calculateUrgency(t.dueDate);
      
      const groupTasks = this.ramTasks.filter(task => task.group_id === t.groupId);
      const maxPos = groupTasks.length > 0 ? Math.max(...groupTasks.map(task => task.position)) + 1 : 0;

      const newTask: Task = {
        id: taskId,
        user_id: this.cachedUserId,
        group_id: t.groupId,
        category_id: t.categoryId,
        task_period_id: t.taskPeriodId,
        title: t.title,
        description: t.description || null,
        due_date: t.dueDate,
        urgency_level: resolvedUrgency,
        is_completed: false,
        completed_at: null,
        position: maxPos,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        time_period: t.timePeriod
      };

      this.ramTasks.push(newTask);

      if (supabase && this.cachedUserId !== 'user-default') {
        try {
          const payload = {
            id: taskId,
            group_id: t.groupId,
            category_id: t.categoryId,
            task_period_id: t.taskPeriodId,
            title: t.title,
            description: t.description || null,
            is_completed: false,
            position: maxPos,
            time_period: t.timePeriod,
            project_issue_id: issueId
          };
          
          const { error } = await supabase.from('tasks').insert(payload);
          if (error) {
            if (error.code === '42703') {
              const prunedPayload = { ...payload };
              delete (prunedPayload as any).project_issue_id;
              await supabase.from('tasks').insert(prunedPayload);
            } else {
              throw error;
            }
          }
        } catch (err: any) {
          this.addLog(`TASK GENERATION CLOUD FAIL: ${err.message}`, 'error');
        }
      }
    }

    this.addLog(`TASKS COMPILED SUCCESSFULLY FOR WORKSTREAM RELAXATION.`, 'success');
    this.triggerDataRefreshCallbacks();
  }

  // ==========================================
  // WEEKLY PLANNING SYSTEM WRAPPERS
  // ==========================================

  static getWeeklyPlans(): WeeklyPlan[] {
    return this.ramWeeklyPlans;
  }

  static getWeeklyPlanTopics(): WeeklyPlanTopic[] {
    return this.ramWeeklyPlanTopics;
  }

  static async getOrCreateWeeklyPlan(weekStartDate: string): Promise<WeeklyPlan> {
    const isGuest = !supabase || this.cachedUserId === 'user-default';
    let plan: WeeklyPlan;
    if (isGuest) {
      const existing = this.ramWeeklyPlans.find(p => p.week_start_date === weekStartDate);
      if (existing) {
        plan = existing;
      } else {
        plan = {
          id: `mock-plan-${weekStartDate}`,
          user_id: this.cachedUserId,
          week_start_date: weekStartDate,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
    } else {
      plan = await getOrCreateSupabaseWeeklyPlan(weekStartDate);
    }
    if (!this.ramWeeklyPlans.some(p => p.id === plan.id)) {
      this.ramWeeklyPlans.unshift(plan);
    }
    this.triggerDataRefreshCallbacks();
    return plan;
  }

  static async saveWeeklyPlanTopic(weeklyPlanId: string, categoryId: string, weekday: number): Promise<WeeklyPlanTopic> {
    const isGuest = !supabase || this.cachedUserId === 'user-default';
    let created: WeeklyPlanTopic;
    if (isGuest) {
      created = {
        id: `mock-wpt-${Math.random().toString(36).substr(2, 9)}`,
        weekly_plan_id: weeklyPlanId,
        category_id: categoryId,
        weekday,
        user_id: this.cachedUserId,
        created_at: new Date().toISOString()
      };
    } else {
      created = await saveSupabaseWeeklyPlanTopic(weeklyPlanId, categoryId, weekday);
    }
    this.ramWeeklyPlanTopics = this.ramWeeklyPlanTopics.filter(
      wpt => !(wpt.weekly_plan_id === weeklyPlanId && wpt.category_id === categoryId && wpt.weekday === weekday)
    );
    this.ramWeeklyPlanTopics.push(created);
    this.triggerDataRefreshCallbacks();
    return created;
  }

  static async deleteWeeklyPlanTopic(weeklyPlanId: string, categoryId: string, weekday: number): Promise<void> {
    const isGuest = !supabase || this.cachedUserId === 'user-default';
    if (!isGuest) {
      await deleteSupabaseWeeklyPlanTopic(weeklyPlanId, categoryId, weekday);
    }
    this.ramWeeklyPlanTopics = this.ramWeeklyPlanTopics.filter(
      wpt => !(wpt.weekly_plan_id === weeklyPlanId && wpt.category_id === categoryId && wpt.weekday === weekday)
    );
    this.triggerDataRefreshCallbacks();
  }

  static async clearWeeklyPlanDay(weeklyPlanId: string, weekday: number): Promise<void> {
    const isGuest = !supabase || this.cachedUserId === 'user-default';
    if (!isGuest) {
      await clearSupabaseWeeklyPlanDay(weeklyPlanId, weekday);
    }
    this.ramWeeklyPlanTopics = this.ramWeeklyPlanTopics.filter(
      wpt => !(wpt.weekly_plan_id === weeklyPlanId && wpt.weekday === weekday)
    );
    this.triggerDataRefreshCallbacks();
  }
}
