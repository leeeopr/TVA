import { supabase } from '@/lib/supabase';

export interface CustomColor {
  id: string;
  name: string;
  hex_code?: string;
  tailwind_class?: string;
}

export interface TaskCategory {
  id: string;
  user_id: string;
  group_id: string;
  name: string;
  description: string | null;
  color_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  color?: CustomColor | null;
}

export interface TaskGroup {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  color?: CustomColor | null;
  categories?: TaskCategory[];
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
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    throw new Error('Usuário não autenticado no Supabase');
  }
  return session.user.id;
};

// GROUPS CRUD
export async function getGroups(): Promise<TaskGroup[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('task_groups')
    .select(`
      *,
      color:custom_colors(*),
      categories:task_categories(
        *,
        color:custom_colors(*)
      )
    `)
    .eq('user_id', userId)
    .order('position', { ascending: true });

  if (error) {
    console.error('Error fetching task groups:', error);
    throw error;
  }
  return data || [];
}

export async function createGroup(name: string, description: string | null, colorId: string | null = null, position?: number): Promise<TaskGroup> {
  const userId = await getCurrentUserId();
  
  let finalPosition = position;
  if (finalPosition === undefined) {
    const existing = await getGroups();
    finalPosition = existing.length;
  }

  const payload = {
    id: generateUUID(),
    user_id: userId,
    name,
    description,
    color_id: colorId,
    position: finalPosition,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('task_groups')
    .insert(payload)
    .select(`
      *,
      color:custom_colors(*),
      categories:task_categories(
        *,
        color:custom_colors(*)
      )
    `)
    .single();

  if (error) {
    throw error;
  }
  return data;
}

export async function updateGroup(id: string, updates: Partial<TaskGroup>): Promise<TaskGroup> {
  const userId = await getCurrentUserId();
  
  const payload = {
    ...updates,
    updated_at: new Date().toISOString()
  };

  // Strip join fields before update to avoid failures
  delete payload.color;
  delete payload.categories;

  const { data, error } = await supabase
    .from('task_groups')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select(`
      *,
      color:custom_colors(*),
      categories:task_categories(
        *,
        color:custom_colors(*)
      )
    `)
    .single();

  if (error) {
    throw error;
  }
  return data;
}

export async function deleteGroup(id: string): Promise<void> {
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from('task_groups')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}

export async function reorderGroups(reordered: TaskGroup[]): Promise<void> {
  const userId = await getCurrentUserId();
  const promises = reordered.map((g, idx) =>
    supabase
      .from('task_groups')
      .update({ position: idx, updated_at: new Date().toISOString() })
      .eq('id', g.id)
      .eq('user_id', userId)
  );
  await Promise.all(promises);
}
