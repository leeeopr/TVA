-- ==========================================
-- SUPABASE MIGRATION DATABASE SCHEMA
-- ==========================================
-- Objective: Real persistence for Task Groups and Task Categories under Supabase
-- RLS, Multi-user segregation, Indices, triggers, & Cascade configurations.

-- ENABLE UUID EXTENSION IF NOT EXISTS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 0. CUSTOM COLORS DEFINITION SCHEMA
CREATE TABLE IF NOT EXISTS public.custom_colors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    hex_code TEXT,
    tailwind_class TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SEED STATIC SCHEMATIC DEPT FOR COLORS
INSERT INTO public.custom_colors (name, hex_code, tailwind_class) VALUES
('blue', '#60a5fa', 'blue'),
('purple', '#c084fc', 'purple'),
('green', '#34d399', 'green'),
('red', '#f87171', 'red'),
('yellow', '#fbbf24', 'yellow'),
('cyan', '#22d3ee', 'cyan'),
('orange', '#fb923c', 'orange')
ON CONFLICT (name) DO NOTHING;

-- 1. SQL — TABELA TASK_GROUPS
CREATE TABLE IF NOT EXISTS public.task_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    color_id UUID REFERENCES public.custom_colors(id) ON DELETE SET NULL,
    position INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. SQL — TABELA TASK_CATEGORIES
CREATE TABLE IF NOT EXISTS public.task_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    group_id UUID REFERENCES public.task_groups(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    color_id UUID REFERENCES public.custom_colors(id) ON DELETE SET NULL,
    position INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. ÍNDICES PARA ALTA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_task_groups_user ON public.task_groups (user_id);
CREATE INDEX IF NOT EXISTS idx_task_categories_user ON public.task_categories (user_id);
CREATE INDEX IF NOT EXISTS idx_task_categories_group ON public.task_categories (group_id);

-- 4. ATIVAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.task_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;

-- POLICIES COMPLETAS PARA TASK_GROUPS
DROP POLICY IF EXISTS "Users can only SELECT their own task groups" ON public.task_groups;
CREATE POLICY "Users can only SELECT their own task groups" 
ON public.task_groups FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only INSERT their own task groups" ON public.task_groups;
CREATE POLICY "Users can only INSERT their own task groups" 
ON public.task_groups FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only UPDATE their own task groups" ON public.task_groups;
CREATE POLICY "Users can only UPDATE their own task groups" 
ON public.task_groups FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only DELETE their own task groups" ON public.task_groups;
CREATE POLICY "Users can only DELETE their own task groups" 
ON public.task_groups FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- POLICIES COMPLETAS PARA TASK_CATEGORIES
DROP POLICY IF EXISTS "Users can only SELECT their own task categories" ON public.task_categories;
CREATE POLICY "Users can only SELECT their own task categories" 
ON public.task_categories FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only INSERT their own task categories" ON public.task_categories;
CREATE POLICY "Users can only INSERT their own task categories" 
ON public.task_categories FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only UPDATE their own task categories" ON public.task_categories;
CREATE POLICY "Users can only UPDATE their own task categories" 
ON public.task_categories FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only DELETE their own task categories" ON public.task_categories;
CREATE POLICY "Users can only DELETE their own task categories" 
ON public.task_categories FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);


-- 5. TRIGGER AUTOMÁTICO DE UPDATED_AT
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- BIND TRIGGERS TO TABLES
DROP TRIGGER IF EXISTS handle_update_task_groups_timestamp ON public.task_groups;
CREATE TRIGGER handle_update_task_groups_timestamp
    BEFORE UPDATE ON public.task_groups
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS handle_update_task_categories_timestamp ON public.task_categories;
CREATE TRIGGER handle_update_task_categories_timestamp
    BEFORE UPDATE ON public.task_categories
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();
