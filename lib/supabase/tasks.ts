import { supabase } from '@/lib/supabase';

// Types exactly matching Supabase schema definitions and keeping UI compatibility
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
  due_date: string | null; // UI mapping
  urgency_level: 'low' | 'moderate' | 'urgent' | 'overdue'; // UI mapping
  is_completed: boolean; // UI mapping
  completed_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  
  // Database native mappings
  deadline?: string | null;
  urgency?: 'low' | 'moderate' | 'urgent';
  completed?: boolean;

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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Usuário autenticado inválido ou nulo');
  }
  return user.id;
};

// Map database format to TS UI Task type
export function mapTaskFromDb(t: any): Task {
  if (!t) return t;
  const deadlineVal = t.deadline ?? t.due_date ?? null;
  const completedVal = t.completed ?? t.is_completed ?? false;
  const urgencyVal = t.urgency ?? t.urgency_level ?? 'low';

  return {
    id: t.id,
    user_id: t.user_id,
    group_id: t.group_id,
    category_id: t.category_id,
    title: t.title,
    description: t.description ?? null,
    due_date: deadlineVal,
    urgency_level: urgencyVal === 'overdue' ? 'urgent' : urgencyVal,
    is_completed: completedVal,
    completed_at: t.completed_at ?? (completedVal ? t.updated_at || new Date().toISOString() : null),
    position: t.position ?? 0,
    created_at: t.created_at,
    updated_at: t.updated_at,
    deadline: deadlineVal,
    urgency: urgencyVal === 'overdue' ? 'urgent' : urgencyVal,
    completed: completedVal
  };
}

// ==========================================
// TASKS CRUD & DB SYNC SERVICES
// ==========================================

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
  return (data || []).map(mapTaskFromDb);
}

export async function createTask(task: Partial<Task>, userId?: string): Promise<Task> {
  // 2. VALIDAR AUTH
  const { data: { user } } = await supabase.auth.getUser();
  
  // 3. LOGS OBRIGATÓRIOS (AUTH USER)
  console.log("AUTH USER", user);

  if (!user) {
    const errorMsg = 'Usuário nulo ou sessão inválida. Impossível criar a tarefa.';
    console.error("SUPABASE ERROR", errorMsg);
    throw new Error(errorMsg);
  }

  const taskId = task.id || generateUUID();
  const position = task.position !== undefined ? task.position : 0;
  
  const rawDeadline = task.due_date || task.deadline || null;
  const rawUrgency = task.urgency_level || task.urgency || 'low';
  const mappedUrgency = rawUrgency === 'overdue' ? 'urgent' : rawUrgency;
  const rawCompleted = task.is_completed || task.completed || false;

  // 4. VALIDAR PAYLOAD
  // Toda task deve enviar: user_id, title, description, deadline, urgency, category_id, group_id, completed
  const payload = {
    id: taskId,
    user_id: user.id,
    title: task.title || 'Sem título',
    description: task.description || null,
    deadline: rawDeadline,
    urgency: mappedUrgency,
    category_id: task.category_id || null,
    group_id: task.group_id || null,
    completed: rawCompleted,
    position: position
  };

  // 3. LOGS OBRIGATÓRIOS (TASK PAYLOAD)
  console.log("TASK PAYLOAD", payload);

  const { data, error, status } = await supabase
    .from('tasks')
    .insert(payload)
    .select()
    .single();

  // 3. LOGS OBRIGATÓRIOS (SUPABASE RESPONSE & ERROR)
  console.log("SUPABASE RESPONSE", data);
  console.log("SUPABASE ERROR", error);

  if (error) {
    throw error;
  }
  
  return mapTaskFromDb(data);
}

export async function updateTask(id: string, updates: Partial<Task>, userId?: string): Promise<Task> {
  const uid = await getCurrentUserId(userId);
  
  const payload: any = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.group_id !== undefined) payload.group_id = updates.group_id;
  if (updates.category_id !== undefined) payload.category_id = updates.category_id;
  if (updates.position !== undefined) payload.position = updates.position;

  if (updates.due_date !== undefined || updates.deadline !== undefined) {
    payload.deadline = updates.due_date || updates.deadline || null;
  }
  if (updates.urgency_level !== undefined || updates.urgency !== undefined) {
    const rawUrgency = updates.urgency_level || updates.urgency;
    payload.urgency = rawUrgency === 'overdue' ? 'urgent' : rawUrgency;
  }
  if (updates.is_completed !== undefined || updates.completed !== undefined) {
    const isCompleted = updates.is_completed || updates.completed || false;
    payload.completed = isCompleted;
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
  return mapTaskFromDb(data);
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

export async function toggleTask(id: string, completed: boolean, userId?: string): Promise<Task> {
  const uid = await getCurrentUserId(userId);
  const { data, error } = await supabase
    .from('tasks')
    .update({ completed })
    .eq('id', id)
    .eq('user_id', uid)
    .select()
    .single();

  if (error) {
    console.error('toggleTask Error:', error);
    throw error;
  }
  return mapTaskFromDb(data);
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
