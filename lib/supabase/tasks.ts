import { supabase } from '@/lib/supabase';

// Types exactly matching Supabase schema definitions
export interface TaskGroup {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
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
  due_date: string | null;
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

const getCurrentUserId = async (passedId?: string): Promise<string> => {
  if (passedId) return passedId;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    throw new Error('Usuário autenticado inválido ou nulo');
  }
  return session.user.id;
};

// ==========================================
// TASKS CRUD & DB SYNC SERVICES
// ==========================================

export async function getTaskGroups(userId?: string): Promise<TaskGroup[]> {
  const uid = await getCurrentUserId(userId);
  const { data, error } = await supabase
    .from('task_groups')
    .select('*')
    .eq('user_id', uid)
    .order('position', { ascending: true });

  if (error) {
    console.error('getTaskGroups Error:', error);
    throw error;
  }
  return data || [];
}

export async function getCategories(userId?: string): Promise<TaskCategory[]> {
  const uid = await getCurrentUserId(userId);
  const { data, error } = await supabase
    .from('task_categories')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('getCategories Error:', error);
    throw error;
  }
  return data || [];
}

export async function getTasks(userId?: string): Promise<Task[]> {
  const uid = await getCurrentUserId(userId);
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', uid)
    .order('position', { ascending: true });

  if (error) {
    console.error('getTasks Error:', error);
    throw error;
  }
  return data || [];
}

export async function createTask(task: Partial<Task>, userId?: string): Promise<Task> {
  const uid = await getCurrentUserId(userId);
  const taskId = task.id || generateUUID();
  const position = task.position !== undefined ? task.position : 0;

  const payload = {
    ...task,
    id: taskId,
    user_id: uid,
    position,
    is_completed: task.is_completed || false,
    completed_at: task.is_completed ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from('tasks')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('createTask Error:', error);
    throw error;
  }
  return data;
}

export async function updateTask(id: string, updates: Partial<Task>, userId?: string): Promise<Task> {
  const uid = await getCurrentUserId(userId);
  const payload = { ...updates };
  if (updates.is_completed !== undefined) {
    payload.completed_at = updates.is_completed ? new Date().toISOString() : null;
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(payload)
    .eq('id', id)
    .eq('user_id', uid)
    .select()
    .single();

  if (error) {
    console.error('updateTask Error:', error);
    throw error;
  }
  return data;
}

export async function deleteTask(id: string, userId?: string): Promise<void> {
  const uid = await getCurrentUserId(userId);
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('user_id', uid);

  if (error) {
    console.error('deleteTask Error:', error);
    throw error;
  }
}

export async function reorderTasks(reordered: Task[], userId?: string): Promise<void> {
  const uid = await getCurrentUserId(userId);
  const promises = reordered.map((t, idx) =>
    supabase
      .from('tasks')
      .update({ position: idx })
      .eq('id', t.id)
      .eq('user_id', uid)
  );
  await Promise.all(promises);
}

export async function createGroup(name: string, description: string | null, color: string, userId?: string): Promise<TaskGroup> {
  const uid = await getCurrentUserId(userId);
  const groupId = generateUUID();

  // Find max position
  const existing = await getTaskGroups(uid);
  const nextPos = existing.length > 0 ? Math.max(...existing.map(g => g.position)) + 1 : 0;

  const payload = {
    id: groupId,
    user_id: uid,
    name,
    description,
    color,
    position: nextPos,
  };

  const { data, error } = await supabase
    .from('task_groups')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('createGroup Error:', error);
    throw error;
  }
  return data;
}

export async function updateGroup(id: string, updates: Partial<TaskGroup>, userId?: string): Promise<TaskGroup> {
  const uid = await getCurrentUserId(userId);
  const { data, error } = await supabase
    .from('task_groups')
    .update(updates)
    .eq('id', id)
    .eq('user_id', uid)
    .select()
    .single();

  if (error) {
    console.error('updateGroup Error:', error);
    throw error;
  }
  return data;
}

export async function deleteGroup(id: string, userId?: string): Promise<void> {
  const uid = await getCurrentUserId(userId);
  
  // Dependent categories and tasks inside this group should be handled on the DB cascading 
  // or cleaned up here. We can clean up dependants directly to avoid foreign key violations.
  const { error: taskErr } = await supabase
    .from('tasks')
    .delete()
    .eq('group_id', id)
    .eq('user_id', uid);

  if (taskErr) {
    console.error('Cascade delete tasks error:', taskErr);
  }

  const { error: catErr } = await supabase
    .from('task_categories')
    .delete()
    .eq('group_id', id)
    .eq('user_id', uid);

  if (catErr) {
    console.error('Cascade delete categories error:', catErr);
  }

  const { error } = await supabase
    .from('task_groups')
    .delete()
    .eq('id', id)
    .eq('user_id', uid);

  if (error) {
    console.error('deleteGroup Error:', error);
    throw error;
  }
}

export async function createCategory(groupId: string, name: string, color: string | null, userId?: string): Promise<TaskCategory> {
  const uid = await getCurrentUserId(userId);
  const catId = generateUUID();

  const payload = {
    id: catId,
    user_id: uid,
    group_id: groupId,
    name,
    color,
  };

  const { data, error } = await supabase
    .from('task_categories')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('createCategory Error:', error);
    throw error;
  }
  return data;
}

export async function updateCategory(id: string, updates: Partial<TaskCategory>, userId?: string): Promise<TaskCategory> {
  const uid = await getCurrentUserId(userId);
  const { data, error } = await supabase
    .from('task_categories')
    .update(updates)
    .eq('id', id)
    .eq('user_id', uid)
    .select()
    .single();

  if (error) {
    console.error('updateCategory Error:', error);
    throw error;
  }
  return data;
}

export async function deleteCategory(id: string, userId?: string): Promise<void> {
  const uid = await getCurrentUserId(userId);

  // Set category_id of associated tasks to null first
  const { error: taskErr } = await supabase
    .from('tasks')
    .update({ category_id: null })
    .eq('category_id', id)
    .eq('user_id', uid);

  if (taskErr) {
    console.error('Update tasks for category removal error:', taskErr);
  }

  const { error } = await supabase
    .from('task_categories')
    .delete()
    .eq('id', id)
    .eq('user_id', uid);

  if (error) {
    console.error('deleteCategory Error:', error);
    throw error;
  }
}
