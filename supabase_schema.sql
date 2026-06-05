-- =========================================================
-- TERMINAL RETRO DE FOCO E ESTUDOS - SCHEMA COMPLETO (SUPABASE)
-- =========================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. CUSTOM COLORS
CREATE TABLE IF NOT EXISTS public.custom_colors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    hex_code TEXT,
    tailwind_class TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SEED PALETA DENTRO DE CUSTOM COLORS
INSERT INTO public.custom_colors (name, hex_code, tailwind_class) VALUES
('blue', '#60a5fa', 'blue'),
('purple', '#c084fc', 'purple'),
('green', '#34d399', 'green'),
('red', '#f87171', 'red'),
('yellow', '#fbbf24', 'yellow'),
('cyan', '#22d3ee', 'cyan'),
('orange', '#fb923c', 'orange')
ON CONFLICT (name) DO NOTHING;

-- 3. POMODORO PRESETS
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

-- 4. TASK GROUPS
CREATE TABLE IF NOT EXISTS public.task_groups (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    color_id UUID REFERENCES public.custom_colors(id) ON DELETE SET NULL,
    position INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- MIGRATION: Ensure correct columns are present in case the table already exists
ALTER TABLE public.task_groups ADD COLUMN IF NOT EXISTS color_id UUID REFERENCES public.custom_colors(id) ON DELETE SET NULL;
ALTER TABLE public.task_groups ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0 NOT NULL;

-- 5. TASK CATEGORIES
CREATE TABLE IF NOT EXISTS public.task_categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    group_id UUID REFERENCES public.task_groups(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    color_id UUID REFERENCES public.custom_colors(id) ON DELETE SET NULL,
    position INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- MIGRATION: Ensure correct columns are present in case the table already exists
ALTER TABLE public.task_categories ADD COLUMN IF NOT EXISTS color_id UUID REFERENCES public.custom_colors(id) ON DELETE SET NULL;
ALTER TABLE public.task_categories ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE public.task_categories ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.task_categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW());

-- 5B. TASK PERIODS
CREATE TABLE IF NOT EXISTS public.task_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    position INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- RLS AND POLICIES FOR TASK PERIODS
ALTER TABLE public.task_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow individual read" ON public.task_periods FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow individual insert" ON public.task_periods FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow individual update" ON public.task_periods FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Allow individual delete" ON public.task_periods FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_task_periods_user_id ON public.task_periods(user_id);
CREATE INDEX IF NOT EXISTS idx_task_periods_position ON public.task_periods(position);

-- 6. TASKS TABLE
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.task_groups(id) ON DELETE SET NULL,
    category_id UUID REFERENCES public.task_categories(id) ON DELETE SET NULL,
    task_period_id UUID REFERENCES public.task_periods(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    deadline TIMESTAMPTZ,
    urgency TEXT CHECK (urgency IN ('low', 'moderate', 'urgent')),
    completed BOOLEAN DEFAULT FALSE,
    position INTEGER DEFAULT 0,
    time_period TEXT CHECK (time_period IN ('morning', 'afternoon', 'evening', 'tomorrow')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- MIGRATION: Ensure correct columns are present in case the table already exists and needs modification
ALTER TABLE public.tasks ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.tasks ALTER COLUMN group_id DROP NOT NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS urgency TEXT CHECK (urgency IN ('low', 'moderate', 'urgent'));
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS time_period TEXT CHECK (time_period IN ('morning', 'afternoon', 'evening', 'tomorrow'));
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS task_period_id UUID REFERENCES public.task_periods(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_task_period_id ON public.tasks(task_period_id);

-- 7. POMODORO SESSIONS
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

-- MIGRATION: Ensure correct foreign keys on existing sessions
ALTER TABLE public.pomodoro_sessions ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL;

-- 8. DAILY STATISTICS
CREATE TABLE IF NOT EXISTS public.daily_statistics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    total_focus_minutes INTEGER DEFAULT 0 NOT NULL,
    total_break_minutes INTEGER DEFAULT 0 NOT NULL,
    completed_tasks INTEGER DEFAULT 0 NOT NULL,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    UNIQUE(user_id, date)
);

-- 9. SETTINGS
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

-- 10. ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    action TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 11. DAILY EMOTION LOGS
CREATE TABLE IF NOT EXISTS public.daily_emotion_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    emotion_type TEXT NOT NULL,
    emotion_label_zh TEXT NOT NULL,
    local_date DATE DEFAULT CURRENT_DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE (user_id, local_date)
);

-- =========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pomodoro_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pomodoro_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_emotion_logs ENABLE ROW LEVEL SECURITY;

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
DROP POLICY IF EXISTS "Users can only SELECT their own task groups" ON public.task_groups;
DROP POLICY IF EXISTS "Users can only INSERT their own task groups" ON public.task_groups;
DROP POLICY IF EXISTS "Users can only UPDATE their own task groups" ON public.task_groups;
DROP POLICY IF EXISTS "Users can only DELETE their own task groups" ON public.task_groups;
CREATE POLICY "Users can manage their own task groups." ON public.task_groups
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Task Categories Policies
DROP POLICY IF EXISTS "Users can manage their own task categories." ON public.task_categories;
DROP POLICY IF EXISTS "Users can only SELECT their own task categories" ON public.task_categories;
DROP POLICY IF EXISTS "Users can only INSERT their own task categories" ON public.task_categories;
DROP POLICY IF EXISTS "Users can only UPDATE their own task categories" ON public.task_categories;
DROP POLICY IF EXISTS "Users can only DELETE their own task categories" ON public.task_categories;
CREATE POLICY "Users can manage their own task categories." ON public.task_categories
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Tasks Policies
DROP POLICY IF EXISTS "Users can manage their own tasks." ON public.tasks;
DROP POLICY IF EXISTS "Users can view own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can insert own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;

CREATE POLICY "Users can view own tasks"
ON public.tasks
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks"
ON public.tasks
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
ON public.tasks
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks"
ON public.tasks
FOR DELETE
USING (auth.uid() = user_id);

-- 6. Pomodoro Sessions Policies
DROP POLICY IF EXISTS "Users can manage their own pomodoro sessions." ON public.pomodoro_sessions;
CREATE POLICY "Users can manage their own pomodoro sessions." ON public.pomodoro_sessions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7. Daily Statistics Policies
DROP POLICY IF EXISTS "Users can manage their own daily statistics." ON public.daily_statistics;
CREATE POLICY "Users can manage their own daily statistics." ON public.daily_statistics
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 8. Settings Policies
DROP POLICY IF EXISTS "Users can manage their own settings." ON public.settings;
CREATE POLICY "Users can manage their own settings." ON public.settings
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 9. Activity Logs Policies
DROP POLICY IF EXISTS "Users can manage their own activity logs." ON public.activity_logs;
CREATE POLICY "Users can manage their own activity logs." ON public.activity_logs
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 10. Daily Emotion Logs Policies
DROP POLICY IF EXISTS "Users can manage their own daily emotion logs." ON public.daily_emotion_logs;
CREATE POLICY "Users can manage their own daily emotion logs." ON public.daily_emotion_logs
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- =========================================================
-- AUTOMATIC TIMESTAMPS AND CREATION TRIGGERS
-- =========================================================

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

-- Trigger for Task Groups updated_at
DROP TRIGGER IF EXISTS set_task_groups_updated_at ON public.task_groups;
CREATE TRIGGER set_task_groups_updated_at
BEFORE UPDATE ON public.task_groups
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for Task Categories updated_at
DROP TRIGGER IF EXISTS set_task_categories_updated_at ON public.task_categories;
CREATE TRIGGER set_task_categories_updated_at
BEFORE UPDATE ON public.task_categories
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
    )
    ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        avatar_url = EXCLUDED.avatar_url;
    
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
    )
    ON CONFLICT (user_id) DO NOTHING;
    
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
    (new.id, 'Exercício', 8, 2, 5, 4)
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$;

