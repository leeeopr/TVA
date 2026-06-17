import { supabase } from '@/lib/supabase';

export interface AgendaBlock {
  id: string;
  user_id: string;
  day_of_week: number; // 0 = Segunda, 1 = Terça, 2 = Quarta, 3 = Quinta, 4 = Sexta, 5 = Sábado, 6 = Domingo
  start_time: string; // 'HH:MM'
  end_time: string; // 'HH:MM'
  name: string;
  color?: string | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgendaTodo {
  id: string;
  user_id: string;
  block_id: string;
  title: string;
  completed: boolean;
  group_id?: string | null;
  category_id?: string | null;
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

const getCurrentUserId = async (passedId?: string): Promise<string> => {
  if (passedId) return passedId;
  let { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const { data: { session } } = await supabase.auth.getSession();
    user = session?.user ?? null;
  }
  if (!user) {
    throw new Error('Usuário autenticado inválido ou nulo');
  }
  return user.id;
};

// ==========================================
// AGENDA BLOCKS CRUD (SUPABASE)
// ==========================================

export async function getAgendaBlocks(userId?: string): Promise<AgendaBlock[]> {
  const uid = await getCurrentUserId(userId);
  const { data, error } = await supabase
    .from('agenda_blocks')
    .select('*')
    .eq('user_id', uid)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    console.error('getAgendaBlocks Error:', error);
    throw new Error(`Erro ao buscar blocos (getAgendaBlocks): ${error.message}`);
  }
  return data || [];
}

export async function createAgendaBlock(block: Partial<AgendaBlock>, userId?: string): Promise<AgendaBlock> {
  const uid = await getCurrentUserId(userId || block.user_id);
  const blockId = block.id || generateUUID();
  
  const payload = {
    id: blockId,
    user_id: uid,
    day_of_week: block.day_of_week ?? 0,
    start_time: block.start_time || '08:00',
    end_time: block.end_time || '09:00',
    name: block.name || 'Novo Bloco',
    color: block.color || 'blue',
    description: block.description ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('agenda_blocks')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('createAgendaBlock Error details:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });
    throw new Error(`Erro ao criar bloco (createAgendaBlock): ${error.message}`);
  }
  return data;
}

export async function updateAgendaBlock(id: string, updates: Partial<AgendaBlock>, userId?: string): Promise<AgendaBlock> {
  const uid = await getCurrentUserId(userId);
  
  const payload: any = {
    updated_at: new Date().toISOString()
  };
  if (updates.day_of_week !== undefined) payload.day_of_week = updates.day_of_week;
  if (updates.start_time !== undefined) payload.start_time = updates.start_time;
  if (updates.end_time !== undefined) payload.end_time = updates.end_time;
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.color !== undefined) payload.color = updates.color;
  if (updates.description !== undefined) payload.description = updates.description;

  const { data, error } = await supabase
    .from('agenda_blocks')
    .update(payload)
    .eq('id', id)
    .eq('user_id', uid)
    .select()
    .single();

  if (error) {
    console.error('updateAgendaBlock Error details:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });
    throw new Error(`Erro ao atualizar bloco (updateAgendaBlock): ${error.message}`);
  }
  return data;
}

export async function deleteAgendaBlock(id: string, userId?: string): Promise<void> {
  const uid = await getCurrentUserId(userId);
  const { error } = await supabase
    .from('agenda_blocks')
    .delete()
    .eq('id', id)
    .eq('user_id', uid);

  if (error) {
    console.error('deleteAgendaBlock Error details:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });
    throw new Error(`Erro ao excluir bloco (deleteAgendaBlock): ${error.message}`);
  }
}

// ==========================================
// AGENDA TODOS CRUD (SUPABASE)
// ==========================================

export async function getAgendaTodos(userId?: string): Promise<AgendaTodo[]> {
  const uid = await getCurrentUserId(userId);
  const { data, error } = await supabase
    .from('agenda_todos')
    .select('*')
    .eq('user_id', uid)
    .order('position', { ascending: true });

  if (error) {
    console.error('getAgendaTodos Error:', error);
    throw new Error(`Erro ao buscar pendências (getAgendaTodos): ${error.message}`);
  }
  return data || [];
}

export async function createAgendaTodo(todo: Partial<AgendaTodo>, userId?: string): Promise<AgendaTodo> {
  const uid = await getCurrentUserId(userId || todo.user_id);
  const todoId = todo.id || generateUUID();
  
  const payload = {
    id: todoId,
    user_id: uid,
    block_id: todo.block_id,
    title: todo.title || 'Nova Pendência',
    completed: todo.completed ?? false,
    group_id: todo.group_id || null,
    category_id: todo.category_id || null,
    position: todo.position ?? 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('agenda_todos')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('createAgendaTodo Error:', error);
    throw new Error(`Erro ao criar pendência (createAgendaTodo): ${error.message}`);
  }
  return data;
}

export async function updateAgendaTodo(id: string, updates: Partial<AgendaTodo>, userId?: string): Promise<AgendaTodo> {
  const uid = await getCurrentUserId(userId);
  
  const payload: any = {
    updated_at: new Date().toISOString()
  };
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.completed !== undefined) payload.completed = updates.completed;
  if (updates.group_id !== undefined) payload.group_id = updates.group_id || null;
  if (updates.category_id !== undefined) payload.category_id = updates.category_id || null;
  if (updates.position !== undefined) payload.position = updates.position;

  const { data, error } = await supabase
    .from('agenda_todos')
    .update(payload)
    .eq('id', id)
    .eq('user_id', uid)
    .select()
    .single();

  if (error) {
    console.error('updateAgendaTodo Error:', error);
    throw new Error(`Erro ao atualizar pendência (updateAgendaTodo): ${error.message}`);
  }
  return data;
}

export async function deleteAgendaTodo(id: string, userId?: string): Promise<void> {
  const uid = await getCurrentUserId(userId);
  const { error } = await supabase
    .from('agenda_todos')
    .delete()
    .eq('id', id)
    .eq('user_id', uid);

  if (error) {
    console.error('deleteAgendaTodo Error:', error);
    throw new Error(`Erro ao excluir pendência (deleteAgendaTodo): ${error.message}`);
  }
}

// ==========================================
// AGENDA AUTOMATIC WEEKLY CYCLE & HISTORY (SUPABASE)
// ==========================================

export interface AgendaClosure {
  id: string;
  user_id: string;
  week_code: string;
  closed_at: string;
}

export interface AgendaHistoryItem {
  id: string;
  user_id: string;
  week_code: string;
  block_name: string;
  block_color?: string | null;
  todo_title: string;
  completed: boolean;
  day_of_week: number;
  created_at: string;
}

export async function getAgendaClosures(userId?: string): Promise<AgendaClosure[]> {
  const uid = await getCurrentUserId(userId);
  const { data, error } = await supabase
    .from('agenda_closures')
    .select('*')
    .eq('user_id', uid)
    .order('week_code', { ascending: false });

  if (error) {
    if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
      console.warn("Agenda closures table does not exist yet.");
      return [];
    }
    console.error('getAgendaClosures Error:', error);
    throw new Error(`Erro ao buscar fechamentos (getAgendaClosures): ${error.message}`);
  }
  return data || [];
}

export async function getAgendaHistoryItems(weekCode?: string, userId?: string): Promise<AgendaHistoryItem[]> {
  const uid = await getCurrentUserId(userId);
  let query = supabase
    .from('agenda_history_items')
    .select('*')
    .eq('user_id', uid);

  if (weekCode) {
    query = query.eq('week_code', weekCode);
  }

  const { data, error } = await query.order('created_at', { ascending: true });

  if (error) {
    if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
      console.warn("Agenda history items table does not exist yet.");
      return [];
    }
    console.error('getAgendaHistoryItems Error:', error);
    throw new Error(`Erro ao buscar histórico (getAgendaHistoryItems): ${error.message}`);
  }
  return data || [];
}

