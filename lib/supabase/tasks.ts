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
  due_date: string | null; // UI mapping
  urgency_level: 'low' | 'moderate' | 'urgent' | 'overdue'; // UI mapping
  is_completed: boolean; // UI mapping
  completed_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  notes?: string | null;
  status?: string | null;
  updated_by?: string | null;
  time_period?: string | null;
  project_issue_id?: string | null;
  
  // Database native mappings
  deadline?: string | null;
  urgency?: 'low' | 'moderate' | 'urgent';
  completed?: boolean;

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
    task_period_id: t.task_period_id ?? null,
    title: t.title,
    description: t.description ?? null,
    due_date: deadlineVal,
    urgency_level: urgencyVal === 'overdue' ? 'urgent' : urgencyVal,
    is_completed: completedVal,
    completed_at: t.completed_at ?? (completedVal ? t.updated_at || new Date().toISOString() : null),
    position: t.position ?? 0,
    created_at: t.created_at,
    updated_at: t.updated_at,
    notes: t.notes ?? null,
    status: t.status ?? null,
    updated_by: t.updated_by ?? null,
    deadline: deadlineVal,
    urgency: urgencyVal === 'overdue' ? 'urgent' : urgencyVal,
    completed: completedVal,
    time_period: t.time_period ?? null,
    project_issue_id: t.project_issue_id ?? null
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
    throw new Error(`Erro ao buscar tarefas (getTasks): ${error.message} - Code: ${error.code}`);
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

  const validLegacyPeriods = ['morning', 'afternoon', 'evening', 'tomorrow'];
  const checkedTimePeriod = task.time_period && validLegacyPeriods.includes(task.time_period)
    ? task.time_period
    : null;

  // 4. VALIDAR PAYLOAD
  // Toda task deve enviar: user_id, title, description, deadline, urgency, category_id, group_id, completed
  const payload: any = {
    id: taskId,
    user_id: user.id,
    title: task.title || 'Sem título',
    description: task.description || null,
    category_id: task.category_id || null,
    group_id: task.group_id || null,
    completed: rawCompleted,
    is_completed: rawCompleted,
    position: position,
    deadline: rawDeadline,
    urgency: mappedUrgency,
    time_period: checkedTimePeriod,
    task_period_id: task.task_period_id || null,
    project_issue_id: task.project_issue_id || null
  };

  // 3. LOGS OBRIGATÓRIOS (TASK PAYLOAD)
  console.log("TASK PAYLOAD ATTEMPT 1", payload);

  let { data, error, status } = await supabase
    .from('tasks')
    .insert(payload)
    .select()
    .single();

  // 3. LOGS OBRIGATÓRIOS (SUPABASE RESPONSE & ERROR)
  console.log("SUPABASE RESPONSE ATTEMPT 1", data);
  console.log("SUPABASE ERROR ATTEMPT 1", error);

  // Dynamic schema fallback if columns are missing: PostgrestError code 42703 (undefined_column)
  if (error && error.code === '42703') {
    console.warn("Detected missing columns in remote table schema. Retrying database save with pruned attributes...", error.message);
    const prunedPayload = { ...payload };
    delete prunedPayload.deadline;
    delete prunedPayload.urgency;
    delete prunedPayload.due_date;
    delete prunedPayload.urgency_level;
    delete prunedPayload.project_issue_id;

    console.log("TASK PAYLOAD ATTEMPT 2 (PRUNED)", prunedPayload);

    const retryRes = await supabase
      .from('tasks')
      .insert(prunedPayload)
      .select()
      .single();

    data = retryRes.data;
    error = retryRes.error;
    status = retryRes.status;

    console.log("SUPABASE RESPONSE ATTEMPT 2 (PRUNED)", { data, error, status });
  }

  if (error) {
    console.error("SUPABASE CRITICAL CREATION ERROR:", error);
    throw new Error(`Erro ao criar tarefa (createTask): ${error.message} - Code: ${error.code}`);
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
  if (updates.task_period_id !== undefined) payload.task_period_id = updates.task_period_id;
  if (updates.position !== undefined) payload.position = updates.position;
  if (updates.time_period !== undefined) {
    const validLegacyPeriods = ['morning', 'afternoon', 'evening', 'tomorrow'];
    payload.time_period = updates.time_period && validLegacyPeriods.includes(updates.time_period)
      ? updates.time_period
      : null;
  }

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
    payload.is_completed = isCompleted;
  }
  if (updates.notes !== undefined) payload.notes = updates.notes;
  if (updates.status !== undefined) payload.status = updates.status;

  // Audit requirements: always set updated_by and updated_at on edit
  payload.updated_by = uid;
  payload.updated_at = new Date().toISOString();

  console.log("TASK UPDATE PAYLOAD ATTEMPT 1", payload);

  let { data, error } = await supabase
    .from('tasks')
    .update(payload)
    .eq('id', id)
    .eq('user_id', uid)
    .select()
    .single();

  console.log("SUPABASE UPDATE RESPONSE ATTEMPT 1", { data, error });

  if (error && error.code === '42703') {
    console.warn("Detected missing columns on update. Retrying update with pruned attributes...", error.message);
    const prunedPayload = { ...payload };
    delete prunedPayload.deadline;
    delete prunedPayload.urgency;
    delete prunedPayload.due_date;
    delete prunedPayload.urgency_level;
    delete prunedPayload.notes;
    delete prunedPayload.status;
    delete prunedPayload.updated_by;
    delete prunedPayload.updated_at; // might be locked if column write fails

    console.log("TASK UPDATE PAYLOAD ATTEMPT 2 (PRUNED)", prunedPayload);

    const retryRes = await supabase
      .from('tasks')
      .update(prunedPayload)
      .eq('id', id)
      .eq('user_id', uid)
      .select()
      .single();

    data = retryRes.data;
    error = retryRes.error;
    console.log("SUPABASE UPDATE RESPONSE ATTEMPT 2 (PRUNED)", { data, error });
  }

  if (error) {
    console.error('updateTask Error:', error);
    throw new Error(`Erro ao atualizar tarefa (updateTask): ${error.message} - Code: ${error.code}`);
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
    throw new Error(`Erro ao excluir tarefa (deleteTask): ${error.message} - Code: ${error.code}`);
  }
}