-- Trigger to hook signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =========================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_tasks_user_id_completed ON public.tasks(user_id, is_completed);
CREATE INDEX IF NOT EXISTS idx_task_groups_user_id ON public.task_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_task_categories_group_id ON public.task_categories(group_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_user_id ON public.pomodoro_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_stats_user_id_date ON public.daily_statistics(user_id, date);
CREATE INDEX IF NOT EXISTS idx_emotion_user ON public.daily_emotion_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_emotion_date ON public.daily_emotion_logs(local_date);

-- =========================================================
-- 12. DAILY MOODS (DAILY EMOTION CHECK-IN SYSTEM)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.daily_moods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emotion TEXT NOT NULL,
  emotion_score INTEGER NOT NULL,
  emotion_label_zh TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  mood_date DATE NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_daily_mood ON public.daily_moods(user_id, mood_date);

ALTER TABLE public.daily_moods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own moods" ON public.daily_moods;
CREATE POLICY "Users can view own moods"
ON public.daily_moods
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own moods" ON public.daily_moods;
CREATE POLICY "Users can insert own moods"
ON public.daily_moods
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own moods" ON public.daily_moods;
CREATE POLICY "Users can update own moods"
ON public.daily_moods
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- =========================================================
-- 13. PROJECTS MODULE
-- =========================================================

CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_archived BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.project_phases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    position INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.project_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    phase_id UUID NOT NULL REFERENCES public.project_phases(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    is_completed BOOLEAN DEFAULT FALSE NOT NULL,
    position INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Check and add project_issue_id to tasks table if it does not exist
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS project_issue_id UUID REFERENCES public.project_issues(id) ON DELETE SET NULL;

-- Enable RLS for projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_issues ENABLE ROW LEVEL SECURITY;

-- Policies for projects
DROP POLICY IF EXISTS "Users can manage their own projects." ON public.projects;
CREATE POLICY "Users can manage their own projects." ON public.projects
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policies for project_phases
DROP POLICY IF EXISTS "Users can manage their own project phases." ON public.project_phases;
CREATE POLICY "Users can manage their own project phases." ON public.project_phases
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policies for project_issues
DROP POLICY IF EXISTS "Users can manage their own project issues." ON public.project_issues;
CREATE POLICY "Users can manage their own project issues." ON public.project_issues
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Indexes for Projects Module
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_project_phases_project_id ON public.project_phases(project_id);
CREATE INDEX IF NOT EXISTS idx_project_issues_phase_id ON public.project_issues(phase_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_issue_id ON public.tasks(project_issue_id);

