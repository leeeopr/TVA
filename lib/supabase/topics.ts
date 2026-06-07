import { supabase } from '@/lib/supabase';

export interface Topic {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeeklyPlan {
  id: string;
  user_id: string;
  week_start_date: string; // DATE YYYY-MM-DD
  created_at: string;
  updated_at: string;
}

export interface WeeklyPlanTopic {
  id: string;
  weekly_plan_id: string;
  topic_id: string;
  weekday: number; // 0-6
  user_id: string;
  created_at: string;
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
// TOPICS SERVICES
// ==========================================

export async function getTopics(): Promise<Topic[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('user_id', user.id)
    .order('name', { ascending: true });

  if (error) {
    if (error.code === '42P01') {
      console.warn("A tabela 'topics' não existe. Usando modo em memória.");
      return [];
    }
    throw error;
  }
  return data || [];
}

export async function createTopic(topic: Partial<Topic>): Promise<Topic> {
  const uid = await getCurrentUserId();
  const id = topic.id || generateUUID();

  const payload = {
    id,
    user_id: uid,
    name: topic.name || 'Novo Assunto',
    description: topic.description || null,
    color_id: topic.color_id || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('topics')
    .insert(payload)
    .select()
    .single();

  if (error) {
    if (error.code === '42P01') {
      console.warn("A tabela 'topics' não existe. Utilizando objeto em memória.");
      return payload;
    }
    throw error;
  }
  return data;
}

export async function updateTopic(id: string, topic: Partial<Topic>): Promise<Topic> {
  const uid = await getCurrentUserId();
  const payload = {
    ...topic,
    updated_at: new Date().toISOString()
  };

  // Prevent overriding non-updatable properties
  delete (payload as any).id;
  delete (payload as any).user_id;
  delete (payload as any).created_at;

  const { data, error } = await supabase
    .from('topics')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === '42P01') {
      console.warn("A tabela 'topics' não existe. Retornando atualização em memória.");
      return {
        id,
        user_id: uid,
        name: topic.name || 'Novo Assunto',
        description: topic.description || null,
        color_id: topic.color_id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as Topic;
    }
    throw error;
  }
  return data;
}

export async function deleteTopic(id: string): Promise<void> {
  const { error } = await supabase
    .from('topics')
    .delete()
    .eq('id', id);

  if (error) {
    if (error.code === '42P01') {
      return;
    }
    throw error;
  }
}

// ==========================================
// WEEKLY PLANS SERVICES
// ==========================================

export async function getWeeklyPlans(): Promise<WeeklyPlan[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('weekly_plans')
    .select('*')
    .eq('user_id', user.id)
    .order('week_start_date', { ascending: false });

  if (error) {
    if (error.code === '42P01') {
      console.warn("A tabela 'weekly_plans' não existe. Por favor execute as migrações SQL no painel.");
      return [];
    }
    throw error;
  }
  return data || [];
}

export async function getOrCreateWeeklyPlan(weekStartDate: string): Promise<WeeklyPlan> {
  const uid = await getCurrentUserId();

  // Try fetching first
  const { data, error } = await supabase
    .from('weekly_plans')
    .select('*')
    .eq('user_id', uid)
    .eq('week_start_date', weekStartDate)
    .maybeSingle();

  if (error) {
    if (error.code === '42P01') {
      console.warn("A tabela 'weekly_plans' não existe. Usando plano em memória temporário.");
      return {
        id: `mock-plan-${weekStartDate}`,
        user_id: uid,
        week_start_date: weekStartDate,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
    throw error;
  }
  if (data) return data;

  // Otherwise create it
  const id = generateUUID();
  const payload = {
    id,
    user_id: uid,
    week_start_date: weekStartDate,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data: inserted, error: insertError } = await supabase
    .from('weekly_plans')
    .insert(payload)
    .select()
    .single();

  if (insertError) {
    if (insertError.code === '42P01') {
      console.warn("A tabela 'weekly_plans' não existe ao inserir. Utilizando em memória.");
      return payload;
    }
    throw insertError;
  }
  return inserted;
}

// ==========================================
// WEEKLY PLAN TOPICS SERVICES
// ==========================================

export async function getWeeklyPlanTopics(weeklyPlanId: string): Promise<WeeklyPlanTopic[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('weekly_plan_topics')
    .select('*')
    .eq('weekly_plan_id', weeklyPlanId)
    .eq('user_id', user.id);

  if (error) {
    if (error.code === '42P01') {
      console.warn("A tabela 'weekly_plan_topics' não existe. Por favor execute as migrações SQL no painel.");
      return [];
    }
    throw error;
  }
  return data || [];
}

export async function saveWeeklyPlanTopic(weeklyPlanId: string, topicId: string, weekday: number): Promise<WeeklyPlanTopic> {
  const uid = await getCurrentUserId();
  const id = generateUUID();

  const payload = {
    id,
    weekly_plan_id: weeklyPlanId,
    topic_id: topicId,
    weekday,
    user_id: uid,
    created_at: new Date().toISOString()
  };

  // Use upsert to handle conflict on unique key
  const { data, error } = await supabase
    .from('weekly_plan_topics')
    .upsert(payload, { onConflict: 'weekly_plan_id,topic_id,weekday' })
    .select()
    .single();

  if (error) {
    if (error.code === '42P01') {
      console.warn("A tabela 'weekly_plan_topics' não existe. Retornando payload em memória.");
      return payload;
    }
    throw error;
  }
  return data;
}

export async function deleteWeeklyPlanTopic(weeklyPlanId: string, topicId: string, weekday: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('weekly_plan_topics')
    .delete()
    .eq('weekly_plan_id', weeklyPlanId)
    .eq('topic_id', topicId)
    .eq('weekday', weekday)
    .eq('user_id', user.id);

  if (error) {
    if (error.code === '42P01') {
      return;
    }
    throw error;
  }
}

export async function clearWeeklyPlanDay(weeklyPlanId: string, weekday: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('weekly_plan_topics')
    .delete()
    .eq('weekly_plan_id', weeklyPlanId)
    .eq('weekday', weekday)
    .eq('user_id', user.id);

  if (error) {
    if (error.code === '42P01') {
      return;
    }
    throw error;
  }
}