export async function toggleTask(id: string, completed: boolean, userId?: string): Promise<Task> {
  const uid = await getCurrentUserId(userId);
  const { data, error } = await supabase
    .from('tasks')
    .update({ completed, is_completed: completed })
    .eq('id', id)
    .eq('user_id', uid)
    .select()
    .single();

  if (error) {
    console.error('toggleTask Error:', error);
    throw new Error(`Erro ao alternar status da tarefa (toggleTask): ${error.message} - Code: ${error.code}`);
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

export async function getTaskPeriods(userId?: string): Promise<TaskPeriod[]> {
  const uid = await getCurrentUserId(userId);
  const { data, error } = await supabase
    .from('task_periods')
    .select('*')
    .eq('user_id', uid)
    .order('position', { ascending: true });

  if (error) {
    console.error('getTaskPeriods Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    if (error.code === '42P01') {
      throw new Error("A tabela 'task_periods' não existe no Supabase. Por favor, vá ao painel de controle do Supabase, acesse o editor de SQL e execute a query localizada em '/supabase_schema.sql' para criá-la.");
    }
    throw new Error(`Erro ao buscar períodos de tarefas (getTaskPeriods): ${error.message}`);
  }
  return data || [];
}

export async function createTaskPeriod(period: Partial<TaskPeriod>, userId?: string): Promise<TaskPeriod> {
  const uid = await getCurrentUserId(userId);
  const newPeriod = {
    id: period.id || generateUUID(),
    user_id: uid,
    name: period.name || 'Novo Período',
    icon: period.icon || '☀️',
    color: period.color || '#3b82f6',
    position: period.position !== undefined ? period.position : 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('task_periods')
    .insert(newPeriod)
    .select()
    .single();

  if (error) {
    console.error('createTaskPeriod Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    if (error.code === '42P01') {
      throw new Error("A tabela 'task_periods' não existe no seu banco de dados Supabase. Execute o script contido em '/supabase_schema.sql' no editor de SQL do Supabase para criá-la.");
    }
    throw new Error(`Erro ao criar período (createTaskPeriod): ${error.message}`);
  }
  return data;
}

export async function updateTaskPeriod(id: string, updates: Partial<TaskPeriod>, userId?: string): Promise<TaskPeriod> {
  const uid = await getCurrentUserId(userId);
  const payload: any = {
    updated_at: new Date().toISOString()
  };
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.icon !== undefined) payload.icon = updates.icon;
  if (updates.color !== undefined) payload.color = updates.color;
  if (updates.position !== undefined) payload.position = updates.position;

  const { data, error } = await supabase
    .from('task_periods')
    .update(payload)
    .eq('id', id)
    .eq('user_id', uid)
    .select()
    .single();

  if (error) {
    console.error('updateTaskPeriod Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    if (error.code === '42P01') {
      throw new Error("A tabela 'task_periods' não existe no seu banco de dados Supabase. Execute o script contido em '/supabase_schema.sql' no editor de SQL do Supabase para criá-la.");
    }
    throw new Error(`Erro ao atualizar período (updateTaskPeriod): ${error.message}`);
  }
  return data;
}

export async function reorderTaskPeriods(reordered: TaskPeriod[], userId?: string): Promise<void> {
  const uid = await getCurrentUserId(userId);
  const promises = reordered.map((p, idx) =>
    supabase
      .from('task_periods')
      .update({ position: idx, updated_at: new Date().toISOString() })
      .eq('id', p.id)
      .eq('user_id', uid)
  );
  await Promise.all(promises);
}

export async function deleteTaskPeriod(
  id: string,
  transitionMode: 'move' | 'unassign' | 'delete',
  targetPeriodId?: string,
  userId?: string
): Promise<void> {
  const uid = await getCurrentUserId(userId);

  // 1. Resolve tasks inside the period per transition mode
  if (transitionMode === 'move' && targetPeriodId) {
    const { error } = await supabase
      .from('tasks')
      .update({ task_period_id: targetPeriodId })
      .eq('task_period_id', id)
      .eq('user_id', uid);
    if (error) throw new Error(`Erro ao mover tarefas para outro período: ${error.message}`);
  } else if (transitionMode === 'unassign') {
    const { error } = await supabase
      .from('tasks')
      .update({ task_period_id: null })
      .eq('task_period_id', id)
      .eq('user_id', uid);
    if (error) throw new Error(`Erro ao desvincular tarefas do período: ${error.message}`);
  } else if (transitionMode === 'delete') {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('task_period_id', id)
      .eq('user_id', uid);
    if (error) throw new Error(`Erro ao apagar tarefas vinculadas: ${error.message}`);
  }

  // 2. Finally, delete the period itself
  const { error } = await supabase
    .from('task_periods')
    .delete()
    .eq('id', id)
    .eq('user_id', uid);

  if (error) {
    console.error('deleteTaskPeriod Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    if (error.code === '42P01') {
      throw new Error("A tabela 'task_periods' não existe no seu banco de dados Supabase. Execute o script contido em '/supabase_schema.sql' no editor de SQL do Supabase para criá-la.");
    }
    throw new Error(`Erro ao excluir período (deleteTaskPeriod): ${error.message}`);
  }
}
