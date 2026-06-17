-- ====================================================================
-- MASTER SCHEMA AND COLUMN ALIGNMENT MIGRATION SCRIPT
-- RUN THIS IN YOUR SUPABASE SQL EDITOR TO RESOLVE ALL ISSUES
-- ====================================================================

-- 1. Ensure basic table existence
CREATE TABLE IF NOT EXISTS public.external_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    secret_alias TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.external_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    source_id UUID NOT NULL REFERENCES public.external_sources(id) ON DELETE CASCADE,
    title TEXT NOT NULL
);

-- 2. Alinhamento de colunas em 'external_sources' (Resolve columns missing inside partially-created tables)
ALTER TABLE public.external_sources ADD COLUMN IF NOT EXISTS name TEXT DEFAULT '' NOT NULL;
ALTER TABLE public.external_sources ADD COLUMN IF NOT EXISTS secret_alias TEXT DEFAULT '' NOT NULL;
ALTER TABLE public.external_sources ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE NOT NULL;
ALTER TABLE public.external_sources ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE public.external_sources ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE public.external_sources ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.external_sources ADD COLUMN IF NOT EXISTS company_color TEXT;
ALTER TABLE public.external_sources ADD COLUMN IF NOT EXISTS company_icon TEXT;
ALTER TABLE public.external_sources ADD COLUMN IF NOT EXISTS company_type TEXT;
ALTER TABLE public.external_sources ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.external_sources ADD COLUMN IF NOT EXISTS active_projects_count INTEGER DEFAULT 0;
ALTER TABLE public.external_sources ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;
ALTER TABLE public.external_sources ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;

-- 3. Alinhamento de colunas em 'external_tasks' (Ensures external_id, source_name and mapped columns are fully established)
ALTER TABLE public.external_tasks ADD COLUMN IF NOT EXISTS source_name TEXT DEFAULT '' NOT NULL;
ALTER TABLE public.external_tasks ADD COLUMN IF NOT EXISTS external_id TEXT DEFAULT '' NOT NULL;
ALTER TABLE public.external_tasks ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE NOT NULL;
ALTER TABLE public.external_tasks ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE public.external_tasks ADD COLUMN IF NOT EXISTS mapped_group_id UUID REFERENCES public.task_groups(id) ON DELETE SET NULL;
ALTER TABLE public.external_tasks ADD COLUMN IF NOT EXISTS mapped_category_id UUID REFERENCES public.task_categories(id) ON DELETE SET NULL;
ALTER TABLE public.external_tasks ADD COLUMN IF NOT EXISTS mapped_block_id UUID REFERENCES public.agenda_blocks(id) ON DELETE SET NULL;
ALTER TABLE public.external_tasks ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 3;
ALTER TABLE public.external_tasks ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.external_tasks ADD COLUMN IF NOT EXISTS external_project_id TEXT;
ALTER TABLE public.external_tasks ADD COLUMN IF NOT EXISTS external_project_name TEXT;
ALTER TABLE public.external_tasks ADD COLUMN IF NOT EXISTS external_phase_id TEXT;
ALTER TABLE public.external_tasks ADD COLUMN IF NOT EXISTS external_phase_name TEXT;
ALTER TABLE public.external_tasks ADD COLUMN IF NOT EXISTS external_kanban_column TEXT;
ALTER TABLE public.external_tasks ADD COLUMN IF NOT EXISTS last_sync_direction TEXT DEFAULT 'PULL';
ALTER TABLE public.external_tasks ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW());
ALTER TABLE public.external_tasks ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;
ALTER TABLE public.external_tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;

-- Configurar fk_user_id se ela ainda não for chave estrangeira para auth.users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'external_sources_user_id_fkey'
    ) THEN
        ALTER TABLE public.external_sources ADD CONSTRAINT external_sources_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'external_tasks_user_id_fkey'
    ) THEN
        ALTER TABLE public.external_tasks ADD CONSTRAINT external_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Criar restrição única em 'external_tasks' (evita duplicações de sincronização)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_external_task_source_key'
    ) THEN
        ALTER TABLE public.external_tasks ADD CONSTRAINT unique_external_task_source_key UNIQUE (source_id, external_id);
    END IF;
END $$;

-- 5. Tabelas auxiliares de mapeamento e filas
CREATE TABLE IF NOT EXISTS public.external_source_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES public.external_sources(id) ON DELETE CASCADE,
    target_group_id UUID NOT NULL REFERENCES public.task_groups(id) ON DELETE CASCADE,
    target_category_id UUID NOT NULL REFERENCES public.task_categories(id) ON DELETE CASCADE,
    default_block_id UUID REFERENCES public.agenda_blocks(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_mappings_per_source UNIQUE (source_id)
);

CREATE TABLE IF NOT EXISTS public.external_sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    external_task_id UUID NOT NULL REFERENCES public.external_tasks(id) ON DELETE CASCADE,
    operation TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.external_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES public.external_sources(id) ON DELETE CASCADE,
    external_task_id UUID REFERENCES public.external_tasks(id) ON DELETE SET NULL,
    direction TEXT NOT NULL, -- 'PUSH', 'PULL'
    operation TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    success BOOLEAN NOT NULL,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. Habilitar RLS (Row Level Security) em todas as tabelas
ALTER TABLE public.external_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_source_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_sync_logs ENABLE ROW LEVEL SECURITY;

-- 7. Recriar Políticas RLS de forma limpa e com DROP preventivo para evitar erros de existência
-- External Sources
DROP POLICY IF EXISTS "Users can manage their own external sources" ON public.external_sources;
CREATE POLICY "Users can manage their own external sources" ON public.external_sources
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- External Tasks
DROP POLICY IF EXISTS "Users can manage their own external tasks" ON public.external_tasks;
CREATE POLICY "Users can manage their own external tasks" ON public.external_tasks
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- External Source Mappings
DROP POLICY IF EXISTS "Users can manage their own external mappings" ON public.external_source_mappings;
CREATE POLICY "Users can manage their own external mappings" ON public.external_source_mappings
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- External Sync Queue
DROP POLICY IF EXISTS "Users can manage their own sync queue" ON public.external_sync_queue;
CREATE POLICY "Users can manage their own sync queue" ON public.external_sync_queue
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- External Sync Logs
DROP POLICY IF EXISTS "Users can manage their own sync logs" ON public.external_sync_logs;
CREATE POLICY "Users can manage their own sync logs" ON public.external_sync_logs
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 8. Criar Índices de Desempenho Safely
CREATE INDEX IF NOT EXISTS idx_external_sources_user_id ON public.external_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_external_tasks_user_id ON public.external_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_external_tasks_source_id ON public.external_tasks(source_id);
CREATE INDEX IF NOT EXISTS idx_external_tasks_union ON public.external_tasks(source_id, external_id);
CREATE INDEX IF NOT EXISTS idx_external_tasks_priority ON public.external_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_external_tasks_due_date ON public.external_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_external_tasks_project_id ON public.external_tasks(external_project_id);
CREATE INDEX IF NOT EXISTS idx_external_mappings_user_id ON public.external_source_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_external_mappings_source_id ON public.external_source_mappings(source_id);
CREATE INDEX IF NOT EXISTS idx_external_sync_queue_user ON public.external_sync_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_external_sync_queue_status ON public.external_sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_external_sync_logs_user ON public.external_sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_external_sync_logs_direction_success ON public.external_sync_logs(direction, success);
