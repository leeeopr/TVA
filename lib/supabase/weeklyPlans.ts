import { supabase } from '@/lib/supabase';

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
  category_id: string;
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
    throw new Error("Usuário não autenticado no Supabase.");
  }
  return user.id;
};

// ==========================================
// WEEKLY PLANS SERVICES
// ==========================================

export async function getWeeklyPlans(): Promise<WeeklyPlan[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('weekly_plans')
      .select('*')
      .eq('user_id', user.id)
      .order('week_start_date', { ascending: false });

    if (error) {
      throw error;
    }
    return data || [];
  } catch (err) {
    console.error("Erro ao carregar planejamentos semanais do Supabase:", err);
    throw err;
  }
}

export async function getOrCreateWeeklyPlan(weekStartDate: string): Promise<WeeklyPlan> {
  try {
    const uid = await getCurrentUserId();

    // Tenta carregar primeiro
    const { data, error } = await supabase
      .from('weekly_plans')
      .select('*')
      .eq('user_id', uid)
      .eq('week_start_date', weekStartDate)
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (data) return data;

    // Caso não exista, cria o registro
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
      throw insertError;
    }
    return inserted;
  } catch (err) {
    console.error("Erro ao obter ou criar planejamento semanal no Supabase:", err);
    throw err;
  }
}

// ==========================================
// WEEKLY PLAN CATEGORIES SERVICES
// ==========================================

export async function getWeeklyPlanTopics(weeklyPlanId: string): Promise<WeeklyPlanTopic[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('weekly_plan_topics')
      .select('*')
      .eq('weekly_plan_id', weeklyPlanId)
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }
    return data || [];
  } catch (err) {
    console.error("Erro ao carregar tópicos de planejamento semanal do Supabase:", err);
    throw err;
  }
}

export async function saveWeeklyPlanTopic(weeklyPlanId: string, categoryId: string, weekday: number): Promise<WeeklyPlanTopic> {
  try {
    const uid = await getCurrentUserId();

    const payload = {
      id: generateUUID(),
      weekly_plan_id: weeklyPlanId,
      category_id: categoryId,
      weekday,
      user_id: uid,
      created_at: new Date().toISOString()
    };

    // Upsert para gerenciar conflitos na chave única
    const { data, error } = await supabase
      .from('weekly_plan_topics')
      .upsert(payload, { onConflict: 'weekly_plan_id,category_id,weekday' })
      .select()
      .single();

    if (error) {
      throw error;
    }
    return data;
  } catch (err) {
    console.error("Erro ao salvar tópico do planejamento semanal no Supabase:", err);
    throw err;
  }
}

export async function deleteWeeklyPlanTopic(weeklyPlanId: string, categoryId: string, weekday: number): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado.");

    const { error } = await supabase
      .from('weekly_plan_topics')
      .delete()
      .eq('weekly_plan_id', weeklyPlanId)
      .eq('category_id', categoryId)
      .eq('weekday', weekday)
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }
  } catch (err) {
    console.error("Erro ao remover tópico do planejamento semanal no Supabase:", err);
    throw err;
  }
}

export async function clearWeeklyPlanDay(weeklyPlanId: string, weekday: number): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado.");

    const { error } = await supabase
      .from('weekly_plan_topics')
      .delete()
      .eq('weekly_plan_id', weeklyPlanId)
      .eq('weekday', weekday)
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }
  } catch (err) {
    console.error("Erro ao limpar dia do planejamento semanal no Supabase:", err);
    throw err;
  }
}
