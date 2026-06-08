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
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return 'user-default';
    }
    return user.id;
  } catch (err) {
    console.warn("Failed retrieving standard Supabase User session:", err);
    return 'user-default';
  }
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
      if (error.code === '42P01') {
        console.warn("A tabela 'weekly_plans' não existe. Por favor execute as migrações SQL no painel.");
        return [];
      }
      throw error;
    }
    return data || [];
  } catch (err) {
    console.warn("Error getting weekly plans from Supabase:", err);
    return [];
  }
}

export async function getOrCreateWeeklyPlan(weekStartDate: string): Promise<WeeklyPlan> {
  try {
    const uid = await getCurrentUserId();
    const isGuest = uid === 'user-default';

    if (isGuest) {
      return {
        id: `mock-plan-${weekStartDate}`,
        user_id: uid,
        week_start_date: weekStartDate,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

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
  } catch (err) {
    console.warn("Failed retrieving/creating plan on Supabase, falling back to memory:", err);
    return {
      id: `mock-plan-${weekStartDate}`,
      user_id: 'user-default',
      week_start_date: weekStartDate,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
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
      if (error.code === '42P01') {
        console.warn("A tabela 'weekly_plan_topics' não existe. Por favor execute as migrações SQL no painel.");
        return [];
      }
      throw error;
    }
    return data || [];
  } catch (err) {
    console.warn("Error getting weekly plan topics from Supabase:", err);
    return [];
  }
}

export async function saveWeeklyPlanTopic(weeklyPlanId: string, categoryId: string, weekday: number): Promise<WeeklyPlanTopic> {
  const payload = {
    id: generateUUID(),
    weekly_plan_id: weeklyPlanId,
    category_id: categoryId,
    weekday,
    user_id: 'user-default',
    created_at: new Date().toISOString()
  };

  try {
    const uid = await getCurrentUserId();
    payload.user_id = uid;

    if (uid === 'user-default') {
      return payload;
    }

    // Use upsert to handle conflict on unique key
    const { data, error } = await supabase
      .from('weekly_plan_topics')
      .upsert(payload, { onConflict: 'weekly_plan_id,category_id,weekday' })
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
  } catch (err) {
    console.warn("Error saving weekly plan topic to Supabase, fallback to memory:", err);
    return payload;
  }
}

export async function deleteWeeklyPlanTopic(weeklyPlanId: string, categoryId: string, weekday: number): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('weekly_plan_topics')
      .delete()
      .eq('weekly_plan_id', weeklyPlanId)
      .eq('category_id', categoryId)
      .eq('weekday', weekday)
      .eq('user_id', user.id);

    if (error) {
      if (error.code === '42P01') {
        return;
      }
      throw error;
    }
  } catch (err) {
    console.warn("Error deleting weekly plan topic from Supabase:", err);
  }
}

export async function clearWeeklyPlanDay(weeklyPlanId: string, weekday: number): Promise<void> {
  try {
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
  } catch (err) {
    console.warn("Error clearing weekly plan day on Supabase:", err);
  }
}
