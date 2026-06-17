import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Sessão expirada ou não autorizada.' }, { status: 401 });
    }

    // 2. Fetch active external sources for this user
    const { data: sources, error: sourcesError } = await supabase
      .from('external_sources')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true);

    if (sourcesError) {
      console.error('Error fetching external sources:', sourcesError);
      return NextResponse.json({ error: `Falha ao carregar fontes externas: ${sourcesError.message}` }, { status: 500 });
    }

    const report = {
      totalSources: sources?.length || 0,
      successful: 0,
      failed: 0,
      details: [] as Array<{ name: string; status: 'success' | 'error'; message: string; tasksSynced?: number }>,
    };

    if (!sources || sources.length === 0) {
      return NextResponse.json({ 
        message: 'Nenhuma fonte externa ativa encontrada para sincronizar.', 
        report 
      }, { status: 200 });
    }

    // 3. Sync each source independently
    for (const source of sources) {
      try {
        const alias = source.secret_alias;
        if (!alias) {
          throw new Error(`O alias de configuração não foi informado para a fonte externa '${source.name}'.`);
        }

        const url = process.env[`${alias}_SUPABASE_URL`];
        const key = process.env[`${alias}_SUPABASE_KEY`];

        if (!url || !key) {
          throw new Error(`Credenciais do Supabase não configuradas no ambiente para o alias '${alias}' da fonte '${source.name}'. Certifique-se de configurar ${alias}_SUPABASE_URL e ${alias}_SUPABASE_KEY.`);
        }

        // Create an isolated and temporary client
        const externalClient = createSupabaseClient(
          url,
          key,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
            },
          }
        );

        // Fetch corresponding mapping first (ETAPA 4)
        const { data: mapping, error: mappingError } = await supabase
          .from('external_source_mappings')
          .select('*')
          .eq('source_id', source.id)
          .eq('active', true)
          .maybeSingle();

        if (mappingError) {
          throw new Error(`Erro ao verificar mapeamento: ${mappingError.message}`);
        }

        if (!mapping) {
          throw new Error(`Fonte ${source.name} ignorada: mapeamento não configurado.`);
        }

        // Fetch external tasks (Dynamic target table via source.metadata, defaulting to 'tasks')
        const externalTableName = (source.metadata as any)?.external_table_name || 'tasks';
        const { data: externalTasks, error: taskError } = await externalClient
          .from(externalTableName)
          .select('*');

        if (taskError) {
          throw new Error(`Erro buscando tarefas do cliente na tabela '${externalTableName}': ${taskError.message}`);
        }

        // Get existing logged external tasks for this source to identify deletions
        const { data: existingLocalSynced, error: existingError } = await supabase
          .from('external_tasks')
          .select('external_id, title, description, completed, last_sync_direction, last_sync_at')
          .eq('source_id', source.id);

        if (existingError) {
          throw new Error(`Erro ao checar sincronizados anteriores: ${existingError.message}`);
        }

        const externalTasksList = externalTasks || [];
        const fetchedIds = externalTasksList.map((t: any) => String(t.id));
        const nowTime = Date.now();

        // Normalize retrieved tasks including dynamic mapping targets
        const normalizedTasks = externalTasksList.map((extTask: any) => {
          const extIdStr = String(extTask.id);
          const localMatch = (existingLocalSynced || []).find((loc: any) => String(loc.external_id) === extIdStr);
          
          let localTitle = extTask.title || 'Sem título';
          let localDescription = extTask.description || '';
          let localCompleted = extTask.completed !== undefined ? !!extTask.completed : (extTask.is_completed !== undefined ? !!extTask.is_completed : false);
          let direction = 'PULL';
          let syncAt = new Date().toISOString();

          if (localMatch) {
            const lastSyncAtTime = localMatch.last_sync_at ? new Date(localMatch.last_sync_at).getTime() : 0;
            const isRecentPush = localMatch.last_sync_direction === 'PUSH' && (nowTime - lastSyncAtTime < 15000);
            
            if (isRecentPush) {
              // PREVENT INFINITE LOOP: Maintain local values to prevent immediate overwrite from remote pull
              localTitle = localMatch.title || 'Sem título';
              localDescription = localMatch.description || '';
              localCompleted = !!localMatch.completed;
              direction = 'PUSH'; // keep PUSH flag to preserve temporal block
              syncAt = localMatch.last_sync_at;
            }
          }

          return {
            user_id: user.id,
            source_id: source.id,
            source_name: source.name,
            external_id: extIdStr,
            title: localTitle,
            description: localDescription,
            completed: localCompleted,
            active: true,
            mapped_group_id: mapping.target_group_id,
            mapped_category_id: mapping.target_category_id,
            mapped_block_id: mapping.default_block_id,
            last_sync_direction: direction,
            last_sync_at: syncAt,
            metadata: {
              ...extTask,
              origId: extTask.id,
              syncedAt: new Date().toISOString()
            },
          };
        });

        // Execute dynamic UPSERT
        if (normalizedTasks.length > 0) {
          const { error: upsertError } = await supabase
            .from('external_tasks')
            .upsert(normalizedTasks, { onConflict: 'source_id,external_id' });

          if (upsertError) {
            throw new Error(`Falha no upsert local: ${upsertError.message}`);
          }
        }

        // Determine removed tasks (exist locally for the source, but not in current fetch)
        const localMatched = existingLocalSynced || [];
        const removedIds = localMatched
          .filter((loc: any) => !fetchedIds.includes(String(loc.external_id)))
          .map((loc: any) => loc.external_id);

        if (removedIds.length > 0) {
          const { error: deactivateError } = await supabase
            .from('external_tasks')
            .update({ active: false })
            .eq('source_id', source.id)
            .in('external_id', removedIds);

          if (deactivateError) {
            console.error(`Deactivation check warning for ${source.name}:`, deactivateError);
          }
        }

        // Update last synced meta
        await supabase
          .from('external_sources')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('id', source.id);

        // Keep database logs populated (Rule 9)
        await supabase.from('external_sync_logs').insert({
          user_id: user.id,
          source_id: source.id,
          direction: 'PULL',
          operation: 'UPDATE',
          success: true,
          message: `Sincronização PULL concluída com sucesso. Processadas: ${normalizedTasks.length} tarefas.`,
          created_at: new Date().toISOString()
        });

        report.successful++;
        report.details.push({
          name: source.name,
          status: 'success',
          message: `Sincronizado com sucesso. ${normalizedTasks.length} tarefas processadas.`,
          tasksSynced: normalizedTasks.length,
        });

      } catch (innerError: any) {
        console.error(`Sync failure for source: ${source.name}`, innerError);
        // Log failure (Rule 9)
        try {
          await supabase.from('external_sync_logs').insert({
            user_id: user.id,
            source_id: source.id,
            direction: 'PULL',
            operation: 'UPDATE',
            success: false,
            message: `Falha no PULL: ${innerError?.message || 'Erro desconhecido'}`,
            created_at: new Date().toISOString()
          });
        } catch (logErr) {
          console.error('Error saving sync pull log:', logErr);
        }

        report.failed++;
        report.details.push({
          name: source.name,
          status: 'error',
          message: innerError?.message || 'Erro desconhecido na sincronização.',
        });
      }
    }

    return NextResponse.json({
      message: 'Sincronização processada.',
      report,
    }, { status: 200 });

  } catch (error: any) {
    console.error('Critical sync exception:', error);
    return NextResponse.json({ error: error?.message || 'Erro interno de processamento.' }, { status: 500 });
  }
}
