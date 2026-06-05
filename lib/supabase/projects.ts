import { supabase } from '@/lib/supabase';

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

const getCurrentUserId = async (): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Usuário autenticado inválido ou nulo');
  }
  return user.id;
};

// ==========================================
// PROJECTS SERVICES
// ==========================================

export async function getProjects(): Promise<Project[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === '42P01') {
      console.warn("A tabela 'projects' não existe. Por favor execute as migrações SQL no painel.");
      return [];
    }
    throw error;
  }
  return data || [];
}

export async function createProject(project: Partial<Project>): Promise<Project> {
  const uid = await getCurrentUserId();
  const id = project.id || generateUUID();
  
  const payload = {
    id,
    user_id: uid,
    name: project.name || 'Novo Projeto',
    description: project.description || null,
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('projects')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project> {
  const uid = await getCurrentUserId();
  const payload: any = {
    ...updates,
    updated_at: new Date().toISOString()
  };
  delete payload.id;
  delete payload.user_id;

  const { data, error } = await supabase
    .from('projects')
    .update(payload)
    .eq('id', id)
    .eq('user_id', uid)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProject(id: string): Promise<void> {
  const uid = await getCurrentUserId();
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('user_id', uid);

  if (error) throw error;
}

// ==========================================
// PHASES SERVICES
// ==========================================

export async function getProjectPhases(projectId: string): Promise<ProjectPhase[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('project_phases')
    .select('*')
    .eq('project_id', projectId)
    .order('position', { ascending: true });

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }
  return data || [];
}

export async function createProjectPhase(phase: Partial<ProjectPhase>): Promise<ProjectPhase> {
  const uid = await getCurrentUserId();
  
  if (!phase.project_id) {
    throw new Error('project_id é obrigatório para criar uma fase');
  }

  const id = phase.id || generateUUID();
  const payload = {
    id,
    project_id: phase.project_id,
    user_id: uid,
    name: phase.name || 'Nova Fase',
    description: phase.description || null,
    position: phase.position ?? 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('project_phases')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProjectPhase(id: string, updates: Partial<ProjectPhase>): Promise<ProjectPhase> {
  const uid = await getCurrentUserId();
  const payload: any = {
    ...updates,
    updated_at: new Date().toISOString()
  };
  delete payload.id;
  delete payload.project_id;
  delete payload.user_id;

  const { data, error } = await supabase
    .from('project_phases')
    .update(payload)
    .eq('id', id)
    .eq('user_id', uid)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProjectPhase(id: string): Promise<void> {
  const uid = await getCurrentUserId();
  const { error } = await supabase
    .from('project_phases')
    .delete()
    .eq('id', id)
    .eq('user_id', uid);

  if (error) throw error;
}

export async function reorderProjectPhases(phases: ProjectPhase[]): Promise<void> {
  const uid = await getCurrentUserId();
  const promises = phases.map((phase, idx) =>
    supabase
      .from('project_phases')
      .update({ position: idx, updated_at: new Date().toISOString() })
      .eq('id', phase.id)
      .eq('user_id', uid)
  );
  await Promise.all(promises);
}

// ==========================================
// ISSUES (PENDÊNCIAS) SERVICES
// ==========================================

export async function getProjectIssues(projectId: string): Promise<ProjectIssue[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('project_issues')
    .select('*')
    .eq('project_id', projectId)
    .order('position', { ascending: true });

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }
  return data || [];
}

export async function createProjectIssue(issue: Partial<ProjectIssue>): Promise<ProjectIssue> {
  const uid = await getCurrentUserId();
  
  if (!issue.project_id || !issue.phase_id) {
    throw new Error('project_id e phase_id são obrigatórios para criar uma pendência');
  }

  const id = issue.id || generateUUID();
  const payload = {
    id,
    project_id: issue.project_id,
    phase_id: issue.phase_id,
    user_id: uid,
    title: issue.title || 'Nova Pendência',
    description: issue.description || null,
    is_completed: false,
    position: issue.position ?? 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('project_issues')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProjectIssue(id: string, updates: Partial<ProjectIssue>): Promise<ProjectIssue> {
  const uid = await getCurrentUserId();
  const payload: any = {
    ...updates,
    updated_at: new Date().toISOString()
  };
  delete payload.id;
  delete payload.project_id;
  delete payload.phase_id;
  delete payload.user_id;

  const { data, error } = await supabase
    .from('project_issues')
    .update(payload)
    .eq('id', id)
    .eq('user_id', uid)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProjectIssue(id: string): Promise<void> {
  const uid = await getCurrentUserId();
  const { error } = await supabase
    .from('project_issues')
    .delete()
    .eq('id', id)
    .eq('user_id', uid);

  if (error) throw error;
}