// ==========================================
// PLANNING PACK & PLANNING TODOS (SUPABASE)
// ==========================================

export interface PlanningTodo {
  id: string;
  user_id: string;
  title: string;
  days_of_week: number[];
  block_name: string;
  requires_link: boolean;
  link?: string | null;
  active: boolean;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export async function getPlanningTodos(userId?: string): Promise<PlanningTodo[]> {
  const uid = await getCurrentUserId(userId);
  const { data, error } = await supabase
    .from('planning_todos')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: true });

  if (error) {
    if (error.code === 'PGRST116' || error.code === 'PGRST204' || error.message?.includes('does not exist') || error.message?.includes('planning_todos') || error.message?.includes('completed') || error.message?.includes('column')) {
      console.warn("Planning todos table or column does not exist or schema cache is stale.");
      throw new Error("planning_todos_table_not_exists");
    }
    console.error('getPlanningTodos Error:', error);
    throw new Error(`Erro ao buscar pendências de planejamento (getPlanningTodos): ${error.message}`);
  }
  return data || [];
}

export async function createPlanningTodo(todo: Omit<PlanningTodo, 'id' | 'user_id' | 'created_at' | 'updated_at'>, userId?: string): Promise<PlanningTodo> {
  const uid = await getCurrentUserId(userId);
  const payload = {
    user_id: uid,
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

  const { data, error } = await supabase
    .from('planning_todos')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('createPlanningTodo Error details:', error);
    console.error('createPlanningTodo Detailed message:', error.message, 'code:', error.code, 'details:', error.details, 'hint:', error.hint);
    if (error.code === 'PGRST116' || error.code === '42P01' || error.code === 'PGRST204' || error.message?.includes('does not exist') || error.message?.includes('planning_todos') || error.message?.includes('completed') || error.message?.includes('column')) {
      throw new Error("planning_todos_table_not_exists");
    }
    throw new Error(`Erro ao criar pendência de planejamento (createPlanningTodo): ${error.message}`);
  }
  return data;
}

