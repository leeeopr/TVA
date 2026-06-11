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
