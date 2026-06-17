-- =========================================================
-- ETAPA 7: CENTRO DE OPERAÇÕES MULTICLIENTES - MIGRAÇÕES SQL
-- =========================================================

-- 1. ADICIONAR COLUNAS DE IDENTIDADE VISUAL EM EXTERNAL_SOURCES
ALTER TABLE public.external_sources ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.external_sources ADD COLUMN IF NOT EXISTS company_color TEXT;
ALTER TABLE public.external_sources ADD COLUMN IF NOT EXISTS company_icon TEXT;
ALTER TABLE public.external_sources ADD COLUMN IF NOT EXISTS company_type TEXT;
ALTER TABLE public.external_sources ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.external_sources ADD COLUMN IF NOT EXISTS active_projects_count INTEGER DEFAULT 0;

-- 2. ADICIONAR COLUNAS DE PRIORIZAÇÃO E PRAZO EM EXTERNAL_TASKS
ALTER TABLE public.external_tasks ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 3; -- 1: Urgent, 2: High, 3: Medium, 4: Low
ALTER TABLE public.external_tasks ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE;

-- 3. ADICIONAR COLUNAS DE PREPARAÇÃO DA COOPERAÇÃO BILATERAL MULTI-PROJETOS (ETAPA 8)
ALTER TABLE public.external_tasks ADD COLUMN IF NOT EXISTS external_project_id TEXT;
ALTER TABLE public.external_tasks ADD COLUMN IF NOT EXISTS external_project_name TEXT;
ALTER TABLE public.external_tasks ADD COLUMN IF NOT EXISTS external_phase_id TEXT;
ALTER TABLE public.external_tasks ADD COLUMN IF NOT EXISTS external_phase_name TEXT;
ALTER TABLE public.external_tasks ADD COLUMN IF NOT EXISTS external_kanban_column TEXT;

-- 4. CRIAR ÍNDICES DE DESEMPENHO NO ACESSO DO COCKPIT MULTICLIENTES
CREATE INDEX IF NOT EXISTS idx_external_tasks_priority ON public.external_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_external_tasks_due_date ON public.external_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_external_tasks_project_id ON public.external_tasks(external_project_id);

-- 5. VALIDAÇÃO DOS LOGARDS DA ETAPA 6 - ÍNDICE DE ANÁLISE DE HISTÓRICO
CREATE INDEX IF NOT EXISTS idx_external_sync_logs_direction_success ON public.external_sync_logs(direction, success);
