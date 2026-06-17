-- =========================================================
-- REFORMA COMPLETA DO SISTEMA DE AGENDA
-- SCRIPT SQL PARA CRIAÇÃO DAS TABELAS NO SUPABASE
-- =========================================================

-- 1. TABELA DE BLOCOS DE AGENDA (ESTRUTURA PERMANENTE)
CREATE TABLE IF NOT EXISTS public.agenda_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Segunda, 1=Terça, 2=Quarta, 3=Quinta, 4=Sexta, 5=Sábado, 6=Domingo
    start_time TEXT NOT NULL, -- Formato 'HH:MM' (ex: '07:30')
    end_time TEXT NOT NULL, -- Formato 'HH:MM' (ex: '10:00')
    name TEXT NOT NULL,
    color TEXT DEFAULT 'blue', -- Cor opcional do bloco para renderização macro
    description TEXT, -- Descrição ou objetivo operacional do bloco
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar RLS (Row Level Security) para segurança completa de multi-inquilino
ALTER TABLE public.agenda_blocks ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para agenda_blocks
DROP POLICY IF EXISTS "Users can manage their own agenda blocks" ON public.agenda_blocks;
CREATE POLICY "Users can manage their own agenda blocks" ON public.agenda_blocks
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Índices de desempenho para buscas semanais de agenda rápidas
CREATE INDEX IF NOT EXISTS idx_agenda_blocks_user_id ON public.agenda_blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_agenda_blocks_day_time ON public.agenda_blocks(day_of_week, start_time);


-- 2. TABELA DE PENDÊNCIAS (CONTEÚDO VARIÁVEL DA AGENDA)
CREATE TABLE IF NOT EXISTS public.agenda_todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    block_id UUID NOT NULL REFERENCES public.agenda_blocks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE NOT NULL,
    group_id UUID REFERENCES public.task_groups(id) ON DELETE SET NULL, -- Classificação opcional (Dossiê/Grupo) como metadados
    category_id UUID REFERENCES public.task_categories(id) ON DELETE SET NULL, -- Classificação opcional (Categoria) como metadados
    position INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar RLS para pendências
ALTER TABLE public.agenda_todos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para agenda_todos
DROP POLICY IF EXISTS "Users can manage their own agenda todos" ON public.agenda_todos;
CREATE POLICY "Users can manage their own agenda todos" ON public.agenda_todos
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Índices de desempenho para carregar pendências vinculadas aos blocos ativos
CREATE INDEX IF NOT EXISTS idx_agenda_todos_user_id ON public.agenda_todos(user_id);
CREATE INDEX IF NOT EXISTS idx_agenda_todos_block_id ON public.agenda_todos(block_id);

-- =========================================================
-- 3. TABELAS DE FECHAMENTO AUTOMÁTICO E HISTÓRICO SEMANAL
-- =========================================================

-- Tabela para registrar o fechamento das semanas
CREATE TABLE IF NOT EXISTS public.agenda_closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_code TEXT NOT NULL, -- Formato 'YYYY-Www' (ex: '2026-W24')
    closed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_user_week_closure UNIQUE (user_id, week_code)
);

-- Habilitar RLS para agenda_closures
ALTER TABLE public.agenda_closures ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para agenda_closures
DROP POLICY IF EXISTS "Users can manage their own agenda closures" ON public.agenda_closures;
CREATE POLICY "Users can manage their own agenda closures" ON public.agenda_closures
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Índice de desempenho
CREATE INDEX IF NOT EXISTS idx_agenda_closures_user_week ON public.agenda_closures(user_id, week_code);


-- Tabela para registrar o histórico consolidado de itens concluídos e pendentes no encerramento
CREATE TABLE IF NOT EXISTS public.agenda_history_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_code TEXT NOT NULL, -- Formato 'YYYY-Www' (ex: '2026-W24')
    block_name TEXT NOT NULL,
    block_color TEXT,
    todo_title TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar RLS para agenda_history_items
ALTER TABLE public.agenda_history_items ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para agenda_history_items
DROP POLICY IF EXISTS "Users can manage their own agenda history items" ON public.agenda_history_items;
CREATE POLICY "Users can manage their own agenda history items" ON public.agenda_history_items
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Índices de desempenho
CREATE INDEX IF NOT EXISTS idx_agenda_history_items_user_week ON public.agenda_history_items(user_id, week_code);


-- =========================================================
-- 4. TABELA DE PENDÊNCIAS DE PLANEJAMENTO (CRUD COMPLETO)
-- =========================================================

CREATE TABLE IF NOT EXISTS public.planning_todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    days_of_week INTEGER[] NOT NULL, -- Array de inteiros, ex: {1, 2, 3} (Segunda, Terça, Quarta...)
    block_name TEXT NOT NULL, -- Bloco associado selecionado
    requires_link BOOLEAN DEFAULT TRUE NOT NULL,
    link TEXT DEFAULT NULL,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    completed BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar RLS para planning_todos
ALTER TABLE public.planning_todos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para planning_todos
DROP POLICY IF EXISTS "Users can manage their own planning todos" ON public.planning_todos;
CREATE POLICY "Users can manage their own planning todos" ON public.planning_todos
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Índices de desempenho para carregar planning_todos rápidos
CREATE INDEX IF NOT EXISTS idx_planning_todos_user_id ON public.planning_todos(user_id);
CREATE INDEX IF NOT EXISTS idx_planning_todos_active ON public.planning_todos(user_id, active);


