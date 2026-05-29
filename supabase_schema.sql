-- ==========================================
-- TERMINAL RETRO DE FOCO E ESTUDOS - SCHEMA
-- ==========================================
-- SQL Script for database initialization in Supabase.
-- Incorporates tables, foreign keys, row level security (RLS),
-- indexes for rapid queries, and triggers for updated_at tracking.

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. POMODORO PRESETS TABLE
CREATE TABLE IF NOT EXISTS public.pomodoro_presets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    focus_minutes INTEGER NOT NULL DEFAULT 25,
    short_break_minutes INTEGER NOT NULL DEFAULT 5,
    long_break_minutes INTEGER NOT NULL DEFAULT 15,
    cycles_before_long_break INTEGER NOT NULL DEFAULT 4,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. TASK GROUPS TABLE
CREATE TABLE IF NOT EXISTS public.task_groups (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL,
    position INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. TASK CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.task_categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    group_id UUID REFERENCES public.task_groups(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    color TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. TASKS TABLE
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    group_id UUID REFERENCES public.task_groups(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES public.task_categories(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    urgency_level TEXT DEFAULT 'low' CHECK (urgency_level IN ('low', 'moderate', 'urgent', 'overdue')),
    is_completed BOOLEAN DEFAULT false NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    position INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. POMODORO SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.pomodoro_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    mode TEXT NOT NULL,
    focus_minutes INTEGER DEFAULT 25 NOT NULL,
    break_minutes INTEGER DEFAULT 5 NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    completed BOOLEAN DEFAULT false NOT NULL
);

-- 7. DAILY STATISTICS TABLE
CREATE TABLE IF NOT EXISTS public.daily_statistics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    total_focus_minutes INTEGER DEFAULT 0 NOT NULL,
    total_break_minutes INTEGER DEFAULT 0 NOT NULL,
    completed_tasks INTEGER DEFAULT 0 NOT NULL,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    UNIQUE(user_id, date)
);

-- 8. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.settings (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
    crt_intensity NUMERIC DEFAULT 0.8 CHECK (crt_intensity BETWEEN 0.0 AND 1.0),
    glow_intensity NUMERIC DEFAULT 0.7 CHECK (glow_intensity BETWEEN 0.0 AND 1.0),
    scanlines_enabled BOOLEAN DEFAULT true NOT NULL,
    sounds_enabled BOOLEAN DEFAULT true NOT NULL,
    notifications_enabled BOOLEAN DEFAULT true NOT NULL,
    theme_mode TEXT DEFAULT 'AMBER' CHECK (theme_mode IN ('AMBER', 'GREEN', 'COBALT')),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 9. ACTIVITY LOGS TABLE
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    action TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);


-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pomodoro_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pomodoro_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can edit their own profile." ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile during signup." ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. Pomodoro Presets Policies
DROP POLICY IF EXISTS "Users can manage their own pomodoro presets." ON public.pomodoro_presets;
CREATE POLICY "Users can manage their own pomodoro presets." ON public.pomodoro_presets
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Task Groups Policies
DROP POLICY IF EXISTS "Users can manage their own task groups." ON public.task_groups;
CREATE POLICY "Users can manage their own task groups." ON public.task_groups
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Task Categories Policies
DROP POLICY IF EXISTS "Users can manage their own task categories." ON public.task_categories;
CREATE POLICY "Users can manage their own task categories." ON public.task_categories
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Tasks Policies
DROP POLICY IF EXISTS "Users can manage their own tasks." ON public.tasks;
CREATE POLICY "Users can manage their own tasks." ON public.tasks
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. Pomodoro Sessions Policies
DROP POLICY IF EXISTS "Users can manage their own pomodoro sessions." ON public.pomodoro_sessions;
CREATE POLICY "Users can manage their own pomodoro sessions." ON public.pomodoro_sessions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. Daily Statistics Policies
DROP POLICY IF EXISTS "Users can manage their own daily statistics." ON public.daily_statistics;
CREATE POLICY "Users can manage their own daily statistics." ON public.daily_statistics
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7. Settings Policies
DROP POLICY IF EXISTS "Users can manage their own settings." ON public.settings;
CREATE POLICY "Users can manage their own settings." ON public.settings
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 8. Activity Logs Policies
DROP POLICY IF EXISTS "Users can manage their own activity logs." ON public.activity_logs;
CREATE POLICY "Users can manage their own activity logs." ON public.activity_logs
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ==========================================
-- AUTOMATIC TIMESTAMPS AND CREATION TRIGGERS
-- ==========================================

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for Tasks updated_at
DROP TRIGGER IF EXISTS set_tasks_updated_at ON public.tasks;
CREATE TRIGGER set_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for Settings updated_at
DROP TRIGGER IF EXISTS set_settings_updated_at ON public.settings;
CREATE TRIGGER set_settings_updated_at
BEFORE UPDATE ON public.settings
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Automatically create profiles and default settings on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Create Profile
    INSERT INTO public.profiles (
        id, 
        username, 
        avatar_url
    )
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
        new.raw_user_meta_data->>'avatar_url'
    );
    
    -- 2. Create Settings
    INSERT INTO public.settings (
        user_id, 
        theme_mode, 
        crt_intensity, 
        glow_intensity, 
        scanlines_enabled, 
        sounds_enabled, 
        notifications_enabled
    )
    VALUES (
        new.id, 
        'AMBER', 
        0.8, 
        0.7, 
        true, 
        true, 
        true
    );
    
    -- 3. Seed focus-timer default presets
    INSERT INTO public.pomodoro_presets (
        user_id, 
        name, 
        focus_minutes, 
        short_break_minutes, 
        long_break_minutes, 
        cycles_before_long_break
    )
    VALUES 
    (new.id, 'Estudo Padrão', 25, 5, 15, 4),
    (new.id, 'Super Foco', 50, 10, 20, 3),
    (new.id, 'Exercício', 8, 2, 5, 4);

    RETURN NEW;
END;
$$;

-- Trigger to hook signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ==========================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_tasks_user_id_completed ON public.tasks(user_id, is_completed);
CREATE INDEX IF NOT EXISTS idx_task_groups_user_id ON public.task_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_task_categories_group_id ON public.task_categories(group_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_user_id ON public.pomodoro_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_stats_user_id_date ON public.daily_statistics(user_id, date);

-- 9. DAILY EMOTION LOGS TABLE
DROP TABLE IF EXISTS public.daily_emotion_logs CASCADE;

CREATE TABLE public.daily_emotion_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    emotion_type TEXT NOT NULL,
    emotion_label_zh TEXT NOT NULL,
    local_date DATE DEFAULT CURRENT_DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE (user_id, local_date)
);

ALTER TABLE public.daily_emotion_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own daily emotion logs." ON public.daily_emotion_logs;
CREATE POLICY "Users can manage their own daily emotion logs." ON public.daily_emotion_logs
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_emotion_user ON public.daily_emotion_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_emotion_date ON public.daily_emotion_logs(local_date);