export async function updatePlanningTodo(id: string, updates: Partial<Omit<PlanningTodo, 'id' | 'user_id' | 'created_at' | 'updated_at'>>, userId?: string): Promise<PlanningTodo> {
  const uid = await getCurrentUserId(userId);
  const payload: any = {
    updated_at: new Date().toISOString()
  };

  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.days_of_week !== undefined) payload.days_of_week = updates.days_of_week;
  if (updates.block_name !== undefined) payload.block_name = updates.block_name;
  if (updates.requires_link !== undefined) payload.requires_link = updates.requires_link;
  if (updates.link !== undefined) payload.link = updates.link || null;
  if (updates.active !== undefined) payload.active = updates.active;
  if (updates.completed !== undefined) payload.completed = updates.completed;

  const { data, error } = await supabase
    .from('planning_todos')
    .update(payload)
    .eq('id', id)
    .eq('user_id', uid)
    .select()
    .single();

  if (error) {
    console.error('updatePlanningTodo Error:', error);
    if (error.code === 'PGRST116' || error.code === '42P01' || error.code === 'PGRST204' || error.message?.includes('does not exist') || error.message?.includes('planning_todos') || error.message?.includes('completed') || error.message?.includes('column')) {
      throw new Error("planning_todos_table_not_exists");
    }
    throw new Error(`Erro ao atualizar pendência de planejamento (updatePlanningTodo): ${error.message}`);
  }
  return data;
}

export async function deletePlanningTodo(id: string, userId?: string): Promise<void> {
  const uid = await getCurrentUserId(userId);
  const { error } = await supabase
    .from('planning_todos')
    .delete()
    .eq('id', id)
    .eq('user_id', uid);

  if (error) {
    console.error('deletePlanningTodo Error:', error);
    if (error.code === 'PGRST116' || error.code === '42P01' || error.code === 'PGRST204' || error.message?.includes('does not exist') || error.message?.includes('planning_todos') || error.message?.includes('completed') || error.message?.includes('column')) {
      throw new Error("planning_todos_table_not_exists");
    }
    throw new Error(`Erro ao deletar pendência de planejamento (deletePlanningTodo): ${error.message}`);
  }
}


