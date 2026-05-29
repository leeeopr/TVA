import { supabase } from '@/lib/supabase';
import { TaskCategory } from './task-groups';

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

// CATEGORIES CRUD
export async function getCategories(): Promise<TaskCategory[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('task_categories')
    .select(`
      *,
      color:custom_colors(*)
    `)
    .eq('user_id', userId)
    .order('position', { ascending: true });

  if (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
  return data || [];
}

export async function createCategory(
  groupId: string,
  name: string,
  description: string | null = null,
  colorId: string | null = null,
  position?: number
): Promise<TaskCategory> {
  const userId = await getCurrentUserId();

  let finalPosition = position;
  if (finalPosition === undefined) {
    const existing = await getCategories();
    // Filter only the categories within this group to get next index
    const groupCats = existing.filter(c => c.group_id === groupId);
    finalPosition = groupCats.length;
  }

  const payload = {
    id: generateUUID(),
    user_id: userId,
    group_id: groupId,
    name,
    description,
    color_id: colorId,
    position: finalPosition,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('task_categories')
    .insert(payload)
    .select(`
      *,
      color:custom_colors(*)
    `)
    .single();

  if (error) {
    throw error;
  }
  return data;
}

export async function updateCategory(id: string, updates: Partial<TaskCategory>): Promise<TaskCategory> {
  const userId = await getCurrentUserId();

  const payload = {
    ...updates,
    updated_at: new Date().toISOString()
  };

  // Strip join fields before update to avoid failures
  delete payload.color;

  const { data, error } = await supabase
    .from('task_categories')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select(`
      *,
      color:custom_colors(*)
    `)
    .single();

  if (error) {
    throw error;
  }
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from('task_categories')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}

export async function reorderCategories(reordered: TaskCategory[]): Promise<void> {
  const userId = await getCurrentUserId();
  const promises = reordered.map((c, idx) =>
    supabase
      .from('task_categories')
      .update({ position: idx, updated_at: new Date().toISOString() })
      .eq('id', c.id)
      .eq('user_id', userId)
  );
  await Promise.all(promises);
}
