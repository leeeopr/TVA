'use client';

import { supabase, isSupabaseConfigured } from './supabase';
import { 
  createTask as createSupabaseTask, 
  updateTask as updateSupabaseTask, 
  deleteTask as deleteSupabaseTask, 
  reorderTasks as reorderSupabaseTasks, 
  mapTaskFromDb
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
import {
  getAgendaBlocks,
  createAgendaBlock,
  updateAgendaBlock,
  deleteAgendaBlock,
  getAgendaTodos,
  createAgendaTodo,
  updateAgendaTodo,
  deleteAgendaTodo,
  getAgendaClosures,
  getAgendaHistoryItems,
  getPlanningTodos,
  createPlanningTodo,
  updatePlanningTodo,
  deletePlanningTodo,
  AgendaBlock,
  AgendaTodo,
  AgendaClosure,
  AgendaHistoryItem,
  PlanningTodo
} from './supabase/agenda';

export type { AgendaBlock, AgendaTodo, AgendaClosure, AgendaHistoryItem, PlanningTodo };

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
  project_issue_id?: string | null;
  
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

export interface UnifiedTask {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  completed: boolean;
  
  group_id: string | null;
  category_id: string | null;
  block_id: string | null;
  
  source_type: 'local' | 'external' | 'project_issue';
  source_id: string | null;
  created_at: string;
  updated_at: string;
  
  is_external: boolean;
  external_source_name?: string | null;
  original_external_id?: string | null;
  
  // Stage 7 Company Identity Profile Fields
  company_name?: string | null;
  company_color?: string | null;
  company_icon?: string | null;
  company_type?: string | null;
  
  // Prioritization & Deadline Fields
  priority: number; // 1: Urgent, 2: High, 3: Medium, 4: Low
  due_date: string | null;
  
  // Stage 8 Preparation Fields (Dual Coop)
  external_project_id?: string | null;
  external_project_name?: string | null;
  external_phase_id?: string | null;
  external_phase_name?: string | null;
  external_kanban_column?: string | null;
  
  // UI mapping fields
  group_name?: string;
  group_color?: string;
  group_color_hex?: string;
  category_name?: string;
  category_color_hex?: string;
  sync_status?: 'synchronized' | 'pending' | 'failed';
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
  private static hideCompleted: boolean = true;
  private static ramTaskStats: any[] = [];
  private static colorNameToId: Record<string, string> = {};
  private static colorIdToName: Record<string, string> = {};
  private static colorIdToHex: Record<string, string> = {};
  private static isPlanningTableMissing: boolean = false;

  static checkPlanningTableMissing(): boolean {
    return this.isPlanningTableMissing;
  }

  static isLoading(): boolean {
    return this.isPulling;
  }

  static getSyncError(): string | null {
    return this.pullError;
  }

  static getHideCompleted(): boolean {
    return this.hideCompleted;
  }

  static async setHideCompleted(val: boolean): Promise<void> {
    this.hideCompleted = val;
    await this.pullFromSupabase();
    this.triggerDataRefreshCallbacks();
  }

  static getTaskStats(): any[] {
    return this.ramTaskStats;
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
  private static ramPeriods: TaskPeriod[] = [];
  private static ramTasks: Task[] = [];
  private static ramSessions: PomodoroSession[] = [];
  private static ramPresets: PomodoroPreset[] = [];
  private static ramProjects: Project[] = [];
  private static ramPhases: ProjectPhase[] = [];
  private static ramIssues: ProjectIssue[] = [];
  private static ramWeeklyPlans: WeeklyPlan[] = [];
  private static ramWeeklyPlanTopics: WeeklyPlanTopic[] = [];
  private static ramAgendaBlocks: AgendaBlock[] = [];
  private static ramAgendaTodos: AgendaTodo[] = [];
  private static ramPlanningTodos: PlanningTodo[] = [];
  private static ramExternalTasks: any[] = [];
  private static ramExternalSources: any[] = [];
  private static ramExternalSyncQueue: any[] = [];

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

      // 4B. Fetch Task Periods (Deprecated)
      this.ramPeriods = [];
      this.addLog(`CLOUD_SYNC: TASK PERIODS ARE DEPRECATED. SKIPPED SYNC.`, 'info');

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
      let taskQuery = supabase
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
        .eq('user_id', this.cachedUserId);

      if (this.hideCompleted) {
        taskQuery = taskQuery.eq('completed', false);
      }

      const { data: tasksData, error: tasksErr } = await taskQuery.order('position', { ascending: true });

      if (!tasksErr && tasksData) {
        this.ramTasks = (tasksData as any[]).map(t => {
          const mapped = mapTaskFromDb(t);

          // Resolve group and category models
          const categoryObj = t.category;
          const groupObj = t.group || categoryObj?.group;
          
          const colorObj = groupObj?.color;
          const catColorObj = categoryObj?.color;

          return {
            ...mapped,
            task_period_id: null,
            urgency_level: mapped.is_completed ? 'low' : this.calculateUrgency(mapped.due_date),
            group_name: groupObj?.name || undefined,
            group_color: colorObj?.name || undefined,
            group_color_hex: colorObj?.hex_code || undefined,
            category_name: categoryObj?.name || undefined,
            category_color_hex: catColorObj?.hex_code || undefined,
            period_name: undefined,
            period_icon: undefined,
            period_color: undefined
          };
        });
        this.addLog(`CLOUD_SYNC: ${tasksData.length} INTEGRATED TASKS RELATIONALLY ALIGNED IN RAM (FILTRADO: ${this.hideCompleted}).`, 'success');
      }

      // 5B. Fetch stats of all tasks (weightless status list) from Supabase purely for metrics/counters
      try {
        const { data: statsRawData, error: statsRawErr } = await supabase
          .from('tasks')
          .select('id, completed, deadline, urgency, created_at, task_period_id, group_id, category_id, time_period')
          .eq('user_id', this.cachedUserId);

        if (!statsRawErr && statsRawData) {
          this.ramTaskStats = (statsRawData as any[]).map(t => {
            const completedVal = t.completed ?? false;
            const deadlineVal = t.deadline ?? null;
            const urgencyVal = t.urgency ?? 'low';
            return {
              id: t.id,
              is_completed: completedVal,
              completed: completedVal,
              due_date: deadlineVal,
              deadline: deadlineVal,
              urgency_level: urgencyVal,
              urgency: urgencyVal,
              created_at: t.created_at,
              task_period_id: t.task_period_id,
              group_id: t.group_id,
              category_id: t.category_id,
              time_period: t.time_period
            };
          });
        }
      } catch (err) {
        console.warn("Failed to retrieve statistics payload from database:", err);
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

      // 9. Agenda Blocks & Todos module synchronization
      try {
        // Execute automatic weekly cycle check before fetching blocks & todos
        try {
          await this.checkAndRunWeeklyCycle();
        } catch (cycleErr) {
          console.warn("Skipping weekly cycle check during sync: tables might not exist yet.", cycleErr);
        }

        const blocks = await getAgendaBlocks();
        this.ramAgendaBlocks = blocks;
        const todos = await getAgendaTodos();
        this.ramAgendaTodos = todos;

        // Fetch planning todos
        try {
          const ptodos = await getPlanningTodos();
          this.ramPlanningTodos = ptodos;
          this.isPlanningTableMissing = false;
          this.addLog(`CLOUD_SYNC: ${blocks.length} AGENDA BLOCKS, ${todos.length} PENDING ITEMS, AND ${ptodos.length} PLANNING ITEMS SYNCHRONIZED.`, 'success');
        } catch (ptodoErr: any) {
          console.warn("Planning todos table might not exist yet:", ptodoErr);
          if (ptodoErr.message === "planning_todos_table_not_exists" || ptodoErr.message?.includes("planning_todos")) {
            this.isPlanningTableMissing = true;
          }
          this.addLog(`DB_WARN: TABELA 'planning_todos' NÃO DETECTADA. ADICIONE O SCHEMA SQL NAS CONFIGURAÇÕES.`, 'warning');
          this.ramPlanningTodos = [];
        }
      } catch (agendaErr) {
        console.warn("Skipped database loading of agenda; tables might not exist yet.", agendaErr);
      }

      // 10. Fetch external sources and tasks for unified operations (ETAPA 5)
      try {
        if (supabase) {
          const { data: sourcesData, error: sourcesErr } = await supabase
            .from('external_sources')
            .select('*')
            .eq('active', true);

          if (!sourcesErr && sourcesData) {
            this.ramExternalSources = sourcesData;
          }

          const { data: extTasksData, error: extTasksErr } = await supabase
            .from('external_tasks')
            .select('*')
            .eq('active', true);

          if (!extTasksErr && extTasksData) {
            this.ramExternalTasks = extTasksData;
            this.addLog(`CLOUD_SYNC: ${extTasksData.length} CLIENT PENDÊNCIAS INTEGRATED SECURELY.`, 'success');
          }

          const { data: queueData, error: queueErr } = await supabase
            .from('external_sync_queue')
            .select('*');

          if (!queueErr && queueData) {
            this.ramExternalSyncQueue = queueData;
          }
        }
      } catch (extErr) {
        console.warn("Skipped loading of external sources or tasks.", extErr);
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
  // EXTERNAL SOURCES GETTER
  // ==========================================
  static getExternalSources(): any[] {
    return this.ramExternalSources;
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

  static getUnifiedTasks(): UnifiedTask[] {
    const COLOR_NAME_TO_HEX: Record<string, string> = {
      blue: '#60a5fa',
      purple: '#c084fc',
      green: '#34d399',
      red: '#f87171',
      yellow: '#fbbf24',
      cyan: '#22d3ee',
      orange: '#fb923c'
    };

    // 1. Get all local tasks
    const localTasksUnified: UnifiedTask[] = this.getTasks().map(t => {
      // Priority mapping: Urgent=1, Moderate=2, Low/others=3
      let mappedPriority = 3;
      if (t.urgency_level === 'urgent') mappedPriority = 1;
      else if (t.urgency_level === 'moderate') mappedPriority = 2;

      return {
        id: t.id,
        user_id: t.user_id,
        title: t.title,
        description: t.description,
        completed: t.is_completed,
        group_id: t.group_id,
        category_id: t.category_id,
        block_id: null,
        source_type: 'local',
        source_id: null,
        created_at: t.created_at,
        updated_at: t.updated_at,
        is_external: false,
        external_source_name: 'TVA',
        original_external_id: null,
        priority: mappedPriority,
        due_date: t.due_date || null,
        group_name: t.group_name,
        group_color: t.group_color,
        group_color_hex: t.group_color_hex,
        category_name: t.category_name,
        category_color_hex: t.category_color_hex
      };
    });

    // 2. Get all external tasks
    const externalTasksUnified: UnifiedTask[] = this.ramExternalTasks
      .filter(et => et.active)
      .map(et => {
        const sourceObj = this.ramExternalSources.find(s => s.id === et.source_id);
        const catObj = this.ramCategories.find(c => c.id === et.mapped_category_id);
        const targetGroupId = et.mapped_group_id || catObj?.group_id;
        const groupObj = this.ramGroups.find(g => g.id === targetGroupId);

        const computedGroupColorName = groupObj?.color || 'blue';
        const computedGroupColorHex = COLOR_NAME_TO_HEX[computedGroupColorName] || '#60a5fa';
        const computedCategoryColorHex = catObj?.color ? COLOR_NAME_TO_HEX[catObj.color] : undefined;

        // Determine sync status from queue
        const queueItem = this.ramExternalSyncQueue.find(q => q.external_task_id === et.id);
        let syncStatus: 'synchronized' | 'pending' | 'failed' = 'synchronized';
        if (queueItem) {
          if (queueItem.status === 'PENDING' || queueItem.status === 'PROCESSING') {
            syncStatus = 'pending';
          } else if (queueItem.status === 'FAILED') {
            syncStatus = 'failed';
          }
        }

        return {
          id: et.id,
          user_id: et.user_id,
          title: et.title,
          description: et.description,
          completed: et.completed,
          group_id: et.mapped_group_id || null,
          category_id: et.mapped_category_id || null,
          block_id: et.mapped_block_id || null,
          source_type: 'external',
          source_id: et.source_id,
          created_at: et.created_at,
          updated_at: et.updated_at,
          is_external: true,
          external_source_name: sourceObj?.name || 'Cliente Externo',
          original_external_id: et.external_id,
          
          // Stage 7 Company Identity Profile mapping
          company_name: sourceObj?.company_name || sourceObj?.name || 'Cliente Externo',
          company_color: sourceObj?.company_color || '#00e5ff',
          company_icon: sourceObj?.company_icon || 'Building',
          company_type: sourceObj?.company_type || 'OUTROS',
          
          // Priorities and Deadlines
          priority: et.priority !== undefined && et.priority !== null ? Number(et.priority) : 3,
          due_date: et.due_date || null,
          
          // Stage 8 Preparation Mapping (Dual Coop)
          external_project_id: et.external_project_id || null,
          external_project_name: et.external_project_name || null,
          external_phase_id: et.external_phase_id || null,
          external_phase_name: et.external_phase_name || null,
          external_kanban_column: et.external_kanban_column || null,

          group_name: groupObj?.name || 'Geral',
          group_color: computedGroupColorName,
          group_color_hex: computedGroupColorHex,
          category_name: catObj?.name || '',
          category_color_hex: computedCategoryColorHex,
          sync_status: syncStatus
        };
      });

    // 3. Get all project issues (Central de Operações unificadora - local)
    const projectIssuesUnified: UnifiedTask[] = this.ramIssues.map(issue => {
      const projObj = this.ramProjects.find(p => p.id === issue.project_id);
      return {
        id: issue.id,
        user_id: issue.user_id,
        title: `[PROJETO] ${issue.title}`,
        description: issue.description,
        completed: issue.is_completed,
        group_id: null,
        category_id: null,
        block_id: null,
        source_type: 'project_issue',
        source_id: issue.project_id,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        is_external: false,
        external_source_name: projObj ? `PROJETO: ${projObj.name}` : 'Projeto Local',
        original_external_id: null,
        priority: 2, // Default priority = High (2) for project issues
        due_date: null,
        
        company_name: projObj?.name || 'Projeto',
        company_color: '#c084fc', // purple default for projects
        company_icon: 'FolderGit2'
      };
    });

    return [...localTasksUnified, ...externalTasksUnified, ...projectIssuesUnified];
  }

  static async toggleTaskCompletion(id: string, sourceType: 'local' | 'external' | 'project_issue', completed: boolean): Promise<any> {
    if (sourceType === 'local') {
      return await this.updateTask(id, { is_completed: completed });
    } else if (sourceType === 'project_issue') {
      return await this.updateProjectIssue(id, { is_completed: completed });
    } else {
      const previousExternalTasks = [...this.ramExternalTasks];
      this.ramExternalTasks = this.ramExternalTasks.map(et => {
        if (et.id === id) {
          return { ...et, completed, updated_at: new Date().toISOString() };
        }
        return et;
      });

      if (supabase && this.cachedUserId !== 'user-default') {
        try {
          const { error } = await supabase
            .from('external_tasks')
            .update({ completed, updated_at: new Date().toISOString() })
            .eq('id', id);

          if (error) throw error;
          this.addLog(`AGREGADOR: Pendência externa atualizada para ${completed ? 'CONCLUÍDA' : 'EM ANDAMENTO'}.`, 'success');

          // Propagar alteração de status via sincronizador reverso bidirecional
          fetch('/api/sync-external/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              operation: 'UPDATE',
              taskId: id,
              completed
            })
          }).then(async (res) => {
            const data = await res.json();
            if (data?.success) {
              this.addLog(`RECIPROCIDADE: Sincronia de status da tarefa completada com sucesso.`, 'success');
            } else {
              this.addLog(`RECIPROCIDADE: Origem offline ou travada. Salvando sinal na fila de contingência.`, 'warning');
            }
            this.pullFromSupabase();
          }).catch(err => {
            this.addLog(`RECIPROCIDADE_ERR: Erro de transmissão do sinal push: ${err.message}`, 'error');
          });

        } catch (err: any) {
          this.ramExternalTasks = previousExternalTasks;
          this.addLog(`AGREGADOR_ERR: Falha ao atualizar pendência externa: ${err.message}`, 'error');
          throw err;
        }
      }

      this.triggerDataRefreshCallbacks();
      return this.getUnifiedTasks();
    }
  }

  static async updateExternalTask(id: string, updates: { title?: string; description?: string }): Promise<any> {
    const previousExternalTasks = [...this.ramExternalTasks];
    this.ramExternalTasks = this.ramExternalTasks.map(et => {
      if (et.id === id) {
        return { ...et, ...updates, updated_at: new Date().toISOString() };
      }
      return et;
    });

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        const { error } = await supabase
          .from('external_tasks')
          .update({
            ...(updates.title !== undefined ? { title: updates.title } : {}),
            ...(updates.description !== undefined ? { description: updates.description } : {}),
            updated_at: new Date().toISOString()
          })
          .eq('id', id);

        if (error) throw error;
        this.addLog(`AGREGADOR: Pendência externa atualizada localmente. Propagando...`, 'success');

        // Propagate updates to remote database
        fetch('/api/sync-external/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation: 'UPDATE',
            taskId: id,
            title: updates.title,
            description: updates.description
          })
        }).then(async (res) => {
          const data = await res.json();
          if (data?.success) {
            this.addLog(`RECIPROCIDADE: Atualização de texto propagada com sucesso à fonte.`, 'success');
          } else {
            this.addLog(`RECIPROCIDADE: Falha ao propagar texto na origem. Salvo na fila.`, 'warning');
          }
          this.pullFromSupabase();
        }).catch(err => {
          this.addLog(`RECIPROCIDADE_ERR: Falha de envio do push de texto: ${err.message}`, 'error');
        });

      } catch (err: any) {
        this.ramExternalTasks = previousExternalTasks;
        this.addLog(`AGREGADOR_ERR: Falha ao editar pendência externa: ${err.message}`, 'error');
        throw err;
      }
    }

    this.triggerDataRefreshCallbacks();
    return this.getUnifiedTasks();
  }

  static async deleteExternalTask(id: string, deleteRemote: boolean): Promise<any> {
    const previousExternalTasks = [...this.ramExternalTasks];
    this.ramExternalTasks = this.ramExternalTasks.filter(et => et.id !== id);

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        this.addLog(`AGREGADOR: Solicitando deleção de pendência externa...`, 'info');

        // Execute deletion bidirectionally through the server push API
        const res = await fetch('/api/sync-external/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation: 'DELETE',
            taskId: id,
            deleteRemote
          })
        });

        const data = await res.json();
        if (data?.success) {
          this.addLog(`AGREGADOR: Deleção bidirecional realizada com sucesso: ${data.message}`, 'success');
        } else {
          // If fail, we don't bring back the RAM task because local database deletion or Remote deletion was handled inside api route
          this.addLog(`AGREGADOR: Erro ao realizar deleção bidirecional: ${data.error || 'Erro desconhecido'}`, 'error');
        }

        // Always pull fresh state from database to represent final deleted state
        await this.pullFromSupabase();

      } catch (err: any) {
        this.ramExternalTasks = previousExternalTasks;
        this.addLog(`AGREGADOR_ERR: Falha de comunicação de deleção: ${err.message}`, 'error');
        throw err;
      }
    }

    this.triggerDataRefreshCallbacks();
    return this.getUnifiedTasks();
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
  // TASK PERIODS CRUD (Deprecated / Stubs for backwards compatibility)
  // ==========================================
  static getTaskPeriods(): TaskPeriod[] {
    return [];
  }

  static async saveTaskPeriod(name: string, icon: string, color: string): Promise<TaskPeriod> {
    const id = generateUUID();
    const newPeriod: TaskPeriod = {
      id,
      user_id: this.cachedUserId,
      name,
      icon,
      color,
      position: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    return newPeriod;
  }

  static async updateTaskPeriod(id: string, updates: Partial<TaskPeriod>): Promise<TaskPeriod[]> {
    return [];
  }

  static async deleteTaskPeriod(
    id: string,
    transitionMode: 'move' | 'unassign' | 'delete',
    targetPeriodId?: string
  ): Promise<TaskPeriod[]> {
    return [];
  }

  static async reorderTaskPeriods(reordered: TaskPeriod[]): Promise<void> {
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
        time_period: t.timePeriod,
        project_issue_id: issueId
      };

      this.ramTasks.push(newTask);

      if (supabase && this.cachedUserId !== 'user-default') {
        try {
          const created = await createSupabaseTask({
            id: taskId,
            group_id: t.groupId,
            category_id: t.categoryId,
            task_period_id: t.taskPeriodId,
            title: t.title,
            description: t.description || null,
            due_date: t.dueDate,
            is_completed: false,
            position: maxPos,
            time_period: t.timePeriod,
            project_issue_id: issueId
          });
          
          // Update model to match database inputs
          this.ramTasks = this.ramTasks.map(task => task.id === taskId ? created : task);
          this.addLog(`CLOUD_WRITE_SUCCESS: PROJECT TASK SYNCED TO SUPABASE.`, 'success');
        } catch (err: any) {
          // Rollback optimistic update on cloud save failure
          this.ramTasks = this.ramTasks.filter(task => task.id !== taskId);
          const processedErr = err instanceof Error ? err : new Error(err?.message || JSON.stringify(err) || String(err));
          this.addLog(`TASK GENERATION CLOUD FAIL: ${processedErr.message}`, 'error');
          throw processedErr;
        }
      }
    }

    this.addLog(`TASKS COMPILED SUCCESSFULLY FOR WORKSTREAM RELAXATION.`, 'success');
    this.triggerDataRefreshCallbacks();
  }

  // ==========================================
  // REAL-TIME AGENDA SYSTEM WRAPPERS (EXCLUSIVAMENTE SUPABASE)
  // ==========================================

  static getAgendaBlocks(): AgendaBlock[] {
    if (this.ramAgendaBlocks.length === 0 && this.cachedUserId === 'user-default') {
      this.ramAgendaBlocks = [
        {
          id: 'block-biologia',
          user_id: 'user-default',
          day_of_week: 0, // Segunda
          start_time: '07:30',
          end_time: '10:00',
          name: 'Aula de Biologia',
          color: 'blue',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'block-foco-web',
          user_id: 'user-default',
          day_of_week: 0, // Segunda
          start_time: '10:15',
          end_time: '12:30',
          name: 'Desenvolvimento Web',
          color: 'green',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
    }
    return this.ramAgendaBlocks;
  }

  static getAgendaTodos(): AgendaTodo[] {
    if (this.ramAgendaTodos.length === 0 && this.cachedUserId === 'user-default') {
      this.ramAgendaTodos = [
        {
          id: 'todo-bio-1',
          user_id: 'user-default',
          block_id: 'block-biologia',
          title: 'Assistir aula sobre genética',
          completed: false,
          group_id: null,
          category_id: null,
          position: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'todo-bio-2',
          user_id: 'user-default',
          block_id: 'block-biologia',
          title: 'Resolver lista 03',
          completed: false,
          group_id: null,
          category_id: null,
          position: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'todo-bio-3',
          user_id: 'user-default',
          block_id: 'block-biologia',
          title: 'Revisar anotações',
          completed: true,
          group_id: null,
          category_id: null,
          position: 2,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'todo-web-1',
          user_id: 'user-default',
          block_id: 'block-foco-web',
          title: 'Implementar as interfaces da agenda',
          completed: false,
          group_id: null,
          category_id: null,
          position: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
    }
    return this.ramAgendaTodos;
  }

  static async saveAgendaBlock(dayOfWeek: number, startTime: string, endTime: string, name: string, color?: string, description?: string): Promise<AgendaBlock> {
    const tempId = 'block-' + Math.random().toString(36).substr(2, 9);
    const newBlock: AgendaBlock = {
      id: tempId,
      user_id: this.cachedUserId,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      name,
      color: color || 'blue',
      description: description || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.ramAgendaBlocks.push(newBlock);
    this.addLog(`AGENDA_WRITE: BLOCK "${name}" ADDED TO RAM TEMPLATE`, 'success');

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        const created = await createAgendaBlock({ day_of_week: dayOfWeek, start_time: startTime, end_time: endTime, name, color, description });
        this.ramAgendaBlocks = this.ramAgendaBlocks.map(b => b.id === tempId ? created : b);
        this.addLog(`CLOUD_WRITE_SUCCESS: AGENDA BLOCK PERSISTED TO SUPABASE`, 'success');
      } catch (err: any) {
        this.ramAgendaBlocks = this.ramAgendaBlocks.filter(b => b.id !== tempId);
        this.addLog(`CLOUD_WRITE_ERR: BLOCK CREATE FAILED: ${err.message}`, 'error');
        throw err;
      }
    }
    this.triggerDataRefreshCallbacks();
    return newBlock;
  }

  static async updateAgendaBlock(id: string, updates: Partial<AgendaBlock>): Promise<AgendaBlock[]> {
    this.ramAgendaBlocks = this.ramAgendaBlocks.map(b => b.id === id ? { ...b, ...updates, updated_at: new Date().toISOString() } : b);
    
    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        await updateAgendaBlock(id, updates);
        this.addLog(`CLOUD_WRITE_SUCCESS: AGENDA BLOCK UPDATED ON SUPABASE`, 'success');
      } catch (err: any) {
        this.addLog(`CLOUD_WRITE_ERR: BLOCK EDIT FAILED: ${err.message}`, 'error');
      }
    }
    this.triggerDataRefreshCallbacks();
    return this.ramAgendaBlocks;
  }

  static async deleteAgendaBlock(id: string): Promise<AgendaBlock[]> {
    this.ramAgendaBlocks = this.ramAgendaBlocks.filter(b => b.id !== id);
    this.ramAgendaTodos = this.ramAgendaTodos.filter(t => t.block_id !== id);

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        await deleteAgendaBlock(id);
        this.addLog(`CLOUD_WRITE_SUCCESS: AGENDA BLOCK WIPED FROM SUPABASE`, 'success');
      } catch (err: any) {
        this.addLog(`CLOUD_WRITE_ERR: BLOCK DELETE FAILED: ${err.message}`, 'error');
      }
    }
    this.triggerDataRefreshCallbacks();
    return this.ramAgendaBlocks;
  }

  static async duplicateAgendaBlock(id: string, targetDayOfWeek?: number): Promise<AgendaBlock | null> {
    const block = this.ramAgendaBlocks.find(b => b.id === id);
    if (!block) return null;

    const blockTodos = this.ramAgendaTodos.filter(t => t.block_id === id);
    const targetDay = targetDayOfWeek !== undefined ? targetDayOfWeek : block.day_of_week;

    const duplicatedBlock = await this.saveAgendaBlock(
      targetDay,
      block.start_time,
      block.end_time,
      `${block.name} (Cópia)`,
      block.color || undefined,
      block.description || undefined
    );

    for (const todo of blockTodos) {
      await this.saveAgendaTodo(duplicatedBlock.id, todo.title, todo.group_id, todo.category_id);
    }

    return duplicatedBlock;
  }

  static async copyDayAgenda(fromDay: number, targetDays: number[], mode: 'merge' | 'replace'): Promise<void> {
    if (!supabase || this.cachedUserId === 'user-default') {
      const sourceBlocks = this.ramAgendaBlocks.filter(b => b.day_of_week === fromDay);
      for (const targetDay of targetDays) {
        if (mode === 'replace') {
          const blockIdsToDelete = this.ramAgendaBlocks
            .filter(b => b.day_of_week === targetDay)
            .map(b => b.id);
          this.ramAgendaTodos = this.ramAgendaTodos.filter(t => !blockIdsToDelete.includes(t.block_id));
          this.ramAgendaBlocks = this.ramAgendaBlocks.filter(b => b.day_of_week !== targetDay);
        }
        for (const block of sourceBlocks) {
          const tempId = 'block-' + Math.random().toString(36).substr(2, 9);
          this.ramAgendaBlocks.push({
            ...block,
            id: tempId,
            day_of_week: targetDay,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      }
      this.triggerDataRefreshCallbacks();
      return;
    }

    const sourceBlocks = this.ramAgendaBlocks.filter(b => b.day_of_week === fromDay);
    if (sourceBlocks.length === 0) {
      this.addLog(`COPY_DAY_WARN: NO BLOCKS TO COPY FROM DAY ${fromDay}`, 'warning');
      return;
    }

    try {
      this.addLog(`COPY_DAY_START: COPYING ${sourceBlocks.length} BLOCKS FROM DAY ${fromDay}`, 'system');

      if (mode === 'replace') {
        const { error: deleteErr } = await supabase
          .from('agenda_blocks')
          .delete()
          .eq('user_id', this.cachedUserId)
          .in('day_of_week', targetDays);

        if (deleteErr) {
          throw new Error(`Erro ao deletar blocos anteriores: ${deleteErr.message}`);
        }
        this.addLog(`COPY_DAY_WIP: OLD BLOCKS REPLACED ON TARGET DAYS`, 'success');
      }

      const payloads: any[] = [];
      for (const targetDay of targetDays) {
        for (const block of sourceBlocks) {
          payloads.push({
            user_id: this.cachedUserId,
            day_of_week: targetDay,
            start_time: block.start_time,
            end_time: block.end_time,
            name: block.name,
            color: block.color || 'blue',
            description: block.description || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      }

      if (payloads.length > 0) {
        const { error: insertErr } = await supabase
          .from('agenda_blocks')
          .insert(payloads);

        if (insertErr) {
          throw new Error(`Erro ao inserir novos blocos: ${insertErr.message}`);
        }
        this.addLog(`COPY_DAY_SUCCESS: ALL BLOCKS DUPLICATED ON TARGET DAYS`, 'success');
      }

      await this.pullFromSupabase();
    } catch (err: any) {
      this.addLog(`COPY_DAY_ERR: FAILED TO COPY DAY AGENDA: ${err.message}`, 'error');
      throw err;
    }
  }

  static async saveAgendaTodo(blockId: string, title: string, groupId?: string | null, categoryId?: string | null): Promise<AgendaTodo> {
    const tempId = 'todo-' + Math.random().toString(36).substr(2, 9);
    const maxPos = this.ramAgendaTodos.filter(t => t.block_id === blockId).length;

    const newTodo: AgendaTodo = {
      id: tempId,
      user_id: this.cachedUserId,
      block_id: blockId,
      title,
      completed: false,
      group_id: groupId || null,
      category_id: categoryId || null,
      position: maxPos,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.ramAgendaTodos.push(newTodo);
    this.addLog(`AGENDA_WRITE: TODO "${title}" SEEDED INTO BLOCK RAM`, 'success');

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        const created = await createAgendaTodo({ block_id: blockId, title, group_id: groupId, category_id: categoryId, position: maxPos });
        this.ramAgendaTodos = this.ramAgendaTodos.map(t => t.id === tempId ? created : t);
        this.addLog(`CLOUD_WRITE_SUCCESS: AGENDA ITEM PERSISTED KEY-VALUE`, 'success');
      } catch (err: any) {
        this.ramAgendaTodos = this.ramAgendaTodos.filter(t => t.id !== tempId);
        this.addLog(`CLOUD_WRITE_ERR: ITEM CREATE PARTITION FAIL: ${err.message}`, 'error');
        throw err;
      }
    }
    this.triggerDataRefreshCallbacks();
    return newTodo;
  }

  static async updateAgendaTodo(id: string, updates: Partial<AgendaTodo>): Promise<AgendaTodo[]> {
    this.ramAgendaTodos = this.ramAgendaTodos.map(t => t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t);

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        await updateAgendaTodo(id, updates);
        this.addLog(`CLOUD_WRITE_SUCCESS: AGENDA ITEM STATE MODIFIED`, 'success');
      } catch (err: any) {
        this.addLog(`CLOUD_WRITE_ERR: ITEM UPDATE FAIL: ${err.message}`, 'error');
      }
    }
    this.triggerDataRefreshCallbacks();
    return this.ramAgendaTodos;
  }

  static async deleteAgendaTodo(id: string): Promise<AgendaTodo[]> {
    this.ramAgendaTodos = this.ramAgendaTodos.filter(t => t.id !== id);

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        await deleteAgendaTodo(id);
        this.addLog(`CLOUD_WRITE_SUCCESS: AGENDA ITEM DELETED FROM CLOUD`, 'success');
      } catch (err: any) {
        this.addLog(`CLOUD_WRITE_ERR: ITEM SCRUB CORRUPTION: ${err.message}`, 'error');
      }
    }
    this.triggerDataRefreshCallbacks();
    return this.ramAgendaTodos;
  }

  // ==========================================
  // PLANNING PACK & PLANNING TODOS WRAPPERS
  // ==========================================

  static getPlanningTodos(): PlanningTodo[] {
    return this.ramPlanningTodos;
  }

  static async createPlanningTodo(todo: Omit<PlanningTodo, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<PlanningTodo[]> {
    const tempId = 'plan-' + Math.random().toString(36).substr(2, 9);
    const mockTodo: PlanningTodo = {
      id: tempId,
      user_id: this.cachedUserId,
      title: todo.title,
      days_of_week: todo.days_of_week,
      block_name: todo.block_name,
      requires_link: todo.requires_link,
      link: todo.link || null,
      active: todo.active ?? true,
      completed: todo.completed ?? false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.ramPlanningTodos.push(mockTodo);

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        const created = await createPlanningTodo(todo);
        this.ramPlanningTodos = this.ramPlanningTodos.map(t => t.id === tempId ? created : t);
        this.isPlanningTableMissing = false;
        this.addLog(`PLANNING_SYNC: NEW ITEM RECORDED SUCCESS IN CLOUD`, 'success');
      } catch (err: any) {
        if (err.message === "planning_todos_table_not_exists" || err.message?.includes("planning_todos") || err.message?.includes("does not exist") || err.message?.includes("completed") || err.message?.includes("column")) {
          this.isPlanningTableMissing = true;
        }
        this.addLog(`PLANNING_SYNC_ERR: CLOUD CREATE FAILED: ${err.message}`, 'error');
        // Remove from ram cache as it failed
        this.ramPlanningTodos = this.ramPlanningTodos.filter(t => t.id !== tempId);
        throw err;
      }
    }

    this.triggerDataRefreshCallbacks();
    return this.ramPlanningTodos;
  }

  static async updatePlanningTodo(id: string, updates: Partial<Omit<PlanningTodo, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<PlanningTodo[]> {
    this.ramPlanningTodos = this.ramPlanningTodos.map(t => 
      t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t
    );

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        await updatePlanningTodo(id, updates);
        this.isPlanningTableMissing = false;
        this.addLog(`PLANNING_SYNC: ITEM MODIFIED SUCCESS IN CLOUD`, 'success');
      } catch (err: any) {
        if (err.message === "planning_todos_table_not_exists" || err.message?.includes("planning_todos") || err.message?.includes("does not exist") || err.message?.includes("completed") || err.message?.includes("column")) {
          this.isPlanningTableMissing = true;
        }
        this.addLog(`PLANNING_SYNC_ERR: CLOUD UPDATE FAILED: ${err.message}`, 'error');
      }
    }

    this.triggerDataRefreshCallbacks();
    return this.ramPlanningTodos;
  }

  static async deletePlanningTodo(id: string): Promise<PlanningTodo[]> {
    this.ramPlanningTodos = this.ramPlanningTodos.filter(t => t.id !== id);

    if (supabase && this.cachedUserId !== 'user-default') {
      try {
        await deletePlanningTodo(id);
        this.isPlanningTableMissing = false;
        this.addLog(`PLANNING_SYNC: ITEM DELETED SUCCESS FROM CLOUD`, 'success');
      } catch (err: any) {
        if (err.message === "planning_todos_table_not_exists" || err.message?.includes("planning_todos") || err.message?.includes("does not exist") || err.message?.includes("completed") || err.message?.includes("column")) {
          this.isPlanningTableMissing = true;
        }
        this.addLog(`PLANNING_SYNC_ERR: CLOUD DELETE FAILED: ${err.message}`, 'error');
      }
    }

    this.triggerDataRefreshCallbacks();
    return this.ramPlanningTodos;
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
    const plan = await getOrCreateSupabaseWeeklyPlan(weekStartDate);
    if (!this.ramWeeklyPlans.some(p => p.id === plan.id)) {
      this.ramWeeklyPlans.unshift(plan);
    }
    this.triggerDataRefreshCallbacks();
    return plan;
  }

  static async saveWeeklyPlanTopic(weeklyPlanId: string, categoryId: string, weekday: number): Promise<WeeklyPlanTopic> {
    const created = await saveSupabaseWeeklyPlanTopic(weeklyPlanId, categoryId, weekday);
    this.ramWeeklyPlanTopics = this.ramWeeklyPlanTopics.filter(
      wpt => !(wpt.weekly_plan_id === weeklyPlanId && wpt.category_id === categoryId && wpt.weekday === weekday)
    );
    this.ramWeeklyPlanTopics.push(created);
    this.triggerDataRefreshCallbacks();
    return created;
  }

  static async deleteWeeklyPlanTopic(weeklyPlanId: string, categoryId: string, weekday: number): Promise<void> {
    await deleteSupabaseWeeklyPlanTopic(weeklyPlanId, categoryId, weekday);
    this.ramWeeklyPlanTopics = this.ramWeeklyPlanTopics.filter(
      wpt => !(wpt.weekly_plan_id === weeklyPlanId && wpt.category_id === categoryId && wpt.weekday === weekday)
    );
    this.triggerDataRefreshCallbacks();
  }

  static async clearWeeklyPlanDay(weeklyPlanId: string, weekday: number): Promise<void> {
    await clearSupabaseWeeklyPlanDay(weeklyPlanId, weekday);
    this.ramWeeklyPlanTopics = this.ramWeeklyPlanTopics.filter(
      wpt => !(wpt.weekly_plan_id === weeklyPlanId && wpt.weekday === weekday)
    );
    this.triggerDataRefreshCallbacks();
  }

  // ==========================================
  // CUSTOM ADVANCED QUERY METHODS (SUPABASE EXCLUSIVE)
  // ==========================================
  static async fetchTodaysCategoriesWithTasks(weekday: number, mondayStr: string): Promise<TaskCategory[]> {
    if (!supabase || this.cachedUserId === 'user-default') {
      return [];
    }

    try {
      // 1. Get weekly plan
      const { data: plans } = await supabase
        .from('weekly_plans')
        .select('id')
        .eq('week_start_date', mondayStr)
        .eq('user_id', this.cachedUserId);

      if (!plans || plans.length === 0) return [];
      const planId = plans[0].id;

      // 2. Query categories that have weekly_plan_topics for this plan and weekday,
      // and have at least one pending (completed: false) task. We run nested subquery style / Join in Supabase
      const { data: topicData, error: topicsErr } = await supabase
        .from('weekly_plan_topics')
        .select('category_id')
        .eq('weekly_plan_id', planId)
        .eq('weekday', weekday);

      if (topicsErr || !topicData || topicData.length === 0) return [];
      const categoryIds = topicData.map((t: any) => t.category_id);

      // Now query tasks to find which of these categoryIds has at least one pending task.
      const { data: activeTasks, error: tasksErr } = await supabase
        .from('tasks')
        .select('category_id')
        .eq('completed', false)
        .in('category_id', categoryIds);

      if (tasksErr || !activeTasks || activeTasks.length === 0) return [];
      const activeIds = Array.from(new Set(activeTasks.map((t: any) => t.category_id)));

      // Fetch the full categories with groups
      const { data: finalCats, error: finalErr } = await supabase
        .from('task_categories')
        .select(`
          *,
          group:task_groups(
            *,
            color:custom_colors(*)
          ),
          color:custom_colors(*)
        `)
        .in('id', activeIds);

      if (finalErr || !finalCats) return [];
      return finalCats;
    } catch (err) {
      console.error("fetchTodaysCategoriesWithTasks failed, searching on fallback:", err);
      return [];
    }
  }

  // ==========================================
  // HISTORIC AGENDA CYCLE METHODS
  // ==========================================

  static getISOWeekString(date: Date = new Date()): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }

  static async getAgendaClosures(): Promise<AgendaClosure[]> {
    if (!supabase || this.cachedUserId === 'user-default') return [];
    try {
      return await getAgendaClosures();
    } catch (err: any) {
      this.addLog(`DB_ERR: BUSCA DE FECHAMENTOS: ${err.message}`, 'error');
      return [];
    }
  }

  static async getAgendaHistoryItems(weekCode?: string): Promise<AgendaHistoryItem[]> {
    if (!supabase || this.cachedUserId === 'user-default') return [];
    try {
      return await getAgendaHistoryItems(weekCode);
    } catch (err: any) {
      this.addLog(`DB_ERR: BUSCA DE HISTÓRICO: ${err.message}`, 'error');
      return [];
    }
  }

  static async checkAndRunWeeklyCycle(): Promise<void> {
    if (!supabase || this.cachedUserId === 'user-default') return;

    try {
      const currentWeekCode = this.getISOWeekString(new Date());
      const now = new Date();
      const prevWeekDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const prevWeekCode = this.getISOWeekString(prevWeekDate);

      this.addLog(`WEEKLY_CYCLE: VALIDANDO PERÍODO ATIVO [${currentWeekCode}], ANTERIOR [${prevWeekCode}]`, 'info');

      const closures = await getAgendaClosures();
      const latestClosure = closures && closures.length > 0 ? closures[0] : null;

      if (!latestClosure) {
        this.addLog(`WEEKLY_CYCLE: NENHUM REGISTRO DE FECHAMENTO ENCONTRADO. CRIANDO MARCADOR DE BASE [${prevWeekCode}]...`, 'system');
        
        const closurePayload = {
          user_id: this.cachedUserId,
          week_code: prevWeekCode,
          closed_at: new Date().toISOString()
        };

        const { error: insertErr } = await supabase
          .from('agenda_closures')
          .insert(closurePayload);

        if (insertErr) {
          console.error("Error writing initial week closure:", insertErr);
          throw insertErr;
        }

        this.addLog(`WEEKLY_CYCLE: REGISTRO DE BASE GRAVADO COM SUCESSO.`, 'success');
        return;
      }

      const lastClosedWeek = latestClosure.week_code;

      if (lastClosedWeek === prevWeekCode || lastClosedWeek === currentWeekCode) {
        this.addLog(`WEEKLY_CYCLE: AGENDA UP-TO-DATE. ENVELOPE ESTÁVEL SUCESSO.`, 'info');
        return;
      }

      this.addLog(`WEEKLY_CYCLE: TRANSIÇÃO DETECTADA! EXECUTANDO FECHAMENTO AUTOMÁTICO DE [${prevWeekCode}]...`, 'warning');

      const blocks = await getAgendaBlocks();
      const todos = await getAgendaTodos();

      if (todos.length === 0) {
        const { error: stampErr } = await supabase
          .from('agenda_closures')
          .insert({
            user_id: this.cachedUserId,
            week_code: prevWeekCode,
            closed_at: new Date().toISOString()
          });

        if (stampErr) throw stampErr;
        this.addLog(`WEEKLY_CYCLE: SEMANA ANTERIOR [${prevWeekCode}] ENCERRADA SEM ITENS.`, 'info');
        return;
      }

      const historyPayload = todos.map(todo => {
        const parentBlock = blocks.find(b => b.id === todo.block_id);
        return {
          user_id: this.cachedUserId,
          week_code: prevWeekCode,
          block_name: parentBlock?.name || 'Bloco Desconhecido',
          block_color: parentBlock?.color || 'blue',
          todo_title: todo.title,
          completed: todo.completed,
          day_of_week: parentBlock?.day_of_week ?? 0,
          created_at: new Date().toISOString()
        };
      });

      const { error: insertHistErr } = await supabase
        .from('agenda_history_items')
        .insert(historyPayload);

      if (insertHistErr) {
        this.addLog(`WEEKLY_CYCLE: FALHA AO INSERIR REGISTROS HISTÓRICOS: ${insertHistErr.message}`, 'error');
        throw insertHistErr;
      }

      const completedIds = todos.filter(t => t.completed).map(t => t.id);

      if (completedIds.length > 0) {
        const { error: deleteTodosErr } = await supabase
          .from('agenda_todos')
          .delete()
          .in('id', completedIds);

        if (deleteTodosErr) {
          this.addLog(`WEEKLY_CYCLE: FALHA AO LIMPAR ITENS CONCLUÍDOS: ${deleteTodosErr.message}`, 'error');
          throw deleteTodosErr;
        }

        this.addLog(`WEEKLY_CYCLE: ${completedIds.length} PENDÊNCIAS CONCLUÍDAS ARQUIVADAS.`, 'success');
      }

      const { error: finalClosureErr } = await supabase
        .from('agenda_closures')
        .insert({
          user_id: this.cachedUserId,
          week_code: prevWeekCode,
          closed_at: new Date().toISOString()
        });

      if (finalClosureErr) {
        this.addLog(`WEEKLY_CYCLE: FALHA AO REGISTRAR SELO DE FECHAMENTO: ${finalClosureErr.message}`, 'error');
        throw finalClosureErr;
      }

      this.addLog(`WEEKLY_CYCLE: FECHAMENTO SUCESSO [${prevWeekCode}]. CORRETAMENTE NA SEMANA ATIVA [${currentWeekCode}].`, 'success');
    } catch (cycleErr: any) {
      if (cycleErr?.message?.includes('agenda_closures') || cycleErr?.message?.includes('agenda_history_items')) {
        this.addLog(`WEEKLY_CYCLE_FAIL: Tabelas não encontradas no Supabase. Execute o assistente de SQL.`, 'error');
      } else {
        this.addLog(`WEEKLY_CYCLE_FAIL: FALHA NO SELETOR CRONOLÓGICO: ${cycleErr?.message || cycleErr}`, 'error');
      }
      throw cycleErr;
    }
  }
}
