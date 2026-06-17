-- TABELA DE FILA DE REENVIO (Rule 7)
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

-- TABELA DE REGISTRO DE LOGS DE SINCRONIZAÇÃO (Rule 9)
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

-- ADICIONAR COLUNAS DE PROTEÇÃO ANTI-LOOP EM EXTERNAL_TASKS (Rule 6)
ALTER TABLE public.external_tasks ADD COLUMN IF NOT EXISTS last_sync_direction TEXT DEFAULT 'PULL';
ALTER TABLE public.external_tasks ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW());

-- Habilitar RLS se necessário
ALTER TABLE public.external_sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_sync_logs ENABLE ROW LEVEL SECURITY;

-- Criar políticas simples para usuários administrarem seus próprios dados
DROP POLICY IF EXISTS "Users can manage their own sync queue" ON public.external_sync_queue;
CREATE POLICY "Users can manage their own sync queue" ON public.external_sync_queue
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own sync logs" ON public.external_sync_logs;
CREATE POLICY "Users can manage their own sync logs" ON public.external_sync_logs
    FOR ALL USING (auth.uid() = user_id);

-- Criar índices para performance de buscas da fila
CREATE INDEX IF NOT EXISTS idx_external_sync_queue_user ON public.external_sync_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_external_sync_queue_status ON public.external_sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_external_sync_logs_user ON public.external_sync_logs(user_id);
